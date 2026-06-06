import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.models.whiteboard import ChatMessage

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# OPTIMIZED SYSTEM PROMPT  – single-request deep concept mapping and explanation
# ─────────────────────────────────────────────────────────────────────────────
WHITEBOARD_SYSTEM_PROMPT = """
You are an expert teacher AI that draws deep, hierarchical concept maps while explaining.
You MUST respond in strict streaming JSON Lines format: each line is one JSON object.

Your response MUST follow this exact sequence to ensure the frontend renders properly:
1. Clear the whiteboard by emitting: {"type":"draw","command":"clear","data":{}}
2. Emit ALL "node" draw commands to create the graph nodes.
3. Emit ALL "arrow" draw commands to connect the nodes.
4. Emit "text" explanation chunks (conversational, short sentences).
5. Emit occasional "speak" chunks for key voice overs.
6. Emit exactly one final {"type":"done"} chunk.

━━━━━━━━━  CONCEPT MAP STRUCTURE & DEPTH RULES  ━━━━━━━━━
NEVER generate a shallow flowchart or keyword list.
Generate a DEEP HIERARCHICAL CONCEPT MAP with:
  • Minimum 20 nodes total.
  • Minimum 4 levels of depth.
  • Every major concept must have 2-4 child nodes.

The map must cover the topic exhaustively, including:
  1. Root concept (the topic itself)
  2. Definition / Core Concept
  3. Internal Structure / Components
  4. Key Properties / Characteristics
  5. Working / Mechanics
  6. Types / Variants
  7. Examples
  8. Advantages
  9. Disadvantages / Limitations
 10. Real-world Applications / Use Cases
 11. Comparisons / Trade-offs
 12. Interview Questions / Key Takeaways

━━━━━━━━━  "vs" / COMPARISON TOPICS  ━━━━━━━━━
If the query contains "vs", "versus", "compare", or "difference between", generate TWO side-by-side subtrees:

  Root (Topic A vs Topic B)
  ├── Topic A
  │   ├── Definition
  │   ├── Properties
  │   ├── Advantages
  │   ├── Disadvantages
  │   ├── Examples
  │   └── Use Cases
  └── Topic B
      ├── Definition
      ├── Properties
      ├── Advantages
      ├── Disadvantages
      ├── Examples
      └── Use Cases

Both subtrees MUST have equal depth and node count.

━━━━━━━━━  NODE / ARROW RULES  ━━━━━━━━━
- Every node command MUST have these fields in its data:
  - "title": Short, clear name of the concept (2-5 words).
  - "description": A clear, concise one-sentence description explaining the concept.
  - "category": A classification category (e.g. 'Core', 'Concept', 'Component', 'Advantage', 'Limitation', 'Application', 'Trade-off').
  - "color": Hex code corresponding to its hierarchy level.
  - "parent": Parent node id, or null for the root.
- DO NOT output "x" or "y" coordinates for node or arrow draw commands.
- DO NOT use the "label" field on node commands; use "title", "description", and "category" instead.
- Use "parent" to express hierarchy, NOT just arrows.
- Create arrows AFTER all nodes are created. Arrow from must be parent → child.
- Use colours to distinguish hierarchy levels:
    Level 0 (root)  → #6366f1
    Level 1         → #06b6d4
    Level 2         → #10b981
    Level 3         → #f59e0b
    Level 4+        → #f43f5e

━━━━━━━━━  DRAW COMMAND SCHEMA  ━━━━━━━━━
- "node"      : {"id":"uid","title":"Concept Title","description":"Detailed one-sentence explanation of this concept.","category":"CategoryName","color":"#hex","shape":"rect","parent":"parent_id_or_null"}
- "arrow"     : {"from":"src_id","to":"tgt_id","label":"optional short label"}
- "equation"  : {"id":"uid","latex":"formula","x":80,"y":430}
- "code"      : {"id":"uid","language":"python","snippet":"code","x":560,"y":390}
- "highlight" : {"id":"existing_node_id","color":"#hex"}
- "text_label": {"label":"text","x":100,"y":100}
- "mermaid"   : {"id":"uid","code":"mermaid_syntax","x":50,"y":50,"width":900,"height":500}
- "clear"     : {}

━━━━━━━━━  RESPONSE FORMAT EXAMPLE  ━━━━━━━━━
{"type":"draw","command":"clear","data":{}}
{"type":"draw","command":"node","data":{"id":"root","title":"Trees vs Graphs","description":"Comparing hierarchical tree structures with interconnected networks.","category":"Root","color":"#6366f1","shape":"rect","parent":null}}
{"type":"draw","command":"node","data":{"id":"trees","title":"Trees","description":"A hierarchical structure containing nodes with parent-child relationships.","category":"Structure","color":"#06b6d4","shape":"rect","parent":"root"}}
{"type":"draw","command":"node","data":{"id":"tree_def","title":"Definition","description":"An acyclic connected graph where any two vertices are connected by exactly one path.","category":"Core","color":"#10b981","shape":"rect","parent":"trees"}}
{"type":"draw","command":"arrow","data":{"from":"root","to":"trees"}}
{"type":"draw","command":"arrow","data":{"from":"trees","to":"tree_def"}}
{"type":"text","content":"Let's start by comparing trees and graphs."}
{"type":"speak","content":"Trees are a special subset of graphs."}
{"type":"done"}

Important:
- Emit ONLY JSON objects, one per line.
- Do NOT emit markdown, code fences, arrays, prose outside JSON, or comments.
- Generate ALL nodes before generating arrows.
- Aim for 25-35 nodes for any topic to ensure comprehensive coverage.
""".strip()


