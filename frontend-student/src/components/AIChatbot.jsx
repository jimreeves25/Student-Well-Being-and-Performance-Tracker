import React, { useState, useRef, useEffect } from "react";
import "../styles/AIChatbot.css";
import { sendChatMessage } from "../services/api";

const HISTORY_KEY = "aiAssistant_history";
const MAX_STORED_MESSAGES = 50;
const CONTEXT_WINDOW = 20;

const DEFAULT_WELCOME_MESSAGE = {
  role: "assistant",
  content: "Hi! I'm your AI study assistant. Ask me about scheduling, studying tips, or managing stress! 🎓",
  timestamp: new Date(),
};

const ACTION_LABELS = {
  ADD_LOG: "Daily log updated!",
  ADD_ASSIGNMENT: "Assignment added!",
  UPDATE_LOG: "Daily log updated!",
  CHECK_ASSIGNMENTS: "Assignments checked!",
};

const moodToRating = {
  happy: 8,
  good: 7,
  calm: 7,
  neutral: 5,
  okay: 5,
  stressed: 4,
  sad: 3,
  tired: 4,
};

const parseMessageTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const extractActionTags = (text = "") => {
  const actions = [];
  const regex = /\[ACTION:([A-Z_]+)(?::([^\]]+))?\]/g;
  let match = regex.exec(text);

  while (match) {
    const [, actionType, payloadRaw] = match;
    let payload = null;

    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        payload = null;
      }
    }

    actions.push({ actionType, payload });
    match = regex.exec(text);
  }

  const cleanedText = text.replace(regex, "").replace(/\s{2,}/g, " ").trim();
  return { cleanedText, actions };
};

/**
 * AIChatbot - Floating AI Assistant
 * Renders as a single floating widget at bottom-right of the screen.
 * Should be rendered once globally (e.g., in App.js).
 */
