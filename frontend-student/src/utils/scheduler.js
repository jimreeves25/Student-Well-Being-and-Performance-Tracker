const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatClock = (date) =>
  date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatRange = (startHour, durationMinutes) => {
  const start = new Date();
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${formatClock(start)}–${formatClock(end)}`;
};

const toTimeLabel = (assignment, now, index) => {
  const dueDate = toDate(assignment.dueDate);
  const isOverdue = Boolean(dueDate && dueDate < now);
  const dueDays = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null;
  const startHour = 6 + (index % 3) * 2;
  const duration = assignment.priority === "high" ? 120 : assignment.priority === "medium" ? 90 : 60;
  const range = formatRange(startHour, duration);

  if (isOverdue) {
    return `Today ${range}`;
  }

  if (dueDays === 0) {
    return `Today ${range}`;
  }

  if (dueDays === 1) {
    return `Tomorrow ${range}`;
  }

  if (dueDays && dueDays <= 3) {
    return `This week ${range}`;
  }

  return `Next available ${range}`;
};

export const generateSmartSchedule = (assignments = []) => {
  const now = new Date();
  const activeAssignments = (assignments || [])
    .filter((assignment) => assignment?.status !== "completed")
    .map((assignment) => {
      const dueDate = toDate(assignment.dueDate);
      const overdue = Boolean(dueDate && dueDate < now);
      const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
      const priorityScore = PRIORITY_WEIGHT[String(assignment.priority || "medium").toLowerCase()] || 2;
      const progressScore = 100 - (Number(assignment.progress) || 0);
      const urgencyScore = overdue
        ? 1000
        : Math.max(0, 30 - Math.min(daysUntilDue, 30)) * 20 + priorityScore * 10 + progressScore;

      return {
        ...assignment,
        dueDateValue: dueDate,
        overdue,
        daysUntilDue,
        priorityScore,
        urgencyScore,
      };
    })
    .sort((left, right) => {
      if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
      if (left.daysUntilDue !== right.daysUntilDue) return left.daysUntilDue - right.daysUntilDue;
      if (left.priorityScore !== right.priorityScore) return right.priorityScore - left.priorityScore;
      return right.urgencyScore - left.urgencyScore;
    });

  const plan = activeAssignments.map((assignment, index) => ({
    id: assignment.id,
    title: assignment.title,
    subject: assignment.subject || "General",
    priority: assignment.priority || "medium",
    progress: Number(assignment.progress) || 0,
    dueLabel: assignment.dueDateValue
      ? assignment.overdue
        ? `Overdue by ${Math.abs(assignment.daysUntilDue)} day${Math.abs(assignment.daysUntilDue) === 1 ? "" : "s"}`
        : assignment.daysUntilDue === 0
          ? "Due today"
          : `Due in ${assignment.daysUntilDue} day${assignment.daysUntilDue === 1 ? "" : "s"}`
      : "No due date",
    time: toTimeLabel(assignment, now, index),
    reason: assignment.overdue
      ? "Prioritize immediately to recover the deadline."
      : assignment.priority === "high"
        ? "High priority item should be tackled first."
        : assignment.priority === "medium"
          ? "Allocate a focused block before lower priority work."
          : "Use this as a lighter focus block."
  }));

  return {
    plan,
    totalAssignments: activeAssignments.length,
    overdueCount: activeAssignments.filter((item) => item.overdue).length,
    generatedAt: now.toISOString(),
  };
};

export default generateSmartSchedule;