def _history_to_messages(history: list[ChatMessage], question: str, subject: str) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": WHITEBOARD_SYSTEM_PROMPT}]

    for message in history[-settings.max_history_messages:]:
        role = "assistant" if message.role in {"assistant", "model"} else "user"
        messages.append({"role": role, "content": message.content})

    messages.append(
        {
            "role": "user",
            "content": (
                f"Student question: {question}\n"
                f"Subject context: {subject}\n"
                "Please generate the complete deep concept map (nodes, then arrows) followed by a short explanation."
            ),
        }
    )
    return messages


def _clean_stream_line(line: str) -> str:
    cleaned = line.strip()
    if cleaned.startswith("```"):
        return ""
    if cleaned.lower().startswith("json"):
        cleaned = cleaned[4:].strip()
    return cleaned


def _parse_json_line(line: str) -> dict | None:
    cleaned = _clean_stream_line(line)
    if not cleaned:
        return None

    # Fast path
    try:
        parsed = json.loads(cleaned)
        return parsed
    except json.JSONDecodeError as err:
        logger.warning("Failed standard JSON parse: %s  (err: %s)", cleaned[:120], err)

    # Recovery 1 – missing closing brace
    if cleaned.startswith("{") and not cleaned.endswith("}"):
        try:
            parsed = json.loads(cleaned + "}")
            logger.info("Recovered JSON (added closing brace)")
            return parsed
        except Exception:
            pass

    # Recovery 2 – stray markdown fences
    try:
        stripped = re.sub(r"```(?:json)?", "", cleaned).strip()
        parsed = json.loads(stripped)
        logger.info("Recovered JSON (stripped markdown fences)")
        return parsed
    except Exception:
        pass

    # Recovery 3 – extract first {...} substring
    brace_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if brace_match:
        try:
            parsed = json.loads(brace_match.group())
            logger.info("Recovered JSON (extracted first brace block)")
            return parsed
        except Exception:
            pass

    logger.error("JSON parse failed completely for line: %s", cleaned[:200])
    return None


def _extract_delta_text(event: dict) -> str:
    pieces: list[str] = []
    for choice in event.get("choices", []):
        delta = choice.get("delta") or {}
        content = delta.get("content")
        if content:
            pieces.append(content)
    return "".join(pieces)


