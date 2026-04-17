const { Op } = require("sequelize");
const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const StudySession = require("../models/StudySession");
const DailyLog = require("../models/DailyLog");
const Assignment = require("../models/Assignment");
const NotificationLog = require("../models/NotificationLog");
const NotificationPreference = require("../models/NotificationPreference");
const UserActivityLog = require("../models/UserActivityLog");
const { sendEmailAndSms } = require("./notificationDelivery");

const DEFAULT_STUDENT_PREFS = {
  emailOn: true,
  dailyLogReminderTime: "21:00",
};

const DEFAULT_PARENT_PREFS = {
  emailOn: true,
  dailyLogReminderTime: null,
};

const normalizeTimeString = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^([0-2]?\d):([0-5]\d)$/);
  if (!match) return null;
  const hour = Math.min(23, Number(match[1]));
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
};

const getPrincipalRecord = async (role, ownerId) => {
  if (role === "parent") {
    return ParentUser.findByPk(ownerId);
  }

  return User.findByPk(ownerId);
};

const getPrincipalContacts = (principal, role) => {
  if (!principal) return { email: null, phone: null, name: "User" };

  return {
    email: principal.email || null,
    phone: principal.phone || null,
    name: principal.name || (role === "parent" ? "Parent" : "Student"),
  };
};

const getOrCreatePreferences = async (ownerId, role = "student") => {
  const [preferences] = await NotificationPreference.findOrCreate({
    where: { userId: ownerId, role },
    defaults: role === "parent" ? { ...DEFAULT_PARENT_PREFS, userId: ownerId, role } : { ...DEFAULT_STUDENT_PREFS, userId: ownerId, role },
  });

  return preferences;
};

const serializePreferences = (preferences, role = "student") => ({
  emailOn: Boolean(preferences?.emailOn ?? (role === "parent" ? DEFAULT_PARENT_PREFS.emailOn : DEFAULT_STUDENT_PREFS.emailOn)),
  dailyLogReminderTime: preferences?.dailyLogReminderTime || (role === "parent" ? DEFAULT_PARENT_PREFS.dailyLogReminderTime : DEFAULT_STUDENT_PREFS.dailyLogReminderTime),
});

const getPreferencesForOwner = async (ownerId, role = "student") => {
  const preferences = await getOrCreatePreferences(ownerId, role);
  return serializePreferences(preferences, role);
};

const shouldSkipDuplicate = async ({ ownerId, role, type, channel, withinMinutes = 60 }) => {
  const existing = await NotificationLog.findOne({
    where: {
      userId: ownerId,
      role,
      type,
      channel,
      sentAt: { [Op.gte]: new Date(Date.now() - withinMinutes * 60 * 1000) },
    },
    order: [["sentAt", "DESC"]],
  });

  return Boolean(existing);
};

const createNotificationLog = async ({ ownerId, role, type, channel, title, message, metadata = {}, status = "sent", sentAt = new Date() }) => {
  return NotificationLog.create({
    userId: ownerId,
    role,
    type,
    channel,
    title,
    messagePreview: String(message || "").slice(0, 240),
    metadata: JSON.stringify(metadata || {}),
    status,
    sentAt,
  });
};

const sendNotificationToOwner = async ({ ownerId, role = "student", type, title, message, metadata = {}, channels = ["email"] }) => {
  const principal = await getPrincipalRecord(role, ownerId);
  if (!principal) {
    return { delivered: false, reason: "owner-not-found" };
  }

  const contacts = getPrincipalContacts(principal, role);
  const preferences = await getPreferencesForOwner(ownerId, role);
  const now = new Date();

  const nextChannels = [];
  if (channels.includes("email") && preferences.emailOn && contacts.email) {
    nextChannels.push("email");
  }

  if (!nextChannels.length) {
    await createNotificationLog({
      ownerId,
      role,
      type,
      channel: "skipped",
      title,
      message,
      metadata,
      status: "skipped",
    });
    return { delivered: false, reason: "no-enabled-channels" };
  }

  const deliveries = await Promise.allSettled(
    nextChannels.map(async (channel) => {
      if (await shouldSkipDuplicate({ ownerId, role, type, channel })) {
        return { channel, skipped: true };
      }

      const result =
        channel === "email"
          ? await sendNotificationAndLogEmail({ ownerId, role, type, title, message, metadata, contacts })
          : { channel: "skipped", skipped: true, delivered: false };

      return result;
    })
  );

  return deliveries.map((delivery) => (delivery.status === "fulfilled" ? delivery.value : { channel: "unknown", skipped: false, delivered: false }));
};

