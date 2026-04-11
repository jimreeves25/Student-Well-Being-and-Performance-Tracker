import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "chats";
const ACTIVE_CHAT_KEY = "studyCoach_active_chat_id";

const MODES = [
  {
    id: "study-help",
    label: "Study Help",
    systemPrompt:
      "You are an expert AI Study Coach. Help students understand concepts and learn effectively.",
    starters: [
      "Help me understand photosynthesis in simple terms.",
      "Explain this math problem-solving strategy step-by-step.",
      "Give me a 30-minute revision plan for biology.",
      "How can I study smarter for tomorrow's exam?",
    ],
  },
  {
    id: "quiz-me",
    label: "Quiz Me",
    systemPrompt:
      "You are a quiz master. Give one question at a time, wait for answers, then give feedback.",
    starters: [
      "Quiz me on world history.",
      "Start a short algebra quiz.",
      "Test me on chemistry equations.",
      "Ask me one question at a time on grammar.",
    ],
  },
  {
    id: "plan-my-day",
    label: "Plan My Day",
    systemPrompt:
      "You are a productivity coach. Help students plan study sessions and manage their time.",
    starters: [
      "Plan my day from 4 PM to 10 PM with breaks.",
      "I have 3 subjects and 2 hours. What should I do first?",
      "Build a focused evening study routine for me.",
      "Help me split my homework into clear blocks.",
    ],
  },
  {
    id: "wellness",
    label: "Wellness",
    systemPrompt:
      "You are a wellness coach. Help with stress, sleep, and study-life balance. Be empathetic.",
    starters: [
      "I am stressed before exams. What should I do first?",
      "Help me build a better sleep routine this week.",
      "How do I recover when I feel mentally drained?",
      "Give me a calm reset routine before studying.",
    ],
  },
];

