import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  changePasswordAPI,
  getDashboardSummary,
  getParentLinkRequests,
  generateParentLinkCode,
  respondToParentLinkRequest,
  saveDailyLog,
  updateWellnessPrivacy,
} from "../services/api";
import AiCoach from "../components/AiCoach";
import DashboardCharts from "../components/DashboardCharts";
import LiveFaceStudySession from "../components/sample/LiveFaceStudySession";
import Header from "../components/dashboard/Header";
import MoodTracker from "../components/dashboard/MoodTracker";
import TaskList from "../components/dashboard/TaskList";
import DashboardGrid from "../components/layout/DashboardGrid";
import StatsCard from "../components/ui/StatsCard";
import AssignmentPlanner from "../components/assignments/AssignmentPlanner";
import { useAssignments } from "../hooks/useAssignments";
import {
  clearAllNotifications,
  getInAppNotifications,
  markAllRead,
  requestNotificationPermission,
  saveInAppNotification,
  sendBrowserNotification,
} from "../utils/notificationService";
import { loadFromStorage, saveToStorage, setUserData } from "../utils/storage";
import { updateUserProfile, initializeUserAuth } from "../utils/userAuth";
import "../styles/Dashboard.css";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "rewards", label: "Rewards" },
  { id: "daily-log", label: "Daily Log" },
  { id: "assignments", label: "Assignments" },
  { id: "sessions", label: "Live Session" },
  { id: "ai-tools", label: "AI Tools" },
  { id: "settings", label: "Settings" },
];

const SETTINGS_NOTIFICATION_PREFS_KEY = "settingsNotificationPrefs";

const themes = {
  dark: {
    name: "Dark",
    bg: "#0a0a0f",
    card: "#16161e",
    cardSecondary: "#1e1e2a",
    text: "#ffffff",
    textMuted: "#8888aa",
    accent: "#1db954",
    accentText: "#ffffff",
    border: "#2a2a3a",
    buttonBg: "#1e1e2a",
    buttonText: "#ffffff",
  },
  light: {
    name: "Light",
    bg: "#f7f8fc",
    card: "#ffffff",
    cardSecondary: "#f0f1f7",
    text: "#1a1a2e",
    textMuted: "#6666888",
    accent: "#1db954",
    accentText: "#ffffff",
    border: "#e0e0ee",
    buttonBg: "#ffffff",
    buttonText: "#1a1a2e",
  },
  galaxy: {
    name: "Galaxy",
    bg: "#0d0d1a",
    card: "#13131f",
    cardSecondary: "#1a1a2e",
    text: "#ffffff",
    textMuted: "#8888bb",
    accent: "#9b59f5",
    accentText: "#ffffff",
    border: "#2a2a4a",
    buttonBg: "#1a1a2e",
    buttonText: "#ffffff",
  },
  sunset: {
    name: "Sunset",
    bg: "#0f0a08",
    card: "#1a1210",
    cardSecondary: "#221815",
    text: "#ffffff",
    textMuted: "#aa9988",
    accent: "#e8622a",
    accentText: "#ffffff",
    border: "#332820",
    buttonBg: "#1a1210",
    buttonText: "#ffffff",
  },
  forest: {
    name: "Forest",
    bg: "#080f09",
    card: "#101810",
    cardSecondary: "#162016",
    text: "#ffffff",
    textMuted: "#779977",
    accent: "#2d8c45",
    accentText: "#ffffff",
    border: "#1e2e1e",
    buttonBg: "#101810",
    buttonText: "#ffffff",
  },
};

const themeDotColors = {
  dark: "#555566",
  light: "#e8e8f0",
  galaxy: "#9b59f5",
  sunset: "#e8622a",
  forest: "#2d8c45",
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

const calculateWellnessScoreFromMoodLogs = (recentLogs) => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const moodValues = (recentLogs || [])
    .filter((log) => {
      const date = new Date(log?.date || log?.logDate || log?.createdAt);
      return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
    })
    .map((log) => Number(log?.moodRating ?? log?.moodValue ?? log?.mood))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!moodValues.length) return null;

  const averageMood = moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length;
  return clampPercent((averageMood / 10) * 100);
};

const calculatePerformanceScoreFromTasks = (tasks) => {
  if (!tasks?.length) return null;
  const completed = tasks.filter((task) => task?.status === "completed").length;
  return clampPercent((completed / tasks.length) * 100);
};

const collectActivityDateKeys = (recentLogs, tasks, sessions) => {
  const keys = new Set();
  const add = (value) => {
    const key = toDateKey(value);
    if (key) keys.add(key);
  };

  (recentLogs || []).forEach((log) => add(log?.date || log?.logDate || log?.createdAt));
  (tasks || []).forEach((task) => add(task?.updatedAt || task?.createdAt));
  (sessions || []).forEach((session) => add(session?.scheduledDate || session?.createdAt));

  return keys;
};

const buildWeekDaysFromActivity = (activityKeys) => {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset);
  const todayKey = toDateKey(today);

  return labels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = toDateKey(date);
    return {
      label,
      key,
      isActive: key ? activityKeys.has(key) : false,
      isToday: key === todayKey,
    };
  });
};

