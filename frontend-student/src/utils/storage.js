export const loadFromStorage = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to load storage key: ${key}`, error);
    return fallback;
  }
};

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`Failed to save storage key: ${key}`, error);
    return false;
  }
};

export function getUserData() {
  return {
    mood: Number(localStorage.getItem("mood")) || 0,
    studyTime: Number(localStorage.getItem("studyTime")) || 0,
    performance: Number(localStorage.getItem("performance")) || 0,
  };
}

export function setUserData({ mood, studyTime, performance }) {
  if (mood !== undefined) localStorage.setItem("mood", mood);
  if (studyTime !== undefined) localStorage.setItem("studyTime", studyTime);
  if (performance !== undefined) localStorage.setItem("performance", performance);
}
