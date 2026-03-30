import React, { useEffect, useMemo, useState } from "react";
import {
  createAssignment,
  getAssignments,
  getDashboardSummary,
  getParentLinkRequests,
  generateParentLinkCode,
  createStudySession,
  respondToParentLinkRequest,
  saveDailyLog,
  updateWellnessPrivacy,
} from "../services/api";
import AIChatbot from "../components/AIChatbot";
import SmartScheduler from "../components/SmartScheduler";
import DashboardCharts from "../components/DashboardCharts";
import LiveFaceStudySession from "../components/sample/LiveFaceStudySession";
import Header from "../components/dashboard/Header";
import MoodTracker from "../components/dashboard/MoodTracker";
import TaskList from "../components/dashboard/TaskList";
import SettingsModal from "../components/settings/SettingsModal";
import { loadFromStorage, saveToStorage } from "../utils/storage";
import { changePassword, updateUserProfile, initializeUserAuth } from "../utils/userAuth";
import "../styles/Dashboard.css";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "daily-log", label: "Daily Log" },
  { id: "assignments", label: "Assignments" },
  { id: "sessions", label: "Live Session" },
  { id: "parent-link", label: "Parent Link" },
  { id: "ai-tools", label: "AI Tools" },
];

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
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [showLogForm, setShowLogForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [parentCode, setParentCode] = useState(null);
  const [parentRequests, setParentRequests] = useState([]);
  const [allowWellnessShare, setAllowWellnessShare] = useState(true);
  const [todayMoodLog, setTodayMoodLog] = useState(null);
  const [completedTaskMap, setCompletedTaskMap] = useState({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    username: "",
    email: "",
    phone: "",
    profilePicture: "",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    subject: "",
    dueDate: "",
    status: "pending",
    progress: 0,
  });

  useEffect(() => {
    fetchDashboard();
    fetchParentRequests();
    fetchAssignments();
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
    } catch (error) {
      console.warn("Could not load saved settings", error);
    }
  }, []);

  const hasDailyLogs = Boolean(summary?.recentLogs?.length);
  const safeSummary = summary || {};
  const recentLogs = Array.isArray(safeSummary.recentLogs) ? safeSummary.recentLogs : [];
  const sessionLogs = Array.isArray(safeSummary.upcomingSessions) ? safeSummary.upcomingSessions : [];
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

  const completedAssignments = assignments.filter((item) => item.status === "completed").length;
  const assignmentCompletionRate = assignments.length
    ? clampPercent((completedAssignments / assignments.length) * 100)
    : null;
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

  const earnedBadges = useMemo(() => {
    const badgeRules = [
      {
        min: 7,
        title: "7 Day Streak",
        subtitle: "Logged in 7 days in a row!",
        icon: "★",
      },
      {
        min: 14,
        title: "14 Day Streak",
        subtitle: "Logged in 14 days in a row!",
        icon: "★",
      },
      {
        min: 21,
        title: "21 Day Streak",
        subtitle: "Logged in 21 days in a row!",
        icon: "★",
      },
      {
        min: 30,
        title: "Perfect Month",
        subtitle: "Logged in 30 days in a row!",
        icon: "🏆",
      },
    ];

    return badgeRules.filter((badge) => currentStreak >= badge.min);
  }, [currentStreak]);

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
    setShowSettingsModal(false);
  };

  const handleChangePassword = (currentPassword, newPassword) => {
    return changePassword(currentPassword, newPassword);
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

  const fetchAssignments = async () => {
    try {
      const data = await getAssignments();
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([fetchDashboard(), fetchParentRequests(), fetchAssignments()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogChange = (e) => {
    const { name, value } = e.target;
    setLogForm({ ...logForm, [name]: value });
  };

  const handleAssignmentChange = (e) => {
    const { name, value } = e.target;
    setAssignmentForm({ ...assignmentForm, [name]: value });
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

  const handleScheduleCreated = async (scheduleData) => {
    try {
      const studySessions = scheduleData.filter((b) => b.type === "study");
      let savedCount = 0;
      const errors = [];

      for (const block of studySessions) {
        try {
          const sessionData = {
            subject: block.subject,
            scheduledDate: block.scheduledDate || block.startTime,
            duration: block.duration,
            notes: block.reason || "AI-generated study session",
          };
          await createStudySession(sessionData);
          savedCount += 1;
        } catch (sessionError) {
          errors.push(sessionError.message || "Unknown error");
        }
      }

      if (savedCount > 0) {
        alert(`Successfully scheduled ${savedCount} study session(s)!`);
        fetchDashboard();
      } else {
        alert(`Error saving sessions: ${errors.join(", ")}`);
      }
    } catch (error) {
      console.error("Error in schedule creation:", error);
      alert("Error saving sessions. Please try again.");
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveDailyLog(logForm);
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

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();

    if (!assignmentForm.title.trim()) {
      alert("Assignment title is required.");
      return;
    }

    try {
      await createAssignment({
        title: assignmentForm.title.trim(),
        subject: assignmentForm.subject.trim() || "General",
        dueDate: assignmentForm.dueDate || null,
        status: assignmentForm.status,
        progress: Number(assignmentForm.progress || 0),
      });

      alert("Assignment saved successfully!");
      setAssignmentForm({
        title: "",
        subject: "",
        dueDate: "",
        status: "pending",
        progress: 0,
      });
      setShowAssignmentForm(false);
      fetchAssignments();
      fetchDashboard();
    } catch (error) {
      console.error("Error saving assignment:", error);
      alert("Error saving assignment: " + error.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
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
        onOpenSettings={() => setShowSettingsModal(true)}
        wellnessScore={wellnessRhythm}
        performanceScore={assignmentCompletionRate}
        todayTaskCount={todayTaskCount}
      />

      <section className="dashboard-quick-insights" aria-label="Quick dashboard insights">
        <article className="insight-card-dark">
          <h3>Wellness</h3>
          <strong>{wellnessRhythm === null ? "No data available" : `${wellnessRhythm}%`}</strong>
          <p>{wellnessLabel}</p>
        </article>

        <article className="insight-card-dark">
          <h3>Performance</h3>
          <strong>{averagePerformance === null ? "No data available" : `${averagePerformance}%`}</strong>
          <div className="insight-progress-track" aria-hidden="true">
            <div className="insight-progress-fill" style={{ width: `${averagePerformance || 0}%` }} />
          </div>
          <p>Average assignment progress</p>
        </article>

        <article className="insight-card-dark">
          <h3>Schedule</h3>
          <strong>{todayTaskCount === null ? "No data available" : `${todayTaskCount} today`}</strong>
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
            <p>{sessionLogs.length ? "No upcoming tasks found." : "No data available"}</p>
          )}
        </article>
      </section>

      <StreakDashboard streakCount={currentStreak} weekDays={weekDays} hasActivityData={hasAnyUserData} />

      {earnedBadges.length > 0 && (
        <section className="achievements-card" aria-label="Earned achievements">
          <h3>Achievements</h3>
          <div className="achievements-row">
            {earnedBadges.map((badge) => (
              <article className="achievement-item" key={badge.title}>
                <div className="achievement-icon" aria-hidden="true">
                  <span>{badge.icon}</span>
                </div>
                <strong>{badge.title}</strong>
                <p>{badge.subtitle}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-dual-widgets" aria-label="Mood log and task checklist">
        <MoodTracker todayMoodLog={todayMoodLog} onLogMood={handleMoodPick} />
        <TaskList todaysTasks={todaysTaskItems} onToggleTask={handleTaskToggle} />
      </section>

      <section className="student-command-bar glass-card">
        <div className="command-bar-copy">
          <h2>Command Center</h2>
          <p>Use smart shortcuts to move through your daily workflow faster.</p>
        </div>
        <div className="command-bar-actions">
          <button
            className="btn-analytics"
            onClick={() => {
              if (hasDailyLogs) window.location.hash = "#analytics";
            }}
            disabled={!hasDailyLogs}
            aria-disabled={!hasDailyLogs}
            title={hasDailyLogs ? "View your analytics" : "Add a daily log to unlock analytics"}
          >
            Open Analytics
          </button>
          <button className="btn-secondary" onClick={handleRefreshAll} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="btn-logout"
            onClick={handleLogoutClick}
          >
            Logout
          </button>
          <button className="btn-primary" onClick={() => { setActiveView("daily-log"); setShowLogForm(true); }}>
            Log Today
          </button>
          <button className="btn-secondary" onClick={() => setActiveView("sessions")}>Open Live Hub</button>
          <button className="btn-secondary" onClick={() => setActiveView("assignments")}>Track Assignments</button>
          <button className="btn-secondary" onClick={() => setActiveView("parent-link")}>Parent Access</button>
        </div>
      </section>

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
          <section className="overview-ribbon">
            <article className="ribbon-card">
              <span>Assignment Completion</span>
              <strong>{assignmentCompletionRate === null ? "No data available" : `${assignmentCompletionRate}%`}</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${assignmentCompletionRate || 0}%` }} />
              </div>
            </article>
            <article className="ribbon-card">
              <span>Focus Balance</span>
              <strong>{focusBalance === null ? "No data available" : `${focusBalance}%`}</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${focusBalance || 0}%` }} />
              </div>
            </article>
            <article className="ribbon-card">
              <span>Wellness Rhythm</span>
              <strong>{wellnessRhythm === null ? "No data available" : `${wellnessRhythm}%`}</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${wellnessRhythm || 0}%` }} />
              </div>
            </article>
          </section>

          <section className="quick-stats-grid">
            {quickStats.map((item) => (
              <article className="quick-stat-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </article>
            ))}
          </section>

          {safeSummary.todayLog && (
            <section className="today-card glass-card">
              <h2>Today at a Glance</h2>
              <div className="today-stats">
                <div>
                  <strong>Study</strong>
                  <span>{safeSummary.todayLog.studyHours}h</span>
                </div>
                <div>
                  <strong>Sleep</strong>
                  <span>{safeSummary.todayLog.sleepHours}h ({safeSummary.todayLog.sleepQuality})</span>
                </div>
                <div>
                  <strong>Exercise</strong>
                  <span>{safeSummary.todayLog.exerciseMinutes}min</span>
                </div>
                <div>
                  <strong>Water</strong>
                  <span>{safeSummary.todayLog.waterIntake}L</span>
                </div>
                <div>
                  <strong>Mood</strong>
                  <span>{safeSummary.todayLog.moodRating}/10</span>
                </div>
              </div>
            </section>
          )}

          <section className="glass-card">
            <h2>Performance Panels</h2>
            <DashboardCharts
              summary={safeSummary}
              hasDailyLogs={hasDailyLogs}
              onRequestLog={() => {
                setActiveView("daily-log");
                setShowLogForm(true);
              }}
            />
          </section>

          {safeSummary.recommendations?.length > 0 && (
            <section className="recommendations-card glass-card">
              <h2>Recommendations</h2>
              <ul>
                {safeSummary.recommendations.map((rec, index) => (
                  <li key={`recommend-${index}`}>{rec}</li>
                ))}
              </ul>
            </section>
          )}
        </>
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
          <div className="feature-head">
            <div>
              <h2>Assignment Planner</h2>
              <p>Track every assignment with status and progress.</p>
            </div>
            <button onClick={() => setShowAssignmentForm((prev) => !prev)} className="btn-primary">
              {showAssignmentForm ? "Hide Form" : "Add Assignment"}
            </button>
          </div>

          {showAssignmentForm && (
            <div className="form-card">
              <form onSubmit={handleAssignmentSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Title</label>
                    <input type="text" name="title" value={assignmentForm.title} onChange={handleAssignmentChange} placeholder="Assignment title" />
                  </div>
                  <div className="form-group">
                    <label>Subject</label>
                    <input type="text" name="subject" value={assignmentForm.subject} onChange={handleAssignmentChange} placeholder="e.g., IoT, Math" />
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input type="datetime-local" name="dueDate" value={assignmentForm.dueDate} onChange={handleAssignmentChange} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={assignmentForm.status} onChange={handleAssignmentChange}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Progress (%)</label>
                    <input type="number" name="progress" value={assignmentForm.progress} onChange={handleAssignmentChange} min="0" max="100" />
                  </div>
                </div>
                <button type="submit" className="btn-submit">Save Assignment</button>
              </form>
            </div>
          )}

          <div className="sessions-card">
            <h3>Tracked Assignments</h3>
            {assignments.length ? (
              <ul>
                {assignments.map((assignment) => (
                  <li key={assignment.id} className="assignment-item">
                    <div>
                      <strong>{assignment.title}</strong>
                      <div className="session-meta">{assignment.subject || "General"}</div>
                      {assignment.dueDate && <div className="session-date">Due {new Date(assignment.dueDate).toLocaleString()}</div>}
                    </div>
                    <div className="assignment-meta">
                      <span className={`assignment-status assignment-${assignment.status}`}>{assignment.status.replace("_", " ")}</span>
                      <span>{assignment.progress}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sessions-empty">No assignments tracked yet.</p>
            )}
          </div>
        </section>
      )}

      {activeView === "sessions" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>Live Session Hub</h2>
              <p>Schedule, monitor, and review your study sessions.</p>
            </div>
            <SmartScheduler studentContext={studentContext} onScheduleCreated={handleScheduleCreated} />
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

      {activeView === "parent-link" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>Parent Access Controls</h2>
              <p>Manage account linking and wellness sharing permissions.</p>
            </div>
            <button className="btn-secondary" onClick={handleGenerateParentCode}>Generate Code</button>
          </div>

          <div className="today-stats">
            <div>
              <strong>Verification Code</strong>
              {parentCode?.verificationCode ? (
                <span>{parentCode.verificationCode} (expires {new Date(parentCode.expiresAt).toLocaleTimeString()})</span>
              ) : (
                <span>Generate a code to link a parent account.</span>
              )}
            </div>
            <div>
              <strong>Wellness Privacy</strong>
              <label className="privacy-toggle">
                <input type="checkbox" checked={allowWellnessShare} onChange={(e) => handleWellnessShareToggle(e.target.checked)} />
                Share detailed wellness indicators with approved parent
              </label>
            </div>
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
                      <button className="btn-primary" onClick={() => handleRespondParentRequest(request.id, "approved")}>Approve</button>
                      <button className="btn-logout" onClick={() => handleRespondParentRequest(request.id, "rejected")}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sessions-empty">No pending parent requests.</p>
            )}
          </div>
        </section>
      )}

      {activeView === "ai-tools" && (
        <section className="glass-card feature-section">
          <div className="feature-head">
            <div>
              <h2>AI Assistant Space</h2>
              <p>Chat with AI and request personalized support tips.</p>
            </div>
          </div>
          <AIChatbot studentContext={studentContext} />
        </section>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settingsForm}
        validationErrors={settingsErrors}
        onFieldChange={handleSettingsFieldChange}
        onProfilePictureChange={handleProfilePictureChange}
        themeMode={themeMode === "custom" ? "system" : themeMode}
        onThemeModeChange={(value) => {
          setThemeMode(value);
          if (value === "light" || value === "dark") {
            setThemeName(value);
          }
        }}
        notificationsEnabled={notificationsEnabled}
        onNotificationToggle={setNotificationsEnabled}
        onSave={handleSaveSettings}
        onChangePassword={handleChangePassword}
        onLogout={handleLogoutClick}
      />
    </div>
  );
}

export default Dashboard;