const calculateStreakCount = (activityKeys) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cursor = new Date(today);

  while (true) {
    const key = toDateKey(cursor);
    if (!key || !activityKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const calculateXP = (recentLogs, assignments, currentStreak, moodLogs) => {
  console.log("XP Inputs:", {
    logs: recentLogs?.length,
    assignments: assignments?.length,
    streak: currentStreak,
    moodLogs: moodLogs?.length,
  });

  let xp = 0;

  (recentLogs || []).forEach((log) => {
    xp += 50;
    if (Number(log?.waterIntake) >= 3) xp += 10;
    if (Number(log?.exerciseMinutes) >= 30) xp += 15;
    if (Number(log?.sleepHours) >= 7) xp += 10;
    if (Number(log?.studyHours) >= 6) xp += 20;
  });

  (assignments || []).forEach((assignment) => {
    if (assignment?.status === "completed") xp += 30;
  });

  (moodLogs || []).forEach(() => {
    xp += 10;
  });

  xp += Number(currentStreak || 0) * 25;

  return xp;
};

const getLevel = (xp) => {
  if (xp >= 3000) return { name: "Legend", next: null, current: 3000, max: 3000 };
  if (xp >= 1500) return { name: "Wellness Pro", next: "Legend", current: 1500, max: 3000 };
  if (xp >= 500) return { name: "Scholar", next: "Wellness Pro", current: 500, max: 1500 };
  return { name: "Beginner", next: "Scholar", current: 0, max: 500 };
};

const calculateBadges = (recentLogs, assignments, currentStreak, moodLogs, totalXP) => {
  const badges = [];
  const logs = recentLogs || [];

  if (logs.length >= 1) {
    badges.push({
      id: "first_log",
      icon: "📝",
      title: "First Step",
      desc: "Logged your first day",
      earned: true,
    });
  }

  if (currentStreak >= 7) {
    badges.push({
      id: "streak_7",
      icon: "🔥",
      title: "Week Warrior",
      desc: "7 day streak",
      earned: true,
    });
  }

  if (currentStreak >= 14) {
    badges.push({
      id: "streak_14",
      icon: "⚡",
      title: "Fortnight Force",
      desc: "14 day streak",
      earned: true,
    });
  }

  if (currentStreak >= 30) {
    badges.push({
      id: "streak_30",
      icon: "👑",
      title: "Monthly Legend",
      desc: "30 day streak",
      earned: true,
    });
  }

  if (logs.some((log) => Number(log?.studyHours) >= 6)) {
    badges.push({
      id: "study_beast",
      icon: "📚",
      title: "Study Beast",
      desc: "Studied 6+ hours in a day",
      earned: true,
    });
  }

  if (logs.filter((log) => Number(log?.waterIntake) >= 3).length >= 5) {
    badges.push({
      id: "hydrated",
      icon: "💧",
      title: "Hydration Hero",
      desc: "Drank 3L water 5 days",
      earned: true,
    });
  }

  if (logs.some((log) => Number(log?.sleepHours) >= 8 && log?.sleepQuality === "Excellent")) {
    badges.push({
      id: "sleep_king",
      icon: "😴",
      title: "Sleep Champion",
      desc: "8h excellent sleep",
      earned: true,
    });
  }

  if (logs.filter((log) => Number(log?.exerciseMinutes) >= 30).length >= 7) {
    badges.push({
      id: "fitness",
      icon: "💪",
      title: "Fitness Freak",
      desc: "Exercised 7 days",
      earned: true,
    });
  }

  if ((assignments || []).filter((assignment) => assignment?.status === "completed").length >= 5) {
    badges.push({
      id: "assignments",
      icon: "✅",
      title: "Assignment Ace",
      desc: "Completed 5 assignments",
      earned: true,
    });
  }

  if (totalXP >= 500) {
    badges.push({
      id: "scholar",
      icon: "🎓",
      title: "Scholar",
      desc: "Reached 500 XP",
      earned: true,
    });
  }

  if (totalXP >= 1500) {
    badges.push({
      id: "wellness_pro",
      icon: "🌟",
      title: "Wellness Pro",
      desc: "Reached 1500 XP",
      earned: true,
    });
  }

  if (totalXP >= 3000) {
    badges.push({
      id: "legend",
      icon: "🏆",
      title: "Legend",
      desc: "Reached 3000 XP",
      earned: true,
    });
  }

  return badges;
};
const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const StreakDashboard = ({ streakCount, weekDays, hasActivityData }) => (
  <section className="streak-dashboard-card" aria-label="Streak dashboard">
    <h3>Streak Dashboard</h3>
    <div className="streak-count">
      {hasActivityData ? `🔥 ${streakCount} day streak` : "No data available"}
    </div>

    <div className="streak-week-row">
      {weekDays.map((day) => (
        <div className="streak-day-item" key={day.key || day.label}>
          <div
            className={`streak-day-dot ${day.isActive ? "active" : ""} ${day.isToday ? "today" : ""}`}
            aria-label={`${day.label}: ${day.isActive ? "active" : "inactive"}`}
          />
          <span>{day.label}</span>
        </div>
      ))}
    </div>

    <p className="streak-message">
      {!hasActivityData
        ? "Log activities to start tracking your streak."
        : streakCount > 0
          ? "Keep it up! Log in tomorrow to continue"
          : "Start your streak today!"}
    </p>
  </section>
);

const getPasswordStrength = (value) => {
  const password = value || "";
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password.length || score <= 2) {
    return { label: "Weak", width: "34%", color: "#ef4444" };
  }
  if (score <= 4) {
    return { label: "Fair", width: "67%", color: "#f59e0b" };
  }
  return { label: "Strong", width: "100%", color: "#22c55e" };
};

function SettingsView({
  settings,
  validationErrors,
  onFieldChange,
  onProfilePictureChange,
  onSave,
  onChangePassword,
  onThemeCardSelect,
  themeMode,
  onThemeModeChange,
  activeThemeName,
  notificationsEnabled,
  onNotificationToggle,
  notificationPrefs,
  onNotificationPrefToggle,
  parentCode,
  parentRequests,
  allowWellnessShare,
  onGenerateParentCode,
  onRespondParentRequest,
  onWellnessShareToggle,
  onBackToDashboard,
  onLogout,
}) {
  const [activeSection, setActiveSection] = useState("profile");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const fileInputRef = useRef(null);

  const userName = settings.username?.trim() || "Student";
  const userEmail = settings.email?.trim() || "student@example.com";

  const initials = useMemo(() => {
    const parts = (userName || userEmail)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "ST";
    return parts.map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2);
  }, [userName, userEmail]);

  const passwordStrength = useMemo(() => getPasswordStrength(passwordForm.newPassword), [passwordForm.newPassword]);

  const handlePasswordUpdate = async () => {
    setPasswordMessage(null);

    if (!passwordForm.currentPassword.trim()) {
      setPasswordMessage({ type: "error", text: "Current password is required." });
      return;
    }

    if (!passwordForm.newPassword.trim()) {
      setPasswordMessage({ type: "error", text: "New password is required." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    const result = await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (result.success) {
      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordMessage(null), 3000);
      return;
    }

    setPasswordMessage({ type: "error", text: result.error || "Failed to change password." });
  };

  const renderEyeButton = (field) => (
    <button
      type="button"
      className="settings-eye-btn"
      onClick={() => setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }))}
      aria-label={showPassword[field] ? "Hide password" : "Show password"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5c-5.2 0-9.5 3.3-11 7 1.5 3.7 5.8 7 11 7s9.5-3.3 11-7c-1.5-3.7-5.8-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2.2A1.8 1.8 0 1 0 12 10a1.8 1.8 0 0 0 0 3.8z" />
      </svg>
    </button>
  );

  return (
    <section className="settings-page-shell" aria-label="Settings page">
      <h1 className="settings-page-title">Settings</h1>

      <div className="settings-page-layout">
        <aside className="settings-page-sidebar">
          <button type="button" className="settings-back-btn" onClick={onBackToDashboard}>
            ← Dashboard
          </button>

          <div className="settings-sidebar-group">
            <small>Account</small>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => setActiveSection("profile")}
            >
              Profile
            </button>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "security" ? "active" : ""}`}
              onClick={() => setActiveSection("security")}
            >
              Security
            </button>
          </div>

          <div className="settings-sidebar-group">
            <small>App Settings</small>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "preferences" ? "active" : ""}`}
              onClick={() => setActiveSection("preferences")}
            >
              Preferences
            </button>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "notifications" ? "active" : ""}`}
              onClick={() => setActiveSection("notifications")}
            >
              Notifications
            </button>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "parent-controls" ? "active" : ""}`}
              onClick={() => setActiveSection("parent-controls")}
            >
              Parent Controls
            </button>
          </div>

          <div className="settings-sidebar-group">
            <small>Danger</small>
            <button
              type="button"
              className={`settings-side-item ${activeSection === "danger" ? "active" : ""}`}
              onClick={() => setActiveSection("danger")}
            >
              Logout
            </button>
          </div>
        </aside>

        <div className="settings-page-content">
          {activeSection === "profile" && (
            <article className="settings-content-card">
              <h2>Profile</h2>
              <p>Update your personal information and profile photo.</p>

              <div className="settings-profile-hero">
                {settings.profilePicture ? (
                  <img src={settings.profilePicture} alt="Profile" className="settings-profile-avatar" />
                ) : (
                  <div className="settings-profile-avatar settings-avatar-fallback">{initials}</div>
                )}
                <button type="button" className="settings-card-btn" onClick={() => fileInputRef.current?.click()}>
                  Change Photo
                </button>
                <input
                  ref={fileInputRef}
                  id="settings-profile-picture"
                  type="file"
                  accept="image/*"
                  onChange={onProfilePictureChange}
                  style={{ display: "none" }}
                />
              </div>

              <div className="settings-card-grid">
                <label className="settings-card-field">
                  <span>Username</span>
                  <input value={settings.username} onChange={(event) => onFieldChange("username", event.target.value)} />
                  {validationErrors.username ? <small>{validationErrors.username}</small> : null}
                </label>

                <label className="settings-card-field">
                  <span>Email</span>
                  <input type="email" value={settings.email} onChange={(event) => onFieldChange("email", event.target.value)} />
                  {validationErrors.email ? <small>{validationErrors.email}</small> : null}
                </label>

                <label className="settings-card-field settings-card-field-full">
                  <span>Phone</span>
                  <input value={settings.phone} onChange={(event) => onFieldChange("phone", event.target.value)} />
                  {validationErrors.phone ? <small>{validationErrors.phone}</small> : null}
                </label>
              </div>

              <div className="settings-card-actions">
                <button type="button" className="settings-card-btn settings-card-btn-primary" onClick={onSave}>
                  Save
                </button>
              </div>
            </article>
          )}

          {activeSection === "security" && (
            <article className="settings-content-card">
              <h2>Security</h2>
              <p>Manage your password and keep your account protected.</p>

              <label className="settings-card-field settings-card-field-full">
                <span>Current Password</span>
                <div className="settings-password-input-wrap">
                  <input
                    type={showPassword.currentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  />
                  {renderEyeButton("currentPassword")}
                </div>
              </label>

              <label className="settings-card-field settings-card-field-full">
                <span>New Password</span>
                <div className="settings-password-input-wrap">
                  <input
                    type={showPassword.newPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  />
                  {renderEyeButton("newPassword")}
                </div>
              </label>

              <div className="settings-password-strength">
                <div className="settings-password-strength-track">
                  <div
                    className="settings-password-strength-fill"
                    style={{ width: passwordStrength.width, background: passwordStrength.color }}
                  />
                </div>
                <small style={{ color: passwordStrength.color }}>{passwordStrength.label}</small>
              </div>

              <label className="settings-card-field settings-card-field-full">
                <span>Confirm Password</span>
                <div className="settings-password-input-wrap">
                  <input
                    type={showPassword.confirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  />
                  {renderEyeButton("confirmPassword")}
                </div>
              </label>

              <div className="settings-card-actions">
                <button type="button" className="settings-card-btn settings-card-btn-primary" onClick={handlePasswordUpdate}>
                  Change Password
                </button>
              </div>

              {passwordMessage ? (
                <p className={`settings-inline-message ${passwordMessage.type === "error" ? "error" : "success"}`}>
                  {passwordMessage.text}
                </p>
              ) : null}
            </article>
          )}

          {activeSection === "preferences" && (
            <article className="settings-content-card">
              <h2>Preferences</h2>
              <p>Customize the dashboard appearance and behavior.</p>

              <div className="settings-theme-card-grid">
                {Object.entries(themes).map(([themeKey, themeValues]) => (
                  <button
                    key={themeKey}
                    type="button"
                    className={`settings-theme-card ${activeThemeName === themeKey ? "active" : ""}`}
                    onClick={() => onThemeCardSelect(themeKey)}
                  >
                    <strong>{themeValues.name}</strong>
                    <div className="settings-theme-card-swatches">
                      <span style={{ background: themeValues.bg }} />
                      <span style={{ background: themeValues.card }} />
                      <span style={{ background: themeValues.accent }} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="settings-toggle-row-full">
                <div>
                  <strong>System Theme</strong>
                  <p>Automatically match your operating system theme.</p>
                </div>
                <button
                  type="button"
                  className={`settings-pill-toggle ${themeMode === "system" ? "on" : ""}`}
                  onClick={() => onThemeModeChange(themeMode === "system" ? "dark" : "system")}
                  aria-pressed={themeMode === "system"}
                >
                  <span />
                </button>
              </div>
            </article>
          )}

          {activeSection === "notifications" && (
            <article className="settings-content-card">
              <h2>Notifications</h2>
              <p>Choose what alerts and summaries you receive.</p>

              <div className="settings-toggle-list">
                <div className="settings-toggle-row-full">
                  <div>
                    <strong>Streak reminders</strong>
                    <p>Remind me to log daily.</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-pill-toggle ${notificationPrefs.streakReminders ? "on" : ""}`}
                    onClick={() => onNotificationPrefToggle("streakReminders")}
                    aria-pressed={notificationPrefs.streakReminders}
                  >
                    <span />
                  </button>
                </div>

                <div className="settings-toggle-row-full">
                  <div>
                    <strong>Weekly summary</strong>
                    <p>Get a weekly wellness report.</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-pill-toggle ${notificationPrefs.weeklySummary ? "on" : ""}`}
                    onClick={() => onNotificationPrefToggle("weeklySummary")}
                    aria-pressed={notificationPrefs.weeklySummary}
                  >
                    <span />
                  </button>
                </div>

                <div className="settings-toggle-row-full">
                  <div>
                    <strong>Achievement alerts</strong>
                    <p>Notify when badge earned.</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-pill-toggle ${notificationPrefs.achievementAlerts ? "on" : ""}`}
                    onClick={() => onNotificationPrefToggle("achievementAlerts")}
                    aria-pressed={notificationPrefs.achievementAlerts}
                  >
                    <span />
                  </button>
                </div>

                <div className="settings-toggle-row-full">
                  <div>
                    <strong>Account notifications</strong>
                    <p>General account updates and reminders.</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-pill-toggle ${notificationsEnabled ? "on" : ""}`}
                    onClick={() => onNotificationToggle(!notificationsEnabled)}
                    aria-pressed={notificationsEnabled}
                  >
                    <span />
                  </button>
                </div>
              </div>
            </article>
          )}

          {activeSection === "parent-controls" && (
            <article className="settings-content-card">
              <h2>Parent Access Controls</h2>
              <p>Manage account linking and wellness sharing permissions.</p>

              <div className="settings-toggle-row-full">
                <div>
                  <strong>Verification Code</strong>
                  <p>
                    {parentCode?.verificationCode
                      ? `${parentCode.verificationCode} (expires ${new Date(parentCode.expiresAt).toLocaleTimeString()})`
                      : "Generate a code to link a parent account."}
                  </p>
                </div>
                <button type="button" className="settings-card-btn" onClick={onGenerateParentCode}>
                  Generate Code
                </button>
              </div>

              <div className="settings-toggle-row-full">
                <div>
                  <strong>Wellness Privacy</strong>
                  <p>Share detailed wellness indicators with approved parent.</p>
                </div>
                <button
                  type="button"
                  className={`settings-pill-toggle ${allowWellnessShare ? "on" : ""}`}
                  onClick={() => onWellnessShareToggle(!allowWellnessShare)}
                  aria-pressed={allowWellnessShare}
                >
                  <span />
                </button>
              </div>

              <div className="sessions-card">
                <h3>Pending Parent Requests</h3>
                {parentRequests.length ? (
                  <ul>
                    {parentRequests.map((request) => (
                      <li key={request.id}>
                        <div>
                          <strong>{request.parent?.name || "Unknown Parent"}</strong>
                          <div className="session-meta">{request.parent?.email}</div>
                        </div>
                        <div className="inline-actions">
                          <button type="button" className="btn-primary" onClick={() => onRespondParentRequest(request.id, "approved")}>Approve</button>
                          <button type="button" className="btn-logout" onClick={() => onRespondParentRequest(request.id, "rejected")}>Reject</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sessions-empty">No pending parent requests.</p>
                )}
              </div>
            </article>
          )}

          {activeSection === "danger" && (
            <article className="settings-content-card">
              <h2>Logout</h2>
              <p>Sign out and manage sensitive account actions.</p>

              <div className="settings-card-actions">
                <button type="button" className="settings-card-btn" onClick={onLogout}>
                  Logout
                </button>
              </div>

              <section className="settings-danger-card">
                <strong>Danger Zone</strong>
                <p>This action is permanent and cannot be undone.</p>
                <button type="button" className="settings-danger-action-btn">Delete Account</button>
              </section>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function Dashboard({ onLogout }) {
  const [themeName, setThemeName] = useState(() => {
    const savedTheme = localStorage.getItem("dashboardTheme") || "dark";
    return savedTheme === "green" ? "forest" : savedTheme;
  });
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("dashboardThemeMode") || "system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true
  );
  const effectiveThemeName =
    themeMode === "light" || themeMode === "dark"
      ? themeMode
      : themeMode === "system"
        ? systemPrefersDark
          ? "dark"
          : "light"
        : themeName;
  const theme = themes[effectiveThemeName] || themes.dark;
  const [summary, setSummary] = useState(null);
  const assignmentPlanner = useAssignments();
  const assignments = assignmentPlanner.rawAssignments;
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [showLogForm, setShowLogForm] = useState(false);
  const [parentCode, setParentCode] = useState(null);
  const [parentRequests, setParentRequests] = useState([]);
  const [allowWellnessShare, setAllowWellnessShare] = useState(true);
  const [todayMoodLog, setTodayMoodLog] = useState(null);
  const [moodLogsAll, setMoodLogsAll] = useState(() => {
    try {
      const data = loadFromStorage("moodLogs", []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState(() => getInAppNotifications());
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [completedTaskMap, setCompletedTaskMap] = useState({});
  const [settingsErrors, setSettingsErrors] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    username: "",
    email: "",
    phone: "",
    profilePicture: "",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [settingsNotificationPrefs, setSettingsNotificationPrefs] = useState({
    streakReminders: true,
    weeklySummary: true,
    achievementAlerts: true,
  });

  const [logForm, setLogForm] = useState({
    studyHours: 0,
    focusMinutes: 0,
    breakMinutes: 0,
    screenTime: 0,
    sleepHours: 0,
    sleepQuality: "Fair",
    mealsCount: 0,
    waterIntake: 0,
    exerciseMinutes: 0,
    exerciseType: "",
    stressLevel: "Low",
    moodRating: 5,
    notes: "",
  });

  useEffect(() => {
    fetchDashboard();
    fetchParentRequests();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event) => setSystemPrefersDark(event.matches);
    mediaQuery.addEventListener("change", updateSystemTheme);
    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    // Initialize user auth system on first mount
    initializeUserAuth();

    try {
      const savedUser = loadFromStorage("user", {});
      const savedSettings = loadFromStorage("userSettings", {});

      setSettingsForm({
        username: savedSettings.username || savedUser.name || "",
        email: savedSettings.email || savedUser.email || "",
        phone: savedSettings.phone || savedUser.phone || "",
        profilePicture: savedSettings.profilePicture || savedUser.profilePicture || "",
      });
      setNotificationsEnabled(Boolean(savedSettings.notificationsEnabled));

      const savedNotificationPrefs = loadFromStorage(SETTINGS_NOTIFICATION_PREFS_KEY, null);
      if (savedNotificationPrefs && typeof savedNotificationPrefs === "object") {
        setSettingsNotificationPrefs((prev) => ({ ...prev, ...savedNotificationPrefs }));
      }
    } catch (error) {
      console.warn("Could not load saved settings", error);
    }
  }, []);

  useEffect(() => {
    saveToStorage(SETTINGS_NOTIFICATION_PREFS_KEY, settingsNotificationPrefs);
  }, [settingsNotificationPrefs]);

  useEffect(() => {
    if (!loading) {
      setUserData({ performance: assignmentPlanner.analytics.completionRate || 0 });
    }
  }, [assignmentPlanner.analytics.completionRate, loading]);

  const safeSummary = useMemo(() => summary || {}, [summary]);
  const recentLogs = useMemo(
    () => (Array.isArray(safeSummary.recentLogs) ? safeSummary.recentLogs : []),
    [safeSummary]
  );
  const sessionLogs = useMemo(
    () => (Array.isArray(safeSummary.upcomingSessions) ? safeSummary.upcomingSessions : []),
    [safeSummary]
  );
  const hasDailyLogs = Boolean(recentLogs.length);
  const hasAnyUserData = Boolean(recentLogs.length || assignments.length || sessionLogs.length);

  const showNoData = (value, suffix = "") => {
    if (value === null || value === undefined || Number.isNaN(value)) return "No data available";
    return `${value}${suffix}`;
  };

  const moodTodayValue = (() => {
    const value = Number(safeSummary.todayLog?.moodRating);
    return Number.isFinite(value) ? value : null;
  })();

  const quickStats = useMemo(
    () => [
      {
        label: "Stress Index",
        value: showNoData(safeSummary.stressIndex),
        helper: safeSummary.stressCategory || "No data available",
      },
      {
        label: "Average Study",
        value: showNoData(safeSummary.weeklyStats?.avgStudyHours, "h"),
        helper: "Per day",
      },
      {
        label: "Average Sleep",
        value: showNoData(safeSummary.weeklyStats?.avgSleepHours, "h"),
        helper: "Per night",
      },
      {
        label: "Screen Time",
        value: showNoData(safeSummary.weeklyStats?.avgScreenTime, "h"),
        helper: "Daily average",
      },
      {
        label: "Exercise",
        value: showNoData(safeSummary.weeklyStats?.avgExercise, "m"),
        helper: "Daily average",
      },
      {
        label: "Mood Today",
        value: moodTodayValue === null ? "No data available" : `${moodTodayValue}/10`,
        helper: "Self rating",
      },
    ],
    [safeSummary, moodTodayValue]
  );

  const studentContext = {
    stressLevel: Number(safeSummary.stressIndex ?? 0),
    avgSleepHours: Number(safeSummary.weeklyStats?.avgSleepHours ?? 0),
    avgStudyHours: Number(safeSummary.weeklyStats?.avgStudyHours ?? 0),
    moodRating: Number(safeSummary.todayLog?.moodRating ?? 0),
    recentActivities: {
      exercise: Number(safeSummary.todayLog?.exerciseMinutes ?? 0),
      screenTime: Number(safeSummary.todayLog?.screenTime ?? 0),
      waterIntake: Number(safeSummary.todayLog?.waterIntake ?? 0),
    },
  };

  const averagePerformance = calculatePerformanceScoreFromTasks(assignments);

  const avgFocusMinutes = safeSummary.weeklyStats?.avgFocusMinutes;
  const avgBreakMinutes = safeSummary.weeklyStats?.avgBreakMinutes;
  const hasFocusData = Number.isFinite(Number(avgFocusMinutes)) && Number.isFinite(Number(avgBreakMinutes));
  const focusBalance = hasFocusData
    ? clampPercent((Number(avgFocusMinutes) / Math.max(1, Number(avgFocusMinutes) + Number(avgBreakMinutes))) * 100)
    : null;

  const wellnessRhythm = calculateWellnessScoreFromMoodLogs(recentLogs);
  const wellnessLabel =
    wellnessRhythm === null
      ? "No data available"
      : wellnessRhythm >= 75
        ? "Feeling Good"
        : wellnessRhythm >= 45
          ? "Steady Rhythm"
          : "Needs Attention";
  const todayTasks = sessionLogs.filter((session) => {
    const date = new Date(session.scheduledDate);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  });
  const todayTaskCount = sessionLogs.length ? todayTasks.length : null;
  const nextUpcomingTasks = sessionLogs
    .filter((session) => {
      const date = new Date(session.scheduledDate);
      return !Number.isNaN(date.getTime()) && date >= new Date();
    })
    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
    .slice(0, 2);
  const todayDateKey = toDateKey(new Date());

  const sleepHoursToday = Number(safeSummary.todayLog?.sleepHours || 0);
  const waterIntakeToday = Number(safeSummary.todayLog?.waterIntake || 0);
  const sleepGoalPercent = Math.max(0, Math.min(100, Math.round((sleepHoursToday / 8) * 100)));
  const waterGoalPercent = Math.max(0, Math.min(100, Math.round((waterIntakeToday / 3) * 100)));

  const dashboardThemeStyle = {
    "--theme-bg": theme.bg,
    "--theme-card": theme.card,
    "--theme-card-secondary": theme.cardSecondary,
    "--theme-text": theme.text,
    "--theme-text-muted": theme.textMuted,
    "--theme-accent": theme.accent,
    "--theme-accent-text": theme.accentText,
    "--theme-border": theme.border,
    "--theme-button-bg": theme.buttonBg,
    "--theme-button-text": theme.buttonText,
    "--dash-bg-1": theme.bg,
    "--dash-bg-2": theme.bg,
    "--dash-surface": theme.card,
    "--dash-surface-soft": theme.cardSecondary,
    "--dash-ink-900": theme.text,
    "--dash-ink-700": theme.text,
    "--dash-ink-500": theme.textMuted,
    "--dash-primary": theme.accent,
    "--dash-primary-strong": theme.accent,
    "--dash-accent": theme.accent,
    "--dash-success": theme.accent,
    "--dash-danger": theme.accent,
    "--dash-border": theme.border,
  };

  const buildTaskKey = (task) => {
    const idPart = task.id || task._id || task.scheduledDate || task.subject || "task";
    return `${idPart}-${toDateKey(task.scheduledDate) || "date-unknown"}`;
  };

  const activityDateKeys = useMemo(
    () => collectActivityDateKeys(recentLogs, assignments, sessionLogs),
    [recentLogs, assignments, sessionLogs]
  );

  const weekDays = useMemo(() => buildWeekDaysFromActivity(activityDateKeys), [activityDateKeys]);

  const currentStreak = useMemo(() => calculateStreakCount(activityDateKeys), [activityDateKeys]);

  const totalXP = useMemo(
    () => calculateXP(recentLogs, assignments, currentStreak, moodLogsAll),
    [recentLogs, assignments, currentStreak, moodLogsAll]
  );

  const level = useMemo(() => getLevel(totalXP), [totalXP]);

  const rewardsBadges = useMemo(
    () => calculateBadges(recentLogs, assignments, currentStreak, moodLogsAll, totalXP),
    [recentLogs, assignments, currentStreak, moodLogsAll, totalXP]
  );

  const xpFromDailyLogs = useMemo(() => (recentLogs?.length || 0) * 50, [recentLogs]);
  const xpFromAssignments = useMemo(
    () => (assignments || []).filter((assignment) => assignment?.status === "completed").length * 30,
    [assignments]
  );
  const xpFromStreak = useMemo(() => Number(currentStreak || 0) * 25, [currentStreak]);
  const xpFromMoodLogs = useMemo(() => (moodLogsAll?.length || 0) * 10, [moodLogsAll]);

  const xpProgress = useMemo(() => {
    const range = level.max - level.current;
    if (range <= 0) return 100;
    const progress = totalXP - level.current;
    return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
  }, [totalXP, level]);

  const xpRewardItems = [
    { id: "daily_data", icon: "📝", label: "Log daily data", value: "+50 XP" },
    { id: "mood_log", icon: "🙂", label: "Log your mood", value: "+10 XP" },
    { id: "complete_task", icon: "✅", label: "Complete a task", value: "+15 XP" },
    { id: "streak", icon: "🔥", label: "Maintain your streak", value: "+25 XP/day" },
    { id: "assignment", icon: "📚", label: "Complete assignment", value: "+30 XP" },
    { id: "sleep", icon: "😴", label: "Healthy sleep (7h+)", value: "+10 XP" },
    { id: "exercise", icon: "💪", label: "Exercise 30min+", value: "+15 XP" },
    { id: "water", icon: "💧", label: "Drink 3L water", value: "+10 XP" },
  ];

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const notificationPanelRef = useRef(null);

  useEffect(() => {
    requestNotificationPermission();

    const checkNotifications = () => {
      const now = new Date();
      const todayKey = toDateKey(now);

      (safeSummary.upcomingSessions || []).forEach((session) => {
        const sessionTime = new Date(session.scheduledDate);
        const diffMinutes = (sessionTime - now) / 60000;

        if (diffMinutes > 0 && diffMinutes <= 15) {
          const notifKey = `session_soon_${session.id}`;
          if (!localStorage.getItem(notifKey)) {
            const title = "Study Session Starting Soon!";
            const body = `${session.subject} starts in ${Math.round(diffMinutes)} minutes`;
            sendBrowserNotification(title, body);
            saveInAppNotification(title, body, "warning");
            localStorage.setItem(notifKey, "1");
          }
        }

        if (sessionTime < now && !session.completed) {
          const notifKey = `session_missed_${session.id}_${todayKey}`;
          if (!localStorage.getItem(notifKey)) {
            const title = "Missed Study Session";
            const body = `You missed your ${session.subject} session scheduled at ${sessionTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            sendBrowserNotification(title, body);
            saveInAppNotification(title, body, "danger");
            localStorage.setItem(notifKey, "1");
          }
        }
      });

      const hour = now.getHours();
      if (hour >= 19) {
        const hasLoggedToday = (safeSummary.recentLogs || []).some((log) =>
          toDateKey(log.date || log.createdAt) === todayKey
        );
        const logReminderKey = `log_reminder_${todayKey}`;
        if (!hasLoggedToday && !localStorage.getItem(logReminderKey)) {
          const title = "Don't forget your daily log!";
          const body = "You haven't logged today yet. Keep your streak alive!";
          sendBrowserNotification(title, body);
          saveInAppNotification(title, body, "info");
          localStorage.setItem(logReminderKey, "1");
        }
      }

      if (hour >= 22 && currentStreak > 0) {
        const streakKey = `streak_warning_${todayKey}`;
        const hasLoggedToday = (safeSummary.recentLogs || []).some((log) =>
          toDateKey(log.date || log.createdAt) === todayKey
        );
        if (!hasLoggedToday && !localStorage.getItem(streakKey)) {
          const title = "🔥 Streak at Risk!";
          const body = `Your ${currentStreak} day streak will reset if you don't log today!`;
          sendBrowserNotification(title, body);
          saveInAppNotification(title, body, "danger");
          localStorage.setItem(streakKey, "1");
        }
      }

      (assignments || []).forEach((assignment) => {
        if (!assignment.dueDate || assignment.status === "completed") return;
        const dueTime = new Date(assignment.dueDate);
        const diffHours = (dueTime - now) / 3600000;

        if (diffHours > 0 && diffHours <= 24) {
          const notifKey = `assignment_due_${assignment.id}_${todayKey}`;
          if (!localStorage.getItem(notifKey)) {
            const title = "Assignment Due Soon!";
            const body = `"${assignment.title}" is due in ${Math.round(diffHours)} hours`;
            sendBrowserNotification(title, body);
            saveInAppNotification(title, body, "warning");
            localStorage.setItem(notifKey, "1");
          }
        }
      });

      setNotifications(getInAppNotifications());
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, [safeSummary, assignments, currentStreak]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        setIsNotificationPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todaysTaskItems = useMemo(
    () =>
      todayTasks.map((task) => {
        const id = buildTaskKey(task);
        return {
          id,
          title: task.subject || "Study session",
          date: task.scheduledDate,
          completed: Boolean(completedTaskMap[id]),
        };
      }),
    [todayTasks, completedTaskMap]
  );

  useEffect(() => {
    localStorage.setItem("dashboardTheme", themeName);
  }, [themeName]);

  useEffect(() => {
    localStorage.setItem("dashboardThemeMode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    try {
      const moodLogs = loadFromStorage("moodLogs", []);
      const todayMood = Array.isArray(moodLogs)
        ? moodLogs.find((entry) => entry?.date === todayDateKey)
        : null;
      setTodayMoodLog(todayMood || null);
    } catch (error) {
      console.warn("Could not load moodLog from localStorage", error);
    }

    try {
      const tasksByDay = loadFromStorage("tasks", {});
      if (tasksByDay && typeof tasksByDay === "object") {
        setCompletedTaskMap(tasksByDay[todayDateKey] || {});
        return;
      }

      setCompletedTaskMap({});
    } catch (error) {
      console.warn("Could not load task completion from localStorage", error);
    }
  }, [todayDateKey]);

  useEffect(() => {
    try {
      const data = loadFromStorage("moodLogs", []);
      setMoodLogsAll(Array.isArray(data) ? data : []);
    } catch {
      setMoodLogsAll([]);
    }
  }, [todayMoodLog]);

  const handleMoodPick = (mood) => {
    if (todayMoodLog) return;

    const existingLogs = loadFromStorage("moodLogs", []);
    const filteredLogs = Array.isArray(existingLogs)
      ? existingLogs.filter((entry) => entry?.date !== todayDateKey)
      : [];

    const entry = {
      date: todayDateKey,
      emoji: mood.emoji,
      moodValue: mood.moodValue,
      updatedAt: new Date().toISOString(),
    };

    saveToStorage("moodLogs", [...filteredLogs, entry]);
    setUserData({ mood: Math.round((Number(mood.moodValue) || 0) * 20) });
    setTodayMoodLog(entry);
  };

  const handleTaskToggle = (taskId, isChecked) => {
    setCompletedTaskMap((prev) => {
      const next = { ...prev, [taskId]: isChecked };
      const allTasks = loadFromStorage("tasks", {});
      const nextTasks = {
        ...(allTasks && typeof allTasks === "object" ? allTasks : {}),
        [todayDateKey]: next,
      };
      saveToStorage("tasks", nextTasks);
      return next;
    });
  };

  const handleSettingsFieldChange = (field, value) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
    setSettingsErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleSettingsFieldChange("profilePicture", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = () => {
    const nextErrors = {};
    const trimmedUsername = settingsForm.username.trim();
    const trimmedEmail = settingsForm.email.trim();
    const trimmedPhone = settingsForm.phone.trim();

    if (!trimmedUsername) nextErrors.username = "Username is required.";
    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (trimmedPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(trimmedPhone)) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    setSettingsErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      ...settingsForm,
      username: trimmedUsername,
      email: trimmedEmail,
      phone: trimmedPhone,
      notificationsEnabled,
      themeMode,
      updatedAt: new Date().toISOString(),
    };

    // Update user profile in userAuth system
    const result = updateUserProfile({
      username: trimmedUsername,
      email: trimmedEmail,
      phone: trimmedPhone,
    });

    if (!result.success) {
      alert(`Failed to update profile: ${result.error}`);
      return;
    }

    saveToStorage("userSettings", payload);

    try {
      const existingUser = loadFromStorage("user", {});
      const nextUser = {
        ...existingUser,
        name: payload.username,
        email: payload.email,
        phone: payload.phone,
        profilePicture: payload.profilePicture,
      };
      saveToStorage("user", nextUser);
    } catch (error) {
      console.warn("Could not update user record", error);
    }

    alert("Settings saved successfully.");
    setActiveView("overview");
  };

  const handleChangePassword = async (currentPassword, newPassword) => {
    try {
      await changePasswordAPI(currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleLogoutClick = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    window.location.reload();
  };

  const fetchDashboard = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParentRequests = async () => {
    try {
      const requests = await getParentLinkRequests();
      setParentRequests(requests || []);
    } catch (error) {
      console.error("Error fetching parent requests:", error);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([fetchDashboard(), fetchParentRequests(), Promise.resolve(assignmentPlanner.refreshAssignments())]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogChange = (e) => {
    const { name, value } = e.target;
    setLogForm({ ...logForm, [name]: value });
  };

  const handleGenerateParentCode = async () => {
    try {
      const data = await generateParentLinkCode();
      setParentCode(data);
      alert("Parent verification code generated successfully.");
    } catch (error) {
      alert("Could not generate code: " + error.message);
    }
  };

  const handleRespondParentRequest = async (requestId, action) => {
    try {
      await respondToParentLinkRequest(requestId, action);
      fetchParentRequests();
      alert(`Request ${action}`);
    } catch (error) {
      alert("Could not update request: " + error.message);
    }
  };

  const handleWellnessShareToggle = async (nextValue) => {
    try {
      setAllowWellnessShare(nextValue);
      await updateWellnessPrivacy(nextValue);
    } catch (error) {
      setAllowWellnessShare(!nextValue);
      alert("Failed to update privacy setting: " + error.message);
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveDailyLog(logForm);
      const totalStudyMinutes = Math.max(
        0,
        Math.round((Number(logForm.studyHours) || 0) * 60) + (Number(logForm.focusMinutes) || 0)
      );
      const moodPercent = Math.max(0, Math.min(100, (Number(logForm.moodRating) || 0) * 10));
      setUserData({
        studyTime: totalStudyMinutes,
        mood: moodPercent,
      });
      alert("Daily log saved successfully!");
      setShowLogForm(false);
      fetchDashboard();
      setLogForm({
        studyHours: 0,
        focusMinutes: 0,
        breakMinutes: 0,
        screenTime: 0,
        sleepHours: 0,
        sleepQuality: "Fair",
        mealsCount: 0,
        waterIntake: 0,
        exerciseMinutes: 0,
        exerciseType: "",
        stressLevel: "Low",
        moodRating: 5,
        notes: "",
      });
    } catch (error) {
      console.error("Error saving daily log:", error);
      alert("Error saving log: " + error.message);
    }
  };


  if (loading) {
    return (
      <div className="dashboard-container dashboard-skeleton-shell" style={dashboardThemeStyle}>
        <div className="dashboard-skeleton-bar" />
        <div className="dashboard-skeleton-grid">
          <div className="dashboard-skeleton-card" />
          <div className="dashboard-skeleton-card" />
          <div className="dashboard-skeleton-card" />
          <div className="dashboard-skeleton-card dashboard-skeleton-card-wide" />
          <div className="dashboard-skeleton-card dashboard-skeleton-card-wide" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={dashboardThemeStyle}>
      <Header
        theme={theme}
        themeName={themeName}
        themes={themes}
        themeDotColors={themeDotColors}
        onThemeChange={(key) => {
          setThemeName(key);
          setThemeMode("custom");
        }}
        summary={summary}
        loading={loading}
      />

      {activeView === "settings" && (
        <SettingsView
          settings={settingsForm}
          validationErrors={settingsErrors}
          onFieldChange={handleSettingsFieldChange}
          onProfilePictureChange={handleProfilePictureChange}
          onSave={handleSaveSettings}
          onChangePassword={handleChangePassword}
          onThemeCardSelect={(value) => {
            setThemeName(value);
            setThemeMode("custom");
          }}
          themeMode={themeMode}
          onThemeModeChange={(value) => {
            setThemeMode(value);
            if (value === "light" || value === "dark") {
              setThemeName(value);
            }
          }}
          activeThemeName={themeName}
          notificationsEnabled={notificationsEnabled}
          onNotificationToggle={setNotificationsEnabled}
          notificationPrefs={settingsNotificationPrefs}
          onNotificationPrefToggle={(key) =>
            setSettingsNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          parentCode={parentCode}
          parentRequests={parentRequests}
          allowWellnessShare={allowWellnessShare}
          onGenerateParentCode={handleGenerateParentCode}
          onRespondParentRequest={handleRespondParentRequest}
          onWellnessShareToggle={handleWellnessShareToggle}
          onBackToDashboard={() => setActiveView("overview")}
          onLogout={handleLogoutClick}
        />
      )}

      {activeView !== "settings" && (
        <DashboardGrid
          sidebar={
            <>
              <div className="dashboard-left-brand">
                <strong>Student Wellness</strong>
                <span>Realtime analytics workspace</span>
              </div>
              <nav className="dashboard-left-nav" aria-label="Primary dashboard navigation">
                <button className={`left-nav-item ${activeView === "overview" ? "active" : ""}`} onClick={() => setActiveView("overview")}>Dashboard</button>
                <button className={`left-nav-item ${activeView === "analytics" ? "active" : ""}`} onClick={() => setActiveView("analytics")}>Analytics</button>
                <button className={`left-nav-item ${activeView === "rewards" ? "active" : ""}`} onClick={() => setActiveView("rewards")}>Rewards</button>
                <button className={`left-nav-item ${activeView === "sessions" ? "active" : ""}`} onClick={() => setActiveView("sessions")}>Study Sessions</button>
                <button className={`left-nav-item ${activeView === "settings" ? "active" : ""}`} onClick={() => setActiveView("settings")}>Settings</button>
              </nav>
              <div className="left-nav-utility">
                <button className="btn-primary" onClick={() => { setActiveView("daily-log"); setShowLogForm(true); }}>
                  + Log Today
                </button>
                <button className="btn-secondary" onClick={handleRefreshAll} disabled={isRefreshing}>
                  {isRefreshing ? "Refreshing..." : "Refresh Data"}
                </button>
              </div>
            </>
          }
          topbar={
            <>
              <div className="dashboard-topbar-user">
                <div className="dashboard-avatar-chip">{(settingsForm.username || "ST").slice(0, 2).toUpperCase()}</div>
                <div>
                  <h1>Welcome back, {settingsForm.username || "Student"}</h1>
                  <p>Track wellness, performance, and study momentum in one place.</p>
                </div>
              </div>
              <div className="dashboard-topbar-actions">
                <div className="xp-header-indicator" aria-label="XP progress">
                  <div className="xp-header-meta">
                    <span className="xp-header-level">{level.name}</span>
                    <span className="xp-header-value">{totalXP} XP</span>
                  </div>
                  <div className="xp-header-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpProgress}>
                    <div className="xp-header-fill" style={{ width: `${xpProgress}%` }} />
                  </div>
                </div>
                <StatsCard label="Wellness" value={wellnessRhythm === null ? "--" : `${wellnessRhythm}%`} helper={wellnessLabel} tone="wellness" />
                <StatsCard label="Performance" value={averagePerformance === null ? "--" : `${averagePerformance}%`} helper="Assignments" tone="progress" />
                <StatsCard label="Today" value={todayTaskCount === null ? "--" : `${todayTaskCount}`} helper="Upcoming sessions" tone="default" />
                <div className="notification-shell" ref={notificationPanelRef}>
                  <button
                    type="button"
                    className="notification-bell-btn"
                    onClick={() => setIsNotificationPanelOpen((prev) => !prev)}
                    aria-label="Open notifications"
                  >
                    <span className="notification-bell-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Zm-2 1H6v-6a6 6 0 1 1 12 0v6Z" />
                      </svg>
                    </span>
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                  </button>

                  {isNotificationPanelOpen && (
                    <div className="notification-dropdown" role="dialog" aria-label="Notifications">
                      <div className="notification-dropdown-header">
                        <strong>Notifications</strong>
                        <button type="button" className="notification-panel-close" onClick={() => setIsNotificationPanelOpen(false)}>
                          ✕
                        </button>
                      </div>

                      <div className="notification-list">
                        {notifications.length ? (
                          notifications.map((notification) => (
                            <article key={notification.id} className={`notification-item ${notification.read ? "read" : "unread"}`}>
                              <span className={`notification-dot type-${notification.type}`} aria-hidden="true" />
                              <div className="notification-copy">
                                <div className="notification-title-row">
                                  <strong>{notification.title}</strong>
                                  <span>{formatTimeAgo(notification.createdAt)}</span>
                                </div>
                                <p>{notification.body}</p>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="notification-empty">No notifications yet.</p>
                        )}
                      </div>

                      <div className="notification-actions">
                        <button type="button" onClick={() => setNotifications(markAllRead())}>
                          Mark all read
                        </button>
                        <button type="button" onClick={() => setNotifications(clearAllNotifications())}>
                          Clear all
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button type="button" className="dashboard-notify-chip" onClick={() => setActiveView("settings")}>⚙️ Settings</button>
              </div>
            </>
          }
          rightPanel={
            <>
              <section className="panel-card">
                <h3>Real-time Widgets</h3>
                <MoodTracker todayMoodLog={todayMoodLog} onLogMood={handleMoodPick} />
              </section>
              <section className="panel-card">
                <TaskList todaysTasks={todaysTaskItems} onToggleTask={handleTaskToggle} />
              </section>
              <section className="panel-card quick-actions-panel">
                <h3>Quick Actions</h3>
                <button className="quick-action-icon-btn" onClick={() => setActiveView("assignments")}>📚 Assignments</button>
                <button className="quick-action-icon-btn" onClick={() => setActiveView("sessions")}>🎥 Study Hub</button>
                <button className="quick-action-icon-btn" onClick={() => setActiveView("ai-tools")}>🤖 AI Coach</button>
                <button className="quick-action-icon-btn danger" onClick={handleLogoutClick}>↩ Logout</button>
              </section>
            </>
          }
          main={
            <>
              <section className="workspace-tabs" aria-label="Feature navigation">
                {VIEWS.map((view) => (
                  <button
                    key={view.id}
                    className={`workspace-tab ${activeView === view.id ? "active" : ""}`}
                    onClick={() => setActiveView(view.id)}
                  >
                    {view.label}
                  </button>
                ))}
              </section>

      {activeView === "overview" && (
        <>
          <StreakDashboard streakCount={currentStreak} weekDays={weekDays} hasActivityData={hasAnyUserData} />

          {safeSummary.todayLog && (
            <section className="glass-card overview-glance-card" aria-label="Today at a glance">
              <h2>Today at a Glance</h2>
              <p>
                Study: {Number(safeSummary.todayLog.studyHours || 0)}h | Sleep: {Number(safeSummary.todayLog.sleepHours || 0)}h | Exercise: {Number(safeSummary.todayLog.exerciseMinutes || 0)}min | Water: {Number(safeSummary.todayLog.waterIntake || 0)}L | Mood: {Number(safeSummary.todayLog.moodRating || 0)}/10
              </p>
            </section>
          )}

          <section className="overview-quick-links" aria-label="Quick links">
            <button className="quick-link-pill" onClick={() => { setActiveView("daily-log"); setShowLogForm(true); }}>
              Log Today
            </button>
            <button className="quick-link-pill" onClick={() => setActiveView("analytics")}>
              View Analytics
            </button>
            <button className="quick-link-pill" onClick={() => setActiveView("assignments")}>
              Assignments
            </button>
            <button className="quick-link-pill" onClick={() => setActiveView("ai-tools")}>
              AI Coach
            </button>
          </section>

          <section className="dashboard-hero-section">
            <div className="dashboard-hero-copy dashboard-wellness-snapshot">
              <h2>Today's Wellness Snapshot</h2>
              <p>Prioritized metrics from your current day and weekly rhythm.</p>
              <div className="dashboard-hero-metrics dashboard-wellness-grid">
                <StatsCard label="Stress Index" value={showNoData(safeSummary.stressIndex)} helper={safeSummary.stressCategory || "No data"} tone="wellness" />
                <StatsCard label="Mood" value={moodTodayValue === null ? "--" : `${moodTodayValue}/10`} helper="Current check-in" tone="default" />
                <StatsCard label="Focus Balance" value={focusBalance === null ? "--" : `${focusBalance}%`} helper="Focus vs breaks" tone="progress" />
                <StatsCard label="Sleep Goal" value={`${sleepGoalPercent}%`} helper={`${sleepHoursToday}h of 8h`} tone="default" />
                <StatsCard label="Water Intake" value={`${waterGoalPercent}%`} helper={`${waterIntakeToday}L of 3L`} tone="wellness" />
              </div>
            </div>
          </section>

          <section className="dashboard-tertiary-grid">
            <article className="glass-card recommendations-card">
              <h2>Recommendations</h2>
              {safeSummary.recommendations?.length > 0 ? (
                <ul>
                  {safeSummary.recommendations.slice(0, 3).map((rec, index) => (
                    <li key={`recommend-${index}`}>{rec}</li>
                  ))}
                </ul>
              ) : (
                <p>No recommendations yet. Keep logging to get personalized guidance.</p>
              )}
            </article>
            <article className="glass-card overview-earned-badges">
              <h2>Earned Badges</h2>
              {rewardsBadges.length ? (
                <div className="overview-badge-icons">
                  {rewardsBadges.map((badge) => (
                    <span key={badge.id} title={badge.title} aria-label={badge.title}>{badge.icon}</span>
                  ))}
                </div>
              ) : (
                <p>No badges earned yet.</p>
              )}
            </article>
          </section>
        </>
      )}

      {activeView === "analytics" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>Analytics Workspace</h2>
              <p>Explore trend intelligence for stress, sleep, focus, and screen time.</p>
            </div>
            <button className="btn-secondary" onClick={() => setActiveView("overview")}>
              ← Overview
            </button>
          </div>
          <section className="glass-card dashboard-trends-block">
            <h2>Weekly Trends</h2>
            <DashboardCharts
              summary={safeSummary}
              hasDailyLogs={hasDailyLogs}
              onRequestLog={() => {
                setActiveView("daily-log");
                setShowLogForm(true);
              }}
            />
          </section>

          <section className="glass-card analytics-upcoming-sessions">
            <h2>Upcoming Sessions</h2>
            {nextUpcomingTasks.length ? (
              <ul className="insight-task-list">
                {nextUpcomingTasks.map((task) => (
                  <li key={task.id || task._id || task.scheduledDate}>
                    <span>{task.subject || "Study session"}</span>
                    <small>{new Date(task.scheduledDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No upcoming sessions scheduled.</p>
            )}
          </section>
        </section>
      )}

      {activeView === "rewards" && (
        <section className="glass-card feature-section rewards-page">
          <article className="rewards-level-card">
            <div className="rewards-level-head">
              <h2>{level.name}</h2>
              <strong>{totalXP} XP</strong>
            </div>
            <div className="rewards-xp-progress-wrap">
              <div className="rewards-xp-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpProgress}>
                <div className="rewards-xp-progress-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <p>
                {level.next
                  ? `${Math.max(0, level.max - totalXP)} XP to ${level.next}`
                  : "Max level reached"}
              </p>
            </div>
          </article>

          <article className="rewards-xp-breakdown">
            <h3>XP Breakdown</h3>
            <ul>
              <li>From daily logs: {xpFromDailyLogs} XP ({recentLogs.length} x 50)</li>
              <li>From assignments: {xpFromAssignments} XP</li>
              <li>From streak: {xpFromStreak} XP ({currentStreak} x 25)</li>
              <li>From mood logs: {xpFromMoodLogs} XP ({moodLogsAll.length} x 10)</li>
              <li><strong>Total: {totalXP} XP</strong></li>
            </ul>
          </article>

          <article className="rewards-badge-wall">
            <h3>Your Badges</h3>
            {rewardsBadges.length ? (
              <div className="rewards-badges-grid">
                {rewardsBadges.map((badge) => (
                  <div key={badge.id} className="rewards-badge-card">
                    <span className="rewards-badge-icon" aria-hidden="true">{badge.icon}</span>
                    <strong>{badge.title}</strong>
                    <p>{badge.desc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rewards-empty-state">
                <div className="rewards-empty-illustration" aria-hidden="true" />
                <p>No badges yet - start logging to earn your first!</p>
              </div>
            )}
          </article>

          <article className="rewards-xp-guide">
            <h3>How to earn XP</h3>
            <div className="rewards-xp-grid">
              {xpRewardItems.map((item) => (
                <div key={item.id} className="rewards-xp-item">
                  <span className="rewards-xp-icon" aria-hidden="true">{item.icon}</span>
                  <span className="rewards-xp-text">{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {activeView === "daily-log" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>Daily Log Studio</h2>
              <p>Capture your routine and update wellness indicators.</p>
            </div>
            <button onClick={() => setShowLogForm((prev) => !prev)} className="btn-primary">
              {showLogForm ? "Hide Form" : "Add Daily Log"}
            </button>
          </div>

          {!hasDailyLogs && (
            <div className="unlock-card">
              <div>
                <h3>Unlock Deeper Insights</h3>
                <p>Add your first daily entry to activate analytics and trend tracking.</p>
              </div>
            </div>
          )}

          {showLogForm && (
            <div className="form-card">
              <form onSubmit={handleLogSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Study Hours</label>
                    <input type="number" name="studyHours" value={logForm.studyHours} onChange={handleLogChange} min="0" max="24" step="0.5" />
                  </div>
                  <div className="form-group">
                    <label>Screen Time (hours)</label>
                    <input type="number" name="screenTime" value={logForm.screenTime} onChange={handleLogChange} min="0" max="24" step="0.5" />
                  </div>
                  <div className="form-group">
                    <label>Focus Duration (minutes)</label>
                    <input type="number" name="focusMinutes" value={logForm.focusMinutes || 0} onChange={handleLogChange} min="0" />
                  </div>
                  <div className="form-group">
                    <label>Break Duration (minutes)</label>
                    <input type="number" name="breakMinutes" value={logForm.breakMinutes || 0} onChange={handleLogChange} min="0" />
                  </div>
                  <div className="form-group">
                    <label>Sleep Hours</label>
                    <input type="number" name="sleepHours" value={logForm.sleepHours} onChange={handleLogChange} min="0" max="24" step="0.5" />
                  </div>
                  <div className="form-group">
                    <label>Sleep Quality</label>
                    <select name="sleepQuality" value={logForm.sleepQuality} onChange={handleLogChange}>
                      <option value="Poor">Poor</option>
                      <option value="Fair">Fair</option>
                      <option value="Good">Good</option>
                      <option value="Excellent">Excellent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Meals Count</label>
                    <input type="number" name="mealsCount" value={logForm.mealsCount} onChange={handleLogChange} min="0" max="10" />
                  </div>
                  <div className="form-group">
                    <label>Water Intake (liters)</label>
                    <input type="number" name="waterIntake" value={logForm.waterIntake} onChange={handleLogChange} min="0" step="0.5" />
                  </div>
                  <div className="form-group">
                    <label>Exercise (minutes)</label>
                    <input type="number" name="exerciseMinutes" value={logForm.exerciseMinutes} onChange={handleLogChange} min="0" />
                  </div>
                  <div className="form-group">
                    <label>Exercise Type</label>
                    <input type="text" name="exerciseType" value={logForm.exerciseType} onChange={handleLogChange} placeholder="e.g., Running, Yoga" />
                  </div>
                  <div className="form-group">
                    <label>Stress Level</label>
                    <select name="stressLevel" value={logForm.stressLevel} onChange={handleLogChange}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Mood Rating (1-10)</label>
                    <input type="number" name="moodRating" value={logForm.moodRating} onChange={handleLogChange} min="1" max="10" />
                  </div>
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea name="notes" value={logForm.notes} onChange={handleLogChange} rows="3" placeholder="Any additional notes..." />
                  </div>
                </div>
                <button type="submit" className="btn-submit">Save Daily Log</button>
              </form>
            </div>
          )}
        </section>
      )}

      {activeView === "assignments" && (
        <section className="glass-card feature-section">
          <AssignmentPlanner {...assignmentPlanner} />
        </section>
      )}

      {activeView === "sessions" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>Live Session Hub</h2>
              <p>Schedule, monitor, and review your study sessions.</p>
            </div>
          </div>

          <div className="sessions-card">
            <h3>Upcoming Study Sessions</h3>
            {safeSummary.upcomingSessions?.length ? (
              <ul>
                {safeSummary.upcomingSessions.map((session) => {
                  const sessionDate = new Date(session.scheduledDate);
                  const isPastDue = sessionDate < new Date();
                  return (
                    <li key={session.id || session._id} className={isPastDue ? "session-past" : ""}>
                      <div>
                        <strong>{session.subject}</strong>
                        <span className="session-meta">{session.duration} min</span>
                      </div>
                      <div className="session-date">
                        {sessionDate.toLocaleString()} {isPastDue && <em>(past due)</em>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="sessions-empty">No upcoming sessions yet. Generate a smart schedule to get started.</p>
            )}
          </div>

          <LiveFaceStudySession studentContext={studentContext} />
        </section>
      )}

      {activeView === "ai-tools" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>AI Assistant Space</h2>
              <p>Switch modes and chat with your AI study coach in real time.</p>
            </div>
          </div>

          <AiCoach />
        </section>
      )}
            </>
          }
        />
      )}
    </div>
  );
}

export default Dashboard;
