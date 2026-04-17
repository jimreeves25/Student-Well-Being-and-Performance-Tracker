const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

const MODE_CONFIG = {
  "very-stressed": { work: 25, shortBreak: 10, longBreak: 20, maxTasks: 2, intensity: "minimal" },
  stressed: { work: 30, shortBreak: 10, longBreak: 15, maxTasks: 3, intensity: "light" },
  balanced: { work: 40, shortBreak: 7, longBreak: 15, maxTasks: 4, intensity: "balanced" },
  productive: { work: 45, shortBreak: 5, longBreak: 12, maxTasks: 5, intensity: "challenge" },
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseStartTime = (value = "09:00") => {
  const [hoursRaw, minutesRaw] = String(value).split(":");
  const hours = clamp(Number(hoursRaw) || 9, 0, 23);
  const minutes = clamp(Number(minutesRaw) || 0, 0, 59);
  return { hours, minutes };
};

const formatClock = (date) =>
  date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatRange = (startDate, durationMinutes) => {
  const end = new Date(startDate.getTime() + durationMinutes * 60000);
  return `${formatClock(startDate)} - ${formatClock(end)}`;
};

const getDueLabel = (assignment) => {
  if (!assignment.dueDateValue) return "No due date";
  if (assignment.overdue) {
    const days = Math.abs(assignment.daysUntilDue);
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (assignment.daysUntilDue === 0) return "Due today";
  return `Due in ${assignment.daysUntilDue} day${assignment.daysUntilDue === 1 ? "" : "s"}`;
};

const inferMode = (context = {}) => {
  const stressIndex = Number(context.stressIndex ?? context.stressLevel ?? 0);
  const moodRating = Number(context.moodRating ?? 0);
  const moodValue = Number(context.moodValue ?? 0);
  const performanceScore = Number(context.performanceScore ?? 0);
  const consistencyScore = Number(context.consistencyScore ?? 0);
  const moodText = String(context.moodText || "").toLowerCase();
  const stressText = String(context.stressLabel || context.stressLevelText || "").toLowerCase();

  const veryStressed =
    moodText.includes("overwhelm") ||
    stressText.includes("very") ||
    stressText.includes("overwhelm") ||
    stressIndex >= 80 ||
    (moodRating > 0 && moodRating <= 3) ||
    (moodValue > 0 && moodValue <= 1);

  if (veryStressed) return "very-stressed";

  const stressed =
    moodText.includes("stress") ||
    stressText.includes("high") ||
    stressIndex >= 60 ||
    (moodRating > 0 && moodRating <= 5) ||
    (moodValue > 0 && moodValue <= 2);

  if (stressed) return "stressed";

  if (performanceScore >= 85 && consistencyScore >= 70) return "productive";
  return "balanced";
};

const taskNote = (assignment, mode) => {
  if (mode === "very-stressed") {
    return `${getDueLabel(assignment)}. Keep this block small and achievable.`;
  }
  if (mode === "stressed") {
    return `${getDueLabel(assignment)}. Focus on progress, not perfection.`;
  }
  if (mode === "productive") {
    return `${getDueLabel(assignment)}. Push slightly deeper while keeping quality high.`;
  }
  return `${getDueLabel(assignment)}. Solid focus block with balanced pace.`;
};

const getBreakSuggestion = (mode, isLongBreak = false) => {
  if (mode === "very-stressed") {
    return isLongBreak
      ? "[Step away from the screen, drink water, and sit quietly for a minute]"
      : "[Completely step away from your desk, hydrate, and relax your eyes]";
  }

  if (mode === "stressed") {
    return isLongBreak
      ? "[Take a short walk, stretch, and listen to calm music]"
      : "[Do deep breathing or a quick stretch to relax your mind]";
  }

  if (mode === "productive") {
    return isLongBreak
      ? "[Walk a bit, move your body, and avoid distractions]"
      : "[Stretch or take a quick walk to keep your focus sharp]";
  }

  return isLongBreak
    ? "[Grab a snack, stretch, and reset before the next block]"
    : "[Stretch a bit or check your phone briefly to refresh]";
};

const toActiveAssignments = (assignments, now, mode) =>
  (assignments || [])
    .filter((assignment) => assignment?.status !== "completed")
    .map((assignment) => {
      const dueDate = toDate(assignment.dueDate);
      const overdue = Boolean(dueDate && dueDate < now);
      const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : Number.POSITIVE_INFINITY;
      const priority = String(assignment.priority || "medium").toLowerCase();
      const priorityScore = PRIORITY_WEIGHT[priority] || 2;
      const progress = clamp(Number(assignment.progress) || 0, 0, 100);
      const remainingRatio = (100 - progress) / 100;

      const urgencyByDeadline = overdue ? 1000 : Math.max(0, 30 - Math.min(daysUntilDue, 30)) * 18;
      const wellnessModifier =
        mode === "very-stressed" && priority === "low"
          ? -45
          : mode === "stressed" && priority === "low"
            ? -25
            : mode === "productive" && priority === "high"
              ? 20
              : 0;

      const urgencyScore = urgencyByDeadline + priorityScore * 25 + remainingRatio * 80 + wellnessModifier;

      const baseChunks = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
      const chunkCount = clamp(Math.ceil(baseChunks * Math.max(0.5, remainingRatio)), 1, 3);

      return {
        ...assignment,
        priority,
        progress,
        dueDateValue: dueDate,
        overdue,
        daysUntilDue,
        urgencyScore,
        chunkCount,
      };
    })
    .sort((left, right) => {
      if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
      if (left.daysUntilDue !== right.daysUntilDue) return left.daysUntilDue - right.daysUntilDue;
      return right.urgencyScore - left.urgencyScore;
    });

export const generateSmartSchedule = (assignments = [], context = {}) => {
  const now = new Date();
  const mode = inferMode(context);
  const config = MODE_CONFIG[mode];
  const activeAssignments = toActiveAssignments(assignments, now, mode);
  const selectedAssignments = activeAssignments.slice(0, config.maxTasks);

  const availableHours = clamp(Number(context.availableHours) || 4, 1, 12);
  const availableMinutes = Math.round(availableHours * 60);
  const startTime = parseStartTime(context.startTime || "09:00");

  const cursor = new Date();
  cursor.setHours(startTime.hours, startTime.minutes, 0, 0);
  const sessionDate = new Date(cursor);

  const plan = [];
  let usedMinutes = 0;
  let workBlockCount = 0;

  const pushItem = (duration, task, notes, priority = "medium", assignmentId = null) => {
    if (usedMinutes + duration > availableMinutes) return false;
    const start = new Date(cursor.getTime());
    plan.push({
      id: `${assignmentId || "general"}-${plan.length}`,
      assignmentId,
      time: formatRange(start, duration),
      task,
      notes,
      priority,
      duration,
    });
    cursor.setMinutes(cursor.getMinutes() + duration);
    usedMinutes += duration;
    return true;
  };

  if (mode === "very-stressed") {
    pushItem(15, "Recovery reset", "Slow breathing, hydration, and a gentle start before critical work.", "low");
  }

  for (const assignment of selectedAssignments) {
    for (let chunk = 0; chunk < assignment.chunkCount; chunk += 1) {
      const blockTitle = chunk === 0 ? assignment.title : `${assignment.title} (continued)`;
      const inserted = pushItem(config.work, blockTitle, taskNote(assignment, mode), assignment.priority, assignment.id);
      if (!inserted) break;

      workBlockCount += 1;

      const breakDuration = workBlockCount % 2 === 0 ? config.longBreak : config.shortBreak;
      const breakLabel = workBlockCount % 2 === 0 ? "Long break" : "Short break";
      const breakNotes = getBreakSuggestion(mode, workBlockCount % 2 === 0);

      pushItem(breakDuration, breakLabel, breakNotes, "low");
    }
  }

  const guidanceByMode = {
    "very-stressed": "Minimal plan today: only critical work and recovery time to avoid burnout.",
    stressed: "Lighter plan with shorter blocks and extra breaks to protect energy.",
    balanced: "Balanced plan with steady focus blocks and regular recovery.",
    productive: "You are in a strong rhythm, so the plan adds slightly longer focus blocks.",
  };

  return {
    plan,
    totalAssignments: activeAssignments.length,
    selectedAssignments: selectedAssignments.length,
    overdueCount: activeAssignments.filter((item) => item.overdue).length,
    mode,
    intensity: config.intensity,
    availableHours,
    totalPlannedMinutes: usedMinutes,
    sessionDate: sessionDate.toISOString(),
    guidance: guidanceByMode[mode],
    generatedAt: now.toISOString(),
  };
};

export default generateSmartSchedule;