const sendNotificationAndLogEmail = async ({ ownerId, role, type, title, message, metadata, contacts }) => {
  const result = await sendEmailAndSms({ email: contacts.email, phone: null, subject: title, message });
  const emailResult = result.email || { delivered: false };

  await createNotificationLog({
    ownerId,
    role,
    type,
    channel: "email",
    title,
    message,
    metadata,
    status: emailResult.delivered ? "sent" : "failed",
  });

  return { channel: "email", delivered: Boolean(emailResult.delivered), provider: emailResult.provider || null };
};

const getUnreadNotificationCount = async (ownerId, role = "student") => {
  return NotificationLog.count({ where: { userId: ownerId, role, readAt: null } });
};

const markNotificationRead = async ({ ownerId, role, notificationId }) => {
  const notification = await NotificationLog.findOne({ where: { id: notificationId, userId: ownerId, role } });
  if (!notification) return null;
  await notification.update({ readAt: new Date() });
  return notification;
};

const markAllNotificationsRead = async ({ ownerId, role }) => {
  await NotificationLog.update({ readAt: new Date() }, { where: { userId: ownerId, role, readAt: null } });
};

const getNotificationHistory = async ({ ownerId, role, limit = 50 }) => {
  return NotificationLog.findAll({
    where: { userId: ownerId, role },
    order: [["sentAt", "DESC"]],
    limit,
  });
};

const recordUserActivity = async ({ ownerId, role = "student", activityType = "app_open", source = "web", metadata = {} }) => {
  return UserActivityLog.create({
    userId: ownerId,
    activityType: `${role}_${activityType}`,
    source,
    metadata: JSON.stringify(metadata || {}),
    occurredAt: new Date(),
  });
};

const safeParseJson = (value, fallback = {}) => {
  try {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDailyLogStats = (logs = []) => {
  const studyHours = logs.reduce((sum, log) => sum + Number(log.studyHours || 0), 0);
  const wellnessAverage = logs.length
    ? logs.reduce((sum, log) => sum + Number(log.moodRating || 0), 0) / logs.length
    : 0;

  return {
    studyHours: Number(studyHours.toFixed(1)),
    wellnessAverage: Number(wellnessAverage.toFixed(1)),
    moodLabels: logs.map((log) => String(log.moodLabel || log.mood || log.moodRating || "")),
  };
};

const getStudentStreak = async (studentId) => {
  const logs = await DailyLog.findAll({
    where: { userId: studentId },
    order: [["date", "DESC"]],
    limit: 60,
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const hasEntry = logs.some((log) => new Date(log.date).toISOString().slice(0, 10) === key);
    if (!hasEntry) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getWeeklySummary = async (studentId) => {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  const [logs, sessions, assignments] = await Promise.all([
    DailyLog.findAll({ where: { userId: studentId, date: { [Op.gte]: weekAgo } }, order: [["date", "DESC"]] }),
    StudySession.findAll({ where: { userId: studentId, scheduledDate: { [Op.gte]: weekAgo } }, order: [["scheduledDate", "DESC"]] }),
    Assignment.findAll({ where: { userId: studentId, dueDate: { [Op.gte]: weekAgo } }, order: [["dueDate", "DESC"]] }),
  ]);

  const stats = getDailyLogStats(logs);
  const streak = await getStudentStreak(studentId);
  const missedSessions = sessions.filter((session) => new Date(session.scheduledDate) < now && !session.completed).length;

  return {
    studyHours: stats.studyHours,
    wellnessAverage: stats.wellnessAverage,
    streak,
    missedSessions,
    assignmentsDue: assignments.length,
  };
};

module.exports = {
  DEFAULT_STUDENT_PREFS,
  DEFAULT_PARENT_PREFS,
  getPreferencesForOwner,
  normalizeTimeString,
  shouldSkipDuplicate,
  sendNotificationToOwner,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationHistory,
  recordUserActivity,
  getPrincipalRecord,
  getPrincipalContacts,
  safeParseJson,
  getStudentStreak,
  getWeeklySummary,
};