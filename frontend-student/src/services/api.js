const PROD_API_URL = "https://student-wellness-backend-production.up.railway.app/api";

const BASE_URL =
  process.env.REACT_APP_API_URL?.trim() ||
  (window.location.hostname === "localhost" ? "http://localhost:3001/api" : PROD_API_URL);

const parseJsonResponse = async (res) => {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const handleResponse = async (res) => {
  const result = await parseJsonResponse(res);

  if (!res.ok) {
    if (res.status === 401) {
      // Clear both role tokens to avoid stale auth state loops.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("parentToken");
      localStorage.removeItem("parentUser");
      localStorage.removeItem("authRole");
    }

    let message = result.message;

    if (!message && res.status === 400) {
      message = "Invalid credentials or user data. Please check your input.";
    }

    if (!message && res.status === 401) {
      message = "Session expired or unauthorized. Please login again.";
    }

    throw new Error(message || `Request failed with status ${res.status}`);
  }

  return result;
};

// Helper function to get token
const getToken = () => {
  return localStorage.getItem("token");
};

const getParentToken = () => {
  return localStorage.getItem("parentToken");
};

// Helper function to create headers with token
const getAuthHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

const getParentAuthHeaders = () => {
  const token = getParentToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

// Auth APIs
export const signupUser = async (data) => {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(res);
  if (result.token) {
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("authRole", "student");
  }
  return result;
};

export const loginUser = async (data) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(res);
  if (result.token) {
    localStorage.removeItem("parentToken");
    localStorage.removeItem("parentUser");
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("authRole", "student");
  }
  return result;
};

export const getCurrentUserProfile = async () => {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateCurrentUserProfile = async (data) => {
  const res = await fetch(`${BASE_URL}/auth/profile`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data || {}),
  });
  return handleResponse(res);
};

export const sendOtp = async (payload, isParent = false) => {
  const res = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: "POST",
    headers: isParent ? getParentAuthHeaders() : getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const verifyOtp = async (payload, isParent = false) => {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: isParent ? getParentAuthHeaders() : getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const requestStudentContactSetup = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/student/setup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...(payload || {}), step: "request" }),
  });
  return handleResponse(res);
};

export const completeStudentContactSetup = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/student/setup`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...(payload || {}), step: "complete" }),
  });
  return handleResponse(res);
};

export const requestParentContactSetup = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/parent/setup`, {
    method: "POST",
    headers: getParentAuthHeaders(),
    body: JSON.stringify({ ...(payload || {}), step: "request" }),
  });
  return handleResponse(res);
};

