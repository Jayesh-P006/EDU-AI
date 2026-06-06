import json
import traceback
from pathlib import Path
from typing import Any
import structlog

logger = structlog.get_logger(__name__)

LANGUAGE_EXTENSIONS: dict[str, str] = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".jsx": "JavaScript", ".tsx": "TypeScript", ".java": "Java",
    ".go": "Go", ".rs": "Rust", ".cs": "C#", ".cpp": "C++",
    ".c": "C", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".scala": "Scala", ".html": "HTML",
    ".css": "CSS", ".scss": "SCSS", ".sql": "SQL",
    ".sh": "Shell", ".yaml": "YAML", ".yml": "YAML",
    ".json": "JSON", ".toml": "TOML", ".md": "Markdown",
}

FRAMEWORK_SIGNALS: dict[str, list[str]] = {
    "React": ["react", "@types/react"],
    "Next.js": ["next"],
    "Vue.js": ["vue"],
    "Angular": ["@angular/core"],
    "Express.js": ["express"],
    "NestJS": ["@nestjs/core"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Prisma": ["prisma", "@prisma/client"],
    "TypeORM": ["typeorm"],
    "SQLAlchemy": ["sqlalchemy"],
    "Mongoose": ["mongoose"],
    "Celery": ["celery"],
    "Redis": ["redis", "ioredis"],
    "Socket.IO": ["socket.io"],
    "GraphQL": ["graphql", "apollo-server"],
    "LangChain": ["langchain"],
    "LangGraph": ["langgraph"],
    "OpenAI SDK": ["openai"],
    "Anthropic SDK": ["anthropic"],
    "Tailwind": ["tailwindcss"],
    "Stripe": ["stripe"],
    "Passport": ["passport"],
}

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    "venv", ".venv", "env", "dist", "build", ".next", ".nuxt",
    "coverage", ".mypy_cache", ".ruff_cache", ".tox",
}

# Files that indicate project sophistication
MATURITY_INDICATORS = [
    ".github/workflows", ".github/PULL_REQUEST_TEMPLATE",
    "CONTRIBUTING.md", "CHANGELOG.md", ".eslintrc",
    ".prettierrc", "jest.config", "tsconfig.json",
    ".pre-commit-config.yaml", "Makefile",
]


