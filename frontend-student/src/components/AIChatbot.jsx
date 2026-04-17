import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/AIChatbot.css";
import { sendChatMessage, getChats, createChat, getChatMessages, saveMessage, updateChatTitle, deleteChat } from "../services/api";

const MAX_STORED_MESSAGES = 50;
const CONTEXT_WINDOW = 20;

const GENERAL_ASSISTANT_PROMPT = [
  "You are AI Assistant, a personal AI companion for students.",
  "You are not a generic chatbot.",
  "Talk like ChatGPT-style helpful conversation: natural, warm, direct, and adaptive.",
  "Respond dynamically based on the latest user input and prior chat context.",
  "Never repeat the same full response twice.",
  "Identity: calm, slightly witty, supportive, and real.",
  "Role: personal AI companion plus study partner.",
  "Talk like a smart friend and chill mentor who understands the student.",
  "Avoid robotic language, therapist script tone, and overly formal responses.",
  "Use plain text by default. Avoid markdown artifacts like ###, **bold**, or long template blocks unless the user asks for formatted output.",
  "Avoid repetitive sympathy lines and avoid generic phrases like 'I'm here to help'.",
  "Answer the user's actual question clearly, accurately, and naturally.",
  "If the user asks something simple, respond simply.",
  "Do not output a full-day schedule unless the user explicitly asks for it.",
  "If the user asks for planning help, ask one follow-up question before generating a plan.",
  "If unsure, ask a concise clarifying question instead of guessing.",
  "For study and learning: explain clearly and break ideas down step-by-step.",
  "For stress, frustration, sadness, or anger: respond with natural empathy and practical next steps in a human tone.",
  "For serious distress or self-harm language: respond with care and seriousness, encourage reaching out to trusted people or professionals, and stay supportive.",
  "Use occasional soft human touches like 'hmm', 'alright', or 'okay, let's think this through', but do not overuse them.",
  "If input is unclear, ask one concise clarification question.",
  "Do not force predefined flows or override user intent.",
  "Keep responses concise by default and detailed when needed.",
  "If user asks for points, return a clean one-by-one list with each point on a new line.",
  "When listing steps, prefer 1., 2., 3. format for readability.",
  "Prefer readable formatting: short paragraphs, bullet points, and numbered steps when helpful.",
  "Avoid dense long text blocks; keep line length easy to scan.",
  "If the user asks to perform an app action, you may include tags like [ACTION:ADD_LOG:{...}], [ACTION:ADD_ASSIGNMENT:{...}], [ACTION:UPDATE_LOG:{...}], or [ACTION:CHECK_ASSIGNMENTS]. Only include action tags when the user explicitly asks for an app action.",
].join(" ");

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const DEFAULT_WELCOME_MESSAGE = {
  role: "assistant",
  content: "Hey, I'm AI Assistant. What are we figuring out today: study plan, tough topic, or stress reset?",
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

const ATTACHMENT_META_PREFIX = "[ATTACHMENT_META:";

const normalizeAttachmentMeta = (attachment) => {
  if (!attachment || typeof attachment !== "object") return null;
  const name = String(attachment.name || "").trim();
  if (!name) return null;

  return {
    kind: String(attachment.kind || "file"),
    name,
    mimeType: String(attachment.mimeType || "application/octet-stream"),
  };
};

const appendAttachmentMetaToContent = (content, attachment) => {
  const meta = normalizeAttachmentMeta(attachment);
  if (!meta) return String(content || "");
  return `${String(content || "")}\n\n${ATTACHMENT_META_PREFIX}${JSON.stringify(meta)}]`;
};

const splitAttachmentMetaFromContent = (rawContent) => {
  const content = String(rawContent || "");
  const markerRegex = /\n?\[ATTACHMENT_META:(\{[\s\S]*\})\]\s*$/;
  const match = content.match(markerRegex);
  if (!match) {
    return { content, attachment: null };
  }

  try {
    const parsed = JSON.parse(match[1]);
    return {
      content: content.slice(0, match.index).trimEnd(),
      attachment: normalizeAttachmentMeta(parsed),
    };
  } catch (_error) {
    return { content, attachment: null };
  }
};

const getFileTypeBadge = (attachment) => {
  if (!attachment) return "📄";
  const name = String(attachment.name || "").toLowerCase();
  const mime = String(attachment.mimeType || "").toLowerCase();

  if (mime.startsWith("image/") || name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
    return "🖼️";
  }
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "📕";
  if (mime.includes("word") || mime.includes("document") || name.endsWith(".docx")) return "📘";
  if (mime.includes("presentation") || name.endsWith(".pptx")) return "📊";
  if (mime.includes("spreadsheet") || mime.includes("excel") || name.endsWith(".xlsx")) return "📑";
  if (mime.startsWith("text/") || name.match(/\.(txt|md|csv|json)$/)) return "📝";
  if (name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|html|css)$/)) return "💻";
  return "📎";
};

