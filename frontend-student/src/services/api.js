const BASE_URL = "http://localhost:3001/api"; // backend port

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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    throw new Error(result.message || `Request failed with status ${res.status}`);
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
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    localStorage.setItem("authRole", "student");
  }
  return result;
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

export const getParentAlerts = async () => {
  const res = await fetch(`${BASE_URL}/parent/alerts`, {
    method: "GET",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};

export const markParentAlertRead = async (alertId) => {
  const res = await fetch(`${BASE_URL}/parent/alerts/${alertId}/read`, {
    method: "PATCH",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};

export const getParentReports = async () => {
  const res = await fetch(`${BASE_URL}/parent/reports`, {
    method: "GET",
    headers: getParentAuthHeaders(),
  });
  return handleResponse(res);
};