class RepositoryScanner:
    def __init__(self, repo_root: Path) -> None:
        self.root = repo_root

    def scan(self) -> dict[str, Any]:
        lang_counts: dict[str, int] = {}
        file_count = 0
        folder_count = 0
        total_size = 0
        dependencies: dict[str, list[str]] = {}
        frameworks: set[str] = set()
        maturity_indicators: list[str] = []

        has_dockerfile = False
        has_docker_compose = False
        has_readme = False
        has_tests = False
        has_ci = False

        for entry in self._walk():
            try:
                rel = str(entry.relative_to(self.root))

                if entry.is_dir():
                    folder_count += 1
                    continue

                file_count += 1
                total_size += entry.stat().st_size
                fname = entry.name.lower()
                ext = entry.suffix.lower()

                # Special file detection
                if fname == "dockerfile":
                    has_dockerfile = True
                if fname in ("docker-compose.yml", "docker-compose.yaml"):
                    has_docker_compose = True
                if fname == "readme.md":
                    has_readme = True
                if ".github/workflows" in rel.lower() or "jenkinsfile" in fname:
                    has_ci = True
                if (
                    ("test" in rel.lower() and ext in (".py", ".js", ".ts"))
                    or fname.startswith("test_")
                    or fname.endswith((".test.js", ".test.ts", ".spec.ts", ".spec.js", "_test.py"))
                ):
                    has_tests = True

                # Maturity indicators
                for indicator in MATURITY_INDICATORS:
                    if indicator.lower() in rel.lower():
                        maturity_indicators.append(indicator)

                lang = LANGUAGE_EXTENSIONS.get(ext)
                if lang:
                    lang_counts[lang] = lang_counts.get(lang, 0) + 1

                # Dependency files
                if fname == "package.json":
                    pkgs = self._parse_package_json(entry)
                    if isinstance(pkgs, list) and pkgs:
                        dependencies["npm"] = pkgs
                        for fw, signals in FRAMEWORK_SIGNALS.items():
                            if isinstance(signals, list) and any(
                                s.lower() in [p.lower() for p in pkgs if isinstance(p, str)]
                                for s in signals if isinstance(s, str)
                            ):
                                frameworks.add(fw)

                elif fname == "requirements.txt":
                    pkgs = self._parse_requirements_txt(entry)
                    if isinstance(pkgs, list) and pkgs:
                        existing = dependencies.get("pip", [])
                        dependencies["pip"] = list(dict.fromkeys(existing + pkgs))
                        for fw, signals in FRAMEWORK_SIGNALS.items():
                            if isinstance(signals, list) and any(
                                s.lower() in [p.lower() for p in pkgs if isinstance(p, str)]
                                for s in signals if isinstance(s, str)
                            ):
                                frameworks.add(fw)

                elif fname == "pyproject.toml":
                    pkgs = self._parse_pyproject_toml(entry)
                    if isinstance(pkgs, list) and pkgs:
                        existing = dependencies.get("pip", [])
                        dependencies["pip"] = list(dict.fromkeys(existing + pkgs))

                elif fname == "cargo.toml":
                    pkgs = self._parse_cargo_toml(entry)
                    if isinstance(pkgs, list) and pkgs:
                        dependencies["cargo"] = pkgs

            except Exception:
                continue

        try:
            total_files = max(sum(int(v) for v in lang_counts.values()), 1)
            lang_stats = {
                str(lang): {"files": int(cnt), "percentage": round(int(cnt) / total_files * 100, 1)}
                for lang, cnt in sorted(
                    ((k, v) for k, v in lang_counts.items() if isinstance(k, str) and isinstance(v, int)),
                    key=lambda x: -x[1],
                )
            }
        except Exception:
            logger.error("scan_lang_stats_failed", tb=traceback.format_exc())
            lang_stats = {}

        try:
            sorted_frameworks = sorted(str(f) for f in frameworks if isinstance(f, str))
        except Exception:
            logger.error("scan_frameworks_sort_failed", tb=traceback.format_exc())
            sorted_frameworks = list(frameworks) if hasattr(frameworks, "__iter__") else []

        try:
            deduped_maturity = list(dict.fromkeys(str(m) for m in maturity_indicators if isinstance(m, str)))
        except Exception:
            deduped_maturity = []

        return {
            "fileCount": file_count,
            "folderCount": folder_count,
            "totalSizeBytes": total_size,
            "languages": lang_stats,
            "frameworks": sorted_frameworks,
            "dependencies": dependencies,
            "hasDockerfile": has_dockerfile,
            "hasDockerCompose": has_docker_compose,
            "hasReadme": has_readme,
            "hasTests": has_tests,
            "hasCi": has_ci,
            "maturityIndicators": deduped_maturity,
        }

    def _walk(self):
        try:
            entries = list(self.root.rglob("*"))
        except Exception:
            return
        for entry in entries:
            try:
                rel = entry.relative_to(self.root).parts
                if any(part in IGNORE_DIRS for part in rel):
                    continue
                yield entry
            except Exception:
                continue

    def _parse_package_json(self, path: Path) -> list[str]:
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            pkgs = list(data.get("dependencies", {}).keys())
            pkgs += list(data.get("devDependencies", {}).keys())
            return pkgs
        except Exception:
            return []

    def _parse_requirements_txt(self, path: Path) -> list[str]:
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
            result = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("-"):
                    pkg = line.split("==")[0].split(">=")[0].split("<=")[0].split("~=")[0].strip()
                    if pkg:
                        result.append(pkg)
            return result
        except Exception:
            return []

    def _parse_pyproject_toml(self, path: Path) -> list[str]:
        try:
            import tomllib
        except ImportError:
            try:
                import tomli as tomllib  # type: ignore
            except ImportError:
                return []
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8", errors="ignore"))
            deps = data.get("project", {}).get("dependencies", [])
            return [d.split(">=")[0].split("==")[0].strip() for d in deps if isinstance(d, str)]
        except Exception:
            return []

    def _parse_cargo_toml(self, path: Path) -> list[str]:
        try:
            import tomllib
        except ImportError:
            try:
                import tomli as tomllib  # type: ignore
            except ImportError:
                return []
        try:
            data = tomllib.loads(path.read_text(encoding="utf-8", errors="ignore"))
            return list(data.get("dependencies", {}).keys())
        except Exception:
            return []
