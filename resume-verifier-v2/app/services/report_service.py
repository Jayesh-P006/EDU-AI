from datetime import datetime, timezone
from typing import Any
import structlog

logger = structlog.get_logger(__name__)


class ReportService:
    def build(
        self,
        analysis_id: str,
        candidate_id: str,
        github_url: str,
        claim_results: list[dict],
        repo_metadata: dict,
        ast_data: dict,
        authenticity_result: dict,
        scores,
        processing_time: float,
        default_branch: str = "main",
    ) -> dict[str, Any]:
        verified = [r for r in claim_results if r.get("verified")]
        missing = [r["claim"] for r in claim_results if not r.get("verified")]

        repository_summary = {
            "githubUrl": github_url,
            "defaultBranch": default_branch,
            "fileCount": repo_metadata.get("fileCount", 0),
            "folderCount": repo_metadata.get("folderCount", 0),
            "totalSizeMB": round(repo_metadata.get("totalSizeBytes", 0) / 1024 / 1024, 2),
            "languages": repo_metadata.get("languages", {}),
            "frameworks": repo_metadata.get("frameworks", []),
            "dependencies": repo_metadata.get("dependencies", {}),
            "hasDockerfile": repo_metadata.get("hasDockerfile", False),
            "hasDockerCompose": repo_metadata.get("hasDockerCompose", False),
            "hasTests": repo_metadata.get("hasTests", False),
            "hasReadme": repo_metadata.get("hasReadme", False),
            "hasCi": repo_metadata.get("hasCi", False),
            "maturityIndicators": repo_metadata.get("maturityIndicators", []),
        }

        report = {
            "analysisId": analysis_id,
            "candidateId": candidate_id,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "processingTimeSeconds": round(processing_time, 2),
            "repositorySummary": repository_summary,
            "verifiedClaims": verified,
            "missingClaims": missing,
            "trustScore": scores.trust_score,
            "qualityScore": scores.code_quality_score,
            "architectureScore": scores.architecture_score,
            "securityScore": scores.security_score,
            "featureVerificationScore": scores.feature_verification_score,
            "authenticityScore": scores.authenticity_score,
            "recommendation": scores.recommendation,
            "riskLevel": scores.risk_level,
            "authenticityReasoning": authenticity_result.get("reasoning", []),
            "authenticityIndicators": authenticity_result.get("indicators", {}),
            "codeMetrics": {
                "functionCount": len(ast_data.get("functions", [])),
                "classCount": len(ast_data.get("classes", [])),
                "routeCount": len(ast_data.get("routes", [])),
                "serviceCount": len(ast_data.get("services", [])),
                "controllerCount": len(ast_data.get("controllers", [])),
                "modelCount": len(ast_data.get("models", [])),
                "middlewareCount": len(ast_data.get("middleware", [])),
            },
        }

        logger.info(
            "report_built",
            analysis_id=analysis_id,
            trust_score=scores.trust_score,
            recommendation=scores.recommendation,
            verified=len(verified),
            missing=len(missing),
        )
        return report
