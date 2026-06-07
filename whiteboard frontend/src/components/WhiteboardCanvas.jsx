import { forwardRef, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Minus, Move, Plus } from "lucide-react";
import mermaid from "mermaid";
import dagre from "dagre";

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_W = 210;
const CARD_HEADER_H = 52;
const CARD_DETAIL_H = 64;
const CARD_FULL_H = CARD_HEADER_H + CARD_DETAIL_H; // 116
const LEVEL_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeLabel(el) {
  return el.title || el.label || el.id || "";
}

function nodeDesc(el) {
  return el.description || "";
}

function nodeCat(el) {
  return el.category || "";
}

function hasDetail(el) {
  return Boolean(nodeDesc(el));
}

function getCardH(el) {
  return hasDetail(el) ? CARD_FULL_H : CARD_HEADER_H;
}

// Truncate text to fit
function truncate(text, maxChars) {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

// Wrap text into lines for SVG <tspan>
function wrapText(text, maxCharsPerLine) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxCharsPerLine) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
    if (lines.length >= 3) break; // max 3 lines
  }
  if (line && lines.length < 3) lines.push(line);
  if (lines.length === 3 && text.length > lines.join(" ").length) {
    lines[2] = truncate(lines[2], maxCharsPerLine);
  }
  return lines;
}

// ─── SVG Node Card ────────────────────────────────────────────────────────────