export const completeParentContactSetup = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/parent/setup`, {
    method: "POST",
    headers: getParentAuthHeaders(),
    body: JSON.stringify({ ...(payload || {}), step: "complete" }),
  });
  return handleResponse(res);
};

export const verifyNotificationOtp = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/verify-otp`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const requestContactChange = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/contact/change-request`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const confirmContactChange = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/contact/confirm-change`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const getNotificationPreferences = async () => {
  const res = await fetch(`${BASE_URL}/notifications/preferences`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateNotificationPreferences = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/preferences`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const getNotificationInbox = async () => {
  const res = await fetch(`${BASE_URL}/notifications/inbox`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getNotificationHistory = async (limit = 50) => {
  const res = await fetch(`${BASE_URL}/notifications/history?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const markNotificationRead = async (notificationId) => {
  const res = await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const markAllNotificationsRead = async () => {
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const sendParentNote = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/parent/note`, {
    method: "POST",
    headers: getParentAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const recordUserActivity = async (payload) => {
  const res = await fetch(`${BASE_URL}/notifications/activity`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const sendStudentContactCode = async (payload) => {
  const safePayload = payload || {};
  const channel = String(safePayload.channel || "").trim().toLowerCase();
  const purpose = String(safePayload.purpose || "initial").trim().toLowerCase();

  if (purpose === "initial") {
    if (channel === "email") {
      const res = await fetch(`${BASE_URL}/send-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: safePayload.target }),
      });
      return handleResponse(res);
    }

    if (channel === "phone") {
      const res = await fetch(`${BASE_URL}/send-phone-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: safePayload.target }),
      });
      return handleResponse(res);
    }
  }

  const res = await fetch(`${BASE_URL}/auth/contact/send-code`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(safePayload),
  });
  return handleResponse(res);
};

export const verifyStudentContactCode = async (payload) => {
  const safePayload = payload || {};
  const channel = String(safePayload.channel || "").trim().toLowerCase();
  const purpose = String(safePayload.purpose || "initial").trim().toLowerCase();

  if (purpose === "initial") {
    if (channel === "email") {
      const res = await fetch(`${BASE_URL}/verify-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: safePayload.target,
          code: safePayload.code,
        }),
      });
      return handleResponse(res);
    }

    if (channel === "phone") {
      const res = await fetch(`${BASE_URL}/verify-phone-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: safePayload.target,
          code: safePayload.code,
        }),
      });
      return handleResponse(res);
    }
  }

  const res = await fetch(`${BASE_URL}/auth/contact/verify-code`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(safePayload),
  });
  return handleResponse(res);
};

export const changePasswordAPI = async (currentPassword, newPassword) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to change password");
  }

  return data;
};

export const signupParent = async (data) => {
  const res = await fetch(`${BASE_URL}/parent/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const loginParent = async (data) => {
  const res = await fetch(`${BASE_URL}/parent/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse(res);
  if (result.token) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.setItem("parentToken", result.token);
    localStorage.setItem("parentUser", JSON.stringify(result.parent));
    localStorage.setItem("authRole", "parent");
  }
  return result;
};

// Dashboard APIs
export const getDashboardSummary = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/summary`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const saveDailyLog = async (data) => {
  if (!getToken()) {
    throw new Error("Student session not found. Please login again.");
  }

  const res = await fetch(`${BASE_URL}/dashboard/log`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const getDailyLogs = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/logs`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createStudySession = async (data) => {
  const res = await fetch(`${BASE_URL}/dashboard/study-session`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const getStudySessions = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/study-sessions`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createAssignment = async (data) => {
  const res = await fetch(`${BASE_URL}/parent/student/assignments`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const getAssignments = async () => {
  const res = await fetch(`${BASE_URL}/parent/student/assignments`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const completeStudySession = async (sessionId) => {
  const res = await fetch(`${BASE_URL}/dashboard/study-session/${sessionId}/complete`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const generateParentLinkCode = async () => {
  const res = await fetch(`${BASE_URL}/parent/student/link-code`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getParentLinkRequests = async () => {
  const res = await fetch(`${BASE_URL}/parent/student/link-requests`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const respondToParentLinkRequest = async (requestId, action) => {
  const res = await fetch(`${BASE_URL}/parent/student/link-requests/${requestId}/respond`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ action }),
  });
  return handleResponse(res);
};

export const updateWellnessPrivacy = async (allowWellnessShare) => {
  const res = await fetch(`${BASE_URL}/parent/student/privacy`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ allowWellnessShare }),
  });
  return handleResponse(res);
};

export const startLiveSessionTracking = async (studySessionId = null) => {
  const res = await fetch(`${BASE_URL}/parent/student/live-session/start`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ studySessionId }),
  });
  return handleResponse(res);
};

export const heartbeatLiveSessionTracking = async (payload) => {
  const res = await fetch(`${BASE_URL}/parent/student/live-session/heartbeat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const endLiveSessionTracking = async () => {
  const res = await fetch(`${BASE_URL}/parent/student/live-session/end`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const saveLiveSessionActivity = async ({ message, action = "suggested", kind = "suggestion", metadata = null }) => {
  const res = await fetch(`${BASE_URL}/parent/student/live-session/activity`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, action, kind, metadata }),
  });
  return handleResponse(res);
};

export const getParentDashboard = async () => {
  const res = await fetch(`${BASE_URL}/parent/dashboard`, {
    method: "GET",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};

export const getParentAlerts = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.q) searchParams.set("q", params.q);
  if (params.limit) searchParams.set("limit", String(params.limit));

  try {
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${BASE_URL}/parent/alerts${suffix}`, {
      method: "GET",
      headers: getParentAuthHeaders(),
    });
    const data = await handleResponse(res);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch parent alerts:", error);
    return [];
  }
};

export const markParentAlertRead = async (alertId) => {
  const res = await fetch(`${BASE_URL}/parent/alerts/${alertId}/read`, {
    method: "PATCH",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};

export const getParentReports = async () => {
  try {
    const res = await fetch(`${BASE_URL}/parent/reports`, {
      method: "GET",
      headers: getParentAuthHeaders(),
    });
    const data = await handleResponse(res);
    return data ?? {};
  } catch (error) {
    console.error("Failed to fetch parent reports:", error);
    return {};
  }
};

export const getParentNotificationPreferences = async () => {
  try {
    const res = await fetch(`${BASE_URL}/parent/preferences/notifications`, {
      method: "GET",
      headers: getParentAuthHeaders(),
    });
    const data = await handleResponse(res);
    return data ?? { notifyByEmail: true, notifyByDashboard: true, notifyByPush: false };
  } catch (error) {
    console.error("Failed to fetch parent notification preferences:", error);
    return { notifyByEmail: true, notifyByDashboard: true, notifyByPush: false };
  }
};

export const updateParentNotificationPreferences = async (preferences) => {
  const res = await fetch(`${BASE_URL}/parent/preferences/notifications`, {
    method: "PATCH",
    headers: getParentAuthHeaders(),
    body: JSON.stringify(preferences),
  });
  return handleResponse(res);
};

export const getParentProfile = async () => {
  const res = await fetch(`${BASE_URL}/parent/profile`, {
    method: "GET",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateParentProfile = async (payload) => {
  const res = await fetch(`${BASE_URL}/parent/profile`, {
    method: "PATCH",
    headers: getParentAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const sendParentContactCode = async (payload) => {
  const res = await fetch(`${BASE_URL}/parent/contact/send-code`, {
    method: "POST",
    headers: getParentAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

export const verifyParentContactCode = async (payload) => {
  const res = await fetch(`${BASE_URL}/parent/contact/verify-code`, {
    method: "POST",
    headers: getParentAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(res);
};

// AI Chat API
export const sendChatMessage = async (messages, systemPrompt = "", attachment = null) => {
  const lastMessage = Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
  const message = String(lastMessage?.content || "");
  const contextMessages = Array.isArray(messages)
    ? messages
        .slice(-20)
        .map((msg) => ({
          role: msg?.role === "assistant" ? "assistant" : "user",
          content: String(msg?.content || ""),
        }))
        .filter((msg) => msg.content.trim())
    : [];
  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, systemPrompt, contextMessages, attachment }),
      signal: controller.signal,
    });

    const data = await parseJsonResponse(res);

    if (!res.ok) {
      console.error("Frontend API Error:", data);
      const rawMessage = String(data?.error || data?.message || "").trim();
      const looksLikeHtml = rawMessage.startsWith("<!DOCTYPE") || rawMessage.includes("<html");

      if (res.status === 413) {
        throw new Error("File is too large. Please upload a smaller file (under 20MB).");
      }

      if (looksLikeHtml) {
        throw new Error("Server rejected this file payload. Please try a smaller file or restart backend.");
      }

      throw new Error(rawMessage || "Chat failed");
    }

    return { content: [{ text: data.reply || data.content?.[0]?.text || "" }] };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Pluto is taking too long. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ============================================================
// CHAT PERSISTENCE APIs
// ============================================================

// Create new chat
export const createChat = async (title = "New Conversation") => {
  const res = await fetch(`${BASE_URL}/chats`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });
  const data = await handleResponse(res);

  if (data?.chat?.id) {
    return data.chat;
  }

  if (data?.chatId) {
    const now = new Date().toISOString();
    return {
      id: data.chatId,
      title,
      createdAt: now,
      updatedAt: now,
    };
  }

  return data;
};

// Get all chats for user
export const getChats = async () => {
  const res = await fetch(`${BASE_URL}/chats`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(res);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.chats)) return data.chats;
  return [];
};

// Update chat title
export const updateChatTitle = async (chatId, title) => {
  const res = await fetch(`${BASE_URL}/chats/${chatId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
};

// Delete chat
export const deleteChat = async (chatId) => {
  const res = await fetch(`${BASE_URL}/chats/${chatId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

// Get messages for a chat
export const getChatMessages = async (chatId) => {
  const res = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

// Save message
export const saveMessage = async (chatId, role, content) => {
  const res = await fetch(`${BASE_URL}/chats/messages`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ chatId, role, content }),
  });
  return handleResponse(res);
};
