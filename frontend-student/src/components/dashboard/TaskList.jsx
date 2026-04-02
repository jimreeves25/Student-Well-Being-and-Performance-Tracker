import React from "react";

function TaskList({ todaysTasks, onToggleTask }) {
  const totalTasks = todaysTasks.length;
  const completedCount = todaysTasks.filter((task) => task.completed).length;
  const progress = totalTasks ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <article className="widget-dark-card tasks-widget">
      <h3>Today's Tasks</h3>
      {totalTasks ? (
        <ul className="task-checklist">
          {todaysTasks.map((task) => (
            <li key={task.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(task.completed)}
                  onChange={(event) => onToggleTask(task.id, event.target.checked)}
                />
                <span>{task.title}</span>
              </label>
              <small>
                {new Date(task.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tasks-empty">No data available</p>
      )}

      <div className="task-progress-wrap" aria-hidden="true">
        <div className="task-progress-track">
          <div className="task-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span>{totalTasks ? `${completedCount} of ${totalTasks} tasks done` : "No data available"}</span>
      </div>
    </article>
  );
}

export default TaskList;
