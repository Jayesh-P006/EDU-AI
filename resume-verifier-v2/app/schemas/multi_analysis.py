"""
Schemas for multi-project / resume-based discovery workflow.
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Self
from datetime import datetime


# ── Request ───────────────────────────────────────────────────────────────────

class ResumeAnalyzeRequest(BaseModel):
    candidateId: str = Field(..., min_length=1, max_length=255)
    resumeText: str = Field(..., min_length=50, description="Plain text extracted from resume")
    linkedinUrl: Optional[str] = None
    portfolioUrl: Optional[str] = None


# ── Discovery Result ──────────────────────────────────────────────────────────

class DiscoveredProject(BaseModel):
    name: str
    githubUrl: str
    confidence: float = Field(ge=0.0, le=1.0)
    source: str = "explicit_url"


class ResumeDiscoveryResponse(BaseModel):
    candidateId: str
    projectsFound: int
    projects: List[DiscoveredProject]
    technologies: List[str] = []
    message: str


# ── Batch Analysis ────────────────────────────────────────────────────────────

class BatchAnalyzeRequest(BaseModel):
    candidateId: str = Field(..., min_length=1)
    resumeText: str = Field(..., min_length=50)
    projects: List[DiscoveredProject]


class ProjectAnalysisJob(BaseModel):
    projectName: str
    githubUrl: str
    analysisId: str
    status: str = "queued"


class BatchAnalyzeResponse(BaseModel):
    candidateId: str
    groupId: str
    totalProjects: int
    jobs: List[ProjectAnalysisJob]
    message: str


# ── Group Status ──────────────────────────────────────────────────────────────

class ClaimVerificationItem(BaseModel):
    claim: str
    status: str              # "verified" | "partial" | "failed"
    confidence: float
    reasoning: str = ""
    evidence: List[Dict[str, Any]] = []


class ProjectStatus(BaseModel):
    analysisId: str
    projectName: str
    githubUrl: str
    status: str  # queued | processing | completed | failed
    trustScore: Optional[float] = None
    authenticityScore: Optional[float] = None
    architectureScore: Optional[float] = None
    riskLevel: Optional[str] = None
    claimsVerified: Optional[int] = None
    totalClaims: Optional[int] = None
    errorMessage: Optional[str] = None
    # Detailed claim results — shown in the evidence drawer
    claimVerification: List[ClaimVerificationItem] = []
    # Repo metadata — shown in the drawer
    languages: Dict[str, Any] = {}
    technologies: List[str] = []
    files: Optional[int] = None
    linesOfCode: Optional[int] = None
    commitCount: Optional[int] = None
    # Frontend-friendly aliases (MultiProjectDashboard uses project.name / project.id)
    id: str = ""
    name: str = ""

    @model_validator(mode="after")
    def _fill_aliases(self) -> "ProjectStatus":
        if not self.id:
            self.id = self.analysisId
        if not self.name:
            self.name = self.projectName
        return self


class AggregatedScores(BaseModel):
    overallTrustScore: float
    authenticityScore: float
    riskLevel: str
    recommendation: str
    projectCount: int
    verifiedCount: int


class GroupStatusResponse(BaseModel):
    groupId: str
    candidateId: str
    candidateName: str = ""
    appliedRole: str = ""
    totalProjects: int
    completedProjects: int
    failedProjects: int
    pendingProjects: int
    overallStatus: str  # pending | in_progress | completed | partial_failure
    projects: List[ProjectStatus]
    aggregated: Optional[AggregatedScores] = None
    aggregatedSkills: List[str] = []
    createdAt: datetime
    updatedAt: datetime


# ── Resume-to-Report (combined flow) ─────────────────────────────────────────

class ResumeToReportRequest(BaseModel):
    """
    One-shot endpoint: upload resume text → auto-discover repos
    → dispatch parallel analysis → return groupId for polling.
    """
    candidateId: str = Field(..., min_length=1)
    resumeText: str = Field(..., min_length=50)
    linkedinUrl: Optional[str] = None
    portfolioUrl: Optional[str] = None
    githubProfile: Optional[str] = Field(None, description="GitHub username or profile URL for API fallback when PDF links are not plain text")


class ResumeToReportResponse(BaseModel):
    candidateId: str
    groupId: str
    projectsDiscovered: int
    projectsQueued: int
    discoveredProjects: List[DiscoveredProject]
    pollUrl: str
    message: str
