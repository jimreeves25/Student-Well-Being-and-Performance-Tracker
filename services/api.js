const BASE_URL = "http://localhost:3001/api"; // backend port

// Helper function to get token
const getToken = () => {
  return localStorage.getItem("token");
};

// Helper function to create headers with token
const getAuthHeaders = () => {
  const token = getToken();
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
  const result = await res.json();
  if (result.token) {
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
  }
  return result;
};

export const loginUser = async (data) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (result.token) {
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
  }
  return result;
};

// Dashboard APIs
export const getDashboardSummary = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/summary`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return res.json();
};

export const saveDailyLog = async (data) => {
  const res = await fetch(`${BASE_URL}/dashboard/log`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getDailyLogs = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/logs`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return res.json();
};

export const createStudySession = async (data) => {
  const res = await fetch(`${BASE_URL}/dashboard/study-session`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getStudySessions = async () => {
  const res = await fetch(`${BASE_URL}/dashboard/study-sessions`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return res.json();
};

export const completeStudySession = async (sessionId) => {
  const res = await fetch(`${BASE_URL}/dashboard/study-session/${sessionId}/complete`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return res.json();
};

export const changePasswordAPI = async (currentPassword, newPassword) => {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to change password");
  return data;
};
