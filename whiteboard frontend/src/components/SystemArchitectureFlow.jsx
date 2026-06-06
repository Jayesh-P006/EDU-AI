import React, { useCallback } from "react";
import ReactFlow, {
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Background,
  Controls,
  MiniMap,
  Handle,
} from "reactflow";
import dagre from "dagre";
import {
  User,
  Monitor,
  Cpu,
  BrainCircuit,
  Cloud,
  Network,
  Paintbrush,
  MessageSquare,
  Volume2,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

import "reactflow/dist/style.css";

// 1. Custom Node Component
const CustomArchitectureNode = ({ data, targetPosition, sourcePosition }) => {
  const Icon = data.icon;
  return (
    <div className="bg-slate-900 border-2 border-indigo-500/20 hover:border-indigo-500/60 hover:shadow-indigo-500/10 hover:shadow-xl transition-all duration-300 rounded-xl p-4 w-[280px] text-slate-100 flex items-start gap-3 relative shadow-lg select-none">
      <Handle
        type="target"
        position={targetPosition || Position.Top}
        className="!w-3 !h-3 !bg-indigo-500 border border-slate-900"
      />
      <div className={`p-2.5 rounded-lg shrink-0 ${data.bgColor || "bg-indigo-500/10 text-indigo-400"}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm text-slate-100 leading-tight">{data.title}</h3>
        <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap leading-normal">{data.subtitle}</p>
      </div>
      <Handle
        type="source"
        position={sourcePosition || Position.Bottom}
        className="!w-3 !h-3 !bg-indigo-500 border border-slate-900"
      />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomArchitectureNode,
};

// 2. Define Initial Elements matching whiteboard_flow.mmd
const initialNodes = [
  {
    id: "User",
    type: "customNode",
    data: {
      title: "Student / User",
      subtitle: "Inputs query & clicks Ask",
      icon: User,
      bgColor: "bg-emerald-500/10 text-emerald-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "Frontend",
    type: "customNode",
    data: {
      title: "React Frontend (Vite)",
      subtitle: "Vite + Tailwind web app panel",
      icon: Monitor,
      bgColor: "bg-cyan-500/10 text-cyan-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "API",
    type: "customNode",
    data: {
      title: "FastAPI Backend (solve)",
      subtitle: "Python API routes & SSE handler",
      icon: Cpu,
      bgColor: "bg-amber-500/10 text-amber-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "Service",
    type: "customNode",
    data: {
      title: "Groq Whiteboard Service",
      subtitle: "Translates history & formats system prompt",
      icon: BrainCircuit,
      bgColor: "bg-purple-500/10 text-purple-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "GroqAPI",
    type: "customNode",
    data: {
      title: "Groq Cloud API",
      subtitle: "Llama 3 inference engine",
      icon: Cloud,
      bgColor: "bg-blue-500/10 text-blue-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "Hook",
    type: "customNode",
    data: {
      title: "useWhiteboardStream Hook",
      subtitle: "Dynamic stream buffer & state dispatch",
      icon: Network,
      bgColor: "bg-indigo-500/10 text-indigo-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "Canvas",
    type: "customNode",
    data: {
      title: "Whiteboard Canvas",
      subtitle: "Draws native SVG nodes/lines",
      icon: Paintbrush,
      bgColor: "bg-rose-500/10 text-rose-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "Chat",
    type: "customNode",
    data: {
      title: "Chat Panel",
      subtitle: "Displays conversation stream",
      icon: MessageSquare,
      bgColor: "bg-pink-500/10 text-pink-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "TTS",
    type: "customNode",
    data: {
      title: "Text to Speech",
      subtitle: "Web speech synthesiser voice",
      icon: Volume2,
      bgColor: "bg-teal-500/10 text-teal-400",
    },
    position: { x: 0, y: 0 },
  },
  {
    id: "End",
    type: "customNode",
    data: {
      title: "Completes Stream",
      subtitle: "Enables input fields",
      icon: CheckCircle2,
      bgColor: "bg-sky-500/10 text-sky-400",
    },
    position: { x: 0, y: 0 },
  },
];

const initialEdges = [
  {
    id: "e-user-frontend",
    source: "User",
    target: "Frontend",
    label: "Types Question & clicks Ask",
    type: "smoothstep",
  },
  {
    id: "e-frontend-api",
    source: "Frontend",
    target: "API",
    label: "1. Sends POST Solve request (question, subject, history)",
    type: "smoothstep",
  },
  {
    id: "e-api-service",
    source: "API",
    target: "Service",
    label: "2. Translates request to messages (System Prompt + History)",
    type: "smoothstep",
  },
  {
    id: "e-service-groqapi",
    source: "Service",
    target: "GroqAPI",
    label: "3. Calls OpenAI-compatible streaming API",
    type: "smoothstep",
  },
  {
    id: "e-groqapi-service",
    source: "GroqAPI",
    target: "Service",
    label: "4. Streams back JSON Lines (SSE)",
    type: "smoothstep",
  },
  {
    id: "e-service-api",
    source: "Service",
    target: "API",
    label: "5. Parses & filters lines",
    type: "smoothstep",
  },
  {
    id: "e-api-frontend",
    source: "API",
    target: "Frontend",
    label: "6. Sends SSE ('data: {type: ...}')",
    type: "smoothstep",
  },
  {
    id: "e-frontend-hook",
    source: "Frontend",
    target: "Hook",
    label: "7. Processes chunks",
    type: "smoothstep",
  },
  {
    id: "e-hook-canvas",
    source: "Hook",
    target: "Canvas",
    label: "If type='draw'",
    type: "smoothstep",
  },
  {
    id: "e-hook-chat",
    source: "Hook",
    target: "Chat",
    label: "If type='text'",
    type: "smoothstep",
  },
  {
    id: "e-hook-tts",
    source: "Hook",
    target: "TTS",
    label: "If type='speak'",
    type: "smoothstep",
  },
  {
    id: "e-hook-end",
    source: "Hook",
    target: "End",
    label: "If type='done'",
    type: "smoothstep",
  },
];

// 3. Layout calculation using Dagre
const nodeWidth = 280;
const nodeHeight = 100;

const getLayoutedElements = (nodes, edges, direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  const layoutedEdges = edges.map((edge) => {
    return {
      ...edge,
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#6366f1",
      },
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

// 4. Main Component
export default function SystemArchitectureFlow() {
  const [layoutDir, setLayoutDir] = React.useState("TB");
  const { nodes: initialLayoutNodes, edges: initialLayoutEdges } = getLayoutedElements(
    JSON.parse(JSON.stringify(initialNodes)),
    JSON.parse(JSON.stringify(initialEdges)),
    "TB"
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayoutEdges);

  const onLayout = useCallback(
    (direction) => {
      setLayoutDir(direction);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        JSON.parse(JSON.stringify(nodes)),
        JSON.parse(JSON.stringify(edges)),
        direction
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [nodes, edges, setNodes, setEdges]
  );

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 z-10">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BrainCircuit size={18} className="text-indigo-400" />
            System Architecture Flowchart
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Auto-layout system flow visualization</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onLayout("TB")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              layoutDir === "TB"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <ArrowDown size={14} />
            Top-Down
          </button>
          <button
            onClick={() => onLayout("LR")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              layoutDir === "LR"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <ArrowRight size={14} />
            Left-Right
          </button>
        </div>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1 w-full h-full relative" style={{ height: "calc(100% - 70px)" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#334155" gap={16} size={1.5} />
          <Controls className="!bg-slate-900 !border-slate-800 !text-slate-100 fill-slate-100" />
          <MiniMap
            nodeStrokeColor={() => "#6366f1"}
            nodeColor={() => "#0f172a"}
            nodeBorderRadius={8}
            className="!bg-slate-900 !border-slate-800"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
