"""
Node 8 — Report Generation
Assembles the final structured report from all upstream node outputs.
"""

from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.report_service import ReportService

logger = structlog.get_logger(__name__)


async def generate_report_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_generate_report", analysis_id=state["analysis_id"])

    from app.services.scoring_engine import ScoringEngine, ScoreBreakdown

    # Reconstruct ScoreBreakdown from state (avoids re-computation)
    scores = state.get("scores", {})
    breakdown = ScoreBreakdown(
        feature_verification_score=scores.get("featureVerification", 0.0),
        architecture_score=scores.get("architectureQuality", 0.0),
        code_quality_score=scores.get("codeQuality", 0.0),
        security_score=scores.get("securityQuality", 0.0),
        authenticity_score=scores.get("authenticity", 0.0),
        trust_score=state.get("trust_score", 0.0),
        recommendation=state.get("recommendation", ""),
        risk_level=state.get("risk_level", "MEDIUM"),
    )

    service = ReportService()
    report = service.build(
        analysis_id=state["analysis_id"],
        candidate_id=state["candidate_id"],
        github_url=state["github_url"],
        claim_results=state.get("verification_results", []),
        repo_metadata=state.get("repo_metadata", {}),
        ast_data=state.get("ast_data", {}),
        authenticity_result=state.get("authenticity_result", {}),
        scores=breakdown,
        processing_time=0.0,  # will be updated by worker
        default_branch=state.get("default_branch", "main"),
    )

    return {"report": report, "errors": []}
