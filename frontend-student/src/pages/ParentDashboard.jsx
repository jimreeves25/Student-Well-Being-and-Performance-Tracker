import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getParentAlerts,
  getParentDashboard,
  getParentNotificationPreferences,
  getParentReports,
  markParentAlertRead,
  updateParentNotificationPreferences,
} from "../services/api";
import { connectParentSocket, disconnectParentSocket } from "../services/socket";
import "../styles/ParentDashboard.css";

const ALERT_TITLE_MAP = {
  student_sleeping_suspected: "Possible Sleep Detected",
  student_sleeping_confirmed: "Sleep Pattern Confirmed",
  student_inactive_60s: "Inactivity Notice",
  student_inactive_120s: "Extended Inactivity",
  student_inactive_180s: "High Inactivity Risk",
  student_inactive_300s: "Critical Inactivity",
  camera_no_face_45s: "Camera Away Alert",
  camera_no_face_90s: "Camera Away Extended",
  camera_no_face_150s: "Camera Away Critical",
  student_low_focus_streak: "Low Focus Trend",
  student_recovered_focus: "Recovery Update",
  student_tab_closed: "Study Tab Closed",
  student_left_class: "Student Went Offline",
  student_joined_class: "Student Joined Session",
  student_sleepy_10s: "Sleepy For 10 Seconds",
  student_drowsy_alarm_activated: "Drowsy Alarm Activated",
};

const formatAlertTitle = (alert) => {
  const type = String(alert?.alertType || "");
  return ALERT_TITLE_MAP[type] || type.replace(/_/g, " ");
};

const formatAlertDetails = (alert) => {
  const metadata = alert?.metadata || {};
  const details = [];

  if (Number.isFinite(Number(metadata.inactivityDuration))) {
    details.push(`Inactivity: ${Math.round(Number(metadata.inactivityDuration))}s`);
  }
  if (Number.isFinite(Number(metadata.focusLevel))) {
    details.push(`Focus: ${Math.round(Number(metadata.focusLevel))}%`);
  }
  if (Number.isFinite(Number(metadata.noFaceSeconds))) {
    details.push(`No face: ${Math.round(Number(metadata.noFaceSeconds))}s`);
  }
  if (typeof metadata.cameraStatus === "string" && metadata.cameraStatus) {
    details.push(`Camera: ${metadata.cameraStatus}`);
  }

  return details.join(" | ");
};

function ParentDashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [softWarning, setSoftWarning] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("Offline");
  const [realtimeFocus, setRealtimeFocus] = useState(0);
  const [realtimeInactivity, setRealtimeInactivity] = useState(0);
  const [realtimeTimerSec, setRealtimeTimerSec] = useState(0);
  const [activityGraph, setActivityGraph] = useState([]);
  const [alertFilter, setAlertFilter] = useState("all");
  const [alertSort, setAlertSort] = useState("latest");
  const [alertSearch, setAlertSearch] = useState("");
  const [alertDateFrom, setAlertDateFrom] = useState("");
  const [alertDateTo, setAlertDateTo] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState({
    notifyByEmail: true,
    notifyByDashboard: true,
    notifyByPush: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const unreadAlerts = useMemo(() => alerts.filter((item) => !item.isRead), [alerts]);
  const visibleAlerts = useMemo(() => {
    const query = alertSearch.trim().toLowerCase();
    const fromDate = alertDateFrom ? new Date(`${alertDateFrom}T00:00:00`) : null;
    const toDate = alertDateTo ? new Date(`${alertDateTo}T23:59:59`) : null;

    const filtered = alerts.filter((item) => {
      const severityMatch =
        alertFilter === "all" ||
        (alertFilter === "unread" ? !item.isRead : item.severity === alertFilter);
      if (!severityMatch) return false;

      const createdAt = new Date(item.createdAt || 0);
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;

      if (query) {
        const text = `${item.alertType || ""} ${item.message || ""} ${item.severity || ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return alertSort === "latest" ? bTime - aTime : aTime - bTime;
    });
  }, [alerts, alertFilter, alertSort, alertSearch, alertDateFrom, alertDateTo]);

  const loadDashboard = useCallback(async () => {
    const firstLoad = !hasLoadedOnceRef.current;
    if (firstLoad) setLoading(true);
    if (!firstLoad) setIsRefreshing(true);

    try {
      const [dashboardResult, alertResult, reportResult] = await Promise.allSettled([
        getParentDashboard(),
        getParentAlerts(),
        getParentReports(),
      ]);

      const warnings = [];

      if (dashboardResult.status === "fulfilled") {
        setData(dashboardResult.value || null);
        setError("");
        hasLoadedOnceRef.current = true;
      } else {
        const message = dashboardResult.reason?.message || "Unable to load parent dashboard";
        if (hasLoadedOnceRef.current) {
          warnings.push("dashboard");
        } else {
          setError(message);
        }
      }

      if (alertResult.status === "fulfilled") {
        setAlerts(alertResult.value || []);
      } else {
        warnings.push("alerts");
      }

      if (reportResult.status === "fulfilled") {
        setReports(reportResult.value || null);
      } else {
        warnings.push("reports");
      }

      setSoftWarning(
        warnings.length
          ? `Some sections are temporarily unavailable: ${warnings.join(", ")}.`
          : ""
      );
    } catch (err) {
      if (hasLoadedOnceRef.current) {
        setSoftWarning("Temporary connection issue. Showing last synced parent dashboard data.");
      } else {
        setError(err.message || "Unable to load parent dashboard");
      }
    } finally {
      if (firstLoad) setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getParentNotificationPreferences();
        setNotificationPrefs({
          notifyByEmail: !!prefs.notifyByEmail,
          notifyByDashboard: !!prefs.notifyByDashboard,
          notifyByPush: !!prefs.notifyByPush,
        });
      } catch (err) {
        console.error("Unable to load notification preferences", err);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    if (!data?.student?.id) return undefined;

    const token = localStorage.getItem("parentToken");
    if (!token) return undefined;

    const socket = connectParentSocket(token);
    if (!socket) return undefined;

    const notify = (title, body) => {
      if (!window.Notification) return;
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
        return;
      }
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    };

    const onConnect = () => {
      socket.emit("parent_subscribe", { studentId: data.student.id });
    };

    const onStatus = (payload = {}) => {
      const nextStatus = payload.status === "studying" ? "Studying" : payload.status === "idle" ? "Idle" : "Offline";
      setRealtimeStatus(nextStatus);

      if (payload.startedAt) {
        const seconds = Math.max(0, Math.floor((Date.now() - new Date(payload.startedAt).getTime()) / 1000));
        setRealtimeTimerSec(seconds);
      }

      if (nextStatus === "Offline") {
        setRealtimeFocus(0);
        setRealtimeInactivity(0);
      }
    };

    const onActivity = (payload = {}) => {
      const nextFocus = Math.max(0, Math.min(100, Number(payload.focusLevel || 0)));
      const nextInactivity = Math.max(0, Number(payload.inactivityDuration || 0));
      const nextStatus = payload.status === "studying" ? "Studying" : payload.status === "idle" ? "Idle" : "Offline";
      setRealtimeStatus(nextStatus);
      setRealtimeFocus(nextFocus);
      setRealtimeInactivity(nextInactivity);
      setActivityGraph((prev) => [...prev, { at: Date.now(), focus: nextFocus }].slice(-24));
    };

    const onSleepingAlert = (payload = {}) => {
      setAlerts((prev) => [
        {
          id: `rt-${Date.now()}`,
          alertType: "student_sleeping_alert",
          severity: "high",
          message: payload.message || "Sleep detected during live session.",
          isRead: false,
          createdAt: new Date().toISOString(),
          metadata: payload,
        },
        ...prev,
      ].slice(0, 40));

      notify("Student inactivity alert", payload.message || "Sleep/inactivity detected");
    };

    const onRealtimeAlert = (payload = {}) => {
      setAlerts((prev) => [
        {
          id: `rt-alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          alertType: payload.alertType || "live_alert",
          severity: payload.severity || "medium",
          message: payload.message || "Live monitoring alert",
          isRead: false,
          createdAt: payload.createdAt || new Date().toISOString(),
          metadata: payload.metadata || null,
        },
        ...prev,
      ].slice(0, 40));

      notify("Student monitoring update", payload.message || "New live alert received.");
    };

    socket.on("connect", onConnect);
    socket.on("student_status_update", onStatus);
    socket.on("student_activity_update", onActivity);
    socket.on("student_sleeping_alert", onSleepingAlert);
    socket.on("parent_realtime_alert", onRealtimeAlert);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("student_status_update", onStatus);
      socket.off("student_activity_update", onActivity);
      socket.off("student_sleeping_alert", onSleepingAlert);
      socket.off("parent_realtime_alert", onRealtimeAlert);
      disconnectParentSocket();
    };
  }, [data?.student?.id]);

  useEffect(() => {
    if (realtimeStatus !== "Studying") return undefined;

    const ticker = window.setInterval(() => {
      setRealtimeTimerSec((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(ticker);
  }, [realtimeStatus]);

  const markRead = async (alertId) => {
    try {
      await markParentAlertRead(alertId);
      setAlerts((prev) => prev.map((item) => (item.id === alertId ? { ...item, isRead: true } : item)));
    } catch (err) {
      console.error("Mark alert read failed", err);
    }
  };

  const markVisibleAsRead = async () => {
    const unreadVisible = visibleAlerts.filter((item) => !item.isRead);
    if (!unreadVisible.length) return;

    try {
      await Promise.allSettled(unreadVisible.map((item) => markParentAlertRead(item.id)));
      const unreadSet = new Set(unreadVisible.map((item) => item.id));
      setAlerts((prev) => prev.map((item) => (unreadSet.has(item.id) ? { ...item, isRead: true } : item)));
    } catch (err) {
      console.error("Mark visible alerts read failed", err);
    }
  };

  const toggleNotificationPreference = async (key) => {
    const nextPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(nextPrefs);
    setSavingPrefs(true);

    try {
      const response = await updateParentNotificationPreferences(nextPrefs);
      if (response?.preferences) {
        setNotificationPrefs({
          notifyByEmail: !!response.preferences.notifyByEmail,
          notifyByDashboard: !!response.preferences.notifyByDashboard,
          notifyByPush: !!response.preferences.notifyByPush,
        });
      }
    } catch (err) {
      setNotificationPrefs(notificationPrefs);
      alert(`Could not save preferences: ${err.message}`);
    } finally {
      setSavingPrefs(false);
    }
  };

  const exportWeeklyReportCsv = () => {
    if (!reports?.weekly?.length) {
      alert("No weekly report data to export yet.");
      return;
    }

    const header = ["week", "avgStudyHours", "avgFocusMinutes", "avgBreakMinutes"];
    const rows = reports.weekly.map((row) => [
      row.week,
      row.avgStudyHours,
      row.avgFocusMinutes,
      row.avgBreakMinutes,
    ]);

    if (reports?.engagement) {
      rows.push(["engagement_active_minutes", reports.engagement.activeMinutes || 0, "", ""]);
      rows.push(["engagement_inactive_minutes", reports.engagement.inactiveMinutes || 0, "", ""]);
    }

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `parent-weekly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="parent-loading">Loading parent monitoring dashboard...</div>;
  }

  if (error) {
    return (
      <div className="parent-error-wrap">
        <h2>Parent Access Status</h2>
        <p>{error}</p>
        <p className="hint">If you just created your account, wait for student approval from the student dashboard.</p>
        <button className="parent-btn logout" onClick={onLogout}>Logout</button>
      </div>
    );
  }

  const weeklyBars = data?.studyActivity?.dailySeries || [];
  const student = data?.student;
  const riskIndicators = data?.reports?.riskIndicators || [];
  const burnoutSignals = data?.reports?.burnoutSignals || [];
  const liveMinutes = Math.floor(realtimeTimerSec / 60);
  const liveSeconds = String(realtimeTimerSec % 60).padStart(2, "0");
  const statusClass =
    realtimeStatus === "Studying"
      ? "status-studying"
      : realtimeStatus === "Idle"
        ? "status-idle"
        : "status-offline";
  const liveClassStatus =
    realtimeStatus === "Studying"
      ? "Active"
      : realtimeStatus === "Idle"
        ? "Idle"
        : (data?.status?.liveClassStatus || "Not Active");
  const criticalUnreadCount = unreadAlerts.filter((item) => !item.isRead && item.severity === "high").length;
  const focusEfficiency = Math.round(
    ((Number(data?.studyActivity?.totalFocusMinutes) || 0) /
      Math.max(
        1,
        (Number(data?.studyActivity?.totalFocusMinutes) || 0) +
          (Number(data?.studyActivity?.totalBreakMinutes) || 0)
      )) *
      100
  );
  const completionRate = Math.round(
    ((data?.recentAssignments?.filter((item) => item.status === "completed").length || 0) /
      Math.max(1, data?.recentAssignments?.length || 0)) *
      100
  );
  const attentionScore = Math.max(0, 100 - Math.min(60, criticalUnreadCount * 15 + burnoutSignals.length * 12));

  return (
    <div className="parent-dashboard">
      <div className="parent-glow parent-glow-left" aria-hidden="true" />
      <div className="parent-glow parent-glow-right" aria-hidden="true" />

      <header className="parent-header panel">
        <div className="hero-copy">
          <p className="eyebrow">Live Guardian View</p>
          <h1>Parent Monitoring Center</h1>
          <p>Track learning performance, wellbeing, and live session behavior through a single actionable control room.</p>
          <div className="hero-meta">
            <span className="hero-chip">Student: {student?.name || "Unknown"}</span>
            <span className="hero-chip">Unread Alerts: {unreadAlerts.length}</span>
            <span className="hero-chip">Attendance: {data?.attendance?.rate || 0}%</span>
            <span className="hero-chip">Attention Score: {attentionScore}%</span>
          </div>
        </div>
        <div className="parent-header-actions">
          <span
            className={`live-badge ${
              realtimeStatus === "Studying" ? "active" : realtimeStatus === "Idle" ? "idle" : "inactive"
            }`}
          >
            {liveClassStatus}
          </span>
          <button className="parent-btn mark subtle" onClick={loadDashboard} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="parent-btn logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <section className="parent-command-bar panel">
        <div className="command-title-wrap">
          <h2>Command Center</h2>
          <p>Jump directly to the section you need and take immediate action.</p>
        </div>
        <div className="command-actions">
          <button
            className="parent-btn mark subtle"
            onClick={() => document.getElementById("live-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Go to Live Monitor
          </button>
          <button
            className="parent-btn mark subtle"
            onClick={() => document.getElementById("alerts-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Go to Alerts
          </button>
          <button className="parent-btn mark subtle" onClick={markVisibleAsRead}>
            Mark Visible Alerts Read
          </button>
          <button className="parent-btn mark" onClick={exportWeeklyReportCsv}>
            Export Weekly CSV
          </button>
        </div>
      </section>

      {!!softWarning && <div className="parent-soft-warning">{softWarning}</div>}

      <section className="parent-grid metrics advanced-metrics">
        <div className="metric-card accent-panel">
          <h3>Daily Study Hours</h3>
          <p className="metric-value">{data?.studyActivity?.avgStudyHoursPerDay || 0}h</p>
          <span className="metric-note">Average study time per day</span>
        </div>
        <div className="metric-card">
          <h3>Focus Efficiency</h3>
          <p className="metric-value">{focusEfficiency}%</p>
          <span className="metric-note">Focus ratio against total focus + break time</span>
        </div>
        <div className="metric-card">
          <h3>Assignment Completion</h3>
          <p className="metric-value">{completionRate}%</p>
          <span className="metric-note">Completed from recent tracked assignments</span>
        </div>
        <div className="metric-card">
          <h3>Critical Alerts</h3>
          <p className="metric-value">{criticalUnreadCount}</p>
          <span className="metric-note">Unread high-severity alerts right now</span>
        </div>
      </section>

      <section className="parent-grid profile-row" id="overview-section">
        <div className="panel student-profile">
          <h2>Student Snapshot</h2>
          <div className="profile-grid">
            <div>
              <span>Name</span>
              <strong>{student?.name || "Unknown"}</strong>
            </div>
            <div>
              <span>Student ID</span>
              <strong>{student?.studentId || "N/A"}</strong>
            </div>
            <div>
              <span>Live Status</span>
              <strong>{data?.status?.engagementStatus || "Offline"}</strong>
            </div>
            <div>
              <span>Unread Alerts</span>
              <strong>{unreadAlerts.length}</strong>
            </div>
          </div>
        </div>

        <div className="panel risk-panel pulse-panel">
          <h2>Attention Needed</h2>
          <div className="chip-wrap">
            {riskIndicators.length ? (
              riskIndicators.map((risk) => (
                <span key={risk} className="risk-chip">{risk}</span>
              ))
            ) : (
              <span className="risk-chip ok">No major risk indicators</span>
            )}
          </div>
          <div className="chip-wrap burnout">
            {burnoutSignals.length ? (
              burnoutSignals.map((signal) => (
                <span key={signal} className="risk-chip warn">{signal}</span>
              ))
            ) : (
              <span className="risk-chip ok">No burnout signals</span>
            )}
          </div>
          <div className="attention-meter" role="img" aria-label={`Attention score ${attentionScore} percent`}>
            <div className="attention-meter-track">
              <div className="attention-meter-fill" style={{ width: `${attentionScore}%` }} />
            </div>
            <strong>{attentionScore}% Stable</strong>
          </div>
        </div>
      </section>

      <section className="parent-grid two-col" id="live-section">
        <div className="panel live-realtime-panel accent-panel">
          <h2>Live Monitoring Stream</h2>
          <div className="live-realtime-status-row">
            <span className={`status-dot ${statusClass}`} />
            <strong>{realtimeStatus}</strong>
          </div>
          <div className="live-realtime-kpis">
            <div>
              <span>Live Session Timer</span>
              <strong>{liveMinutes}m {liveSeconds}s</strong>
            </div>
            <div>
              <span>Focus Percentage</span>
              <strong>{realtimeFocus}%</strong>
            </div>
            <div>
              <span>Inactivity</span>
              <strong>{realtimeInactivity}s</strong>
            </div>
          </div>
          <div className="live-meter-wrap">
            <span>Current focus gauge</span>
            <div className="live-meter-track" role="img" aria-label={`Current live focus ${realtimeFocus} percent`}>
              <div className="live-meter-fill" style={{ width: `${realtimeFocus}%` }} />
            </div>
          </div>
          <div className="live-focus-graph">
            {activityGraph.length ? (
              activityGraph.map((item) => (
                <div key={item.at} className="focus-graph-bar-wrap" title={`Focus ${item.focus}%`}>
                  <div className="focus-graph-bar" style={{ height: `${Math.max(6, item.focus)}%` }} />
                </div>
              ))
            ) : (
              <p className="empty">Waiting for real-time activity stream...</p>
            )}
          </div>
        </div>

        <div className="panel watchlist-panel">
          <h2>Session Alert Rules</h2>
          <div className="watchlist-grid">
            <p><strong>Join/Leave:</strong> Instant parent notifications enabled</p>
            <p><strong>Inactivity Threshold:</strong> {realtimeInactivity >= 60 ? "Triggered" : "Monitoring"}</p>
            <p><strong>Sleep Detection:</strong> Alert sent if sleepy state persists for 10 seconds</p>
            <p><strong>Tab Closure:</strong> Parent receives immediate tab-close alert</p>
          </div>
        </div>
      </section>

      <section className="parent-grid two-col" id="activity-section">
        <div className="panel">
          <h2>Study Activity (Daily)</h2>
          <div className="bar-wrap">
            {weeklyBars.length ? (
              weeklyBars.map((item, idx) => (
                <div className="bar-item" key={`${item.date}-${idx}`}>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: `${Math.max(6, Math.min(100, (item.value / 8) * 100))}%` }} />
                  </div>
                  <span className="bar-label">{new Date(item.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
                </div>
              ))
            ) : (
              <p className="empty">No study logs available yet.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <h2>Live Session Monitoring</h2>
          {data?.liveSession ? (
            <div className="live-details">
              <p><strong>Join Time:</strong> {new Date(data.liveSession.joinTime).toLocaleString()}</p>
              <p><strong>Active Participation:</strong> {Math.round((data.liveSession.activeParticipationDuration || 0) / 60)} min</p>
              <p><strong>Inactivity During Session:</strong> {Math.round((data.liveSession.inactivityDuringSession || 0) / 60)} min</p>
              <p><strong>Leave Time:</strong> {data.liveSession.leaveTime ? new Date(data.liveSession.leaveTime).toLocaleString() : "Still active"}</p>
            </div>
          ) : (
            <p className="empty">No recent live-session data.</p>
          )}
        </div>
      </section>

      <section className="parent-grid two-col">
        <div className="panel">
          <h2>Recent Assignments</h2>
          {data?.recentAssignments?.length ? (
            <ul className="assignment-list">
              {data.recentAssignments.map((item) => (
                <li key={item.id}>
                  <div className="assignment-main">
                    <strong>{item.title}</strong>
                    <span>{item.subject}</span>
                    <div className="assignment-progress-track" aria-hidden="true">
                      <div className="assignment-progress-fill" style={{ width: `${Math.max(0, Math.min(100, item.progress || 0))}%` }} />
                    </div>
                  </div>
                  <div className="status-wrap">
                    <span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span>
                    <span>{item.progress || 0}%</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No assignments tracked yet.</p>
          )}
        </div>

        <div className="panel">
          <h2>Wellness Indicators</h2>
          {data?.wellness?.privacyMode ? (
            <p className="empty">{data.wellness.message}</p>
          ) : (
            <div className="wellness-grid">
              <div>
                <span>Stress</span>
                <strong>{data?.wellness?.avgStress || 0}</strong>
              </div>
              <div>
                <span>Sleep (avg)</span>
                <strong>{data?.wellness?.avgSleepHours || 0}h</strong>
              </div>
              <div>
                <span>Mood (avg)</span>
                <strong>{data?.wellness?.avgMood || 0}/10</strong>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="parent-grid two-col" id="alerts-section">
        <div className="panel alerts">
          <div className="alerts-header-row">
            <h2>Real-Time Alerts {unreadAlerts.length ? `(${unreadAlerts.length} unread)` : ""}</h2>
            <button className="parent-btn mark subtle" onClick={markVisibleAsRead}>
              Mark Visible Read
            </button>
          </div>

          <div className="alerts-toolbar">
            <div className="toggle-pill-group" role="group" aria-label="Alert filter">
              <button
                className={`toggle-pill ${alertFilter === "all" ? "active" : ""}`}
                onClick={() => setAlertFilter("all")}
              >
                All
              </button>
              <button
                className={`toggle-pill ${alertFilter === "unread" ? "active" : ""}`}
                onClick={() => setAlertFilter("unread")}
              >
                Unread
              </button>
              <button
                className={`toggle-pill ${alertFilter === "high" ? "active" : ""}`}
                onClick={() => setAlertFilter("high")}
              >
                High
              </button>
              <button
                className={`toggle-pill ${alertFilter === "medium" ? "active" : ""}`}
                onClick={() => setAlertFilter("medium")}
              >
                Medium
              </button>
            </div>

            <div className="alerts-sort-wrap">
              <label htmlFor="alert-sort">Sort</label>
              <select
                id="alert-sort"
                value={alertSort}
                onChange={(e) => setAlertSort(e.target.value)}
              >
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div className="alerts-search-wrap">
              <label htmlFor="alert-search">Search</label>
              <input
                id="alert-search"
                type="text"
                placeholder="type, message, severity"
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
              />
            </div>

            <div className="alerts-date-wrap">
              <label htmlFor="alert-from">From</label>
              <input
                id="alert-from"
                type="date"
                value={alertDateFrom}
                onChange={(e) => setAlertDateFrom(e.target.value)}
              />
              <label htmlFor="alert-to">To</label>
              <input
                id="alert-to"
                type="date"
                value={alertDateTo}
                onChange={(e) => setAlertDateTo(e.target.value)}
              />
            </div>
          </div>

          {visibleAlerts.length ? (
            <ul className="alert-list">
              {visibleAlerts.map((alert) => (
                <li key={alert.id} className={`${alert.severity} ${alert.isRead ? "read" : "unread"}`}>
                  <div className="alert-main">
                    <strong>{formatAlertTitle(alert)}</strong>
                    <p>{alert.message}</p>
                    {!!formatAlertDetails(alert) && <small>{formatAlertDetails(alert)}</small>}
                    <small className="alert-time">{new Date(alert.createdAt).toLocaleString()}</small>
                  </div>
                  {!alert.isRead && (
                    <button className="parent-btn mark" onClick={() => markRead(alert.id)}>
                      Mark Read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No alerts right now.</p>
          )}
        </div>

        <div className="panel">
          <h2>Behavior Insight Reports</h2>
          <div className="report-actions">
            <button className="parent-btn mark subtle" onClick={exportWeeklyReportCsv}>
              Export Weekly CSV
            </button>
          </div>
          <div className="report-kpis">
            <p><strong>Study Consistency:</strong> {data?.reports?.studyConsistency || 0}%</p>
            <p><strong>Productivity Trend:</strong> {data?.reports?.productivityTrends || 0}</p>
            <p><strong>Attendance Rate:</strong> {data?.attendance?.rate || 0}%</p>
            <p><strong>Risk Indicators:</strong> {riskIndicators.join(", ") || "None"}</p>
            <p><strong>Burnout Signals:</strong> {burnoutSignals.join(", ") || "None"}</p>
          </div>

          <div className="notification-preferences">
            <h3>Notification Preferences</h3>
            <div className="notification-toggle-grid">
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.notifyByDashboard}
                  onChange={() => toggleNotificationPreference("notifyByDashboard")}
                  disabled={savingPrefs}
                />
                Dashboard Alerts
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.notifyByEmail}
                  onChange={() => toggleNotificationPreference("notifyByEmail")}
                  disabled={savingPrefs}
                />
                Email Alerts
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.notifyByPush}
                  onChange={() => toggleNotificationPreference("notifyByPush")}
                  disabled={savingPrefs}
                />
                Push Alerts
              </label>
            </div>
            {savingPrefs && <p className="pref-saving">Saving preferences...</p>}
          </div>

          {!!reports?.weekly?.length && (
            <div className="weekly-table">
              {reports.weekly.map((row) => (
                <div key={row.week}>
                  <span>{row.week}</span>
                  <span>{row.avgStudyHours}h avg study</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ParentDashboard;
