from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)

# Weights must sum to 1.0
WEIGHTS = {
    "feature_verification": 0.35,
    "architecture_quality": 0.20,
    "code_quality": 0.15,
    "security_quality": 0.15,
    "authenticity": 0.15,
}

RECOMMENDATIONS = [
    (90, "Proceed to Technical Interview — Exceptional Candidate"),
    (75, "Proceed to Technical Interview"),
    (60, "Consider Technical Interview with Caution"),
    (45, "Requires Further Verification"),
    (0, "Do Not Proceed — Significant Concerns"),
]

RISK_THRESHOLDS = [
    (70, "LOW"),
    (50, "MEDIUM"),
    (0, "HIGH"),
]


@dataclass
class ScoreBreakdown:
    feature_verification_score: float
    architecture_score: float
    code_quality_score: float
    security_score: float
    authenticity_score: float
    trust_score: float
    recommendation: str
    risk_level: str


class ScoringEngine:
    def compute(
        self,
        claim_results: list[dict],
        ast_data: dict,
        repo_metadata: dict,
        authenticity_result: dict,
    ) -> ScoreBreakdown:
        feat = self._feature_score(claim_results)
        arch = self._architecture_score(ast_data, repo_metadata)
        quality = self._code_quality_score(ast_data, repo_metadata)
        security = self._security_score(ast_data, repo_metadata)
        auth = float(authenticity_result.get("authenticityScore", 50))

        trust = (
            feat * WEIGHTS["feature_verification"]
            + arch * WEIGHTS["architecture_quality"]
            + quality * WEIGHTS["code_quality"]
            + security * WEIGHTS["security_quality"]
            + auth * WEIGHTS["authenticity"]
        )
        trust = round(max(0.0, min(100.0, trust)), 1)
        recommendation = self._recommendation(trust)
        risk_level = self._risk_level(trust)

        logger.info(
            "scores_computed",
            feature=feat, architecture=arch, quality=quality,
            security=security, authenticity=auth, trust=trust,
        )
        return ScoreBreakdown(
            feature_verification_score=round(feat, 1),
            architecture_score=round(arch, 1),
            code_quality_score=round(quality, 1),
            security_score=round(security, 1),
            authenticity_score=round(auth, 1),
            trust_score=trust,
            recommendation=recommendation,
            risk_level=risk_level,
        )

    # ── Sub-scores ────────────────────────────────────────────────────────────

    def _feature_score(self, claim_results: list[dict]) -> float:
        if not claim_results:
            return 0.0
        total = 0.0
        for r in claim_results:
            if r.get("verified"):
                # Depth bonus: shallow=0.7x, moderate=0.85x, deep=1.0x
                depth_mult = {"none": 0.0, "shallow": 0.7, "moderate": 0.85, "deep": 1.0}.get(
                    r.get("depth", "shallow"), 0.7
                )
                total += r.get("confidence", 50) * depth_mult
        return min(100.0, total / len(claim_results))

    def _architecture_score(self, ast: dict, repo: dict) -> float:
        score = 0.0

        # Layered architecture: controllers + services + models
        if ast.get("controllers"):
            score += 25
        if ast.get("services"):
            score += 25
        if ast.get("models"):
            score += 20

        # Routes imply working API surface
        route_count = len(ast.get("routes", []))
        score += min(15, route_count * 2)

        # Infrastructure
        if repo.get("hasDockerfile"):
            score += 5
        if repo.get("hasCi"):
            score += 10

        return min(100.0, score)

    def _code_quality_score(self, ast: dict, repo: dict) -> float:
        score = 0.0
        max_score = 100.0

        fn_count = len(ast.get("functions", []))
        score += min(25, fn_count * 1.5)

        class_count = len(ast.get("classes", []))
        score += min(20, class_count * 4)

        # Tests signal quality culture
        if repo.get("hasTests"):
            score += 20

        # Maturity indicators
        maturity = len(repo.get("maturityIndicators", []))
        score += min(20, maturity * 4)

        # Middleware usage shows awareness of cross-cutting concerns
        mw_count = len(ast.get("middleware", []))
        score += min(15, mw_count * 5)

        return min(100.0, score)

    def _security_score(self, ast: dict, repo: dict) -> float:
        score = 0.0
        imports_str = " ".join(ast.get("imports", [])).lower()

        security_libs = [
            ("bcrypt", 15), ("argon2", 15), ("passlib", 15),
            ("jwt", 20), ("jose", 20), ("cryptography", 15),
            ("helmet", 10), ("cors", 10), ("csrf", 10),
            ("dotenv", 10), ("python-dotenv", 10),
        ]
        for lib, pts in security_libs:
            if lib in imports_str:
                score += pts

        # Auth middleware
        if ast.get("middleware"):
            score += 15

        return min(100.0, score)

    def _recommendation(self, trust: float) -> str:
        for threshold, label in RECOMMENDATIONS:
            if trust >= threshold:
                return label
        return "Do Not Proceed"

    def _risk_level(self, trust: float) -> str:
        for threshold, level in RISK_THRESHOLDS:
            if trust >= threshold:
                return level
        return "HIGH"
