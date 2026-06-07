"""
GitHub project discovery service.
Extracts GitHub repository URLs and project references from resume text.
"""
import re
from typing import List, Dict, Optional
from dataclasses import dataclass

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Matches github.com/owner/repo with optional scheme/www, optional .git suffix,
# and an optional trailing slash. The scheme is OPTIONAL because resumes very
# commonly write bare "github.com/owner/repo" without "https://".
# A negative lookbehind keeps us from matching mid-word (e.g. "notgithub.com/...").
# Uses a LOOKAHEAD so the terminator is not consumed (avoids swallowing \n
# between URLs and prevents profile-URL shadow-matches from eating repo paths).
# re.MULTILINE makes $ match end-of-line, not just end-of-string.
_REPO_RE = re.compile(
    r'(?<![\w./-])'                            # don't start mid-word/mid-path
    r'(?:https?://)?(?:www\.)?github\.com'
    r'/([A-Za-z0-9][A-Za-z0-9._-]*)'        # owner (greedy — stops at /)
    r'/([A-Za-z0-9_][A-Za-z0-9._-]*?)'       # repo  (non-greedy)
    r'(?:\.git)?/?'                            # optional .git suffix and/or trailing slash
    r'(?=[\s,;)\'"<>\[\]#?\\|/]|$)',          # lookahead boundary — NOT consumed
    re.IGNORECASE | re.MULTILINE,
)

# Matches github.com/user — used only for profile-API fallback
_PROFILE_RE = re.compile(
    r'(?<![\w./-])'
    r'(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9][A-Za-z0-9._-]{0,37})'
    r'(?=[\s,;)\'"<>\[\]/]|$)',
    re.IGNORECASE | re.MULTILINE,
)

_GITHUB_RESERVED = {
    'topics', 'trending', 'explore', 'marketplace', 'features', 'enterprise',
    'about', 'blog', 'pricing', 'careers', 'settings', 'notifications',
    'pulls', 'issues', 'wiki', 'security', 'insights', 'actions', 'projects',
    'packages', 'releases', 'commits', 'branches', 'tags', 'network', 'forks',
    'stargazers', 'watchers', 'login', 'join', 'new', 'import', 'organizations',
}


@dataclass
class DiscoveredProject:
    name: str
    github_url: str
    confidence: float  # 0.0–1.0
    source: str        # 'explicit_url' | 'github_profile'


def extract_github_repos(text: str) -> List[DiscoveredProject]:
    """
    Extract all GitHub repository URLs from resume text.
    Returns de-duplicated list in discovery order (first occurrence wins).
    """
    found: Dict[str, DiscoveredProject] = {}

    for m in _REPO_RE.finditer(text):
        owner = m.group(1).rstrip('.')
        repo  = m.group(2).rstrip('.')

        if not owner or not repo:
            continue
        if owner.lower() in _GITHUB_RESERVED or repo.lower() in _GITHUB_RESERVED:
            continue

        url = f"https://github.com/{owner}/{repo}"
        if url not in found:
            found[url] = DiscoveredProject(
                name=_humanize_repo_name(repo),
                github_url=url,
                confidence=0.95,
                source='explicit_url',
            )

    results = list(found.values())
    logger.info(
        "github_discovery_complete",
        text_length=len(text),
        repos_found=len(results),
        urls=[r.github_url for r in results],
    )
    return results


def extract_github_profile_usernames(text: str, extra_url: Optional[str] = None) -> List[str]:
    """
    Return distinct GitHub usernames found in text.
    Only returns profile-level matches (no repo path).
    """
    # First collect all repo owners so we can skip them as bare profile hits
    repo_owners = {m.group(1).lower() for m in _REPO_RE.finditer(text)}

    seen: set = set()
    usernames: List[str] = []
    sources = [text] + ([extra_url] if extra_url else [])

    for source in sources:
        if not source:
            continue
        for m in _PROFILE_RE.finditer(source):
            username = m.group(1).rstrip('.')
            key = username.lower()
            if key in _GITHUB_RESERVED or key in seen:
                continue
            # Only add as a profile username if no repo path follows
            # (i.e. the full match doesn't contain a second path segment)
            full_match = m.group(0)
            if '/' in full_match.replace('https://github.com/', '').replace('github.com/', ''):
                continue
            seen.add(key)
            usernames.append(username)

    return usernames


async def fetch_repos_from_profile(
    username: str,
    token: Optional[str] = None,
    max_repos: int = 10,
) -> List[DiscoveredProject]:
    """
    Fetch the most-recently-updated public non-fork repos for a GitHub user.
    Used as fallback when no explicit repo URLs are found in the resume.
    """
    headers = {"User-Agent": "resume-verifier/2.0", "Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.github.com/users/{username}/repos",
                headers=headers,
                params={"per_page": 30, "sort": "updated", "type": "public"},
            )

        if resp.status_code != 200:
            logger.warning("github_api_profile_failed", username=username, status=resp.status_code)
            return []

        results: List[DiscoveredProject] = []
        for repo in resp.json():
            if repo.get("fork"):
                continue
            results.append(DiscoveredProject(
                name=_humanize_repo_name(repo["name"]),
                github_url=repo["html_url"],
                confidence=0.70,
                source="github_profile",
            ))
            if len(results) >= max_repos:
                break

        logger.info("github_profile_repos_fetched", username=username, repos_found=len(results))
        return results

    except Exception as exc:
        logger.warning("github_profile_fetch_error", username=username, error=str(exc))
        return []


def extract_resume_metadata(text: str) -> Dict:
    """Extract high-level metadata: skills, technologies, links."""
    emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
    linkedin_urls = re.findall(
        r'https?://(?:www\.)?linkedin\.com/in/[\w\-]+/?',
        text, re.IGNORECASE,
    )

    TECH_KEYWORDS = {
        'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'C#',
        'React', 'Vue', 'Angular', 'Next.js', 'FastAPI', 'Django', 'Flask', 'Spring',
        'Node.js', 'Express', 'NestJS', 'Laravel', 'Rails',
        'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
        'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform',
        'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ',
        'JWT', 'OAuth', 'WebSocket', 'Socket.io',
        'React Native', 'Flutter', 'Swift', 'Kotlin',
        'TensorFlow', 'PyTorch', 'scikit-learn', 'pandas', 'NumPy',
        'LangChain', 'LangGraph', 'Playwright', 'Selenium', 'WebRTC',
        'Prisma', 'SQLAlchemy', 'Razorpay', 'Stripe', 'Mediasoup',
    }
    found_techs = {
        tech for tech in TECH_KEYWORDS
        if re.search(r'\b' + re.escape(tech) + r'\b', text, re.IGNORECASE)
    }

    return {
        'email': emails[0] if emails else None,
        'linkedinUrl': linkedin_urls[0] if linkedin_urls else None,
        'technologies': sorted(found_techs),
        'githubRepos': [
            {'name': p.name, 'githubUrl': p.github_url, 'confidence': p.confidence}
            for p in extract_github_repos(text)
        ],
    }


def _humanize_repo_name(repo: str) -> str:
    return re.sub(r'[-_]+', ' ', repo).title()
