import { forwardRef, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Minus, Move, Plus } from "lucide-react";
import mermaid from "mermaid";
import dagre from "dagre";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeCenter(element) {
  return {
    x: Number(element.x || 500),
    y: Number(element.y || 300),
  };
}

function nodeSize(label = "") {
  const lines = String(label).split("\n");
  const maxLen = Math.max(...lines.map((l) => l.length));
  const width = Math.min(200, Math.max(100, maxLen * 7.5 + 32));
  const height = Math.max(44, lines.length * 18 + 20);
  return { width, height };
}

/** Assign level-based colours matching the backend prompt colours */
const LEVEL_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

// ─── SVG Node ─────────────────────────────────────────────────────────────────

function NodeElement({ element }) {
  const { x, y } = getNodeCenter(element);
  const label = element.label || element.id;
  const color =
    element.highlighted ? element.highlightColor || "#f59e0b" : element.color || "#6366f1";
  const { width, height } = nodeSize(label);
  const lines = String(label).split("\n");

  if (element.shape === "circle") {
    const r = Math.max(38, Math.min(52, width / 2));
    return (
      <g className={`board-item ${element.highlighted ? "highlighted" : ""}`}>
        <circle cx={x} cy={y} r={r} fill={`${color}22`} stroke={color} strokeWidth="2.5" />
        <text x={x} y={y + 5} textAnchor="middle" className="node-text">
          {lines.map((line, idx) => (
            <tspan key={idx} x={x} dy={idx === 0 ? -(lines.length - 1) * 7 : 16}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  return (
    <g className={`board-item ${element.highlighted ? "highlighted" : ""}`}>
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx="7"
        fill={`${color}22`}
        stroke={color}
        strokeWidth="2"
      />
      <text x={x} y={y + 4} textAnchor="middle" className="node-text">
        {lines.map((line, idx) => (
          <tspan key={idx} x={x} dy={idx === 0 ? -(lines.length - 1) * 7 : 16}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// ─── Arrow intersection math ─────────────────────────────────────────────────

function getIntersectionPoint(from, to) {
  const start = getNodeCenter(from);
  const end = getNodeCenter(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0)
    return { startX: start.x, startY: start.y, endX: end.x, endY: end.y };

  const fromIsCircle = from.shape === "circle";
  const { width: w1, height: h1 } = fromIsCircle
    ? { width: 96, height: 96 }
    : nodeSize(from.label || from.id);

  let startX = start.x;
  let startY = start.y;

  if (fromIsCircle) {
    const dist = Math.hypot(dx, dy);
    startX = start.x + (dx / dist) * 48;
    startY = start.y + (dy / dist) * 48;
  } else {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx * (h1 / 2) > absDy * (w1 / 2)) {
      const signX = dx > 0 ? 1 : -1;
      startX = start.x + signX * (w1 / 2);
      startY = start.y + (dy / absDx) * (w1 / 2);
    } else {
      const signY = dy > 0 ? 1 : -1;
      startX = start.x + (dx / absDy) * (h1 / 2);
      startY = start.y + signY * (h1 / 2);
    }
  }

  const toIsCircle = to.shape === "circle";
  const { width: w2, height: h2 } = toIsCircle
    ? { width: 96, height: 96 }
    : nodeSize(to.label || to.id);

  let endX = end.x;
  let endY = end.y;

  if (toIsCircle) {
    const dist = Math.hypot(dx, dy);
    endX = end.x - (dx / dist) * 52;
    endY = end.y - (dy / dist) * 52;
  } else {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx * (h2 / 2) > absDy * (w2 / 2)) {
      const signX = dx > 0 ? 1 : -1;
      endX = end.x - signX * (w2 / 2 + 5);
      endY = end.y - (dy / absDx) * (w2 / 2 + 5);
    } else {
      const signY = dy > 0 ? 1 : -1;
      endX = end.x - (dx / absDy) * (h2 / 2 + 5);
      endY = end.y - signY * (h2 / 2 + 5);
    }
  }

  return { startX, startY, endX, endY };
}

function ArrowElement({ element, nodesById }) {
  const from = nodesById.get(element.from);
  const to = nodesById.get(element.to);
  if (!from || !to) return null;

  const { startX, startY, endX, endY } = getIntersectionPoint(from, to);
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 8;
  const lines = String(element.label || "").split("\n");

  return (
    <g className="board-item">
      <line
        className="draw-arrow"
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        markerEnd="url(#arrowhead)"
      />
      {element.label && (
        <text x={midX} y={midY} textAnchor="middle" className="arrow-label">
          {lines.map((line, idx) => (
            <tspan key={idx} x={midX} dy={idx === 0 ? 0 : 15}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </g>
  );
}

// ─── Other element types ──────────────────────────────────────────────────────

function EquationElement({ element }) {
  return (
    <g className="board-item">
      <rect x={element.x} y={element.y - 34} width="330" height="58" rx="8" className="formula-bg" />
      <text x={element.x + 18} y={element.y + 3} className="formula-text">
        {element.latex}
      </text>
    </g>
  );
}

function CodeBlockElement({ element }) {
  const lines = String(element.snippet || "").split("\n").slice(0, 7);
  return (
    <g className="board-item">
      <rect
        x={element.x}
        y={element.y - 26}
        width="375"
        height={lines.length * 24 + 48}
        rx="8"
        className="code-bg"
      />
      <text x={element.x + 16} y={element.y} className="code-title">
        {element.language || "code"}
      </text>
      {lines.map((line, index) => (
        <text
          key={`${element.id}-${index}`}
          x={element.x + 16}
          y={element.y + 30 + index * 22}
          className="code-line"
        >
          {line || " "}
        </text>
      ))}
    </g>
  );
}

function TextLabelElement({ element }) {
  return (
    <text x={element.x} y={element.y} className="floating-label board-item">
      {element.text || element.label}
    </text>
  );
}

function LineElement({ element }) {
  return (
    <line
      className="board-item sketch-line"
      x1={element.x1 || element.x || 0}
      y1={element.y1 || element.y || 0}
      x2={element.x2 || element.toX || 100}
      y2={element.y2 || element.toY || 100}
    />
  );
}

function MermaidElement({ element }) {
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!element.code) return;
    const renderDiagram = async () => {
      try {
        const id = `mermaid-svg-${element.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
        const { svg } = await mermaid.render(id, element.code);
        const startIdx = svg.indexOf(">") + 1;
        const endIdx = svg.lastIndexOf("</svg>");
        setSvgContent(svg.slice(startIdx, endIdx));
        setError(null);
      } catch (err) {
        console.error("Mermaid parsing error:", err);
        setError("Error parsing diagram");
      }
    };
    renderDiagram();
  }, [element.code, element.id]);

  const x = element.x || 50;
  const y = element.y || 50;
  const width = element.width || 900;
  const height = element.height || 500;

  if (error) {
    return (
      <g className="board-item">
        <rect x={x} y={y} width={300} height={60} fill="#ef444422" stroke="#ef4444" strokeWidth="2" rx="8" />
        <text x={x + 15} y={y + 35} fill="#ef4444" fontWeight="bold">
          Error rendering diagram
        </text>
      </g>
    );
  }

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      className="board-item"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

// ─── Layout engine ────────────────────────────────────────────────────────────

/**
 * Build parent→children map from the "parent" field on each node.
 * This is what makes deep hierarchies work – we don't rely purely on arrows.
 */
function buildParentEdgesFromNodes(nodes, existingArrows) {
  const arrowSet = new Set(existingArrows.map((a) => `${a.from}→${a.to}`));
  const syntheticArrows = [];

  for (const node of nodes) {
    if (node.parent && node.parent !== "null" && node.parent !== null) {
      const key = `${node.parent}→${node.id}`;
      if (!arrowSet.has(key)) {
        syntheticArrows.push({
          id: `_parent_${node.parent}_${node.id}`,
          from: node.parent,
          to: node.id,
          type: "arrow",
          label: "",
          _synthetic: true,
        });
        arrowSet.add(key);
      }
    }
  }

  return syntheticArrows;
}

/**
 * Assign level-based colours if the node doesn't have one or has the
 * wrong level colour (i.e., LLM sent wrong colour).
 */
function assignLevelColors(nodes, arrows) {
  const childOf = new Map();
  for (const a of arrows) {
    childOf.set(a.to, a.from);
  }
  // Also use parent field
  for (const n of nodes) {
    if (n.parent && n.parent !== "null") childOf.set(n.id, n.parent);
  }

  const levels = new Map();
  const visited = new Set();

  function getLevel(id) {
    if (levels.has(id)) return levels.get(id);
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const parent = childOf.get(id);
    if (!parent) {
      levels.set(id, 0);
      return 0;
    }
    const lvl = getLevel(parent) + 1;
    levels.set(id, lvl);
    return lvl;
  }

  return nodes.map((n) => ({
    ...n,
    color: LEVEL_COLORS[getLevel(n.id) % LEVEL_COLORS.length],
  }));
}

function runDagreLayout(nodes, arrows) {
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({
    rankdir: "TB",
    nodesep: 55,    // horizontal gap between sibling nodes
    ranksep: 80,    // vertical gap between levels
    marginx: 60,
    marginy: 60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const size = nodeSize(node.label || node.id);
    g.setNode(node.id, { width: size.width + 20, height: size.height + 12 });
  });

  arrows.forEach((arrow) => {
    if (g.hasNode(arrow.from) && g.hasNode(arrow.to)) {
      g.setEdge(arrow.from, arrow.to);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: pos ? pos.x : node.x || 500,
      y: pos ? pos.y : node.y || 300,
    };
  });
}

// ─── Main Canvas Component ────────────────────────────────────────────────────

const WhiteboardCanvas = forwardRef(function WhiteboardCanvas({ elements, isDrawing }, ref) {
  const [zoom, setZoom] = useState(1);
  const [layoutError, setLayoutError] = useState(null);

  const layoutedElements = useMemo(() => {
    const rawNodes = elements.filter((el) => el.type === "node");
    const rawArrows = elements.filter((el) => el.type === "arrow");
    const others = elements.filter((el) => el.type !== "node" && el.type !== "arrow");

    if (rawNodes.length === 0) return elements;

    const nodeIds = new Set(rawNodes.map((n) => n.id));

    // 1. Synthesise arrows from parent fields (deep hierarchy support)
    const syntheticArrows = buildParentEdgesFromNodes(rawNodes, rawArrows);
    const allArrows = [...rawArrows, ...syntheticArrows];

    // 2. Filter orphaned arrows (both endpoints must exist)
    const validArrows = allArrows.filter((a) => nodeIds.has(a.from) && nodeIds.has(a.to));
    const orphaned = allArrows.filter((a) => !nodeIds.has(a.from) || !nodeIds.has(a.to));
    if (orphaned.length > 0) {
      console.warn(`[Canvas] Dropped ${orphaned.length} orphaned arrows`, orphaned.map((a) => `${a.from}→${a.to}`));
    }

    // 3. Assign level-based colours
    const coloredNodes = assignLevelColors(rawNodes, validArrows);

    // 4. Run Dagre layout
    try {
      const positionedNodes = runDagreLayout(coloredNodes, validArrows);
      setLayoutError(null);
      console.log(`[Canvas] Layout: ${positionedNodes.length} nodes, ${validArrows.length} edges (${syntheticArrows.length} synthetic)`);
      // Only expose real arrows (not synthetic) to the renderer but keep synthetic for layout
      const realArrows = validArrows.filter((a) => !a._synthetic);
      return [...positionedNodes, ...realArrows, ...others];
    } catch (err) {
      console.error("[Canvas] Dagre layout failed:", err);
      setLayoutError("Layout calculation failed – nodes may overlap.");
      return elements;
    }
  }, [elements]); // ← REMOVED layoutError from deps to prevent infinite loop

  const nodesById = useMemo(() => {
    const map = new Map();
    layoutedElements
      .filter((el) => el.type === "node")
      .forEach((el) => map.set(el.id, el));
    return map;
  }, [layoutedElements]);

  // ── Dynamic viewBox: expand to fit all nodes ──────────────────────────────
  const viewBox = useMemo(() => {
    const nodes = layoutedElements.filter((el) => el.type === "node" && el.x !== undefined);
    if (nodes.length === 0) return `0 0 1000 700`;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const { width, height } = nodeSize(n.label || n.id);
      minX = Math.min(minX, n.x - width / 2);
      minY = Math.min(minY, n.y - height / 2);
      maxX = Math.max(maxX, n.x + width / 2);
      maxY = Math.max(maxY, n.y + height / 2);
    }

    const pad = 80;
    const W = Math.max(1000, maxX - minX + pad * 2);
    const H = Math.max(700, maxY - minY + pad * 2);
    const vx = (minX - pad) / zoom;
    const vy = (minY - pad) / zoom;

    return `${vx} ${vy} ${W / zoom} ${H / zoom}`;
  }, [layoutedElements, zoom]);

  return (
    <section className="whiteboard-panel">
      {layoutError && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(244, 63, 94, 0.22)",
            border: "1.5px solid #f43f5e",
            borderRadius: "6px",
            padding: "6px 14px",
            color: "#fda4af",
            fontSize: "12px",
            fontWeight: 700,
            zIndex: 10,
            backdropFilter: "blur(12px)",
          }}
        >
          {layoutError}
        </div>
      )}

      <div className="board-toolbar">
        <div className="board-status">
          <span className={isDrawing ? "status-dot active" : "status-dot"} />
          <span>{isDrawing ? "Drawing" : "Board"}</span>
        </div>
        <div className="board-status" style={{ fontSize: "11px", opacity: 0.6 }}>
          {layoutedElements.filter((e) => e.type === "node").length} nodes
        </div>
        <div className="zoom-controls">
          <button type="button" onClick={() => setZoom((v) => Math.max(0.3, v - 0.15))} title="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom">
            <Move size={16} />
          </button>
          <button type="button" onClick={() => setZoom((v) => Math.min(2.5, v + 0.15))} title="Zoom in">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <svg
        ref={ref}
        className="whiteboard-svg"
        viewBox={viewBox}
        role="img"
        aria-label="AI generated whiteboard"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.11)" strokeWidth="1" />
          </pattern>
          <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <path d="M 0 0 L 10 4 L 0 8 z" fill="#06b6d4" />
          </marker>
        </defs>

        <rect x="-5000" y="-5000" width="20000" height="20000" fill="#0d0d14" />
        <rect x="-5000" y="-5000" width="20000" height="20000" fill="url(#grid)" />

        {layoutedElements.map((element) => {
          if (element.type === "node")
            return <NodeElement key={element.id} element={element} />;
          if (element.type === "arrow")
            return <ArrowElement key={element.id} element={element} nodesById={nodesById} />;
          if (element.type === "equation")
            return <EquationElement key={element.id} element={element} />;
          if (element.type === "code")
            return <CodeBlockElement key={element.id} element={element} />;
          if (element.type === "text_label")
            return <TextLabelElement key={element.id} element={element} />;
          if (element.type === "mermaid")
            return <MermaidElement key={element.id} element={element} />;
          if (element.type === "line")
            return <LineElement key={element.id} element={element} />;
          return null;
        })}
      </svg>
    </section>
  );
});

export default WhiteboardCanvas;
