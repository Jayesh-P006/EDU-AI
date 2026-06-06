import { useRef } from "react";
import { Download, Eraser, Network } from "lucide-react";

import ChatPanel from "./components/ChatPanel.jsx";
import WhiteboardCanvas from "./components/WhiteboardCanvas.jsx";
import useWhiteboardStream from "./hooks/useWhiteboardStream.js";

function App() {
  const svgRef = useRef(null);
  const {
    elements,
    messages,
    isStreaming,
    isDrawing,
    askQuestion,
    clearBoard,
    clearChat,
  } = useWhiteboardStream();

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 960;
      const context = canvas.getContext("2d");
      context.fillStyle = "#0d0d14";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "edu-ai-whiteboard.png";
      link.click();
      URL.revokeObjectURL(url);
    };

    image.src = url;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Network size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h1>EDU-AI Whiteboard</h1>
            <p>Live doubt solving with synchronized diagrams</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={exportPng} title="Export PNG">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button
            className="icon-button ghost"
            type="button"
            onClick={() => {
              clearBoard();
              clearChat();
            }}
            title="Clear board and chat"
          >
            <Eraser size={18} />
            <span>Clear</span>
          </button>
        </div>
      </header>

      <section className="workspace">
        <WhiteboardCanvas ref={svgRef} elements={elements} isDrawing={isDrawing} />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          isDrawing={isDrawing}
          onAsk={askQuestion}
        />
      </section>
    </main>
  );
}

export default App;