function NodeElement({ element }) {
  const x = Number(element.x || 500);
  const y = Number(element.y || 300);

  const title  = nodeLabel(element);
  const desc   = nodeDesc(element);
  const cat    = nodeCat(element);
  const color  = element.highlighted
    ? element.highlightColor || "#f59e0b"
    : element.color || "#6366f1";

  const cardH  = getCardH(element);
  const left   = x - CARD_W / 2;
  const top    = y - cardH / 2;

  // Circle shape (root node)
  if (element.shape === "circle") {
    const r = 42;
    const titleLines = wrapText(title, 14);
    return (
      <g className={`board-item ${element.highlighted ? "highlighted" : ""}`}>
        <circle cx={x} cy={y} r={r} fill={`${color}28`} stroke={color} strokeWidth="2.5" />
        <circle cx={x} cy={y} r={r - 6} fill={`${color}10`} stroke={`${color}55`} strokeWidth="1" />
        <text textAnchor="middle" fill="#f0f4ff" fontSize="11" fontWeight="800" letterSpacing="0.3">
          {titleLines.map((line, i) => (
            <tspan key={i} x={x} dy={i === 0 ? y - (titleLines.length - 1) * 7 + 2 : 15}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  // Standard card
  const titleLines = wrapText(title, 22);
  const descLines  = wrapText(desc, 30);

  return (
    <g className={`board-item ${element.highlighted ? "highlighted" : ""}`}>
      {/* Card shadow */}
      <rect
        x={left + 3} y={top + 4}
        width={CARD_W} height={cardH}
        rx="12" fill="rgba(0,0,0,0.45)"
      />

      {/* Card body */}
      <rect
        x={left} y={top}
        width={CARD_W} height={cardH}
        rx="12"
        fill="#0f1117"
        stroke={color}
        strokeWidth="1.5"
      />

      {/* Colored header band */}
      <clipPath id={`clip-hdr-${element.id}`}>
        <rect x={left} y={top} width={CARD_W} height={CARD_HEADER_H} rx="12" />
      </clipPath>
      <rect
        x={left} y={top}
        width={CARD_W} height={CARD_HEADER_H}
        fill={`${color}20`}
        clipPath={`url(#clip-hdr-${element.id})`}
      />
      {/* Fix bottom of header (square corners at divider) */}
      <rect
        x={left} y={top + CARD_HEADER_H - 12}
        width={CARD_W} height={12}
        fill={`${color}20`}
      />

      {/* Category badge */}
      {cat && (
        <>
          <rect
            x={left + 10} y={top + 8}
            width={Math.min(cat.length * 5.5 + 12, CARD_W - 20)} height={14}
            rx="4"
            fill={`${color}30`}
            stroke={`${color}60`}
            strokeWidth="0.8"
          />
          <text
            x={left + 16} y={top + 18}
            fill={color}
            fontSize="8"
            fontWeight="700"
            letterSpacing="0.8"
          >
            {cat.toUpperCase().slice(0, 20)}
          </text>
        </>
      )}

      {/* Title */}
      <text
        textAnchor="middle"
        fill="#eef2ff"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.2"
      >
        {titleLines.map((line, i) => (
          <tspan
            key={i}
            x={x}
            dy={i === 0
              ? top + (cat ? 34 : 24) + (titleLines.length === 1 ? 6 : 0)
              : 14}
          >
            {line}
          </tspan>
        ))}
      </text>

      {/* Divider */}
      {hasDetail(element) && (
        <line
          x1={left + 14} y1={top + CARD_HEADER_H}
          x2={left + CARD_W - 14} y2={top + CARD_HEADER_H}
          stroke={`${color}40`}
          strokeWidth="1"
        />
      )}

      {/* Description lines */}
      {hasDetail(element) && descLines.length > 0 && (
        <text
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontWeight="400"
          letterSpacing="0.1"
        >
          {descLines.map((line, i) => (
            <tspan key={i} x={x} dy={i === 0 ? top + CARD_HEADER_H + 14 : 12}>
              {line}
            </tspan>
          ))}
        </text>
      )}

      {/* Glow on highlight */}
      {element.highlighted && (
        <rect
          x={left - 2} y={top - 2}
          width={CARD_W + 4} height={cardH + 4}
          rx="13"
          fill="none"
          stroke={color}
          strokeWidth="3"
          opacity="0.5"
        />
      )}
    </g>
  );
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

function getEdgePoints(from, to) {
  const fx = Number(from.x), fy = Number(from.y);
  const tx = Number(to.x),   ty = Number(to.y);
  const dx = tx - fx, dy = ty - fy;
  if (dx === 0 && dy === 0) return { x1: fx, y1: fy, x2: tx, y2: ty };

  const fromH = getCardH(from);
  const toH   = getCardH(to);

  // Exit from bottom-center of source card
  const x1 = fx;
  const y1 = fy + fromH / 2;
  // Enter top-center of target card
  const x2 = tx;
  const y2 = ty - toH / 2 - 4;

  return { x1, y1, x2, y2 };
}

function ArrowElement({ element, nodesById }) {
  const from = nodesById.get(element.from);
  const to   = nodesById.get(element.to);
  if (!from || !to) return null;

  const { x1, y1, x2, y2 } = getEdgePoints(from, to);

  // Bezier control point
  const cpY = (y1 + y2) / 2;

  return (
    <g className="board-item">
      <path
        d={`M ${x1} ${y1} C ${x1} ${cpY}, ${x2} ${cpY}, ${x2} ${y2}`}
        fill="none"
        stroke="#06b6d455"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

// ─── Other element types ──────────────────────────────────────────────────────

function EquationElement({ element }) {
  return (
    <g className="board-item">
      <rect x={element.x} y={element.y - 34} width="330" height="58" rx="8" className="formula-bg" />
      <text x={element.x + 18} y={element.y + 3} className="formula-text">{element.latex}</text>
    </g>
  );
}

function CodeBlockElement({ element }) {
  const lines = String(element.snippet || "").split("\n").slice(0, 7);
  return (
    <g className="board-item">
      <rect x={element.x} y={element.y - 26} width="375" height={lines.length * 24 + 48} rx="8" className="code-bg" />
      <text x={element.x + 16} y={element.y} className="code-title">{element.language || "code"}</text>
      {lines.map((line, i) => (
        <text key={i} x={element.x + 16} y={element.y + 30 + i * 22} className="code-line">{line || " "}</text>
      ))}
    </g>
  );
}

function TextLabelElement({ element }) {
  return <text x={element.x} y={element.y} className="floating-label board-item">{element.text || element.label}</text>;
}

function LineElement({ element }) {
  return (
    <line className="board-item sketch-line"
      x1={element.x1 || element.x || 0} y1={element.y1 || element.y || 0}
      x2={element.x2 || element.toX || 100} y2={element.y2 || element.toY || 100} />
  );
}

function MermaidElement({ element }) {
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!element.code) return;
    (async () => {
      try {
        const id = `mermaid-svg-${element.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
        const { svg } = await mermaid.render(id, element.code);
        const start = svg.indexOf(">") + 1;
        const end = svg.lastIndexOf("</svg>");
        setSvgContent(svg.slice(start, end));
        setError(null);
      } catch { setError("Error parsing diagram"); }
    })();
  }, [element.code, element.id]);

  const x = element.x || 50, y = element.y || 50;
  if (error) return (
    <g className="board-item">
      <rect x={x} y={y} width={300} height={60} fill="#ef444422" stroke="#ef4444" strokeWidth="2" rx="8" />
      <text x={x + 15} y={y + 35} fill="#ef4444" fontWeight="bold">Error rendering diagram</text>
    </g>
  );
  return <svg x={x} y={y} width={element.width || 900} height={element.height || 500} className="board-item" dangerouslySetInnerHTML={{ __html: svgContent }} />;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function buildSyntheticArrows(nodes, existing) {
  const arrowSet = new Set(existing.map((a) => `${a.from}→${a.to}`));
  const out = [];
  for (const n of nodes) {
    if (n.parent && n.parent !== "null" && n.parent !== null) {
      const key = `${n.parent}→${n.id}`;
      if (!arrowSet.has(key)) {
        out.push({ id: `_p_${n.parent}_${n.id}`, from: n.parent, to: n.id, type: "arrow", label: "", _synthetic: true });
        arrowSet.add(key);
      }
    }
  }
  return out;
}

function assignLevelColors(nodes, arrows) {
  const childOf = new Map();
  for (const a of arrows) childOf.set(a.to, a.from);
  for (const n of nodes) {
    if (n.parent && n.parent !== "null") childOf.set(n.id, n.parent);
  }

  const levels = new Map();
  const visited = new Set();
  function getLevel(id) {
    if (levels.has(id)) return levels.get(id);
    if (visited.has(id)) return 0;
    visited.add(id);
    const p = childOf.get(id);
    if (!p) { levels.set(id, 0); return 0; }
    const lvl = getLevel(p) + 1;
    levels.set(id, lvl);
    return lvl;
  }
  return nodes.map((n) => ({ ...n, color: LEVEL_COLORS[getLevel(n.id) % LEVEL_COLORS.length] }));
}

function runDagreLayout(nodes, arrows) {
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 80, marginy: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => {
    g.setNode(n.id, { width: CARD_W + 30, height: getCardH(n) + 30 });
  });
  arrows.forEach((a) => {
    if (g.hasNode(a.from) && g.hasNode(a.to)) g.setEdge(a.from, a.to);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, x: pos ? pos.x : n.x || 500, y: pos ? pos.y : n.y || 300 };
  });
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

const WhiteboardCanvas = forwardRef(function WhiteboardCanvas({ elements, isDrawing }, ref) {
  const [zoom, setZoom] = useState(1);
  const [layoutError, setLayoutError] = useState(null);

  const layoutedElements = useMemo(() => {
    const rawNodes  = elements.filter((el) => el.type === "node");
    const rawArrows = elements.filter((el) => el.type === "arrow");
    const others    = elements.filter((el) => el.type !== "node" && el.type !== "arrow");

    if (rawNodes.length === 0) return elements;

    const nodeIds = new Set(rawNodes.map((n) => n.id));
    const synthetic = buildSyntheticArrows(rawNodes, rawArrows);
    const allArrows = [...rawArrows, ...synthetic];
    const validArrows = allArrows.filter((a) => nodeIds.has(a.from) && nodeIds.has(a.to));

    const coloredNodes = assignLevelColors(rawNodes, validArrows);

    try {
      const positioned = runDagreLayout(coloredNodes, validArrows);
      setLayoutError(null);
      const realArrows = validArrows.filter((a) => !a._synthetic);
      return [...positioned, ...realArrows, ...others];
    } catch (err) {
      console.error("[Canvas] Dagre layout failed:", err);
      setLayoutError("Layout failed — nodes may overlap.");
      return elements;
    }
  }, [elements]);

  const nodesById = useMemo(() => {
    const map = new Map();
    layoutedElements.filter((el) => el.type === "node").forEach((el) => map.set(el.id, el));
    return map;
  }, [layoutedElements]);

  const viewBox = useMemo(() => {
    const nodes = layoutedElements.filter((el) => el.type === "node" && el.x !== undefined);
    if (nodes.length === 0) return "0 0 1000 700";

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const h = getCardH(n);
      minX = Math.min(minX, n.x - CARD_W / 2);
      minY = Math.min(minY, n.y - h / 2);
      maxX = Math.max(maxX, n.x + CARD_W / 2);
      maxY = Math.max(maxY, n.y + h / 2);
    }

    const pad = 100;
    const W = Math.max(1200, maxX - minX + pad * 2);
    const H = Math.max(700,  maxY - minY + pad * 2);
    return `${(minX - pad) / zoom} ${(minY - pad) / zoom} ${W / zoom} ${H / zoom}`;
  }, [layoutedElements, zoom]);

  return (
    <section className="whiteboard-panel">
      {layoutError && (
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          background: "rgba(244,63,94,0.18)", border: "1.5px solid #f43f5e",
          borderRadius: 6, padding: "6px 14px", color: "#fda4af",
          fontSize: 12, fontWeight: 700, zIndex: 10, backdropFilter: "blur(12px)",
        }}>
          {layoutError}
        </div>
      )}

      <div className="board-toolbar">
        <div className="board-status">
          <span className={isDrawing ? "status-dot active" : "status-dot"} />
          <span>{isDrawing ? "Drawing" : "Board"}</span>
        </div>
        <div className="board-status" style={{ fontSize: 11, opacity: 0.6 }}>
          {layoutedElements.filter((e) => e.type === "node").length} nodes
        </div>
        <div className="zoom-controls">
          <button type="button" onClick={() => setZoom((v) => Math.max(0.2, v - 0.15))} title="Zoom out"><Minus size={16} /></button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom"><Move size={16} /></button>
          <button type="button" onClick={() => setZoom((v) => Math.min(3, v + 0.15))} title="Zoom in"><Plus size={16} /></button>
        </div>
      </div>

      <svg ref={ref} className="whiteboard-svg" viewBox={viewBox} role="img" aria-label="AI whiteboard">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.09)" strokeWidth="1" />
          </pattern>
          <marker id="arrowhead" markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M 0 0 L 8 3.5 L 0 7 z" fill="#06b6d4" opacity="0.7" />
          </marker>
          <filter id="card-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background */}
        <rect x="-9999" y="-9999" width="99999" height="99999" fill="#080810" />
        <rect x="-9999" y="-9999" width="99999" height="99999" fill="url(#grid)" />

        {/* Render arrows first (below nodes) */}
        {layoutedElements.filter((el) => el.type === "arrow").map((el) => (
          <ArrowElement key={el.id} element={el} nodesById={nodesById} />
        ))}

        {/* Render nodes on top */}
        {layoutedElements.map((el) => {
          if (el.type === "node")       return <NodeElement key={el.id} element={el} />;
          if (el.type === "equation")   return <EquationElement key={el.id} element={el} />;
          if (el.type === "code")       return <CodeBlockElement key={el.id} element={el} />;
          if (el.type === "text_label") return <TextLabelElement key={el.id} element={el} />;
          if (el.type === "mermaid")    return <MermaidElement key={el.id} element={el} />;
          if (el.type === "line")       return <LineElement key={el.id} element={el} />;
          return null;
        })}
      </svg>
    </section>
  );
});

export default WhiteboardCanvas;
