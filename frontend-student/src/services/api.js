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

// AI Chat API
export const sendChatMessage = async (messages, systemPrompt = "") => {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      systemPrompt,
    }),
  });
  return handleResponse(res);
};
