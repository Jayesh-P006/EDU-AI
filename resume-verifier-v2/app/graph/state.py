from typing import TypedDict, Annotated, Any, Optional
import operator


class AnalysisState(TypedDict):
    # Identity
    analysis_id: str
    candidate_id: str
    github_url: str
    resume_text: str

    # Node 1 output: extracted claims
    claims: list[str]

    # Node 2 output: downloaded repo
    repo_path: str          # path to repo root inside temp dir
    temp_dir: str           # parent temp dir — cleaned up by worker
    default_branch: str
    commit_count: Optional[int]

    # Node 3 output: repo scan
    repo_metadata: dict[str, Any]

    # Node 4 output: AST analysis
    ast_data: dict[str, Any]

    # Node 5 output: per-claim verification
    verification_results: list[dict[str, Any]]

    # Node 6 output: authenticity
    authenticity_result: dict[str, Any]

    # Node 7 output: scores
    scores: dict[str, float]
    trust_score: float
    recommendation: str
    risk_level: str

    # Node 8 output: final report
    report: dict[str, Any]

    # Accumulated errors across nodes — appended via Annotated[list, operator.add]
    errors: Annotated[list[str], operator.add]
