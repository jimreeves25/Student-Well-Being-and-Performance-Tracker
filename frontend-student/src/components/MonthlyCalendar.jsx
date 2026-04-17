import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/MonthlyCalendar.css";

function MonthlyCalendar({ loginDates = [], assignments = [], accountCreatedAt = null, onClose }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getAssignmentBadgeMeta = (status) => {
    const normalized = String(status || "pending").toLowerCase();
    if (normalized === "completed") {
      return {
        className: "completed",
        icon: "◆",
        label: "Completed assignment",
      };
    }

    return {
      className: "pending",
      icon: "◷",
      label: "Pending assignment",
    };
  };

  // Convert login dates to YYYY-MM-DD format for comparison
  const loginDateSet = useMemo(() => {
    return new Set(
      (loginDates || []).map((date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })
    );
  }, [loginDates]);

  // Group assignments by date
  const assignmentsByDate = useMemo(() => {
    const map = {};
    (assignments || []).forEach((assignment) => {
      if (!assignment.dueDate) return;
      const dueDate = new Date(assignment.dueDate);
      const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(assignment);
    });
    return map;
  }, [assignments]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const today = new Date();

  const accountCreatedDate = useMemo(() => {
    const parsed = accountCreatedAt ? new Date(accountCreatedAt) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed;

    const firstLogin = (loginDates || [])
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return firstLogin || new Date();
  }, [accountCreatedAt, loginDates]);

  const accountCreatedKey = `${accountCreatedDate.getFullYear()}-${String(
    accountCreatedDate.getMonth() + 1
  ).padStart(2, "0")}-${String(accountCreatedDate.getDate()).padStart(2, "0")}`;

  const isAtOrBeforeAccountMonth =
    year < accountCreatedDate.getFullYear() ||
    (year === accountCreatedDate.getFullYear() && month <= accountCreatedDate.getMonth());

  const todayLabel = today.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Get days in month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const daysFromPrevMonth = firstDayOfWeek;
  const daysFromNextMonth = 42 - (daysFromPrevMonth + totalDays);

  // Build calendar grid
  const calendarDays = [];

  // Previous month's days
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    calendarDays.push({
      date: date.getDate(),
      isCurrentMonth: false,
      dateKey,
      isLogged: loginDateSet.has(dateKey),
      assignments: assignmentsByDate[dateKey] || [],
    });
  }

  // Current month's days
  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    calendarDays.push({
      date: day,
      isCurrentMonth: true,
      dateKey,
      isLogged: loginDateSet.has(dateKey),
      isToday: dateKey === formatTodayKey(),
      assignments: assignmentsByDate[dateKey] || [],
    });
  }

  // Next month's days
  for (let day = 1; day <= daysFromNextMonth; day++) {
    const date = new Date(year, month + 1, day);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    calendarDays.push({
      date: day,
      isCurrentMonth: false,
      dateKey,
      isLogged: loginDateSet.has(dateKey),
      assignments: assignmentsByDate[dateKey] || [],
    });
  }

  function formatTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  function handlePrevMonth() {
    if (isAtOrBeforeAccountMonth) return;
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  const todayKey = formatTodayKey();

  if (typeof document === "undefined") return null;

  const modal = (
    <div className="monthly-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-title">
      <div className="calendar-overlay" onClick={onClose} />
      <div className="calendar-content">
        <div className="calendar-header">
          <h2 id="calendar-title">
            {monthName} {year}
          </h2>
          <button
            type="button"
            className="calendar-close-btn"
            onClick={onClose}
            aria-label="Close calendar"
          >
            ✕
          </button>
        </div>

        <div className="calendar-controls">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            disabled={isAtOrBeforeAccountMonth}
          >
            ←
          </button>
          <button
            type="button"
            className="calendar-today-btn"
            onClick={handleToday}
          >
            Today: {todayLabel}
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const isTrackableDate = day.dateKey >= accountCreatedKey;
            const shouldMarkMissed =
              day.isCurrentMonth && isTrackableDate && !day.isLogged && day.dateKey <= todayKey;
            const showLoginStatusIcon = day.isCurrentMonth && isTrackableDate && (day.isLogged || shouldMarkMissed);

            return (
            <div
              key={day.dateKey}
              className={`calendar-day ${!day.isCurrentMonth ? "other-month" : ""} ${day.isToday ? "today" : ""} ${day.isLogged ? "logged" : ""} ${shouldMarkMissed ? "not-logged" : ""} ${day.isCurrentMonth && !isTrackableDate ? "pre-account" : ""}`}
            >
              <div className="calendar-day-number">{day.date}</div>

              {showLoginStatusIcon && (
                <div
                  className={`calendar-login-badge ${day.isLogged ? "logged" : "missed"}`}
                  title={day.isLogged ? "Logged in" : "Not logged in"}
                  aria-label={day.isLogged ? "Logged in" : "Not logged in"}
                >
                  {day.isLogged ? "✓" : "✕"}
                </div>
              )}

              {day.assignments.length > 0 && (
                <div className="calendar-assignments-list">
                  {day.assignments.slice(0, 2).map((assignment, idx) => {
                    const badgeMeta = getAssignmentBadgeMeta(assignment?.status);
                    return (
                    <div key={idx} className="calendar-assignment-item">
                      <span
                        className={`calendar-assignment-badge ${badgeMeta.className}`}
                        title={`${assignment.title} (${badgeMeta.label})`}
                        aria-label={badgeMeta.label}
                      >
                        {badgeMeta.icon}
                      </span>
                    </div>
                    );
                  })}
                  {day.assignments.length > 2 && (
                    <span className="calendar-assignment-more">+{day.assignments.length - 2}</span>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <span className="legend-icon logged">✓</span>
            <span>Logged in</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon not-logged">✕</span>
            <span>Not logged in</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon assignment-pending">◷</span>
            <span>Pending assignment</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon assignment-completed">◆</span>
            <span>Completed assignment</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default MonthlyCalendar;
