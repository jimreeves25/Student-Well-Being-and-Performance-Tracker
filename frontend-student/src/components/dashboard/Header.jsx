import React from "react";

function Header({
  theme,
  themeName,
  themes,
  themeDotColors,
  onThemeChange,
  summary,
  loading,
}) {
  const isSummaryUnavailable = loading || !summary;

  const moodRating = summary?.todayLog?.moodRating;
  const wellnessPercent = moodRating
      ? Math.round((moodRating / 10) * 100)
    : null;
  const wellnessValue = isSummaryUnavailable
    ? "--"
    : moodRating
      ? `${wellnessPercent}%`
      : "No log yet";

  const wellnessColor = (() => {
    if (isSummaryUnavailable || wellnessPercent === null) {
      return theme.text;
    }
    if (wellnessPercent > 60) {
      return "#22c55e";
    }
    if (wellnessPercent >= 40) {
      return "#f59e0b";
    }
    return "#ef4444";
  })();

  const performanceValue = isSummaryUnavailable
    ? "--"
    : summary?.weeklyStats?.avgStudyHours
      ? `${summary.weeklyStats.avgStudyHours}h`
      : "0h";

  const todayValue = isSummaryUnavailable
    ? "--"
    : summary?.upcomingSessions?.length || 0;

  return (
    <section className="dashboard-top-banner header" aria-label="Student dashboard banner">
      <div className="banner-brand-row">
        <div className="banner-logo-circle" aria-hidden="true">
          <span>SW</span>
        </div>
        <h1>
          Student Well-Being <span>&</span> Performance Tracker
        </h1>
      </div>

      <div className="banner-controls right-section">
        <div className="theme-switcher">
          <span style={{ color: theme.textMuted }}>Theme</span>
          <div className="theme-dot-row">
            {Object.entries(themes).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => onThemeChange(key)}
                aria-label={`Switch to ${item.name} theme`}
                title={item.name}
                style={{
                  width: key === themeName ? "22px" : "18px",
                  height: key === themeName ? "22px" : "18px",
                  borderRadius: "50%",
                  border: "none",
                  outline: key === themeName ? `2px solid ${theme.accent}` : "none",
                  outlineOffset: key === themeName ? "3px" : "0",
                  background: themeDotColors[key],
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        <div className="banner-stats-row">
          <article className="banner-stat-card">
            <small>Wellness</small>
            <strong style={{ color: wellnessColor }}>{wellnessValue}</strong>
            <span>Mood score</span>
          </article>
          <article className="banner-stat-card">
            <small>Performance</small>
            <strong>{performanceValue}</strong>
            <span>Avg study / day</span>
          </article>
          <article className="banner-stat-card">
            <small>Today</small>
            <strong>{todayValue}</strong>
            <span>Upcoming sessions</span>
          </article>
        </div>
      </div>
    </section>
  );
}

export default Header;
