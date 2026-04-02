import React, { memo } from "react";

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function AssignmentCard({
  assignment,
  onEdit,
  onDelete,
  onToggleComplete,
  onUpdateProgress,
  onUpdateStatus,
}) {
  const statusTone = assignment.computedStatus;
  const priorityLabel = PRIORITY_LABELS[assignment.priority] || assignment.priority;
  const dueDateLabel = assignment.dueLabel || "No due date";

  return (
    <article className={`assignment-card ${statusTone}`}>
      <div className="assignment-card-header">
        <div className="assignment-card-title-block">
          <div className="assignment-card-title-row">
            <h4>{assignment.title}</h4>
            <span className={`assignment-status-chip status-${statusTone}`}>{statusTone}</span>
          </div>
          <p>{assignment.subject || "General"}</p>
        </div>

        <div className="assignment-card-meta-row">
          <span className={`assignment-priority-chip priority-${assignment.priority}`}>{priorityLabel}</span>
          <span className={`assignment-due-chip ${assignment.isOverdue ? "overdue" : assignment.dueSoon ? "soon" : "normal"}`}>
            {dueDateLabel}
          </span>
        </div>
      </div>

      {assignment.description ? <p className="assignment-description">{assignment.description}</p> : null}

      <div className="assignment-progress-block">
        <div className="assignment-progress-meta">
          <span>Progress</span>
          <strong>{assignment.progress}%</strong>
        </div>
        <div className="assignment-progress-track" aria-hidden="true">
          <div className="assignment-progress-fill" style={{ width: `${assignment.progress}%` }} />
        </div>
        <input
          className="assignment-progress-slider"
          type="range"
          min="0"
          max="100"
          value={assignment.progress}
          onChange={(event) => onUpdateProgress(assignment.id, event.target.value)}
          aria-label={`Update progress for ${assignment.title}`}
        />
      </div>

      <div className="assignment-card-footer">
        <div className="assignment-status-select-wrap">
          <label htmlFor={`status-${assignment.id}`}>Status</label>
          <select
            id={`status-${assignment.id}`}
            value={assignment.status}
            onChange={(event) => onUpdateStatus(assignment.id, event.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="assignment-card-actions">
          <button type="button" className="assignment-action-btn" onClick={() => onEdit(assignment)}>
            Edit
          </button>
          <button type="button" className="assignment-action-btn" onClick={() => onToggleComplete(assignment.id)}>
            {assignment.status === "completed" ? "Reopen" : "Complete"}
          </button>
          <button type="button" className="assignment-action-btn danger" onClick={() => onDelete(assignment)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(AssignmentCard);
