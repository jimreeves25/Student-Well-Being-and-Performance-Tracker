import React, { useState } from "react";
import { generateSmartSchedule } from "../services/aiService";
import "../styles/SmartScheduler.css";

function SmartScheduler({ studentContext, onScheduleCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [currentSubject, setCurrentSubject] = useState({
    name: "",
    difficulty: "medium",
    weightage: 1,
  });
  const [scheduleParams, setScheduleParams] = useState({
    availableHours: 6,
    startTime: "09:00",
  });
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const stressIndex = Number(studentContext?.stressIndex ?? 50);
  const stressLabel = String(studentContext?.stressLabel || "").trim() || (stressIndex >= 80 ? "High" : stressIndex >= 60 ? "Medium" : "Low");

  const handleAddSubject = () => {
    if (currentSubject.name.trim()) {
      setSubjects([...subjects, { ...currentSubject, id: Date.now() }]);
      setCurrentSubject({ name: "", difficulty: "medium", weightage: 1 });
    }
  };

  const handleRemoveSubject = (id) => {
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setStep(3);

    const params = {
      subjects,
      stressIndex,
      avgSleepHours: studentContext?.avgSleepHours ?? 7,
      ...scheduleParams,
    };

    const result = await generateSmartSchedule(params);
    setGeneratedSchedule(result);
    setIsGenerating(false);
  };

  const handleSaveSchedule = () => {
    if (generatedSchedule && generatedSchedule.schedule) {
      // Transform schedule data into the format expected by Dashboard
      const scheduleDataWithDates = generatedSchedule.schedule.map((item) => {
        const [startTime] = item.time.split("-");
        const [hours, minutes] = startTime.split(":");
        const scheduledDate = new Date();
        scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (scheduledDate <= new Date()) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        return {
          type: item.type,
          subject: item.subject,
          scheduledDate: scheduledDate.toISOString(),
          startTime: scheduledDate.toISOString(),
          duration: item.duration,
          reason: item.reason,
        };
      });

      // Pass the entire array to the callback
      onScheduleCreated(scheduleDataWithDates);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep(1);
    setSubjects([]);
    setGeneratedSchedule(null);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy":
        return "#4caf50";
      case "medium":
        return "#ff9800";
      case "hard":
        return "#f44336";
      default:
        return "#2196f3";
    }
  };

  const getStressColor = (stressIndex) => {
    if (stressIndex < 35) return "#4caf50";
    if (stressIndex < 65) return "#ff9800";
    return "#f44336";
  };

  return (
    <>
      <button className="smart-scheduler-btn" onClick={() => setIsOpen(true)}>
        <span className="btn-icon">🤖</span>
        <span>AI Smart Scheduler</span>
        <span className="btn-badge">NEW</span>
      </button>

      {isOpen && (
        <div className="scheduler-modal-overlay" onClick={handleClose}>
          <div className="scheduler-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="scheduler-header">
              <div>
                <h2>🤖 AI-Powered Smart Scheduler</h2>
                <p>Auto-schedule based on your stress level & sleep pattern</p>
              </div>
              <button className="close-btn" onClick={handleClose}>
                ✕
              </button>
            </div>

            {/* Progress Steps */}
            <div className="progress-steps">
              <div className={`step ${step >= 1 ? "active" : ""}`}>
                <div className="step-number">1</div>
                <span>Add Subjects</span>
              </div>
              <div className="step-divider"></div>
              <div className={`step ${step >= 2 ? "active" : ""}`}>
                <div className="step-number">2</div>
                <span>Set Preferences</span>
              </div>
              <div className="step-divider"></div>
              <div className={`step ${step >= 3 ? "active" : ""}`}>
                <div className="step-number">3</div>
                <span>Your Schedule</span>
              </div>
            </div>

            {/* Content */}
            <div className="scheduler-content">
              {/* Step 1: Add Subjects */}
              {step === 1 && (
                <div className="step-content">
                  <div className="context-card">
                    <h4>📊 Your Current Stats</h4>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Stress Level</span>
                        <span
                          className="stat-value"
                          style={{
                            color: getStressColor(stressIndex),
                          }}
                        >
                          {stressLabel}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Avg Sleep</span>
                        <span className="stat-value">
                          {studentContext.avgSleepHours || 7}h
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3>Add Your Subjects</h3>
                  <div className="add-subject-form">
                    <input
                      type="text"
                      placeholder="Subject name (e.g., Mathematics)"
                      value={currentSubject.name}
                      onChange={(e) =>
                        setCurrentSubject({ ...currentSubject, name: e.target.value })
                      }
                      onKeyPress={(e) => e.key === "Enter" && handleAddSubject()}
                    />
                    <div className="form-row">
                      <select
                        value={currentSubject.difficulty}
                        onChange={(e) =>
                          setCurrentSubject({
                            ...currentSubject,
                            difficulty: e.target.value,
                          })
                        }
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <input
                        type="number"
                        min="0.5"
                        max="8"
                        step="0.5"
                        placeholder="Hours"
                        value={currentSubject.weightage}
                        onChange={(e) =>
                          setCurrentSubject({
                            ...currentSubject,
                            weightage: parseFloat(e.target.value),
                          })
                        }
                      />
                      <button onClick={handleAddSubject} className="add-btn">
                        + Add
                      </button>
                    </div>
                  </div>

                  <div className="subjects-list">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="subject-card">
                        <div className="subject-info">
                          <h4>{subject.name}</h4>
                          <div className="subject-meta">
                            <span
                              className="difficulty-badge"
                              style={{
                                background: getDifficultyColor(subject.difficulty),
                              }}
                            >
                              {subject.difficulty}
                            </span>
                            <span className="duration-badge">
                              {subject.weightage}h
                            </span>
                          </div>
                        </div>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveSubject(subject.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    className="next-btn"
                    disabled={subjects.length === 0}
                    onClick={() => setStep(2)}
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* Step 2: Preferences */}
              {step === 2 && (
                <div className="step-content">
                  <h3>Set Your Preferences</h3>
                  <div className="preferences-form">
                    <div className="form-group">
                      <label>Available Study Hours Today</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={scheduleParams.availableHours}
                        onChange={(e) =>
                          setScheduleParams({
                            ...scheduleParams,
                            availableHours: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Start Time</label>
                      <input
                        type="time"
                        value={scheduleParams.startTime}
                        onChange={(e) =>
                          setScheduleParams({
                            ...scheduleParams,
                            startTime: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="ai-features-card">
                      <h4>🧠 AI Will Optimize For:</h4>
                      <ul>
                        <li>✓ Your current stress level ({stressLabel})</li>
                        <li>✓ Sleep quality ({studentContext.avgSleepHours}h avg)</li>
                        <li>✓ Peak cognitive performance times</li>
                        <li>✓ Strategic break placement</li>
                        <li>✓ Subject difficulty ordering</li>
                      </ul>
                    </div>
                  </div>

                  <div className="button-group">
                    <button className="back-btn" onClick={() => setStep(1)}>
                      ← Back
                    </button>
                    <button className="generate-btn" onClick={handleGenerateSchedule}>
                      🤖 Generate Smart Schedule
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Generated Schedule */}
              {step === 3 && (
                <div className="step-content">
                  {isGenerating ? (
                    <div className="generating-state">
                      <div className="ai-loader">
                        <div className="loader-brain">🧠</div>
                        <div className="loader-text">
                          AI is analyzing your data...
                        </div>
                      </div>
                      <p>Creating optimal schedule based on:</p>
                      <ul>
                        <li>Stress level: {stressLabel}</li>
                        <li>Sleep pattern: {studentContext.avgSleepHours}h</li>
                        <li>{subjects.length} subjects with varying difficulty</li>
                      </ul>
                    </div>
                  ) : generatedSchedule ? (
                    <div className="schedule-result">
                      <div className="result-header">
                        <h3>✨ Your Optimized Schedule</h3>
                        <p>{generatedSchedule.summary}</p>
                      </div>

                      <div className="timeline">
                        {generatedSchedule.schedule.map((item, index) => (
                          <div
                            key={index}
                            className={`timeline-item ${item.type}`}
                          >
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                              <div className="timeline-time">{item.time}</div>
                              <h4>
                                {item.type === "study" ? "📚" : "☕"}{" "}
                                {item.subject || item.activity}
                              </h4>
                              <p className="timeline-reason">{item.reason}</p>
                              <span className="timeline-duration">
                                {item.duration} min
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {generatedSchedule.tips && (
                        <div className="tips-card">
                          <h4>💡 Pro Tips</h4>
                          <ul>
                            {generatedSchedule.tips.map((tip, index) => (
                              <li key={index}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="button-group">
                        <button className="back-btn" onClick={() => setStep(2)}>
                          ← Regenerate
                        </button>
                        <button className="save-btn" onClick={handleSaveSchedule}>
                          💾 Save to Calendar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SmartScheduler;
