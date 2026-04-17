const cron = (() => {
  try {
    return require("node-cron");
  } catch {
    return null;
  }
})();

const { Op } = require("sequelize");
const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const DailyLog = require("../models/DailyLog");
const StudySession = require("../models/StudySession");
const Assignment = require("../models/Assignment");
const NotificationPreference = require("../models/NotificationPreference");
const { sendNotificationToOwner, shouldSkipDuplicate, getStudentStreak, getWeeklySummary } = require("../utils/notificationEngine");

let schedulerStarted = false;

const minutesUntil = (futureDate, now = new Date()) => Math.round((new Date(futureDate).getTime() - now.getTime()) / 60000);

const getTimeKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
};

const getDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const hasLogToday = async (userId, now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const log = await DailyLog.findOne({
    where: {
      userId,
      date: { [Op.gte]: today },
    },
  });

  return Boolean(log);
};

const runStudentNotifications = async () => {
  const now = new Date();
  const students = await User.findAll({ where: { isContactSetup: true } });

  for (const student of students) {
    const [todayLog, upcomingSessions, assignments, streak, preferences] = await Promise.all([
      hasLogToday(student.id, now),
      StudySession.findAll({
        where: { userId: student.id, completed: false, scheduledDate: { [Op.gte]: new Date(now.getTime() - 60 * 60 * 1000) } },
      }),
      Assignment.findAll({ where: { userId: student.id, dueDate: { [Op.gte]: new Date(now.getTime() - 60 * 60 * 1000) } } }),
      getStudentStreak(student.id),
      NotificationPreference.findOne({ where: { userId: student.id, role: "student" } }),
    ]);

    for (const session of upcomingSessions) {
      const diff = minutesUntil(session.scheduledDate, now);
      if (![30, 15, 5].includes(diff)) continue;
      const type = `class_reminder_${diff}`;
      if (await shouldSkipDuplicate({ ownerId: student.id, role: "student", type, channel: "email" })) continue;

      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type,
        title: "Upcoming class reminder",
        message: `Your class starts in ${diff} minutes.`,
        metadata: { sessionId: session.id, scheduledDate: session.scheduledDate },
      });
    }

    const reminderTime = preferences?.dailyLogReminderTime || "21:00";
    const emailOn = preferences?.emailOn !== false;
    const shouldSendDailyReminder = emailOn && reminderTime === getTimeKey(now);

    if (shouldSendDailyReminder) {
      const dateKey = getDateKey(now);
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: `daily_log_reminder_${dateKey}`,
        title: "Daily Log Reminder",
        message: `Hey ${student.name || "Student"}, don't forget to log your daily progress today!`,
        channels: ["email"],
      });
    }

    if (!todayLog && now.getHours() >= 19) {
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: "streak_protection",
        title: "Protect your streak",
        message: "Log today before midnight to keep your streak alive.",
        metadata: { streak },
      });
    }

    for (const assignment of assignments) {
      const diff = minutesUntil(assignment.dueDate, now);
      if (diff < 1440 || diff > 1455) continue;
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: "assignment_due",
        title: "Assignment due soon",
        message: `${assignment.title || assignment.subject || "An assignment"} is due in 24 hours.`,
        metadata: { assignmentId: assignment.id, dueDate: assignment.dueDate },
      });
    }

    if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() < 2) {
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: "mood_check_in",
        title: "Start your week",
        message: "Start your week - log your mood!",
      });
    }

    if (now.getDay() === 0 && now.getHours() === 18 && now.getMinutes() < 2) {
      const summary = await getWeeklySummary(student.id);
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: "weekly_summary",
        title: "Weekly performance summary",
        message: `Study hours: ${summary.studyHours}. Wellness avg: ${summary.wellnessAverage}.`,
        metadata: summary,
      });
    }

    if (streak < 3 && now.getHours() >= 18) {
      await sendNotificationToOwner({
        ownerId: student.id,
        role: "student",
        type: "streak_warning",
        title: "Streak warning",
        message: `Your streak is down to ${streak}.`,
        metadata: { streak },
      });
    }
  }
};

const runParentNotifications = async () => {
  const now = new Date();
  const parents = await ParentUser.findAll({ where: { linkedStudentId: { [Op.ne]: null } } });

  for (const parent of parents) {
    const studentId = parent.linkedStudentId;
    const recentLogs = await DailyLog.findAll({
      where: { userId: studentId, date: { [Op.gte]: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) } },
      order: [["date", "DESC"]],
      limit: 2,
    });

    const lastTwoMoodValues = recentLogs.slice(0, 2).map((log) => String(log.moodLabel || log.mood || log.stressLevel || "").toLowerCase());
    const isLowMood = lastTwoMoodValues.length === 2 && lastTwoMoodValues.every((value) => ["bad", "terrible"].includes(value));

    if (isLowMood) {
      await sendNotificationToOwner({
        ownerId: parent.id,
        role: "parent",
        type: "low_wellness_alert",
        title: "Low wellness alert",
        message: "Your student has logged Bad or Terrible mood for 2 consecutive days.",
        metadata: { studentId },
      });
    }

    const streak = await getStudentStreak(studentId);
    if (streak < 3) {
      await sendNotificationToOwner({
        ownerId: parent.id,
        role: "parent",
        type: "streak_dropped",
        title: "Streak dropped",
        message: `Student streak is now ${streak}.`,
        metadata: { studentId, streak },
      });
    }

    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const missedSessions = await StudySession.count({
      where: { userId: studentId, scheduledDate: { [Op.gte]: weekAgo }, completed: false },
    });

    if (missedSessions >= 2) {
      await sendNotificationToOwner({
        ownerId: parent.id,
        role: "parent",
        type: "missed_sessions",
        title: "Missed study sessions",
        message: `Student has missed ${missedSessions} scheduled study sessions this week.`,
        metadata: { studentId, missedSessions },
      });
    }

    if (now.getDay() === 0 && now.getHours() === 19 && now.getMinutes() < 2) {
      const summary = await getWeeklySummary(studentId);
      await sendNotificationToOwner({
        ownerId: parent.id,
        role: "parent",
        type: "weekly_digest",
        title: "Weekly digest",
        message: `Wellness score ${summary.wellnessAverage}, study hours ${summary.studyHours}, streak ${summary.streak}.`,
        metadata: summary,
      });
    }
  }
};

const startNotificationScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const run = async () => {
    try {
      await runStudentNotifications();
      await runParentNotifications();
    } catch (error) {
      console.error("[notification-scheduler] run failed", error);
    }
  };

  if (cron) {
    cron.schedule("* * * * *", run, { timezone: process.env.TIMEZONE || "UTC" });
    console.log("[notification-scheduler] cron scheduled every minute");
  } else {
    setInterval(run, 60 * 1000);
    console.log("[notification-scheduler] fallback interval scheduled every minute");
  }
};

module.exports = { startNotificationScheduler };