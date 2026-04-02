import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "../services/aiService";
import "../styles/AIChatbot.css";

/**
 * AIChatbot - Floating AI Assistant
 * Renders as a single floating widget at bottom-right of the screen.
 * Should be rendered once globally (e.g., in App.js).
 */
function AIChatbot({ studentContext = null }) {
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your AI study assistant. Ask me about scheduling, studying tips, or managing stress! 🎓",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Get AI response
    const response = await sendChatMessage(inputMessage, studentContext, messages);

    const aiMessage = {
      role: "assistant",
        content: response?.message || "I couldn't process that request. Please try again.",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiMessage]);
    setIsLoading(false);
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