const makeChatId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makeNewChat = () => ({
  id: makeChatId(),
  title: "New chat",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [DEFAULT_WELCOME_MESSAGE],
});

const titleFromFirstUserMessage = (messages = []) => {
  const firstUser = messages.find((msg) => msg?.role === "user" && String(msg?.content || "").trim());
  if (!firstUser) return "New chat";
  const compact = String(firstUser.content).replace(/\s+/g, " ").trim();
  return compact.length > 38 ? `${compact.slice(0, 38)}...` : compact;
};

const getChatPreview = (chat) => {
  const latest = Array.isArray(chat?.messages) && chat.messages.length
    ? chat.messages[chat.messages.length - 1]
    : null;
  const text = String(latest?.content || "Start a conversation...").replace(/\s+/g, " ").trim();
  return text.length > 44 ? `${text.slice(0, 44)}...` : text;
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

const formatReadableResponse = (rawText = "") => {
  let text = String(rawText || "");

  // Remove markdown symbols that hurt readability in chat bubbles.
  text = text
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "");

  // Ensure list items are printed one-by-one.
  text = text
    .replace(/\s*(\d{1,2})\.\s+/g, "\n$1. ")
    .replace(/\s*[•-]\s+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
};

function AIChatbot({ studentContext = null }) {
  const [chatState, setChatState] = useState("minimized");
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const messagesContainerRef = useRef(null);
  const preservedScrollTopRef = useRef(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const isFullscreen = chatState === "fullscreen";
  const isMinimized = chatState === "minimized";

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || chats[0] || null,
    [chats, activeChatId]
  );

  const messages = activeChat?.messages || [DEFAULT_WELCOME_MESSAGE];

  const conversationHistory = useMemo(
    () => messages
      .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
      .map((msg) => ({ role: msg.role, content: String(msg.content || "") })),
    [messages]
  );

  useEffect(() => {
    console.log("Chat State:", chatState);
  }, [chatState]);

  useEffect(() => {
    if (!isMinimized) {
      setUnreadCount(0);
    }
  }, [isMinimized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isMinimized || !messagesContainerRef.current) return;

    window.requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = preservedScrollTopRef.current;
      }
    });
  }, [chatState, isMinimized]);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const backendChats = await getChats();
        if (Array.isArray(backendChats) && backendChats.length > 0) {
          const normalized = backendChats.map((chat) => ({
            id: String(chat.id),
            title: String(chat.title || "New chat"),
            createdAt: String(chat.createdAt || new Date().toISOString()),
            updatedAt: String(chat.updatedAt || chat.createdAt || new Date().toISOString()),
            messages: [DEFAULT_WELCOME_MESSAGE],
          }));
          setChats(normalized);
          setActiveChatId(normalized[0].id);
          return;
        }

        const created = await createChat("New chat");
        const initialChat = {
          id: String(created.id),
          title: String(created.title || "New chat"),
          createdAt: String(created.createdAt || new Date().toISOString()),
          updatedAt: String(created.updatedAt || created.createdAt || new Date().toISOString()),
          messages: [DEFAULT_WELCOME_MESSAGE],
        };
        setChats([initialChat]);
        setActiveChatId(initialChat.id);
      } catch (error) {
        console.error("Failed to load chats from backend", error);
        const fallbackChat = makeNewChat();
        setChats([fallbackChat]);
        setActiveChatId(fallbackChat.id);
      }
    };

    loadChats();
  }, []);

  useEffect(() => {
    if (!activeChatId) return;

    const loadMessages = async () => {
      try {
        const rows = await getChatMessages(activeChatId);
        const normalizedMessages = Array.isArray(rows)
          ? rows
              .slice(-MAX_STORED_MESSAGES)
              .map((msg) => {
                const parsed = splitAttachmentMetaFromContent(msg?.content);
                return {
                  role: msg?.role === "user" ? "user" : "assistant",
                  content: parsed.content,
                  attachment: parsed.attachment,
                  timestamp: parseMessageTimestamp(msg?.timestamp),
                  confirmations: Array.isArray(msg?.confirmations) ? msg.confirmations : [],
                };
                })
                .filter((msg) => msg.content || msg.attachment)
          : [];

        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: normalizedMessages.length ? normalizedMessages : [DEFAULT_WELCOME_MESSAGE],
                }
              : chat
          )
        );
      } catch (error) {
        console.error("Failed to load chat messages", error);
      }
    };

    loadMessages();
  }, [activeChatId]);

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
    if (!activeChatId) return;

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              title: "New chat",
              updatedAt: new Date().toISOString(),
              messages: [DEFAULT_WELCOME_MESSAGE],
            }
          : chat
      )
    );
  };

  const isTextLikeFile = (file) => {
    const name = String(file?.name || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    const textExts = [
      ".txt", ".md", ".json", ".csv", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".cs", ".html", ".css", ".xml", ".yaml", ".yml",
    ];
    return type.startsWith("text/") || type.includes("json") || textExts.some((ext) => name.endsWith(ext));
  };

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  const handleAttachmentPick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setPendingAttachment({
        kind: "file",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        textContent: "This file is too large. Please attach a file under 20MB.",
      });
      event.target.value = "";
      return;
    }

    try {
      if (String(file.type || "").startsWith("image/")) {
        const dataUrl = await readFileAsDataURL(file);
        setPendingAttachment({
          kind: "image",
          name: file.name,
          mimeType: file.type,
          dataUrl,
        });
      } else {
        const dataUrl = await readFileAsDataURL(file);
        let textContent = "";

        if (isTextLikeFile(file)) {
          textContent = await readFileAsText(file);
        }

        setPendingAttachment({
          kind: "file",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          textContent: textContent.slice(0, 12000),
        });
      }
    } catch (error) {
      console.error("Attachment read failed", error);
      setPendingAttachment({
        kind: "file",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        textContent: "I couldn't read this file on the browser side. Try re-attaching or export it as PDF.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !pendingAttachment) || isLoading || !activeChatId) return;

    const currentChatId = activeChatId;
    const userInput = inputMessage.trim() || `Please help me with this attachment: ${pendingAttachment?.name || "file"}`;
    const attachmentMeta = normalizeAttachmentMeta(pendingAttachment);
    const userMessage = {
      role: "user",
      content: userInput,
      attachment: attachmentMeta,
      timestamp: new Date(),
    };

    const nextConversationHistory = [...conversationHistory, { role: "user", content: userInput }];
    const conversationHistoryForRequest = nextConversationHistory.slice(-CONTEXT_WINDOW);

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const nextMessages = [...chat.messages, userMessage];
        return {
          ...chat,
          title: chat.title === "New chat" ? titleFromFirstUserMessage(nextMessages) : chat.title,
          updatedAt: new Date().toISOString(),
          messages: nextMessages,
        };
      })
    );

    setInputMessage("");
    setIsLoading(true);

    try {
      try {
        await saveMessage(
          parseInt(currentChatId, 10),
          "user",
          appendAttachmentMetaToContent(userInput, attachmentMeta)
        );
      } catch (error) {
        console.error("Failed to save user message to backend:", error);
      }

      const response = await sendChatMessage(
        conversationHistoryForRequest,
        GENERAL_ASSISTANT_PROMPT,
        pendingAttachment
      );
      const aiReply = response?.content?.[0]?.text || "Something went wrong, try again";
      const { cleanedText, actions } = extractActionTags(aiReply);
      const confirmations = [];
      let assignmentsSnapshot = null;

      for (const action of actions) {
        try {
          const result = await handleAppAction(action.actionType, action.payload);
          if (result?.confirmation) confirmations.push(`✅ ${result.confirmation}`);
          if (Array.isArray(result?.assignments)) assignmentsSnapshot = result.assignments;
        } catch (actionError) {
          confirmations.push(`⚠️ ${action.actionType} failed: ${actionError.message}`);
        }
      }

      const assistantText = formatReadableResponse(
        cleanedText || (confirmations.length ? "Action completed." : aiReply)
      );
      const aiMessage = {
        role: "assistant",
        content: assistantText,
        timestamp: new Date(),
        confirmations,
      };

      if (activeChat?.title === "New chat") {
        try {
          await updateChatTitle(parseInt(currentChatId, 10), titleFromFirstUserMessage([userMessage]));
        } catch (error) {
          console.warn("Failed to update chat title", error);
        }
      }

      try {
        await saveMessage(parseInt(currentChatId, 10), "assistant", assistantText);
      } catch (error) {
        console.error("Failed to save AI message to backend:", error);
      }

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: [...chat.messages, aiMessage],
              }
            : chat
        )
      );

      if (chatState === "minimized") {
        setUnreadCount((prev) => prev + 1);
      }

      setPendingAttachment(null);

      if (Array.isArray(assignmentsSnapshot)) {
        const assignmentPreview = assignmentsSnapshot.slice(0, 5).map((assignment) => {
          const title = assignment?.title || "Untitled";
          const dueDate = assignment?.dueDate ? ` (due ${new Date(assignment.dueDate).toLocaleDateString()})` : "";
          return `- ${title}${dueDate}`;
        });

        const followupText = assignmentPreview.length
          ? `Here are your current assignments:\n${assignmentPreview.join("\n")}`
          : "You currently have no assignments.";

        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === currentChatId
              ? {
                  ...chat,
                  updatedAt: new Date().toISOString(),
                  messages: [
                    ...chat.messages,
                    {
                      role: "assistant",
                      content: followupText,
                      timestamp: new Date(),
                    },
                  ],
                }
              : chat
          )
        );

        if (chatState === "minimized") {
          setUnreadCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: [
                  ...chat.messages,
                  {
                    role: "assistant",
                    content: error.message || "Something went wrong, try again",
                    timestamp: new Date(),
                  },
                ],
              }
            : chat
        )
      );

      if (chatState === "minimized") {
        setUnreadCount((prev) => prev + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    setInputMessage(action);
  };

  const handleStateChange = (nextState) => {
    if (messagesContainerRef.current) {
      preservedScrollTopRef.current = messagesContainerRef.current.scrollTop;
    }
    setChatState(nextState);
  };

  const handleFullscreenToggle = () => {
    handleStateChange(isFullscreen ? "normal" : "fullscreen");
    if (!isFullscreen) {
      setIsSidebarVisible(true);
    }
  };

  const handleNewChat = () => {
    setInputMessage("");
    createChat("New chat")
      .then((created) => {
        const nextChat = {
          id: String(created.id),
          title: String(created.title || "New chat"),
          createdAt: String(created.createdAt || new Date().toISOString()),
          updatedAt: String(created.updatedAt || created.createdAt || new Date().toISOString()),
          messages: [DEFAULT_WELCOME_MESSAGE],
        };
        setChats((prev) => [nextChat, ...prev]);
        setActiveChatId(nextChat.id);
      })
      .catch((error) => console.error("Failed to create chat in backend:", error));
  };

  const handleSelectChat = (chatId) => {
    if (!chatId || chatId === activeChatId) return;
    if (messagesContainerRef.current) {
      preservedScrollTopRef.current = messagesContainerRef.current.scrollTop;
    }
    setActiveChatId(chatId);
    setInputMessage("");
  };

  const handleDeleteChat = (chatId) => {
    // Delete from backend
    deleteChat(chatId)
      .then(() => {
        setChats((prev) => {
          const remaining = prev.filter((chat) => chat.id !== chatId);
          if (remaining.length) {
            if (chatId === activeChatId) {
              setActiveChatId(remaining[0].id);
              setInputMessage("");
            }
            return remaining;
          }
          
          // Create new chat if none left
          createChat("New chat")
            .then((created) => {
              const newChat = {
                id: String(created.id),
                title: String(created.title || "New chat"),
                createdAt: String(created.createdAt || new Date().toISOString()),
                updatedAt: String(created.updatedAt || created.createdAt || new Date().toISOString()),
                messages: [DEFAULT_WELCOME_MESSAGE],
              };
              setChats([newChat]);
              setActiveChatId(newChat.id);
            })
            .catch((error) => console.error("Failed to create replacement chat:", error));
          
          return [];  // Temporarily empty
        });
      })
      .catch((error) => console.error("Failed to delete chat from backend:", error));
  };

  const quickActions = [
    "Create a study schedule for today",
    "How can I reduce stress?",
    "Tips for better sleep",
    "Improve my focus",
  ];

  if (isMinimized) {
    return (
      <div className="ai-chatbot-floating">
        <button
          className="chat-icon"
          onClick={() => handleStateChange("normal")}
          aria-label="Open AI Assistant chat"
          title="Open AI Assistant"
        >
          🤖
          {unreadCount > 0 && <span className="chat-badge">{Math.min(unreadCount, 9)}+</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="ai-chatbot-floating">
      <div className={`chat-window ${chatState}`} role="dialog" aria-label="AI Assistant chat window">
        {isFullscreen && isSidebarVisible && (
          <aside className="chat-sidebar" aria-label="AI Assistant chat history">
            <div className="chat-sidebar-header">
              <h4>Conversations</h4>
              <button type="button" className="new-chat-btn" onClick={handleNewChat}>
                + New Chat
              </button>
            </div>

            <div className="chat-sidebar-list">
              {chats.map((chat) => (
                <div key={chat.id} className={`chat-sidebar-item ${chat.id === activeChatId ? "active" : ""}`}>
                  <button
                    type="button"
                    className="chat-sidebar-main"
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <span className="chat-sidebar-title">{chat.title}</span>
                    <span className="chat-sidebar-preview">{getChatPreview(chat)}</span>
                  </button>

                  <div className="chat-sidebar-meta">
                    <span>
                      {new Date(chat.updatedAt || chat.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      className="chat-sidebar-delete"
                      onClick={() => handleDeleteChat(chat.id)}
                      aria-label="Delete chat"
                      title="Delete chat"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        <div
          className={`chat-main ${isFullscreen && !isSidebarVisible ? "chat-main-wide" : ""}`}
          style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <div
            className="chat-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              padding: isFullscreen ? "16px 28px" : "14px 18px",
              background: "#ffffff",
              color: "#0f172a",
              borderBottom: "1px solid #e2e8f0",
              minHeight: "62px",
              flexShrink: 0,
              position: "relative",
              zIndex: 3,
            }}
          >
            <div className="chat-header-content">
              <div className="chat-avatar">🤖</div>
              <div>
                <h3>AI Assistant</h3>
                <p className="chat-status">
                  <span className="status-dot"></span> AI Assistant is online
                </p>
              </div>
            </div>

            <div className="chat-header-actions">
              <button type="button" onClick={handleClearHistory} className="clear-history-btn">
                Clear
              </button>
              <button
                type="button"
                className="chat-control-btn"
                onClick={handleNewChat}
                aria-label="Start new chat"
                title="New chat"
              >
                +
              </button>
              {isFullscreen && (
                <button
                  type="button"
                  className="chat-control-btn"
                  onClick={() => setIsSidebarVisible((prev) => !prev)}
                  aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                >
                  {isSidebarVisible ? "◧" : "◨"}
                </button>
              )}
              <button
                type="button"
                className="chat-control-btn"
                onClick={handleFullscreenToggle}
                aria-label={isFullscreen ? "Restore chat size" : "Fullscreen chat"}
                title={isFullscreen ? "Restore" : "Fullscreen"}
              >
                {isFullscreen ? "❐" : "□"}
              </button>
              <button
                type="button"
                className="chat-control-btn"
                onClick={() => handleStateChange("minimized")}
                aria-label="Minimize chat"
                title="Minimize"
              >
                -
              </button>
              <button
                type="button"
                className="chat-control-btn"
                onClick={() => handleStateChange("minimized")}
                aria-label="Close chat"
                title="Close"
              >
                x
              </button>
            </div>
          </div>

          <div
            className="chat-body"
            ref={messagesContainerRef}
            style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          >
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role === "user" ? "user-message" : "ai-message"}`}>
                <div className="message-avatar">{msg.role === "user" ? "👤" : "🤖"}</div>
                <div className="message-content">
                  <p>{msg.content || (msg.attachment ? "Shared an attachment." : "")}</p>
                  {msg.attachment?.name && (
                    <div className="message-attachment">
                      <span className="attachment-badge">{getFileTypeBadge(msg.attachment)}</span>
                      <span className="attachment-name">{msg.attachment.name}</span>
                    </div>
                  )}
                  {Array.isArray(msg.confirmations) && msg.confirmations.length > 0 && (
                    <div className="message-confirmations">
                      {msg.confirmations.map((note, noteIndex) => (
                        <span key={`${index}-${noteIndex}`} className="message-confirmation-tag">
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

          {messages.length <= 1 && (
            <div className="quick-actions">
              {quickActions.map((action, index) => (
                <button key={index} className="quick-action-btn" onClick={() => handleQuickAction(action)}>
                  {action}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input">
            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleAttachmentChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="attach-btn"
                onClick={handleAttachmentPick}
                disabled={isLoading}
                title="Attach screenshot or file"
              >
                📎
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message AI Assistant..."
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || (!inputMessage.trim() && !pendingAttachment)}>
                {isLoading ? "..." : "➤"}
              </button>
            </form>
            {pendingAttachment && (
              <div className="attachment-pill">
                <span>Attached: {pendingAttachment.name}</span>
                <button
                  type="button"
                  className="attachment-remove-btn"
                  onClick={() => setPendingAttachment(null)}
                  disabled={isLoading}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatbot;
