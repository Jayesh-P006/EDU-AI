import { useCallback, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const TTS_BASE = import.meta.env.VITE_TTS_BASE || "http://localhost:8002";

// ── Audio queue: Coqui TTS backend with browser-TTS fallback ─────────────────
const _audioQueue = [];
let _audioPlaying = false;
let _currentAudio = null;

function _playNext() {
  if (!_audioQueue.length) { _audioPlaying = false; return; }
  _audioPlaying = true;
  const { text, url } = _audioQueue.shift();
  if (url) {
    _currentAudio = new Audio(url);
    _currentAudio.onended = () => { URL.revokeObjectURL(url); _playNext(); };
    _currentAudio.onerror  = () => { URL.revokeObjectURL(url); _browserSpeak(text); };
    _currentAudio.play().catch(() => { URL.revokeObjectURL(url); _browserSpeak(text); });
  } else {
    _browserSpeak(text);
  }
}

function _browserSpeak(text) {
  if (!text || !("speechSynthesis" in window)) { _playNext(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate  = 0.92;
  u.pitch = 1.05;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith("en-") && v.localService);
  if (voice) u.voice = voice;
  u.onend = () => _playNext();
  u.onerror = () => _playNext();
  window.speechSynthesis.speak(u);
}

function stopSpeech() {
  _audioQueue.length = 0;
  _audioPlaying = false;
  if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

async function speak(text) {
  if (!text?.trim()) return;
  try {
    const res = await fetch(`${TTS_BASE}/api/whiteboard/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    _audioQueue.push({ text, url });
  } catch {
    // TTS backend unavailable — queue for browser fallback
    _audioQueue.push({ text, url: null });
  }
  if (!_audioPlaying) _playNext();
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
      stopSpeech();
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
