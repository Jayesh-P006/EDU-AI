import re
from pathlib import Path
from typing import Any, Optional
import structlog

logger = structlog.get_logger(__name__)

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".pytest_cache",
    "venv", ".venv", "env", "dist", "build", ".next",
}
MAX_FILE_SIZE = 512 * 1024  # 512 KB


class ASTParser:
    """
    Parses source code using tree-sitter when available,
    with regex fallback for environments without compiled grammars.
    """

    def __init__(self, repo_root: Path) -> None:
        self.root = repo_root
        self._py_parser = self._init_parser("python")
        self._js_parser = self._init_parser("javascript")

    def _init_parser(self, lang_name: str):
        try:
            if lang_name == "python":
                import tree_sitter_python as tslang
            else:
                import tree_sitter_javascript as tslang  # type: ignore
            from tree_sitter import Language, Parser
            return Parser(Language(tslang.language()))
        except Exception:
            return None

    def parse_repository(self) -> dict[str, Any]:
        agg: dict[str, Any] = {
            "imports": [],
            "functions": [],
            "classes": [],
            "routes": [],
            "middleware": [],
            "controllers": [],
            "services": [],
            "models": [],
            "fileBreakdown": [],
        }

        for path in self._iter_source_files():
            try:
                if path.stat().st_size > MAX_FILE_SIZE:
                    continue
                content = path.read_text(encoding="utf-8", errors="ignore")
                rel = str(path.relative_to(self.root))
                ext = path.suffix.lower()
                file_data = self._parse_file(content, rel, ext)
                if not file_data:
                    continue

                agg["fileBreakdown"].append(file_data)
                agg["imports"].extend(file_data.get("imports", []))
                for fn in file_data.get("functions", []):
                    agg["functions"].append({"name": fn, "file": rel})
                for cls in file_data.get("classes", []):
                    agg["classes"].append({"name": cls, "file": rel})
                for route in file_data.get("routes", []):
                    agg["routes"].append({"route": route, "file": rel})

                if self._is_controller(rel, content):
                    agg["controllers"].append(rel)
                if self._is_service(rel, content):
                    agg["services"].append(rel)
                if self._is_middleware(rel, content):
                    agg["middleware"].append(rel)
                if self._is_model(rel, content):
                    agg["models"].append(rel)

            except Exception as exc:
                logger.debug("ast_parse_skip", file=str(path), error=str(exc))

        # Deduplicate
        agg["imports"] = list(dict.fromkeys(agg["imports"]))
        for key in ("controllers", "services", "middleware", "models"):
            agg[key] = list(dict.fromkeys(agg[key]))

        return agg

    def _parse_file(self, content: str, rel: str, ext: str) -> Optional[dict]:
        result: dict = {
            "file": rel, "language": "",
            "imports": [], "functions": [], "classes": [], "routes": [],
        }

        if ext == ".py":
            result["language"] = "Python"
            if self._py_parser:
                self._ts_parse_python(content, result)
            else:
                self._regex_parse_python(content, result)

        elif ext in (".js", ".jsx"):
            result["language"] = "JavaScript"
            self._regex_parse_js(content, result)

        elif ext in (".ts", ".tsx"):
            result["language"] = "TypeScript"
            self._regex_parse_js(content, result)

        else:
            return None

        return result if any(result[k] for k in ("imports", "functions", "classes", "routes")) else None

    # ── Python ──────────────────────────────────────────────────────────────

    def _ts_parse_python(self, content: str, result: dict) -> None:
        try:
            tree = self._py_parser.parse(content.encode())
            for node in self._walk(tree.root_node):
                t = node.type
                if t in ("import_statement", "import_from_statement"):
                    result["imports"].append(node.text.decode(errors="ignore").strip())
                elif t == "function_definition":
                    n = node.child_by_field_name("name")
                    if n:
                        result["functions"].append(n.text.decode())
                    # Look for route decorators
                    for decorator in node.children:
                        if decorator.type == "decorator":
                            txt = decorator.text.decode(errors="ignore")
                            route = self._route_from_decorator(txt)
                            if route:
                                result["routes"].append(route)
                elif t == "class_definition":
                    n = node.child_by_field_name("name")
                    if n:
                        result["classes"].append(n.text.decode())
        except Exception:
            self._regex_parse_python(content, result)

    def _regex_parse_python(self, content: str, result: dict) -> None:
        result["imports"].extend(re.findall(r"^(?:import|from)\s+\S+.*", content, re.MULTILINE))
        result["functions"].extend(re.findall(r"^def\s+(\w+)\s*\(", content, re.MULTILINE))
        result["classes"].extend(re.findall(r"^class\s+(\w+)[\s:(]", content, re.MULTILINE))
        result["routes"].extend(re.findall(
            r'@\w+\.(?:get|post|put|patch|delete|route)\s*\(\s*["\']([^"\']+)["\']',
            content, re.IGNORECASE
        ))

    # ── JavaScript / TypeScript ──────────────────────────────────────────────

    def _regex_parse_js(self, content: str, result: dict) -> None:
        result["imports"].extend(re.findall(
            r'(?:import\s+.*?from\s+|require\()["\']([\w@/.-]+)["\']', content
        ))
        funcs = re.findall(
            r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s*)?\()",
            content
        )
        result["functions"].extend(f[0] or f[1] or f[2] for f in funcs if any(f))
        result["classes"].extend(re.findall(r"class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{", content))
        result["routes"].extend(re.findall(
            r"(?:router|app)\.(?:get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]",
            content, re.IGNORECASE
        ))
        result["routes"].extend(re.findall(
            r'@(?:Get|Post|Put|Patch|Delete)\s*\(\s*[\'"]([^\'"]*)[\'"]', content
        ))

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _walk(self, node):
        yield node
        for child in node.children:
            yield from self._walk(child)

    def _route_from_decorator(self, text: str) -> Optional[str]:
        m = re.search(r'["\']([^"\']+)["\']', text)
        return m.group(1) if m else None

    def _is_controller(self, rel: str, content: str) -> bool:
        return bool(
            re.search(r"controller|route", rel, re.IGNORECASE)
            or re.search(r'(?:router|app)\.(get|post|put|delete)\(', content, re.IGNORECASE)
            or re.search(r'@(Get|Post|Put|Patch|Delete|Controller)\(', content)
        )

    def _is_service(self, rel: str, content: str) -> bool:
        return "service" in rel.lower() or bool(re.search(r'@Injectable\(\)|class\s+\w+Service', content))

    def _is_middleware(self, rel: str, content: str) -> bool:
        return bool(
            "middleware" in rel.lower() or "guard" in rel.lower()
            or re.search(r'\(req,\s*res,\s*next\)', content)
            or re.search(r'def\s+\w+.*?call_next', content)
        )

    def _is_model(self, rel: str, content: str) -> bool:
        return bool(
            re.search(r"model|schema|entity", rel, re.IGNORECASE)
            or re.search(r'@Entity\(\)|mongoose\.model\(|class\s+\w+(Schema|Model|Entity)', content)
        )

    def _iter_source_files(self):
        for p in self.root.rglob("*"):
            if p.is_dir():
                continue
            parts = p.relative_to(self.root).parts
            if any(part in IGNORE_DIRS for part in parts):
                continue
            if p.suffix.lower() in (".py", ".js", ".jsx", ".ts", ".tsx"):
                yield p
