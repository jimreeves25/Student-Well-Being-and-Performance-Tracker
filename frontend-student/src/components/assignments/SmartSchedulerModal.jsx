import React, { useEffect, useMemo, useState } from "react";
import { generateSmartSchedule } from "../../utils/scheduler";

function SmartSchedulerModal({ isOpen, assignments = [], schedulerContext = {}, onClose }) {
  const [schedule, setSchedule] = useState(() => generateSmartSchedule(assignments, schedulerContext));

  useEffect(() => {
    if (isOpen) {
      setSchedule(generateSmartSchedule(assignments, schedulerContext));
    }
  }, [assignments, isOpen, schedulerContext]);

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
    return `${schedule.totalAssignments} active assignment${schedule.totalAssignments === 1 ? "" : "s"} analyzed, ${schedule.overdueCount} overdue, ${schedule.mode.replace("-", " ")} mode.`;
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
          <p className="smart-scheduler-guidance">{schedule.guidance}</p>

          {schedule.plan.length ? (
            <div className="smart-scheduler-list">
              {schedule.plan.map((item, index) => (
                <article key={item.id} className="smart-scheduler-item">
                  <div className="smart-scheduler-row">
                    <strong>{item.time}</strong>
                    <span> - </span>
                    <span>{item.task}</span>
                  </div>

                  <div className="smart-scheduler-meta">
                    <span>Notes: {item.notes}</span>
                    <span className={`smart-scheduler-priority priority-${item.priority}`}>
                      {item.priority}
                    </span>
                  </div>
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
