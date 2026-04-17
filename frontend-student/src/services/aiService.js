import axios from "axios";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pad = (value) => String(value).padStart(2, "0");

const parseTime = (value = "09:00") => {
  const [hoursRaw, minutesRaw] = String(value).split(":");
  return {
    hours: clamp(Number(hoursRaw) || 9, 0, 23),
    minutes: clamp(Number(minutesRaw) || 0, 0, 59),
  };
};

const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const getMoodMode = (stressIndex = 50) => {
  if (stressIndex >= 80) return "very-stressed";
  if (stressIndex >= 60) return "stressed";
  if (stressIndex <= 35) return "productive";
  return "balanced";
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

const MODE_SETTINGS = {
  "very-stressed": { focus: 25, break: 10, longBreak: 20, label: "Minimal" },
  stressed: { focus: 30, break: 10, longBreak: 15, label: "Light" },
  balanced: { focus: 40, break: 7, longBreak: 15, label: "Balanced" },
  productive: { focus: 45, break: 5, longBreak: 12, label: "High-focus" },
};

const SYSTEM_PROMPTS = {
  "study-help": "You are an expert AI Study Coach. Help students understand concepts, solve problems, and learn effectively. Be encouraging, clear, and use step-by-step examples.",
  "quiz-me": "You are a quiz master AI. Give one question at a time on the topic the student picks. Wait for their answer, then give feedback and the correct answer if wrong. Be encouraging.",
  "plan-my-day": "You are a productivity coach. Help students plan their study sessions, manage time, and set priorities. Ask about their subjects and deadlines to make a personalized plan.",
  "wellness": "You are a wellness coach for students. Help with stress, sleep, burnout, and study-life balance. Be empathetic and supportive. Suggest professional help for serious concerns.",
};

export const sendMessageToAI = async (messages, modeId = "study-help") => {
  const systemPrompt = SYSTEM_PROMPTS[modeId] || SYSTEM_PROMPTS["study-help"];

  const response = await axios.post(
    ANTHROPIC_URL,
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data.content[0].text;
};

export const generateSmartSchedule = async (params = {}) => {
  const subjects = Array.isArray(params.subjects) ? params.subjects.filter((subject) => subject?.name?.trim()) : [];
  const availableHours = clamp(Number(params.availableHours) || 6, 1, 12);
  const stressIndex = Number(params.stressIndex ?? 50);
  const avgSleepHours = Number(params.avgSleepHours ?? 7);
  const startTime = parseTime(params.startTime || "09:00");
  const mode = getMoodMode(stressIndex);
  const config = MODE_SETTINGS[mode];

  const baseDate = new Date();
  baseDate.setHours(startTime.hours, startTime.minutes, 0, 0);

  const schedule = [];
  let cursor = new Date(baseDate);
  let remainingMinutes = availableHours * 60;

  const pushBlock = (type, subject, duration, reason) => {
    if (duration <= 0 || remainingMinutes < duration) return false;
    const blockStart = new Date(cursor);
    const blockEnd = new Date(cursor.getTime() + duration * 60000);
    schedule.push({
      type,
      subject,
      activity: type === "break" ? subject : undefined,
      time: `${formatTime(blockStart)} - ${formatTime(blockEnd)}`,
      duration,
      reason,
    });
    cursor = blockEnd;
    remainingMinutes -= duration;
    return true;
  };

  const sortedSubjects = [...subjects].sort((left, right) => {
    const difficultyRank = { hard: 3, medium: 2, easy: 1 };
    const leftRank = difficultyRank[String(left.difficulty || "medium").toLowerCase()] || 2;
    const rightRank = difficultyRank[String(right.difficulty || "medium").toLowerCase()] || 2;
    return right.weightage - left.weightage || rightRank - leftRank;
  });

  if (!sortedSubjects.length) {
    sortedSubjects.push({ name: "Review and planning", difficulty: "medium", weightage: 1 });
  }

  schedule.push({
    type: "note",
    subject: `Mode: ${config.label}`,
    activity: `Stress ${stressIndex}/100 | Sleep ${avgSleepHours}h`,
    time: `${formatTime(baseDate)} - ${formatTime(new Date(baseDate.getTime() + 5 * 60000))}`,
    duration: 5,
    reason:
      mode === "very-stressed"
        ? "Keep the plan minimal and recovery-first today."
        : mode === "stressed"
          ? "Use shorter blocks so the plan stays doable."
          : mode === "productive"
            ? "You can handle slightly longer focus blocks today."
            : "Balanced pace with steady focus and breaks.",
  });

  for (const subject of sortedSubjects) {
    if (remainingMinutes <= 0) break;

    const weightHours = Number(subject.weightage) || 1;
    const targetDuration = clamp(Math.round(weightHours * 30), config.focus, config.focus * 2);
    const focusReason =
      mode === "very-stressed"
        ? "Short, achievable block to avoid overload."
        : mode === "stressed"
          ? "Focused block with extra breathing room."
          : mode === "productive"
            ? "Longer focus block while your energy is strong."
            : "Solid focus block with a manageable pace.";

    if (!pushBlock("study", subject.name, Math.min(targetDuration, remainingMinutes), focusReason)) break;

    const breakDuration = schedule.length % 2 === 0 ? config.longBreak : config.break;
    if (remainingMinutes > 0) {
      pushBlock(
        "break",
        getBreakSuggestion(mode, breakDuration >= config.longBreak),
        Math.min(breakDuration, remainingMinutes),
        "Take a break to refresh."
      );
    }
  }

  const totalStudyMinutes = schedule
    .filter((item) => item.type === "study")
    .reduce((sum, item) => sum + item.duration, 0);

  const tips = [
    mode === "very-stressed"
      ? "Do the first block only if needed, then re-evaluate your energy."
      : mode === "stressed"
        ? "Keep distractions low and stop when the timer ends."
        : mode === "productive"
          ? "Use the momentum to finish the highest-value subject first."
          : "Stay consistent and keep your breaks on time.",
    `Planned ${Math.round(totalStudyMinutes)} minutes of study time across ${sortedSubjects.length} subject block${sortedSubjects.length === 1 ? "" : "s"}.`,
    `Generated for ${availableHours} available hour${availableHours === 1 ? "" : "s"}.`,
  ];

  const summary =
    mode === "very-stressed"
      ? "Minimal recovery-friendly plan built around only the essentials."
      : mode === "stressed"
        ? "Light plan with extra breaks to keep the workload achievable."
        : mode === "productive"
          ? "High-focus plan with a slightly more ambitious pace."
          : "Balanced plan with focused sessions and healthy breaks.";

  return {
    summary,
    schedule,
    tips,
    mode,
  };
};
