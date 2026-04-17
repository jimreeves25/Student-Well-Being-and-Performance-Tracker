import React from "react";

function TaskList({ todaysTasks = [], taskCount, onNextTaskClick }) {
  const totalTasks = typeof taskCount === "number" ? taskCount : todaysTasks.length;

  return (
    <article className="widget-dark-card tasks-widget">
      <div className="tasks-widget-header">
        <h3>Today's Tasks</h3>
        <span className="tasks-widget-count">{totalTasks ? `${totalTasks} task${totalTasks === 1 ? "" : "s"}` : "0 tasks"}</span>
      </div>
      {totalTasks ? (
        <ul className="task-agenda-list">
          {todaysTasks.map((task, index) => {
            const isNext = index === 0;
            return (
              <li key={task.id} className={`task-agenda-item ${isNext ? "next" : ""}`}>
                <div className="task-agenda-topline">
                  <strong>{task.title}</strong>
                  {isNext && (
                    <button
                      type="button"
                      className="task-next-badge task-next-badge-button"
                      onClick={() => onNextTaskClick?.(task)}
                      aria-label={`Open next task: ${task.title}`}
                    >
                      Next
                    </button>
                  )}
                </div>
                <div className="task-agenda-meta">
                  <span>{task.timeLabel || "All day"}</span>
                  <span className={`task-type-badge type-${task.type}`}>{task.type}</span>
                  {task.duration ? <span>{task.duration} min</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="tasks-empty">No tasks scheduled for today</p>
      )}
    </article>
  );
}

export default TaskList;