async def _stream_from_groq(
    question: str,
    subject: str,
    history: list[ChatMessage],
) -> AsyncIterator[dict]:
    """
    Optimized single-request solver. Runs exactly 1 request to the Groq API.
    Streams back JSON-Lines containing the full diagram first, then text explanation.
    """
    logger.info("[GroqWhiteboard] Initiating single-request streaming solve for: %s", question)
    messages = _history_to_messages(history, question, subject)
    
    buffer = ""
    done_sent = False
    timeout = httpx.Timeout(connect=20.0, read=None, write=20.0, pool=20.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            f"{settings.groq_api_base.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.groq_model,
                "messages": messages,
                "temperature": 0.55,
                "top_p": 0.95,
                "max_tokens": 8000,
                "stream": True,
            },
        ) as response:
            if response.status_code >= 400:
                error_body = (await response.aread()).decode("utf-8", errors="replace")
                raise RuntimeError(f"Groq API returned {response.status_code}: {error_body[:500]}")

            async for raw_line in response.aiter_lines():
                line = raw_line.strip()
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue

                event_text = line.removeprefix("data:").strip()
                if event_text == "[DONE]":
                    break

                try:
                    event = json.loads(event_text)
                except json.JSONDecodeError:
                    logger.warning("Skipping malformed Groq SSE event: %s", event_text[:80])
                    continue

                text = _extract_delta_text(event)
                if not text:
                    continue

                buffer += text
                lines = buffer.splitlines(keepends=False)

                if buffer and not buffer.endswith(("\n", "\r")):
                    buffer = lines.pop() if lines else buffer
                else:
                    buffer = ""

                for output_line in lines:
                    parsed = _parse_json_line(output_line)
                    if parsed is None:
                        continue

                    yield parsed
                    if parsed.get("type") == "done":
                        done_sent = True
                        return

    # Flush remaining buffer
    if buffer.strip():
        parsed = _parse_json_line(buffer)
        if parsed is not None:
            yield parsed
            done_sent = parsed.get("type") == "done"

    if not done_sent:
        yield {"type": "done"}


async def _demo_stream(question: str, subject: str) -> AsyncIterator[dict]:
    """Fallback demo when no API key is configured."""
    topic = question.strip() or "this doubt"
    chunks = [
        {"type": "draw", "command": "clear", "data": {}},
        {"type": "draw", "command": "node", "data": {"id": "root", "title": topic[:34], "description": "Core subject topic under discussion.", "category": "Root", "color": "#6366f1", "shape": "rect", "parent": None}},
        {"type": "draw", "command": "node", "data": {"id": "def", "title": "Definition", "description": f"Clear and concise definition of {topic}.", "category": "Concept", "color": "#06b6d4", "shape": "rect", "parent": "root"}},
        {"type": "draw", "command": "node", "data": {"id": "props", "title": "Properties", "description": f"Key properties and characteristics of {topic}.", "category": "Characteristics", "color": "#06b6d4", "shape": "rect", "parent": "root"}},
        {"type": "draw", "command": "node", "data": {"id": "apps", "title": "Applications", "description": f"Real-world applications and use cases of {topic}.", "category": "Applications", "color": "#06b6d4", "shape": "rect", "parent": "root"}},
        {"type": "draw", "command": "arrow", "data": {"from": "root", "to": "def"}},
        {"type": "draw", "command": "arrow", "data": {"from": "root", "to": "props"}},
        {"type": "draw", "command": "arrow", "data": {"from": "root", "to": "apps"}},
        {"type": "text", "content": f"Let's explore {topic} step by step. Configure GROQ_API_KEY for a full deep concept map."},
        {"type": "speak", "content": "Configure your API key for AI-powered deep concept maps."},
        {"type": "done"},
    ]
    for chunk in chunks:
        await asyncio.sleep(0.18)
        yield chunk


async def stream_whiteboard_solution(
    question: str,
    subject: str,
    history: list[ChatMessage] | None = None,
) -> AsyncIterator[dict]:
    if settings.groq_api_key:
        async for chunk in _stream_from_groq(question, subject, history or []):
            yield chunk
        return

    if not settings.allow_demo_fallback:
        yield {"type": "error", "message": "GROQ_API_KEY is not configured"}
        yield {"type": "done"}
        return

    async for chunk in _demo_stream(question, subject):
        yield chunk
