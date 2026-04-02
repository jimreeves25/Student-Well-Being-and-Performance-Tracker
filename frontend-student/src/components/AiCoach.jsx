import { useEffect, useRef, useState } from "react";
import "../styles/AiCoach.css";

const MODES = {
  study: {
    label: "Study Help",
    placeholder: "Ask Study Help...",
    system:
      "You are an expert AI study coach for a student wellness and performance tracker app. Help students understand difficult topics, explain concepts clearly, suggest study strategies, and provide encouragement. Keep responses concise (3-5 sentences unless explaining a complex topic). Be warm, direct, and practical. Use plain text. No markdown headers. Short paragraphs. If listing steps, use 1. 2. 3. format.",
    pills: [
      "Explain this concept to me",
      "I'm stuck on math",
      "Help me understand physics",
      "Best way to memorize things?",
    ],
  },
  plan: {
    label: "Plan My Day",
    placeholder: "Tell me about your day...",
    system:
      "You are an AI productivity coach helping a student plan their study day. Ask about their subjects, energy levels, deadlines, and breaks. Then generate a realistic time-blocked schedule. Be practical: specific time slots, buffer time, breaks included. Use plain text with time slots like 9:00-10:30: Math revision. No markdown.",
    pills: [
      "Plan today for me",
      "I have exams next week",
      "I only have 2 hours to study",
      "Make me a weekly schedule",
    ],
  },
  wellness: {
    label: "Wellness Check",
    placeholder: "How are you feeling?",
    system:
      "You are a supportive student wellness coach. Help students manage stress, burnout, sleep, and mental health around academics. Be empathetic first, then practical. Ask how they are feeling. Give actionable wellness tips. Never diagnose. Keep responses warm and human. 3-4 sentences. Plain text only.",
    pills: [
      "I feel overwhelmed",
      "I can't sleep before exams",
      "I have no motivation",
      "How do I reduce study stress?",
    ],
  },
  quiz: {
    label: "Quiz Me",
    placeholder: "Tell me a subject to quiz you on...",
    system:
      "You are an AI tutor who quizzes students to test their knowledge. When the user tells you a subject, generate 1 question at a time. Wait for their answer, then give feedback: correct or incorrect plus a brief explanation. Then ask the next question. Adapt difficulty based on their performance. Keep it engaging. Plain text only.",
    pills: [
      "Quiz me on biology",
      "Test my math skills",
      "Ask me history questions",
      "Quiz me on any topic",
    ],
  },
};

function getModeIntro(mode) {
  if (mode === "study") return "Tell me what topic feels difficult and I will break it down step by step.";
  if (mode === "plan") return "Share your available time and deadlines, and I will build a practical schedule.";
  if (mode === "wellness") return "Tell me how you feel right now and we will make a calm, realistic plan.";
  if (mode === "quiz") return "Give me a subject and I will quiz you one question at a time.";
  return "How can I support your learning today?";
}

export default function AiCoach() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("study");
  const [msgCount, setMsgCount] = useState(0);
  const [sessionStart] = useState(Date.now());
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const textareaRef = useRef(null);
  const chatListRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        role: "ai",
        text: "Hi! I am your AI Study Coach. Ask me anything, switch modes above, or pick a quick start below.",
      },
    ]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart) / 60000);
      setSessionMinutes(elapsed);
    }, 30000);

    return () => clearInterval(interval);
  }, [sessionStart]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

  async function sendMessage(rawInput) {
    const effectiveInput = typeof rawInput === "string" ? rawInput : input;
    if (!effectiveInput.trim() || loading) return;
    const userText = effectiveInput.trim();
    setInput("");
    setLoading(true);
    setMsgCount((prev) => prev + 1);

    const newMsg = { role: "user", content: userText };
    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    const newHistory = [...history, newMsg].slice(-10);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory,
          systemPrompt: MODES[mode].system,
        }),
      });

      if (!response.ok) throw new Error("Server error " + response.status);

      const data = await response.json();
      const reply = data.content?.map((b) => b.text || "").join("") || "Sorry, I could not generate a response.";

      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
      setHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            "Error: " +
            err.message +
            ". Make sure the proxy server is running on port 3001 with node server.js",
        },
      ]);
    }

    setLoading(false);
  }

  function switchMode(newMode) {
    setMode(newMode);
    setHistory([]);
    setMessages([
      {
        role: "ai",
        text: "Switched to " + MODES[newMode].label + ". " + getModeIntro(newMode),
      },
    ]);
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className="ai-coach-shell" aria-label="AI Study Coach">
      <div className="ai-coach-modes" role="tablist" aria-label="Coach modes">
        {Object.entries(MODES).map(([key, config]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`ai-coach-mode-btn ${mode === key ? "active" : ""}`}
            onClick={() => switchMode(key)}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className="ai-coach-stats-bar">Messages today: {msgCount} | Mode: {MODES[mode].label} | Session: {sessionMinutes} min</div>

      <div className="ai-coach-quick-pills">
        {MODES[mode].pills.map((pill) => (
          <button
            key={pill}
            type="button"
            className="ai-coach-pill"
            onClick={() => {
              setInput(pill);
              sendMessage(pill);
            }}
            disabled={loading}
          >
            {pill}
          </button>
        ))}
      </div>

      <div className="ai-coach-chat-list" ref={chatListRef}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`ai-coach-row ${message.role === "user" ? "user" : "assistant"}`}>
            <div className="ai-coach-bubble">{message.text}</div>
          </div>
        ))}

        {loading && (
          <div className="ai-coach-row assistant">
            <div className="ai-coach-bubble">Thinking...</div>
          </div>
        )}
      </div>

      <form className="ai-coach-input-wrap" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={MODES[mode].placeholder}
          rows={1}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}