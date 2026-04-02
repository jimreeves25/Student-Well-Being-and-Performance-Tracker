import React from "react";

const moodOptions = [
  { emoji: "😞", moodValue: 1 },
  { emoji: "😐", moodValue: 2 },
  { emoji: "🙂", moodValue: 3 },
  { emoji: "😄", moodValue: 4 },
  { emoji: "🤩", moodValue: 5 },
];

function MoodTracker({ todayMoodLog, onLogMood }) {
  const isLocked = Boolean(todayMoodLog);

  return (
    <article className="widget-dark-card quick-mood-widget">
      <h3>Quick Mood Log</h3>
      <p>How are you feeling today?</p>
      <div className="mood-button-row">
        {moodOptions.map((option) => {
          const isSelected = todayMoodLog?.moodValue === option.moodValue;
          return (
            <button
              key={option.emoji}
              type="button"
              className={`mood-btn ${isSelected ? "active" : ""}`}
              onClick={() => onLogMood(option)}
              disabled={isLocked && !isSelected}
              aria-label={`Log mood ${option.emoji}`}
            >
              {option.emoji}
            </button>
          );
        })}
      </div>
      {todayMoodLog ? (
        <small className="widget-footnote">Mood logged for today: {todayMoodLog.emoji}</small>
      ) : (
        <small className="widget-footnote">No data available</small>
      )}
    </article>
  );
}

export default MoodTracker;
