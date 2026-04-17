const NOTIF_KEY = "appNotifications";

const readNotifications = () => {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const sendBrowserNotification = (title, body, icon = "/logo192.png") => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon });
};

export const saveInAppNotification = (title, body, type = "info") => {
  const existing = readNotifications();
  const newNotif = {
    id: Date.now(),
    title,
    body,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
  const updated = [newNotif, ...existing].slice(0, 50);
  localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  return updated;
};

export const getInAppNotifications = () => {
  return readNotifications();
};

export const markAllRead = () => {
  const notifs = readNotifications();
  const updated = notifs.map((n) => ({ ...n, read: true }));
  localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  return updated;
};

export const clearAllNotifications = () => {
  localStorage.setItem(NOTIF_KEY, JSON.stringify([]));
  return [];
};