"""
Node 7 — Trust Score Calculation
Aggregates all sub-scores into a single weighted trust score.

Weights:
  Feature Verification  35%
  Architecture Quality  20%
  Code Quality          15%
  Security Quality      15%
  Authenticity          15%
"""

from typing import Any
import structlog

from app.graph.state import AnalysisState
from app.services.scoring_engine import ScoringEngine

logger = structlog.get_logger(__name__)


async def score_node(state: AnalysisState) -> dict[str, Any]:
    logger.info("node_score", analysis_id=state["analysis_id"])

    engine = ScoringEngine()
    breakdown = engine.compute(
        claim_results=state.get("verification_results", []),
        ast_data=state.get("ast_data", {}),
        repo_metadata=state.get("repo_metadata", {}),
        authenticity_result=state.get("authenticity_result", {}),
    )

    scores = {
        "featureVerification": breakdown.feature_verification_score,
        "architectureQuality": breakdown.architecture_score,
        "codeQuality": breakdown.code_quality_score,
        "securityQuality": breakdown.security_score,
        "authenticity": breakdown.authenticity_score,
    }

    return {
        "scores": scores,
        "trust_score": breakdown.trust_score,
        "recommendation": breakdown.recommendation,
        "risk_level": breakdown.risk_level,
        "errors": [],
    }
