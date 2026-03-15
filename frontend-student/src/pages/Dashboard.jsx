
import React, { useState, useEffect } from "react";
import {
  getDashboardSummary,
  saveDailyLog,
  createStudySession,
  generateParentLinkCode,
  getParentLinkRequests,
  respondToParentLinkRequest,
  updateWellnessPrivacy,
} from "../services/api";
import AIChatbot from "../components/AIChatbot";
import SmartScheduler from "../components/SmartScheduler";
import DashboardCharts from "../components/DashboardCharts";
import LiveFaceStudySession from "../components/sample/LiveFaceStudySession";
import "../styles/Dashboard.css";

function Dashboard({ onLogout }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
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

  useEffect(() => {
    fetchDashboard();
    fetchParentRequests();
  }, []);

  const hasDailyLogs = Boolean(summary?.recentLogs?.length);

  const fetchDashboard = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
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

  const handleScheduleCreated = async (scheduleData) => {
    // Called by SmartScheduler when AI schedule is generated
    // scheduleData is an array of study blocks
    console.log("Received schedule data:", scheduleData);
    
    try {
      // Save each study block as a study session
      const studySessions = scheduleData.filter(b => b.type === 'study');
      console.log("Study sessions to save:", studySessions);
      
      let savedCount = 0;
      const errors = [];
      
      for (const block of studySessions) {
        try {
          const sessionData = {
            subject: block.subject,
            scheduledDate: block.scheduledDate || block.startTime,
            duration: block.duration,
            notes: block.reason || "AI-generated study session"
          };
          console.log("Saving session:", sessionData);
          
          const response = await createStudySession(sessionData);
          console.log("Study session created:", response);
          savedCount++;
        } catch (sessionError) {
          console.error("Error saving individual session:", sessionError);
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
      alert("Error saving sessions. Please try again. Check console for details.");
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await saveDailyLog(logForm);
      console.log("Daily log response:", response);
      alert("Daily log saved successfully!");
      setShowLogForm(false);
      fetchDashboard();
      // Reset form
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

  const getStressColor = (category) => {
    switch (category) {
      case "Low":
        return "#4caf50";
      case "Medium":
        return "#ff9800";
      case "High":
        return "#f44336";
      default:
        return "#2196f3";
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Student Wellness Dashboard</h1>
        <p>Track your wellbeing and performance</p>
      </header>

      <div className="action-buttons">
        <button onClick={() => setShowLogForm(!showLogForm)} className="btn-primary">
          {showLogForm ? "Hide" : "Add"} Daily Log
        </button>
        <SmartScheduler 
          studentContext={{
            stressLevel: summary?.stressIndex || 50,
            avgSleepHours: summary?.weeklyStats?.avgSleepHours || 7,
            avgStudyHours: summary?.weeklyStats?.avgStudyHours || 4,
            moodRating: summary?.todayLog?.moodRating || 5
          }}
          onScheduleCreated={handleScheduleCreated}
        />
        <button 
          onClick={() => {
            if (hasDailyLogs) {
              window.location.hash = '#analytics';
            }
          }}
          className="btn-analytics"
          disabled={!hasDailyLogs}
          aria-disabled={!hasDailyLogs}
          title={hasDailyLogs ? 'View your analytics' : 'Add a daily log to unlock analytics'}
        >
          📊 View Analytics
        </button>
        <button onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          if (onLogout) onLogout();
          window.location.reload();
        }} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="today-card">
        <h2>Parent Access Controls</h2>
        <div className="today-stats">
          <div>
            <strong>Verification Code</strong>
            {parentCode?.verificationCode ? (
              <span>
                {parentCode.verificationCode} (expires {new Date(parentCode.expiresAt).toLocaleTimeString()})
              </span>
            ) : (
              <span>Generate a code to link a parent account.</span>
            )}
          </div>
          <div>
            <strong>Wellness Privacy</strong>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={allowWellnessShare}
                onChange={(e) => handleWellnessShareToggle(e.target.checked)}
              />
              Share detailed wellness indicators with approved parent
            </label>
          </div>
        </div>
        <button className="btn-secondary" onClick={handleGenerateParentCode}>
          Generate Parent Verification Code
        </button>

        <div style={{ marginTop: "18px" }}>
          <h3>Pending Parent Requests</h3>
          {parentRequests.length ? (
            <ul className="sessions-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
              {parentRequests.map((request) => (
                <li key={request.id} style={{ listStyle: "none" }}>
                  <div>
                    <strong>{request.parent?.name || "Unknown Parent"}</strong>
                    <div className="session-meta">{request.parent?.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
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
      </div>

      {!hasDailyLogs && (
        <div className="unlock-card">
          <div>
            <h2>Unlock Your Insights</h2>
            <p>Add a quick daily log to activate charts, analytics, and deeper recommendations.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowLogForm(true)}>
            Add Daily Log
          </button>
        </div>
      )}

      {/* Daily Log Form */}
      {showLogForm && (
        <div className="form-card">
          <h2>Add Daily Log</h2>
          <form onSubmit={handleLogSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Study Hours</label>
                <input
                  type="number"
                  name="studyHours"
                  value={logForm.studyHours}
                  onChange={handleLogChange}
                  min="0"
                  max="24"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label>Screen Time (hours)</label>
                <input
                  type="number"
                  name="screenTime"
                  value={logForm.screenTime}
                  onChange={handleLogChange}
                  min="0"
                  max="24"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label>Focus Duration (minutes)</label>
                <input
                  type="number"
                  name="focusMinutes"
                  value={logForm.focusMinutes || 0}
                  onChange={handleLogChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Break Duration (minutes)</label>
                <input
                  type="number"
                  name="breakMinutes"
                  value={logForm.breakMinutes || 0}
                  onChange={handleLogChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Sleep Hours</label>
                <input
                  type="number"
                  name="sleepHours"
                  value={logForm.sleepHours}
                  onChange={handleLogChange}
                  min="0"
                  max="24"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label>Sleep Quality</label>
                <select
                  name="sleepQuality"
                  value={logForm.sleepQuality}
                  onChange={handleLogChange}
                >
                  <option value="Poor">Poor</option>
                  <option value="Fair">Fair</option>
                  <option value="Good">Good</option>
                  <option value="Excellent">Excellent</option>
                </select>
              </div>

              <div className="form-group">
                <label>Meals Count</label>
                <input
                  type="number"
                  name="mealsCount"
                  value={logForm.mealsCount}
                  onChange={handleLogChange}
                  min="0"
                  max="10"
                />
              </div>

              <div className="form-group">
                <label>Water Intake (liters)</label>
                <input
                  type="number"
                  name="waterIntake"
                  value={logForm.waterIntake}
                  onChange={handleLogChange}
                  min="0"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label>Exercise (minutes)</label>
                <input
                  type="number"
                  name="exerciseMinutes"
                  value={logForm.exerciseMinutes}
                  onChange={handleLogChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Exercise Type</label>
                <input
                  type="text"
                  name="exerciseType"
                  value={logForm.exerciseType}
                  onChange={handleLogChange}
                  placeholder="e.g., Running, Yoga"
                />
              </div>

              <div className="form-group">
                <label>Stress Level</label>
                <select
                  name="stressLevel"
                  value={logForm.stressLevel}
                  onChange={handleLogChange}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mood Rating (1-10)</label>
                <input
                  type="number"
                  name="moodRating"
                  value={logForm.moodRating}
                  onChange={handleLogChange}
                  min="1"
                  max="10"
                />
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={logForm.notes}
                  onChange={handleLogChange}
                  rows="3"
                  placeholder="Any additional notes..."
                ></textarea>
              </div>
            </div>

            <button type="submit" className="btn-submit">
              Save Daily Log
            </button>
          </form>
        </div>
      )}

      {/* Charts Section */}
      {summary && (
        <DashboardCharts
          summary={summary}
          hasDailyLogs={hasDailyLogs}
          onRequestLog={() => setShowLogForm(true)}
        />
      )}

      {/* Dashboard Cards */}
      <div className="stats-grid">
        {/* Stress Index Card */}
        <div className="stat-card stress-card">
          <h3>Stress Index</h3>
          <div
            className="stress-meter"
            style={{ backgroundColor: getStressColor(summary?.stressCategory) }}
          >
            <span className="stress-value">{summary?.stressIndex || 0}</span>
          </div>
          <p className="stress-label">{summary?.stressCategory || "Medium"} Stress</p>
        </div>

        {/* Weekly Stats */}
        <div className="stat-card">
          <h3>Average Study Hours</h3>
          <p className="stat-value">{summary?.weeklyStats?.avgStudyHours || 0}h</p>
          <p className="stat-label">per day (last 7 days)</p>
        </div>

        <div className="stat-card">
          <h3>Average Sleep</h3>
          <p className="stat-value">{summary?.weeklyStats?.avgSleepHours || 0}h</p>
          <p className="stat-label">per night (last 7 days)</p>
        </div>

        <div className="stat-card">
          <h3>Avg Screen Time</h3>
          <p className="stat-value">{summary?.weeklyStats?.avgScreenTime || 0}h</p>
          <p className="stat-label">per day (last 7 days)</p>
        </div>

        <div className="stat-card">
          <h3>Avg Exercise</h3>
          <p className="stat-value">{summary?.weeklyStats?.avgExercise || 0}m</p>
          <p className="stat-label">per day (last 7 days)</p>
        </div>
      </div>

      {/* Today's Log */}
      {summary?.todayLog && (
        <div className="today-card">
          <h2>Today's Log</h2>
          <div className="today-stats">
            <div>
              <strong>Study:</strong> {summary.todayLog.studyHours}h
            </div>
            <div>
              <strong>Sleep:</strong> {summary.todayLog.sleepHours}h (
              {summary.todayLog.sleepQuality})
            </div>
            <div>
              <strong>Exercise:</strong> {summary.todayLog.exerciseMinutes}min
            </div>
            <div>
              <strong>Meals:</strong> {summary.todayLog.mealsCount}
            </div>
            <div>
              <strong>Water:</strong> {summary.todayLog.waterIntake}L
            </div>
            <div>
              <strong>Mood:</strong> {summary.todayLog.moodRating}/10
            </div>
          </div>
        </div>
      )}

      <LiveFaceStudySession
        studentContext={{
          stressLevel: summary?.stressIndex || 50,
          avgSleepHours: summary?.weeklyStats?.avgSleepHours || 7,
          avgStudyHours: summary?.weeklyStats?.avgStudyHours || 4,
          moodRating: summary?.todayLog?.moodRating || 5,
        }}
      />

      {/* Recommendations */}
      {summary?.recommendations && summary.recommendations.length > 0 && (
        <div className="recommendations-card">
          <h2>Recommendations</h2>
          <ul>
            {summary.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upcoming Study Sessions */}
      <div className="sessions-card">
        <h2>Upcoming Study Sessions</h2>
        {summary?.upcomingSessions?.length ? (
          <ul>
            {summary.upcomingSessions.map((session) => {
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
          <p className="sessions-empty">
            No upcoming sessions yet. Generate a schedule or add a new study session to see it here.
          </p>
        )}
      </div>

      {/* AI Chatbot */}
      <AIChatbot 
        studentContext={{
          stressLevel: summary?.stressIndex || 50,
          avgSleepHours: summary?.weeklyStats?.avgSleepHours || 7,
          avgStudyHours: summary?.weeklyStats?.avgStudyHours || 4,
          moodRating: summary?.todayLog?.moodRating || 5,
          recentActivities: {
            exercise: summary?.todayLog?.exerciseMinutes || 0,
            screenTime: summary?.todayLog?.screenTime || 0,
            waterIntake: summary?.todayLog?.waterIntake || 0
          }
        }}
      />
    </div>
  );
}

export default Dashboard;
