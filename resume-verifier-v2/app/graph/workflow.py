"""
LangGraph Workflow — the central orchestration graph.
Each node is an async function that receives AnalysisState and returns partial updates.
The graph is compiled once and reused across Celery tasks.
"""

from functools import lru_cache
from typing import Any

from langgraph.graph import StateGraph, START, END
import structlog

from app.graph.state import AnalysisState
from app.graph.nodes import (
    extract_claims_node,
    download_repo_node,
    scan_repo_node,
    ast_analysis_node,
    verify_claims_node,
    authenticity_node,
    score_node,
    generate_report_node,
)

logger = structlog.get_logger(__name__)


def _should_continue_after_download(state: AnalysisState) -> str:
    """
    Route after download: if download failed, skip analysis nodes and
    go directly to authenticity (which handles missing repo gracefully)
    then to scoring and report generation.
    """
    if not state.get("repo_path"):
        logger.warning("download_failed_routing_to_score", analysis_id=state["analysis_id"])
        return "authenticity"
    return "scan_repo"


def _build_graph() -> StateGraph:
    builder = StateGraph(AnalysisState)

    # Register all nodes
    builder.add_node("extract_claims", extract_claims_node)
    builder.add_node("download_repo", download_repo_node)
    builder.add_node("scan_repo", scan_repo_node)
    builder.add_node("ast_analysis", ast_analysis_node)
    builder.add_node("verify_claims", verify_claims_node)
    builder.add_node("authenticity", authenticity_node)
    builder.add_node("score", score_node)
    builder.add_node("generate_report", generate_report_node)

    # Happy path edges
    builder.add_edge(START, "extract_claims")
    builder.add_edge("extract_claims", "download_repo")

    # Conditional: skip scan/AST if download failed
    builder.add_conditional_edges(
        "download_repo",
        _should_continue_after_download,
        {
            "scan_repo": "scan_repo",
            "authenticity": "authenticity",
        },
    )

    builder.add_edge("scan_repo", "ast_analysis")
    builder.add_edge("ast_analysis", "verify_claims")
    builder.add_edge("verify_claims", "authenticity")
    builder.add_edge("authenticity", "score")
    builder.add_edge("score", "generate_report")
    builder.add_edge("generate_report", END)

    return builder


@lru_cache(maxsize=1)
def get_compiled_workflow():
    """Compiled LangGraph workflow — cached so it's built only once per process."""
    graph = _build_graph().compile()
    logger.info("langgraph_workflow_compiled")
    return graph


async def run_workflow(initial_state: dict[str, Any]) -> AnalysisState:
    """
    Execute the full analysis workflow for one candidate.
    Returns the final state after all nodes have run.
    """
    workflow = get_compiled_workflow()
    logger.info(
        "workflow_started",
        analysis_id=initial_state.get("analysis_id"),
        candidate_id=initial_state.get("candidate_id"),
    )
    final_state: AnalysisState = await workflow.ainvoke(initial_state)  # type: ignore[assignment]
    logger.info(
        "workflow_completed",
        analysis_id=initial_state.get("analysis_id"),
        trust_score=final_state.get("trust_score"),
        errors=len(final_state.get("errors", [])),
    )
    return final_state
