import React, { useEffect, useMemo, useState } from "react";
import { generateSmartSchedule } from "../../utils/scheduler";

function SmartSchedulerModal({ isOpen, assignments = [], onClose }) {
  const [schedule, setSchedule] = useState(() => generateSmartSchedule(assignments));

  useEffect(() => {
    if (isOpen) {
      setSchedule(generateSmartSchedule(assignments));
    }
  }, [assignments, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const summaryText = useMemo(() => {
    if (!schedule.plan.length) {
      return "All assignments are complete. Add a new assignment to generate a smart study plan.";
    }
    return `${schedule.totalAssignments} active assignment${schedule.totalAssignments === 1 ? "" : "s"} analyzed, ${schedule.overdueCount} overdue.`;
  }, [schedule]);

  if (!isOpen) return null;

  return (
    <div className="assignment-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="smart-scheduler-modal" role="dialog" aria-modal="true" aria-labelledby="smart-scheduler-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="smart-scheduler-modal-header">
          <div>
            <h3 id="smart-scheduler-title">Generate Smart Study Plan</h3>
            <p>{summaryText}</p>
          </div>
          <button type="button" className="assignment-modal-close" onClick={onClose} aria-label="Close smart scheduler">
            ✕
          </button>
        </div>

        <div className="smart-scheduler-panel">
          {schedule.plan.length ? (
            <div className="smart-scheduler-list">
              {schedule.plan.map((item, index) => (
                <article key={item.id} className="smart-scheduler-item">
                  <div className="smart-scheduler-item-header">
                    <div>
                      <h4>{index + 1}. {item.title}</h4>
                      <p>{item.subject}</p>
                    </div>
                    <span className={`smart-scheduler-priority priority-${item.priority}`}>
                      {item.priority}
                    </span>
                  </div>

                  <div className="smart-scheduler-meta">
                    <span>{item.time}</span>
                    <span>{item.dueLabel}</span>
                  </div>

                  <p className="smart-scheduler-reason">{item.reason}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="smart-scheduler-empty">
              <div className="smart-scheduler-empty-icon" aria-hidden="true">
                🧠
              </div>
              <p>No active assignments available for scheduling.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SmartSchedulerModal;