const nowIso = () => new Date().toISOString();

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const formatTime = (isoDate) => {
  try {
    return new Date(isoDate).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const formatDate = (isoDate) => {
  try {
    return new Date(isoDate).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const safeReadChats = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((chat) => ({
        id: String(chat.id || uid()),
        title: String(chat.title || "New Chat"),
        mode: MODES.some((m) => m.id === chat.mode) ? chat.mode : MODES[0].id,
        messages: Array.isArray(chat.messages)
          ? chat.messages
              .filter((m) => m && (m.role === "user" || m.role === "assistant"))
              .map((m) => ({
                role: m.role,
                content: String(m.content || ""),
                createdAt: m.createdAt || nowIso(),
              }))
          : [],
        createdAt: chat.createdAt || nowIso(),
        updatedAt: chat.updatedAt || nowIso(),
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch {
    return [];
  }
};

const buildTitleFromFirstMessage = (text) => {
  const cleaned = String(text || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "New Chat";
  if (cleaned.length <= 52) return cleaned;
  return `${cleaned.slice(0, 52).trim()}...`;
};

const createEmptyChat = (modeId = MODES[0].id) => {
  const time = nowIso();
  return {
    id: uid(),
    title: "New Chat",
    mode: modeId,
    messages: [],
    createdAt: time,
    updatedAt: time,
  };
};

const getModeMeta = (modeId) => MODES.find((mode) => mode.id === modeId) || MODES[0];

export default function StudyCoachChat() {
  const [chats, setChats] = useState(() => {
    const stored = safeReadChats();
    if (stored.length > 0) return stored;
    return [createEmptyChat(MODES[0].id)];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_CHAT_KEY);
    return saved || null;
  });
  const [conversationHistory, setConversationHistory] = useState([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const textareaRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
      return;
    }

    if (activeChatId && !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0]?.id || null);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || chats[0] || null,
    [chats, activeChatId]
  );

  const activeMode = getModeMeta(activeChat?.mode || MODES[0].id);

  useEffect(() => {
    if (!activeChat) {
      setConversationHistory([]);
      return;
    }

    const history = (activeChat.messages || []).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    setConversationHistory(history);
  }, [activeChat?.id, activeChat?.messages]);

  const updateActiveChat = (updater) => {
    setChats((prev) => {
      const index = prev.findIndex((chat) => chat.id === (activeChat?.id || ""));
      if (index < 0) return prev;

      const current = prev[index];
      const next = updater(current);
      const nextChat = {
        ...current,
        ...next,
        updatedAt: nowIso(),
      };

      const copy = [...prev];
      copy[index] = nextChat;
      return copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  };

  const createNewChat = () => {
    const modeId = activeChat?.mode || MODES[0].id;
    const chat = createEmptyChat(modeId);
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setDraft("");
  };

  const deleteChat = (chatId) => {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (filtered.length > 0) return filtered;
      return [createEmptyChat(MODES[0].id)];
    });

    if (activeChatId === chatId) {
      setActiveChatId(null);
      setDraft("");
    }
  };

  const applyModeToActiveChat = (modeId) => {
    if (!activeChat) return;
    updateActiveChat(() => ({ mode: modeId }));
  };

  const sendMessage = async (forcedText = null) => {
    if (!activeChat) return;

    const content = (forcedText ?? draft).trim();
    if (!content || isLoading) return;

    const userMessage = {
      role: "user",
      content,
      createdAt: nowIso(),
    };

    const userHistoryMessage = {
      role: "user",
      content,
    };

    const nextConversationHistory = [...conversationHistory, userHistoryMessage];
    const conversationHistoryForRequest = nextConversationHistory;

    const shouldSetTitle = activeChat.title === "New Chat";

    updateActiveChat((chat) => ({
      messages: [...chat.messages, userMessage],
      title: shouldSetTitle ? buildTitleFromFirstMessage(content) : chat.title,
    }));
    setConversationHistory(nextConversationHistory);

    setDraft("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistoryForRequest,
          systemPrompt: "You are an expert AI Study Coach. Help students understand concepts and learn effectively.",
        }),
      });

      const data = await response.json();
      const assistantText = data.content[0].text;

      const assistantMessage = {
        role: "assistant",
        content: assistantText,
        createdAt: nowIso(),
      };

      updateActiveChat((chat) => ({
        messages: [...chat.messages, assistantMessage],
      }));
      setConversationHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
        },
      ]);
    } catch (error) {
      const errorMessage = {
        role: "assistant",
        content: "Something went wrong, please try again",
        createdAt: nowIso(),
      };

      updateActiveChat((chat) => ({
        messages: [...chat.messages, errorMessage],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen w-full bg-slate-100 text-slate-900">
      <style>{`
        .fade-in-msg {
          animation: fadeInMessage 220ms ease-out;
        }
        @keyframes fadeInMessage {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex h-full">
        <aside className="w-80 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-200">Study Coach</h2>
              <p className="text-xs text-slate-400">Saved conversations</p>
            </div>
            <button
              type="button"
              onClick={createNewChat}
              className="rounded-md bg-[#534AB7] px-3 py-2 text-xs font-medium text-white transition hover:brightness-110"
            >
              New Chat
            </button>
          </div>

          <div className="h-[calc(100%-74px)] overflow-y-auto p-2">
            {chats.map((chat) => {
              const modeMeta = getModeMeta(chat.mode);
              const isActive = chat.id === activeChat?.id;

              return (
                <div
                  key={chat.id}
                  className={`mb-2 rounded-lg border p-3 transition ${
                    isActive
                      ? "border-[#534AB7] bg-slate-900"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveChatId(chat.id)}
                    className="w-full text-left"
                  >
                    <p className="truncate text-sm font-medium text-slate-100">{chat.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-200">
                        {modeMeta.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(chat.updatedAt)}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteChat(chat.id)}
                    className="mt-2 text-xs text-rose-300 transition hover:text-rose-200"
                  >
                    Delete chat
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              {MODES.map((mode) => {
                const selected = mode.id === activeMode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => applyModeToActiveChat(mode.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      selected
                        ? "border-[#534AB7] bg-[#534AB7] text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-[#534AB7] hover:text-[#534AB7]"
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {activeChat?.messages.length ? (
                activeChat.messages.map((message, idx) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={`${message.createdAt}-${idx}`}
                      className={`fade-in-msg flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                          isUser
                            ? "bg-[#534AB7] text-white"
                            : "bg-white text-slate-800 border border-slate-200"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
                        <p
                          className={`mt-2 text-[11px] ${
                            isUser ? "text-white/75" : "text-slate-400"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                  Start a conversation. I will keep your full chat history for context.
                </div>
              )}

              {isLoading && (
                <div className="fade-in-msg flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-3 flex flex-wrap gap-2">
                {activeMode.starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => sendMessage(starter)}
                    disabled={isLoading}
                    className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition hover:border-[#534AB7] hover:text-[#534AB7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {starter}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  rows={1}
                  placeholder="Message your study coach..."
                  className="max-h-[180px] min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={isLoading || !draft.trim()}
                  className="h-11 rounded-xl bg-[#534AB7] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
