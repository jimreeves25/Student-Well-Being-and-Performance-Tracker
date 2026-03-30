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
import "../styles/Dashboard.css";

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "daily-log", label: "Daily Log" },
  { id: "assignments", label: "Assignments" },
  { id: "sessions", label: "Live Session" },
  { id: "parent-link", label: "Parent Link" },
  { id: "ai-tools", label: "AI Tools" },
];

function Dashboard({ onLogout }) {
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

  const hasDailyLogs = Boolean(summary?.recentLogs?.length);
  const safeSummary = summary || {};

  const quickStats = useMemo(
    () => [
      {
        label: "Stress Index",
        value: `${safeSummary.stressIndex || 0}`,
        helper: safeSummary.stressCategory || "Moderate",
      },
      {
        label: "Average Study",
        value: `${safeSummary.weeklyStats?.avgStudyHours || 0}h`,
        helper: "Per day",
      },
      {
        label: "Average Sleep",
        value: `${safeSummary.weeklyStats?.avgSleepHours || 0}h`,
        helper: "Per night",
      },
      {
        label: "Screen Time",
        value: `${safeSummary.weeklyStats?.avgScreenTime || 0}h`,
        helper: "Daily average",
      },
      {
        label: "Exercise",
        value: `${safeSummary.weeklyStats?.avgExercise || 0}m`,
        helper: "Daily average",
      },
      {
        label: "Mood Today",
        value: `${safeSummary.todayLog?.moodRating || 5}/10`,
        helper: "Self rating",
      },
    ],
    [safeSummary]
  );

  const studentContext = {
    stressLevel: safeSummary.stressIndex || 50,
    avgSleepHours: safeSummary.weeklyStats?.avgSleepHours || 7,
    avgStudyHours: safeSummary.weeklyStats?.avgStudyHours || 4,
    moodRating: safeSummary.todayLog?.moodRating || 5,
    recentActivities: {
      exercise: safeSummary.todayLog?.exerciseMinutes || 0,
      screenTime: safeSummary.todayLog?.screenTime || 0,
      waterIntake: safeSummary.todayLog?.waterIntake || 0,
    },
  };

  const completedAssignments = assignments.filter((item) => item.status === "completed").length;
  const assignmentCompletionRate = Math.round(
    (completedAssignments / Math.max(1, assignments.length || 0)) * 100
  );

  const avgFocusMinutes = Number(safeSummary.weeklyStats?.avgFocusMinutes || 0);
  const avgBreakMinutes = Number(safeSummary.weeklyStats?.avgBreakMinutes || 0);
  const focusBalance = Math.round((avgFocusMinutes / Math.max(1, avgFocusMinutes + avgBreakMinutes)) * 100);

  const wellnessRaw =
    (Number(safeSummary.weeklyStats?.avgSleepHours || 0) / 8) * 45 +
    (Number(safeSummary.weeklyStats?.avgExercise || 0) / 45) * 25 +
    (Number(safeSummary.todayLog?.moodRating || 5) / 10) * 30;
  const wellnessRhythm = Math.max(0, Math.min(100, Math.round(wellnessRaw)));

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
    <div className="dashboard-container">
      <div className="page-glow page-glow-left" aria-hidden="true" />
      <div className="page-glow page-glow-right" aria-hidden="true" />

      <header className="dashboard-header glass-card">
        <div>
          <p className="header-kicker">Student Command Center</p>
          <h1>Focus, Wellness, and Progress</h1>
          <p>Move through each feature one by one using the workspace tabs below.</p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => {
              if (hasDailyLogs) window.location.hash = "#analytics";
            }}
            className="btn-analytics"
            disabled={!hasDailyLogs}
            aria-disabled={!hasDailyLogs}
            title={hasDailyLogs ? "View your analytics" : "Add a daily log to unlock analytics"}
          >
            Open Analytics
          </button>
          <button
            onClick={handleRefreshAll}
            className="btn-secondary"
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              if (onLogout) onLogout();
              window.location.reload();
            }}
            className="btn-logout"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="student-command-bar glass-card">
        <div className="command-bar-copy">
          <h2>Command Center</h2>
          <p>Use smart shortcuts to move through your daily workflow faster.</p>
        </div>
        <div className="command-bar-actions">
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
              <strong>{assignmentCompletionRate}%</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${assignmentCompletionRate}%` }} />
              </div>
            </article>
            <article className="ribbon-card">
              <span>Focus Balance</span>
              <strong>{focusBalance}%</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${focusBalance}%` }} />
              </div>
            </article>
            <article className="ribbon-card">
              <span>Wellness Rhythm</span>
              <strong>{wellnessRhythm}%</strong>
              <div className="mini-progress-track" aria-hidden="true">
                <div className="mini-progress-fill" style={{ width: `${wellnessRhythm}%` }} />
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
    </div>
  );
}

export default Dashboard;
