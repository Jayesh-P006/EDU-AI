/**
 * Parses Mermaid flowchart/graph text and computes a layered layout for nodes and edges.
 * Supports TD (Top-Down) and LR (Left-to-Right) orientations.
 *
 * @param {string} code Mermaid diagram code
 * @param {number} baseX X starting offset
 * @param {number} baseY Y starting offset
 * @param {number} width Render width
 * @param {number} height Render height
 */
export function parseMermaidFlowchart(code, baseX = 50, baseY = 50, width = 900, height = 500) {
  if (!code) return null;
  // Split lines by newlines or semicolons
  const lines = code.split(/[\n;]/);
  const nodes = new Map(); // id -> { id, label, shape, color }
  const edges = []; // { id, from, to, label }
  let direction = "TD";

  const registerNode = (id, label, shape) => {
    id = id.trim();
    if (!id) return;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: label || id,
        shape: shape || "rect",
        color: "#6366f1",
      });
    } else {
      const existing = nodes.get(id);
      if (label) existing.label = label;
      if (shape) existing.shape = shape;
    }
  };

  const shapeRegexes = [
    // Double circle/circle: id((label))
    {
      regex: /([a-zA-Z0-9_-]+?)\(\("([^"]+)"\)\)/g,
      shape: "circle",
    },
    {
      regex: /([a-zA-Z0-9_-]+?)\(\(([^)]+)\)\)/g,
      shape: "circle",
    },
    // Stadium: id([label])
    {
      regex: /([a-zA-Z0-9_-]+?)\[\("([^"]+)"\)\]/g,
      shape: "rect",
    },
    {
      regex: /([a-zA-Z0-9_-]+?)\[\(([^)]+)\)\]/g,
      shape: "rect",
    },
    // Rounded rect: id(label)
    {
      regex: /([a-zA-Z0-9_-]+?)\("([^"]+)"\)/g,
      shape: "rect",
    },
    {
      regex: /([a-zA-Z0-9_-]+?)\(([^)]+)\)/g,
      shape: "rect",
    },
    // Rhombus: id{label}
    {
      regex: /([a-zA-Z0-9_-]+?)\{"([^"]+)"\}/g,
      shape: "rect",
    },
    {
      regex: /([a-zA-Z0-9_-]+?)\{([^}]+)\}/g,
      shape: "rect",
    },
    // Rect: id[label]
    {
      regex: /([a-zA-Z0-9_-]+?)\["([^"]+)"\]/g,
      shape: "rect",
    },
    {
      regex: /([a-zA-Z0-9_-]+?)\[([^\]]+)\]/g,
      shape: "rect",
    },
  ];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("%%")) continue;

    // Detect direction
    const dirMatch = line.match(/^\s*(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase();
      if (direction === "TB") direction = "TD";
      continue;
    }

    let cleanedLine = line;
    for (const item of shapeRegexes) {
      cleanedLine = cleanedLine.replace(item.regex, (match, id, label) => {
        const cleanLabel = label.replace(/<br\s*\/?>/gi, "\n");
        registerNode(id, cleanLabel, item.shape);
        return id;
      });
    }

    // Match connection lines:
    // 1. A -- "label" --> B or A -- label --> B
    // 2. A -->|label| B (allowing extra > character like A -->|label|> B)
    // 3. A --> B or A --- B
    const connectionRegexes = [
      /([a-zA-Z0-9_-]+?)\s*--\s*(?:"([^"]+)"|([^"-]+))\s*(?:-->|-.->|==>|->)\s*([a-zA-Z0-9_-]+)/,
      /([a-zA-Z0-9_-]+?)\s*(?:-->|-.->|==>|->)\s*\|(?:"([^"]+)"|([^|]+))\|\s*>?\s*([a-zA-Z0-9_-]+)/,
      /([a-zA-Z0-9_-]+?)\s*(?:-->|---|-.->|==>|->)\s*([a-zA-Z0-9_-]+)/,
    ];

    let matched = false;
    for (const regex of connectionRegexes) {
      const match = cleanedLine.match(regex);
      if (match) {
        let from, to, label = "";
        if (regex.source.includes("--\\s*")) {
          from = match[1];
          label = (match[2] || match[3] || "").trim();
          to = match[4];
        } else if (regex.source.includes("\\|")) {
          from = match[1];
          label = (match[2] || match[3] || "").trim();
          to = match[4];
        } else {
          from = match[1];
          to = match[2];
        }

        registerNode(from, from, "rect");
        registerNode(to, to, "rect");

        edges.push({
          id: `${from}-${to}-${edges.length}`,
          from,
          to,
          label: label.replace(/<br\s*\/?>/gi, "\n"),
          type: "arrow",
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      const idMatch = cleanedLine.match(/^\s*([a-zA-Z0-9_-]+)\s*$/);
      if (idMatch) {
        const id = idMatch[1];
        registerNode(id, id, "rect");
      }
    }
  }

  if (nodes.size === 0) {
    return null;
  }

  // Level Assignment (Relaxation Algorithm - Cycle Proof)
  const levels = new Map();
  for (const nodeId of nodes.keys()) {
    levels.set(nodeId, 0);
  }

  const numNodes = nodes.size;
  for (let i = 0; i < numNodes; i++) {
    let changed = false;
    for (const edge of edges) {
      const u = edge.from;
      const v = edge.to;
      if (nodes.has(u) && nodes.has(v)) {
        const uLvl = levels.get(u) || 0;
        const vLvl = levels.get(v) || 0;
        if (uLvl + 1 > vLvl) {
          levels.set(v, uLvl + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Group nodes by level
  const levelGroups = [];
  for (const [nodeId, lvl] of levels.entries()) {
    if (!levelGroups[lvl]) {
      levelGroups[lvl] = [];
    }
    levelGroups[lvl].push(nodes.get(nodeId));
  }
  const activeLevels = levelGroups.filter((g) => g && g.length > 0);

  // Position nodes beautiful grid
  const numLevels = activeLevels.length;
  const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

  activeLevels.forEach((group, levelIdx) => {
    const N = group.length;
    const levelColor = colors[levelIdx % colors.length];

    if (direction === "TD") {
      const levelSpacing = numLevels > 1 ? height / (numLevels + 0.5) : height / 2;
      const y = baseY + (levelIdx + 0.5) * levelSpacing;
      const nodeSpacingX = Math.min(250, width / (N + 0.5));
      group.forEach((node, idx) => {
        node.x = baseX + width / 2 + (idx - (N - 1) / 2) * nodeSpacingX;
        node.y = y;
        node.color = levelColor;
      });
    } else {
      const levelSpacing = numLevels > 1 ? width / (numLevels + 0.5) : width / 2;
      const x = baseX + (levelIdx + 0.5) * levelSpacing;
      const nodeSpacingY = Math.min(150, height / (N + 0.5));
      group.forEach((node, idx) => {
        node.x = x;
        node.y = baseY + height / 2 + (idx - (N - 1) / 2) * nodeSpacingY;
        node.color = levelColor;
      });
    }
  });

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}
