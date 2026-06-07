from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, List
from datetime import datetime


class AnalyzeRequest(BaseModel):
    candidateId: str = Field(..., min_length=1, max_length=255)
    githubUrl: Optional[str] = Field(None, description="GitHub repository URL — auto-extracted from resumeText if omitted")
    resumeText: str = Field(..., min_length=10)

    @field_validator("githubUrl")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().rstrip("/")
        if v.endswith(".git"):
            v = v[:-4]
        if not v.startswith("https://github.com/"):
            raise ValueError("Must be a valid GitHub repository URL (https://github.com/owner/repo)")
        parts = v.replace("https://github.com/", "").split("/")
        if len(parts) < 2 or not all(parts[:2]):
            raise ValueError("URL must specify owner and repository name")
        return v


class AnalyzeResponse(BaseModel):
    analysisId: str
    status: str
    message: str = "Analysis queued successfully"


class AnalysisStatusResponse(BaseModel):
    analysisId: str
    candidateId: str
    status: str
    trustScore: Optional[float] = None
    recommendation: Optional[str] = None
    riskLevel: Optional[str] = None
    errorMessage: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class EvidenceItem(BaseModel):
    file: str
    line: Optional[int] = None
    snippet: Optional[str] = None
    reason: str


class ClaimVerificationResult(BaseModel):
    claim: str
    verified: bool
    confidence: float = Field(..., ge=0, le=100)
    depth: str = "none"
    reasoning: str = ""
    evidence: list[EvidenceItem] = []


class RepositorySummary(BaseModel):
    githubUrl: str
    defaultBranch: str
    fileCount: int = 0
    folderCount: int = 0
    totalSizeMB: float = 0.0
    languages: dict[str, Any] = {}
    frameworks: list[str] = []
    dependencies: dict[str, list[str]] = {}
    hasDockerfile: bool = False
    hasDockerCompose: bool = False
    hasTests: bool = False
    hasReadme: bool = False
    hasCi: bool = False
    maturityIndicators: list[str] = []


class CodeMetrics(BaseModel):
    functionCount: int = 0
    classCount: int = 0
    routeCount: int = 0
    serviceCount: int = 0
    controllerCount: int = 0
    modelCount: int = 0
    middlewareCount: int = 0


class AuthenticityIndicators(BaseModel):
    architectureDepth: str = "unknown"
    templateRisk: str = "unknown"
    featureCompleteness: str = "unknown"
    projectMaturity: str = "unknown"


class ScoreBreakdown(BaseModel):
    featureVerification: float = 0.0
    architecture: float = 0.0
    codeQuality: float = 0.0
    security: float = 0.0
    authenticity: float = 0.0
    weights: dict[str, float] = Field(default_factory=lambda: {
        "featureVerification": 0.35,
        "architecture": 0.20,
        "codeQuality": 0.15,
        "security": 0.15,
        "authenticity": 0.15,
    })


class ReportResponse(BaseModel):
    analysisId: str
    candidateId: str

    repositorySummary: Optional[RepositorySummary] = None

    # All claims with full evidence (verified + unverified)
    claimResults: list[ClaimVerificationResult] = []
    # Subset: only verified=True claims
    verifiedClaims: list[ClaimVerificationResult] = []
    # Quick list of unverified claim names
    missingClaims: list[str] = []

    # Score components
    trustScore: float = 0.0
    qualityScore: float = 0.0
    authenticityScore: float = 0.0
    architectureScore: float = 0.0
    securityScore: float = 0.0
    featureVerificationScore: float = 0.0
    scoreBreakdown: Optional[ScoreBreakdown] = None

    # Hiring recommendation
    recommendation: str = ""
    riskLevel: str = "MEDIUM"

    # Authenticity analysis detail
    authenticityReasoning: list[str] = []
    authenticityIndicators: Optional[AuthenticityIndicators] = None

    # Static code metrics
    codeMetrics: Optional[CodeMetrics] = None

    # Meta
    processingTimeSeconds: float = 0.0
    analysisErrors: list[str] = []
    createdAt: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    redis: str
    huggingface: str
    models: List[str] = []
    version: str = "2.0.0"