function AIChatbot({ studentContext = null }) {
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return;

      const restoredMessages = parsed
        .slice(-MAX_STORED_MESSAGES)
        .map((msg) => ({
          role: msg?.role === "user" ? "user" : "assistant",
          content: String(msg?.content || ""),
          timestamp: parseMessageTimestamp(msg?.timestamp),
          confirmations: Array.isArray(msg?.confirmations) ? msg.confirmations : [],
        }))
        .filter((msg) => msg.content);

      if (!restoredMessages.length) return;

      setMessages(restoredMessages);
      setConversationHistory(
        restoredMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    } catch (error) {
      console.warn("Failed to restore AI assistant history", error);
    }
  }, []);

  useEffect(() => {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    const serializable = trimmed.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      confirmations: Array.isArray(msg.confirmations) ? msg.confirmations : [],
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(serializable));
  }, [messages]);

  const handleAppAction = async (actionType, data = null) => {
    const actions = window.appActions || {};

    switch (actionType) {
      case "ADD_LOG": {
        if (typeof actions.addDailyLog !== "function") throw new Error("addDailyLog is unavailable");
        const moodValue = String(data?.mood || "").trim().toLowerCase();
        const payload = {
          ...(data || {}),
          moodRating:
            Number.isFinite(Number(data?.moodRating))
              ? Number(data.moodRating)
              : moodToRating[moodValue] || undefined,
        };
        await actions.addDailyLog(payload);
        return { confirmation: ACTION_LABELS.ADD_LOG };
      }
      case "ADD_ASSIGNMENT": {
        if (typeof actions.addAssignment !== "function") throw new Error("addAssignment is unavailable");
        await actions.addAssignment(data || {});
        return { confirmation: ACTION_LABELS.ADD_ASSIGNMENT };
      }
      case "UPDATE_LOG": {
        if (typeof actions.updateTodayLog !== "function") throw new Error("updateTodayLog is unavailable");
        await actions.updateTodayLog(data || {});
        return { confirmation: ACTION_LABELS.UPDATE_LOG };
      }
      case "CHECK_ASSIGNMENTS": {
        if (typeof actions.getAssignments !== "function") throw new Error("getAssignments is unavailable");
        const assignments = await actions.getAssignments();
        return {
          confirmation: ACTION_LABELS.CHECK_ASSIGNMENTS,
          assignments: Array.isArray(assignments) ? assignments : [],
        };
      }
      default:
        return { confirmation: "Action ignored." };
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setConversationHistory([]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userInput = inputMessage.trim();

    const userMessage = {
      role: "user",
      content: userInput,
      timestamp: new Date(),
    };

    const userHistoryItem = {
      role: "user",
      content: userInput,
    };

    const nextConversationHistory = [...conversationHistory, userHistoryItem];
    const conversationHistoryForRequest = nextConversationHistory.slice(-CONTEXT_WINDOW);

    setMessages((prev) => [...prev, userMessage]);
    setConversationHistory(nextConversationHistory);
    setInputMessage("");
    setIsLoading(true);

    try {
      const systemPrompt = "You are an advanced AI study assistant with access to the student's app. You can update their daily logs, add assignments, and check their schedule by including action tags in your response like [ACTION:ADD_ASSIGNMENT:{...}]. Always confirm before taking actions. Be proactive in suggesting to log their mood, study hours, or upcoming assignments.";
      const response = await sendChatMessage(conversationHistoryForRequest, systemPrompt);

      const aiReply = response?.content?.[0]?.text || "Something went wrong, try again";
      const { cleanedText, actions } = extractActionTags(aiReply);
      const confirmations = [];
      let assignmentsSnapshot = null;

      for (const action of actions) {
        try {
          const result = await handleAppAction(action.actionType, action.payload);
          if (result?.confirmation) confirmations.push(`✅ ${result.confirmation}`);
          if (Array.isArray(result?.assignments)) {
            assignmentsSnapshot = result.assignments;
          }
        } catch (actionError) {
          confirmations.push(`⚠️ ${action.actionType} failed: ${actionError.message}`);
        }
      }

      const assistantText = cleanedText || (confirmations.length ? "Action completed." : aiReply);

      const aiMessage = {
        role: "assistant",
        content: assistantText,
        timestamp: new Date(),
        confirmations,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setConversationHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
        },
      ]);

      if (Array.isArray(assignmentsSnapshot)) {
        const assignmentPreview = assignmentsSnapshot.slice(0, 5).map((assignment) => {
          const title = assignment?.title || "Untitled";
          const dueDate = assignment?.dueDate ? ` (due ${new Date(assignment.dueDate).toLocaleDateString()})` : "";
          return `- ${title}${dueDate}`;
        });

        const followupText = assignmentPreview.length
          ? `Here are your current assignments:\n${assignmentPreview.join("\n")}`
          : "You currently have no assignments.";

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: followupText,
            timestamp: new Date(),
          },
        ]);
        setConversationHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: followupText,
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error.message || "Something went wrong, try again",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    "Create a study schedule for today",
    "How can I reduce stress?",
    "Tips for better sleep",
    "Improve my focus",
  ];

  const handleQuickAction = (action) => {
    setInputMessage(action);
  };

  return (
    <div className="ai-chatbot-floating fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="chat-window chat-window-open">
          <div className="chat-header">
            <div className="chat-header-content">
              <div className="chat-avatar">🤖</div>
              <div>
                <h3>AI Study Assistant</h3>
                <p className="chat-status">
                  <span className="status-dot"></span> Online
                </p>
              </div>
            </div>
            <button type="button" onClick={handleClearHistory} className="clear-history-btn">
              Clear History
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${msg.role === "user" ? "user-message" : "ai-message"}`}
              >
                <div className="message-avatar">
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div className="message-content">
                  <p>{msg.content}</p>
                  {Array.isArray(msg.confirmations) && msg.confirmations.length > 0 && (
                    <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {msg.confirmations.map((note, noteIndex) => (
                        <span
                          key={`${index}-${noteIndex}`}
                          style={{
                            background: "#d1fae5",
                            color: "#065f46",
                            borderRadius: "999px",
                            fontSize: "11px",
                            padding: "3px 8px",
                            fontWeight: 600,
                          }}
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="message-time">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message ai-message">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="quick-actions">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(action)}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !inputMessage.trim()}>
              {isLoading ? "..." : "➤"}
            </button>
          </form>
        </div>
      )}

      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        title="AI Assistant"
      >
        {isOpen ? "✕" : "💬"}
        {!isOpen && <span className="chat-badge">AI</span>}
      </button>
    </div>
  );
}

export default AIChatbot;
