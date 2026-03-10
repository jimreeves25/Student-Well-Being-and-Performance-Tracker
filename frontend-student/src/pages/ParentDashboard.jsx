import React, { useEffect, useMemo, useState } from "react";
import {
  getParentAlerts,
  getParentDashboard,
  getParentReports,
  markParentAlertRead,
} from "../services/api";
import "../styles/ParentDashboard.css";

const statusTone = {
  Active: "active",
  "Not Active": "inactive",
};

function ParentDashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const unreadAlerts = useMemo(() => alerts.filter((item) => !item.isRead), [alerts]);

  const loadDashboard = async () => {
    try {
      const [dashboardData, alertData, reportData] = await Promise.all([
        getParentDashboard(),
        getParentAlerts(),
        getParentReports(),
      ]);

      setData(dashboardData);
      setAlerts(alertData || []);
      setReports(reportData);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load parent dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (alertId) => {
    try {
      await markParentAlertRead(alertId);
      setAlerts((prev) => prev.map((item) => (item.id === alertId ? { ...item, isRead: true } : item)));
    } catch (err) {
      console.error("Mark alert read failed", err);
    }
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

  return (
    <div className="parent-dashboard">
      <header className="parent-header">
        <div>
          <h1>Parent Monitoring Center</h1>
          <p>Real-time awareness of study, attendance, and wellness trends</p>
        </div>
        <div className="parent-header-actions">
          <span className={`live-badge ${statusTone[data?.status?.liveClassStatus] || "inactive"}`}>
            {data?.status?.liveClassStatus || "Not Active"}
          </span>
          <button className="parent-btn logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <section className="parent-grid metrics">
        <div className="metric-card">
          <h3>Daily Study Hours</h3>
          <p className="metric-value">{data?.studyActivity?.avgStudyHoursPerDay || 0}h</p>
          <span className="metric-note">Average per day</span>
        </div>
        <div className="metric-card">
          <h3>Attendance Rate</h3>
          <p className="metric-value">{data?.attendance?.rate || 0}%</p>
          <span className="metric-note">Live sessions attended</span>
        </div>
        <div className="metric-card">
          <h3>Focus / Break</h3>
          <p className="metric-value">{data?.studyActivity?.totalFocusMinutes || 0}m / {data?.studyActivity?.totalBreakMinutes || 0}m</p>
          <span className="metric-note">This week total</span>
        </div>
        <div className="metric-card">
          <h3>Productivity Score</h3>
          <p className="metric-value">{data?.academicPerformance?.productivityScore || 0}</p>
          <span className="metric-note">Composite indicator</span>
        </div>
      </section>

      <section className="parent-grid two-col">
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
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subject}</span>
                  </div>
                  <div className="status-wrap">
                    <span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span>
                    <span>{item.progress}%</span>
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

      <section className="parent-grid two-col">
        <div className="panel alerts">
          <h2>Real-Time Alerts {unreadAlerts.length ? `(${unreadAlerts.length} unread)` : ""}</h2>
          {alerts.length ? (
            <ul className="alert-list">
              {alerts.map((alert) => (
                <li key={alert.id} className={`${alert.severity} ${alert.isRead ? "read" : "unread"}`}>
                  <div>
                    <strong>{alert.alertType.replace(/_/g, " ")}</strong>
                    <p>{alert.message}</p>
                    <small>{new Date(alert.createdAt).toLocaleString()}</small>
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
          <div className="report-kpis">
            <p><strong>Study Consistency:</strong> {data?.reports?.studyConsistency || 0}%</p>
            <p><strong>Productivity Trend:</strong> {data?.reports?.productivityTrends || 0}</p>
            <p><strong>Risk Indicators:</strong> {(data?.reports?.riskIndicators || []).join(", ") || "None"}</p>
            <p><strong>Burnout Signals:</strong> {(data?.reports?.burnoutSignals || []).join(", ") || "None"}</p>
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
