import { useCallback, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = window.speechSynthesis
    .getVoices()
    .find((candidate) => candidate.lang?.startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function toMessageHistory(messages) {
  return messages
    .filter((message) => message.content.trim())
    .slice(-10)
    .map((message) => ({
      role: message.role === "ai" ? "assistant" : "user",
      content: message.content,
    }));
}

function parseSseEvents(buffer) {
  const events = buffer.split("\n\n");
  return {
    completeEvents: events.slice(0, -1),
    rest: events.at(-1) || "",
  };
}

export default function useWhiteboardStream() {
  const [elements, setElements] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "ai",
      content: "Ask a doubt and I will build the explanation on the board.",
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingTimer = useRef(null);

  const flashDrawing = useCallback(() => {
    setIsDrawing(true);
    window.clearTimeout(drawingTimer.current);
    drawingTimer.current = window.setTimeout(() => setIsDrawing(false), 900);
  }, []);

  const handleDrawCommand = useCallback(
    (command, data = {}) => {
      flashDrawing();

      setElements((current) => {
        if (command === "clear") return [];
        if (command === "highlight") {
          return current.map((element) =>
            element.id === data.id
              ? { ...element, highlighted: true, highlightColor: data.color || "#f59e0b" }
              : element,
          );
        }

        const next = {
          ...data,
          id: data.id || crypto.randomUUID(),
          type: command,
          createdAt: Date.now(),
        };

        const updated = [...current, next];
        console.log(`[WhiteboardStream] Added draw element. Total active elements: ${updated.length}`);
        return updated.slice(-500); // 500 supports 25+ nodes + arrows + other elements
      });
    },
    [flashDrawing],
  );

  const appendAiText = useCallback((content) => {
    setMessages((current) => {
      const last = current.at(-1);
      if (last?.role === "ai" && last.streaming) {
        return current.map((message) =>
          message.id === last.id
            ? { ...message, content: `${message.content}${message.content ? " " : ""}${content}` }
            : message,
        );
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "ai",
          content,
          streaming: true,
        },
      ];
    });
  }, []);

  const handleChunk = useCallback(
    (chunk) => {
      console.log("[WhiteboardStream] Received streamed chunk:", chunk);
      if (chunk.type === "text") {
        appendAiText(chunk.content || "");
      }

      if (chunk.type === "draw") {
        console.log(`[WhiteboardStream] Dispatching DRAW: command="${chunk.command}"`, chunk.data);
        handleDrawCommand(chunk.command, chunk.data);
      }

      if (chunk.type === "speak") {
        speak(chunk.content);
      }

      if (chunk.type === "error") {
        console.error("[WhiteboardStream] SSE Stream error:", chunk.message);
        appendAiText(`Error: ${chunk.message || "Unable to solve this right now."}`);
      }

      if (chunk.type === "done") {
        console.log("[WhiteboardStream] SSE Stream fully completed.");
        setIsStreaming(false);
        setMessages((current) =>
          current.map((message) => (message.streaming ? { ...message, streaming: false } : message)),
        );
      }
    },
    [appendAiText, handleDrawCommand],
  );

  const askQuestion = useCallback(
    async (question, subject) => {
      const cleanQuestion = question.trim();
      if (!cleanQuestion || isStreaming) return;

      console.log(`[WhiteboardStream] Querying solver for subject="${subject}", question="${cleanQuestion}"`);
      const history = toMessageHistory(messages);
      setIsStreaming(true);
      // Auto-clear the board so the new concept map starts fresh
      setElements([]);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: cleanQuestion },
        { id: crypto.randomUUID(), role: "ai", content: "", streaming: true },
      ]);

      try {
        const response = await fetch(`${API_BASE}/api/whiteboard/solve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: cleanQuestion, subject, history }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          pending += decoder.decode(value, { stream: true });
          const { completeEvents, rest } = parseSseEvents(pending);
          pending = rest;

          for (const event of completeEvents) {
            const dataLines = event
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());
            if (!dataLines.length) continue;

            try {
              handleChunk(JSON.parse(dataLines.join("\n")));
            } catch {
              // Ignore malformed frames; the backend will keep streaming valid chunks.
            }
          }
        }
      } catch (error) {
        handleChunk({ type: "error", message: error.message });
      } finally {
        handleChunk({ type: "done" });
      }
    },
    [handleChunk, isStreaming, messages],
  );

  return {
    elements,
    messages,
    isStreaming,
    isDrawing,
    askQuestion,
    clearBoard: () => setElements([]),
    clearChat: () =>
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "ai",
          content: "Ask a doubt and I will build the explanation on the board.",
        },
      ]),
  };
}
