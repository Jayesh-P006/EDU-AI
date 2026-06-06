import { useRef, useState } from "react";
import { LoaderCircle, Mic, SendHorizontal, Square } from "lucide-react";

const SUBJECTS = ["General", "Math", "Physics", "CS", "Chemistry", "Biology"];

function startSpeechRecognition(onText, onDone) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onText("Speech recognition is not supported in this browser.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join("");
    onText(transcript);
  };
  recognition.onend = onDone;
  recognition.start();
  return recognition;
}

export default function ChatPanel({ messages, isStreaming, isDrawing, onAsk }) {
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("CS");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const submit = () => {
    const question = input.trim();
    if (!question || isStreaming) return;
    setInput("");
    onAsk(question, subject);
  };

  const toggleListening = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    recognitionRef.current = startSpeechRecognition(
      (text) => setInput(text),
      () => setIsListening(false),
    );
    setIsListening(Boolean(recognitionRef.current));
  };

  return (
    <aside className="chat-panel">
      <div className="panel-heading">
        <div>
          <h2>Doubt Thread</h2>
          <p>{isDrawing ? "Drawing..." : isStreaming ? "Thinking..." : "Ready"}</p>
        </div>
        {isStreaming && <LoaderCircle className="spin" size={20} />}
      </div>

      <div className="messages" aria-live="polite">
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <span>{message.role === "ai" ? "AI" : "You"}</span>
            <p>{message.content || (message.streaming ? "..." : "")}</p>
          </article>
        ))}
      </div>

      <div className="composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Type your doubt..."
          rows={3}
        />

        <div className="composer-actions">
          <select value={subject} onChange={(event) => setSubject(event.target.value)}>
            {SUBJECTS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>

          <button
            className={`round-button ${isListening ? "active" : ""}`}
            type="button"
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Speak doubt"}
          >
            {isListening ? <Square size={18} /> : <Mic size={18} />}
          </button>

          <button
            className="send-button"
            type="button"
            onClick={submit}
            disabled={isStreaming || !input.trim()}
            title="Ask"
          >
            <SendHorizontal size={18} />
            <span>Ask</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
