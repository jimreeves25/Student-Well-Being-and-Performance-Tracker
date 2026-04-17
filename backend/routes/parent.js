const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op, fn, col, where } = require("sequelize");

const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const ParentLinkRequest = require("../models/ParentLinkRequest");
const DailyLog = require("../models/DailyLog");
const StudySession = require("../models/StudySession");
const LiveSessionActivity = require("../models/LiveSessionActivity");
const ParentAlert = require("../models/ParentAlert");
const Assignment = require("../models/Assignment");
const NotificationPreference = require("../models/NotificationPreference");
const { sendEmail, sendSms } = require("../utils/contactDelivery");
const { sendNotificationToOwner } = require("../utils/notificationEngine");
const {
  generateOtpCode,
  getOtpExpiryDate,
  normalizePhone,
  isValidEmail,
  isValidPhone,
} = require("../utils/verification");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const LOW_STUDY_HOURS_THRESHOLD = 1.5;
const INACTIVE_SECONDS_THRESHOLD = 600;

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeStudentId = (value = "") => String(value).trim();
const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const next = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(next)) return true;
    if (["false", "0", "no", "off"].includes(next)) return false;
  }
  return fallback;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const appendLiveSessionActivityEntry = async (session, entry) => {
  const currentLog = parseJsonArray(session.activityLog);
  const nextLog = [...currentLog, entry].slice(-100);

  await session.update({
    activityLog: JSON.stringify(nextLog),
  });

  return nextLog;
};

const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

const studentAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role && decoded.role !== "student") {
      return res.status(403).json({ message: "Student access required" });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const parentAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "parent") {
      return res.status(403).json({ message: "Parent access required" });
    }
    req.parentId = decoded.parentId;
    req.studentId = decoded.studentId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const toParentPayload = (parent) => ({
  id: parent.id,
  name: parent.name,
  email: parent.email,
  phone: parent.phone || "",
  emailVerified: Boolean(parent.emailVerified),
  phoneVerified: Boolean(parent.phoneVerified),
  approvalStatus: parent.approvalStatus,
  linkedStudentId: parent.linkedStudentId,
  notifyByEmail: Boolean(parent.notifyByEmail),
  notifyByDashboard: Boolean(parent.notifyByDashboard),
  notifyByPush: Boolean(parent.notifyByPush),
  verifiedAt: parent.verifiedAt,
  createdAt: parent.createdAt,
  updatedAt: parent.updatedAt,
});

const sendEmailNotification = async ({ to, subject, message }) => {
  await sendEmail({ to, subject, text: message });
};

const createParentAlerts = async ({ studentId, alertType, severity, message, metadata }) => {
  const parents = await ParentUser.findAll({
    where: {
      linkedStudentId: studentId,
      approvalStatus: "approved",
    },
  });

  if (!parents.length) return;

  for (const parent of parents) {
    const dashboardEnabled = parent.notifyByDashboard !== false;
    const emailEnabled = parent.notifyByEmail === true;

    if (!dashboardEnabled && !emailEnabled) {
      continue;
    }

    const existing = await ParentAlert.findOne({
      where: {
        parentId: parent.id,
        studentId,
        alertType,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 1000 * 60 * 30),
        },
      },
    });

    if (existing) continue;

    let alert = null;
    if (dashboardEnabled) {
      alert = await ParentAlert.create({
        parentId: parent.id,
        studentId,
        alertType,
        severity,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        deliveredByEmail: false,
      });
    }

    if (emailEnabled) {
      await sendEmailNotification({
        to: parent.email,
        subject: `Student Monitoring Alert: ${alertType}`,
        message,
      });

      if (alert) {
        await alert.update({ deliveredByEmail: true });
      }
    }
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, studentId, verificationCode } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedStudentId = normalizeStudentId(studentId);
    const normalizedCode = String(verificationCode || "").trim();

    if (!normalizedName || !normalizedEmail || !password || !normalizedStudentId || !normalizedCode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingParent = await ParentUser.findOne({
      where: where(fn("lower", col("email")), normalizedEmail),
    });
    if (existingParent) {
      return res.status(400).json({ message: "Parent account already exists" });
    }

    const student = await User.findOne({
      where: where(fn("lower", col("studentId")), normalizedStudentId.toLowerCase()),
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const codeExpired = !student.parentLinkCodeExpiresAt || new Date(student.parentLinkCodeExpiresAt) < new Date();
    const codeInvalid = student.parentLinkCode !== normalizedCode;
    if (codeExpired || codeInvalid) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const parent = await ParentUser.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: phone ? normalizePhone(phone) : null,
      password: hashedPassword,
      approvalStatus: "pending",
      linkedStudentId: null,
    });

    await ParentLinkRequest.create({
      parentId: parent.id,
      studentId: student.id,
      verificationCode: normalizedCode,
      status: "pending",
    });

    res.status(201).json({
      message: "Parent account created. Waiting for student approval.",
      parent: toParentPayload(parent),
    });
  } catch (error) {
    console.error("Parent signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const parent = await ParentUser.findOne({
      where: where(fn("lower", col("email")), normalizedEmail),
    });

    if (!parent) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, parent.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = makeToken({
      role: "parent",
      parentId: parent.id,
      studentId: parent.linkedStudentId,
    });

    res.json({
      message: "Parent login successful",
      token,
      role: "parent",
      parent: toParentPayload(parent),
    });
  } catch (error) {
    console.error("Parent login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/link-code", studentAuth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);

    await User.update(
      {
        parentLinkCode: code,
        parentLinkCodeExpiresAt: expiresAt,
      },
      { where: { id: req.userId } }
    );

    res.json({
      message: "Verification code generated",
      verificationCode: code,
      expiresAt,
    });
  } catch (error) {
    console.error("Generate link code error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/student/link-requests", studentAuth, async (req, res) => {
  try {
    const requests = await ParentLinkRequest.findAll({
      where: {
        studentId: req.userId,
        status: "pending",
      },
      order: [["createdAt", "DESC"]],
    });

    const parents = await ParentUser.findAll({
      where: { id: requests.map((r) => r.parentId) },
      attributes: ["id", "name", "email", "createdAt"],
    });

    const parentMap = Object.fromEntries(parents.map((p) => [p.id, p]));
    const enriched = requests.map((reqItem) => ({
      id: reqItem.id,
      status: reqItem.status,
      createdAt: reqItem.createdAt,
      parent: parentMap[reqItem.parentId] || null,
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Fetch link requests error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/link-requests/:id/respond", studentAuth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Action must be approved or rejected" });
    }

    const linkRequest = await ParentLinkRequest.findOne({
      where: {
        id: req.params.id,
        studentId: req.userId,
        status: "pending",
      },
    });

    if (!linkRequest) {
      return res.status(404).json({ message: "Pending request not found" });
    }

    await linkRequest.update({ status: action, reviewedAt: new Date() });

    const parent = await ParentUser.findByPk(linkRequest.parentId);
    if (action === "approved") {
      await parent.update({ approvalStatus: "approved", linkedStudentId: req.userId });
    } else {
      await parent.update({ approvalStatus: "rejected", linkedStudentId: null });
    }

    res.json({ message: `Parent request ${action}` });
  } catch (error) {
    console.error("Respond link request error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/student/privacy", studentAuth, async (req, res) => {
  try {
    const { allowWellnessShare } = req.body;
    await User.update({ allowWellnessShare: !!allowWellnessShare }, { where: { id: req.userId } });
    res.json({ message: "Privacy preferences updated" });
  } catch (error) {
    console.error("Update privacy error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/live-session/start", studentAuth, async (req, res) => {
  try {
    const { studySessionId } = req.body;

    const active = await LiveSessionActivity.findOne({
      where: { studentId: req.userId, status: "active" },
    });

    if (active) {
      return res.json({ message: "Live session already active", session: active });
    }

    const session = await LiveSessionActivity.create({
      studentId: req.userId,
      studySessionId: studySessionId || null,
      joinTime: new Date(),
      lastActiveAt: new Date(),
      status: "active",
    });

    res.status(201).json({ message: "Live session started", session });
  } catch (error) {
    console.error("Live session start error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/live-session/heartbeat", studentAuth, async (req, res) => {
  try {
    const { activeSeconds = 0, inactiveSeconds = 0, isActive = true } = req.body;

    const session = await LiveSessionActivity.findOne({
      where: { studentId: req.userId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    if (!session) {
      return res.status(404).json({ message: "No active live session" });
    }

    const updates = {
      activeSeconds: session.activeSeconds + Number(activeSeconds || 0),
      inactiveSeconds: session.inactiveSeconds + Number(inactiveSeconds || 0),
      status: isActive ? "active" : "inactive",
    };

    if (isActive) {
      updates.lastActiveAt = new Date();
    }

    await session.update(updates);

    if ((updates.inactiveSeconds || 0) >= INACTIVE_SECONDS_THRESHOLD) {
      await createParentAlerts({
        studentId: req.userId,
        alertType: "inactive_in_live_class",
        severity: "high",
        message: "Student joined live class but has been inactive for an extended period.",
        metadata: { inactiveSeconds: updates.inactiveSeconds },
      });
    }

    res.json({ message: "Heartbeat received", session });
  } catch (error) {
    console.error("Live heartbeat error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/live-session/end", studentAuth, async (req, res) => {
  try {
    const session = await LiveSessionActivity.findOne({
      where: { studentId: req.userId, status: { [Op.in]: ["active", "inactive"] } },
      order: [["createdAt", "DESC"]],
    });

    if (!session) {
      return res.status(404).json({ message: "No active live session found" });
    }

    await session.update({
      leaveTime: new Date(),
      status: "ended",
    });

    if (session.studySessionId) {
      const planned = await StudySession.findByPk(session.studySessionId);
      if (planned && session.activeSeconds < Math.floor(planned.duration * 60 * 0.6)) {
        await createParentAlerts({
          studentId: req.userId,
          alertType: "left_session_early",
          severity: "high",
          message: "Student left a live class significantly earlier than scheduled.",
          metadata: {
            scheduledMinutes: planned.duration,
            attendedSeconds: session.activeSeconds,
          },
        });
      }
    }

    res.json({ message: "Live session ended", session });
  } catch (error) {
    console.error("Live session end error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/assignments", studentAuth, async (req, res) => {
  try {
    const { title, subject, dueDate, status, progress } = req.body;
    if (!title) return res.status(400).json({ message: "Assignment title is required" });

    const assignment = await Assignment.create({
      userId: req.userId,
      title,
      subject: subject || "General",
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || "pending",
      progress: Number(progress || 0),
    });

    // Notify the student immediately when a new assignment is added.
    try {
      const dueLabel = assignment.dueDate
        ? ` Due: ${new Date(assignment.dueDate).toLocaleString()}.`
        : "";

      await sendNotificationToOwner({
        ownerId: req.userId,
        role: "student",
        type: "assignment_assigned",
        title: "New Assignment Assigned",
        message: `A new assignment was added: ${assignment.title}.${dueLabel}`,
        metadata: {
          assignmentId: assignment.id,
          subject: assignment.subject,
          dueDate: assignment.dueDate,
        },
        channels: ["email"],
      });
    } catch (notificationError) {
      console.warn("Assignment created but notification failed:", notificationError.message);
    }

    res.status(201).json({ message: "Assignment created", assignment });
  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/student/assignments", studentAuth, async (req, res) => {
  try {
    const assignments = await Assignment.findAll({
      where: { userId: req.userId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });
    res.json(assignments);
  } catch (error) {
    console.error("List assignments error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/dashboard", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });
    if (parent.approvalStatus !== "approved" || !parent.linkedStudentId) {
      return res.status(403).json({ message: "Waiting for student approval" });
    }

    const student = await User.findByPk(parent.linkedStudentId);
    if (!student) return res.status(404).json({ message: "Linked student not found" });

    const now = new Date();
    const weekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

    const [dailyLogs, sessions, liveSessions, assignments] = await Promise.all([
      DailyLog.findAll({
        where: { userId: student.id, date: { [Op.gte]: weekAgo } },
        order: [["date", "ASC"]],
      }),
      StudySession.findAll({
        where: { userId: student.id, scheduledDate: { [Op.gte]: weekAgo } },
        order: [["scheduledDate", "DESC"]],
      }),
      LiveSessionActivity.findAll({
        where: { studentId: student.id, createdAt: { [Op.gte]: weekAgo } },
        order: [["createdAt", "DESC"]],
      }),
      Assignment.findAll({
        where: { userId: student.id },
        order: [["createdAt", "DESC"]],
        limit: 8,
      }),
    ]);

    const activeLive = await LiveSessionActivity.findOne({
      where: { studentId: student.id, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    const todayLogs = dailyLogs.filter((log) => {
      const d = new Date(log.date);
      return d.toDateString() === now.toDateString();
    });

    const studyHoursSeries = dailyLogs.map((log) => ({
      date: log.date,
      value: Number(log.studyHours || 0),
      focusMinutes: Number(log.focusMinutes || 0),
      breakMinutes: Number(log.breakMinutes || 0),
    }));

    const totalStudyHours = studyHoursSeries.reduce((sum, item) => sum + item.value, 0);
    const avgStudyHours = dailyLogs.length ? totalStudyHours / dailyLogs.length : 0;
    const totalFocusMinutes = studyHoursSeries.reduce((sum, item) => sum + item.focusMinutes, 0);
    const totalBreakMinutes = studyHoursSeries.reduce((sum, item) => sum + item.breakMinutes, 0);

    const attendanceTotal = sessions.length;
    const liveBySession = new Map();
    liveSessions.forEach((live) => {
      if (live.studySessionId && !liveBySession.has(live.studySessionId)) {
        liveBySession.set(live.studySessionId, live);
      }
    });

    const attendedCount = sessions.filter((session) => liveBySession.has(session.id)).length;
    const missedCount = Math.max(0, attendanceTotal - attendedCount);

    if (missedCount > 0) {
      await createParentAlerts({
        studentId: student.id,
        alertType: "missed_live_class",
        severity: "high",
        message: "Student missed one or more scheduled live classes this week.",
        metadata: { missedCount },
      });
    }

    if (avgStudyHours < LOW_STUDY_HOURS_THRESHOLD) {
      await createParentAlerts({
        studentId: student.id,
        alertType: "low_study_activity",
        severity: "medium",
        message: "Study activity is unusually low this week.",
        metadata: { avgStudyHours: Number(avgStudyHours.toFixed(2)) },
      });
    }

    const recentAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      status: assignment.status,
      progress: assignment.progress,
      dueDate: assignment.dueDate,
    }));

    const completedAssignments = assignments.filter((assignment) => assignment.status === "completed").length;
    const completionRate = assignments.length ? Math.round((completedAssignments / assignments.length) * 100) : 0;

    const stressValues = student.allowWellnessShare
      ? dailyLogs.map((log) => (log.stressLevel === "High" ? 80 : log.stressLevel === "Medium" ? 55 : 30))
      : [];
    const sleepValues = student.allowWellnessShare ? dailyLogs.map((log) => Number(log.sleepHours || 0)) : [];
    const moodValues = student.allowWellnessShare ? dailyLogs.map((log) => Number(log.moodRating || 0)) : [];

    const average = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

    const productivityScore = Math.max(
      0,
      Math.min(
        100,
        Math.round((avgStudyHours * 10) + (completionRate * 0.4) + (Math.max(0, 8 - average(stressValues) / 10) * 5))
      )
    );

    const riskIndicators = [];
    if (avgStudyHours < LOW_STUDY_HOURS_THRESHOLD) riskIndicators.push("Low study consistency");
    if (completionRate < 45) riskIndicators.push("Low assignment completion");
    if (stressValues.length && average(stressValues) > 65) riskIndicators.push("High stress pattern");
    if (sleepValues.length && average(sleepValues) < 6) riskIndicators.push("Sleep debt risk");

    const burnoutSignals = [];
    if (stressValues.length && average(stressValues) > 70 && avgStudyHours > 6) {
      burnoutSignals.push("High output with sustained stress");
    }
    if (sleepValues.length && average(sleepValues) < 5.5 && moodValues.length && average(moodValues) < 5) {
      burnoutSignals.push("Low sleep and declining mood trend");
    }

    const latestLive = liveSessions[0] || null;

    res.json({
      student: {
        id: student.id,
        name: student.name,
        studentId: student.studentId,
      },
      status: {
        liveClassStatus: activeLive ? "Active" : "Not Active",
        engagementStatus: activeLive ? "In Class" : "Offline",
      },
      studyActivity: {
        totalStudyHours: Number(totalStudyHours.toFixed(1)),
        avgStudyHoursPerDay: Number(avgStudyHours.toFixed(1)),
        totalFocusMinutes,
        totalBreakMinutes,
        dailySeries: studyHoursSeries,
      },
      attendance: {
        totalScheduled: attendanceTotal,
        attended: attendedCount,
        missed: missedCount,
        rate: attendanceTotal ? Math.round((attendedCount / attendanceTotal) * 100) : 0,
      },
      liveSession: latestLive
        ? {
            joinTime: latestLive.joinTime,
            activeParticipationDuration: latestLive.activeSeconds,
            inactivityDuringSession: latestLive.inactiveSeconds,
            leaveTime: latestLive.leaveTime,
          }
        : null,
      academicPerformance: {
        assignmentCompletionRate: completionRate,
        productivityScore,
      },
      recentAssignments,
      wellness: student.allowWellnessShare
        ? {
            avgStress: Number(average(stressValues).toFixed(1)),
            avgSleepHours: Number(average(sleepValues).toFixed(1)),
            avgMood: Number(average(moodValues).toFixed(1)),
            trend: dailyLogs.slice(-7).map((log) => ({
              date: log.date,
              stressLevel: log.stressLevel,
              sleepHours: log.sleepHours,
              moodRating: log.moodRating,
            })),
          }
        : {
            privacyMode: true,
            message: "Student has restricted detailed wellness sharing.",
          },
      reports: {
        studyConsistency: Number((Math.min(1, avgStudyHours / 4) * 100).toFixed(0)),
        productivityTrends: productivityScore,
        riskIndicators,
        burnoutSignals,
      },
      today: todayLogs[0] || null,
    });
  } catch (error) {
    console.error("Parent dashboard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/alerts", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent || parent.approvalStatus !== "approved") {
      return res.status(403).json({ message: "Parent access not approved" });
    }

    const { from, to, q, limit } = req.query;
    const whereClause = { parentId: req.parentId };
    const createdAtRange = {};

    if (from) {
      const parsedFrom = new Date(from);
      if (!Number.isNaN(parsedFrom.getTime())) {
        createdAtRange[Op.gte] = parsedFrom;
      }
    }

    if (to) {
      const parsedTo = new Date(to);
      if (!Number.isNaN(parsedTo.getTime())) {
        createdAtRange[Op.lte] = parsedTo;
      }
    }

    if (Object.keys(createdAtRange).length) {
      whereClause.createdAt = createdAtRange;
    }

    const parsedLimit = Math.max(1, Math.min(200, Number(limit || 30)));

    const alerts = await ParentAlert.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parsedLimit,
    });

    const mapped = alerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        isRead: alert.isRead,
        createdAt: alert.createdAt,
        metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
      }));

    if (q && String(q).trim()) {
      const query = String(q).trim().toLowerCase();
      return res.json(
        mapped.filter((item) => {
          const text = `${item.alertType} ${item.severity} ${item.message}`.toLowerCase();
          return text.includes(query);
        })
      );
    }

    res.json(mapped);
  } catch (error) {
    console.error("Fetch parent alerts error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/alerts/:id/read", parentAuth, async (req, res) => {
  try {
    const alert = await ParentAlert.findOne({
      where: {
        id: req.params.id,
        parentId: req.parentId,
      },
    });

    if (!alert) return res.status(404).json({ message: "Alert not found" });

    await alert.update({ isRead: true });
    res.json({ message: "Alert marked as read" });
  } catch (error) {
    console.error("Mark alert read error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/reports", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent || parent.approvalStatus !== "approved" || !parent.linkedStudentId) {
      return res.status(403).json({ message: "Parent access not approved" });
    }

    const monthAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const logs = await DailyLog.findAll({
      where: {
        userId: parent.linkedStudentId,
        date: { [Op.gte]: monthAgo },
      },
      order: [["date", "ASC"]],
    });

    const sessions = await LiveSessionActivity.findAll({
      where: {
        studentId: parent.linkedStudentId,
        createdAt: { [Op.gte]: monthAgo },
      },
      order: [["createdAt", "ASC"]],
    });

    const weeklyBuckets = {};
    logs.forEach((log) => {
      const date = new Date(log.date);
      const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
      if (!weeklyBuckets[weekKey]) {
        weeklyBuckets[weekKey] = { study: 0, focus: 0, break: 0, count: 0 };
      }
      weeklyBuckets[weekKey].study += Number(log.studyHours || 0);
      weeklyBuckets[weekKey].focus += Number(log.focusMinutes || 0);
      weeklyBuckets[weekKey].break += Number(log.breakMinutes || 0);
      weeklyBuckets[weekKey].count += 1;
    });

    const weekly = Object.entries(weeklyBuckets).map(([week, data]) => ({
      week,
      avgStudyHours: Number((data.study / Math.max(1, data.count)).toFixed(2)),
      avgFocusMinutes: Number((data.focus / Math.max(1, data.count)).toFixed(1)),
      avgBreakMinutes: Number((data.break / Math.max(1, data.count)).toFixed(1)),
    }));

    const activeMinutes = sessions.reduce((sum, item) => sum + Math.round((item.activeSeconds || 0) / 60), 0);
    const inactiveMinutes = sessions.reduce((sum, item) => sum + Math.round((item.inactiveSeconds || 0) / 60), 0);

    const payload = {
      generatedAt: new Date(),
      weekly,
      engagement: {
        activeMinutes,
        inactiveMinutes,
      },
    };

    const { format } = req.query;
    if (String(format || "").toLowerCase() === "csv") {
      const header = ["week", "avgStudyHours", "avgFocusMinutes", "avgBreakMinutes"];
      const rows = weekly.map((row) => [row.week, row.avgStudyHours, row.avgFocusMinutes, row.avgBreakMinutes]);
      rows.push(["engagement_active_minutes", activeMinutes, "", ""]);
      rows.push(["engagement_inactive_minutes", inactiveMinutes, "", ""]);
      const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=parent-weekly-report.csv");
      return res.send(csv);
    }

    res.json(payload);
  } catch (error) {
    console.error("Parent reports error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/preferences/notifications", parentAuth, async (req, res) => {
  try {
    const [preferences] = await NotificationPreference.findOrCreate({
      where: { userId: req.parentId, role: "parent" },
      defaults: {
        userId: req.parentId,
        role: "parent",
        emailOn: true,
        smsOn: true,
        pushOn: false,
      },
    });

    res.json({
      notifyByEmail: !!preferences.emailOn,
      notifyByDashboard: !!preferences.smsOn,
      notifyByPush: !!preferences.pushOn,
    });
  } catch (error) {
    console.error("Fetch notification preferences error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/preferences/notifications", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const [preferences] = await NotificationPreference.findOrCreate({
      where: { userId: req.parentId, role: "parent" },
      defaults: { userId: req.parentId, role: "parent" },
    });

    const nextNotifyByEmail = toBoolean(req.body.notifyByEmail, !!parent.notifyByEmail);
    const nextNotifyByDashboard = toBoolean(req.body.notifyByDashboard, !!parent.notifyByDashboard);
    const nextNotifyByPush = toBoolean(req.body.notifyByPush, !!parent.notifyByPush);

    await parent.update({
      notifyByEmail: nextNotifyByEmail,
      notifyByDashboard: nextNotifyByDashboard,
      notifyByPush: nextNotifyByPush,
    });

    await preferences.update({
      emailOn: nextNotifyByEmail,
      smsOn: nextNotifyByDashboard,
      pushOn: nextNotifyByPush,
    });

    res.json({
      message: "Notification preferences updated",
      preferences: {
        notifyByEmail: !!nextNotifyByEmail,
        notifyByDashboard: !!nextNotifyByDashboard,
        notifyByPush: !!nextNotifyByPush,
      },
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/profile", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });
    return res.json({ parent: toParentPayload(parent) });
  } catch (error) {
    console.error("Fetch parent profile error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/profile", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const nextName = String(req.body?.name || parent.name).trim();
    const nextEmail = normalizeEmail(req.body?.email || parent.email);
    const nextPhone = req.body?.phone == null ? parent.phone : normalizePhone(req.body.phone);

    if (!nextName) return res.status(400).json({ message: "Name is required" });
    if (!nextEmail || !isValidEmail(nextEmail)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (nextEmail !== parent.email) {
      return res.status(400).json({ message: "Use contact verification flow to change email." });
    }

    if ((nextPhone || "") !== (parent.phone || "")) {
      return res.status(400).json({ message: "Use contact verification flow to change phone." });
    }

    await parent.update({ name: nextName });
    return res.json({ message: "Profile updated", parent: toParentPayload(parent) });
  } catch (error) {
    console.error("Update parent profile error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/contact/send-code", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "initial").trim().toLowerCase();
    const requestedTarget = String(req.body?.target || "").trim();

    if (!["email", "phone"].includes(channel)) {
      return res.status(400).json({ message: "channel must be email or phone" });
    }

    const isEmail = channel === "email";
    const currentTarget = isEmail ? parent.email : (parent.phone || "");
    let target = requestedTarget || currentTarget;
    if (isEmail) target = normalizeEmail(target);
    else target = normalizePhone(target);

    if (!target) return res.status(400).json({ message: `${channel} is required` });
    if (isEmail && !isValidEmail(target)) return res.status(400).json({ message: "Enter a valid email" });
    if (!isEmail && !isValidPhone(target)) return res.status(400).json({ message: "Enter a valid phone" });

    const now = new Date();
    if (purpose === "change-current" && target !== currentTarget) {
      return res.status(400).json({ message: `Current ${channel} does not match profile` });
    }

    if (purpose === "change-new") {
      const canChangeUntil = isEmail ? parent.canChangeEmailUntil : parent.canChangePhoneUntil;
      if (!canChangeUntil || new Date(canChangeUntil) < now) {
        return res.status(400).json({ message: `Verify current ${channel} first` });
      }
      if (target === currentTarget) {
        return res.status(400).json({ message: `New ${channel} must be different` });
      }
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiryDate();
    const updatePayload = isEmail
      ? { emailOtpCode: code, emailOtpTarget: target, emailOtpPurpose: purpose, emailOtpExpiresAt: expiresAt }
      : { phoneOtpCode: code, phoneOtpTarget: target, phoneOtpPurpose: purpose, phoneOtpExpiresAt: expiresAt };

    await parent.update(updatePayload);

    const message = `Your verification code is ${code}. It expires in 10 minutes.`;
    let delivery;
    if (isEmail) {
      delivery = await sendEmail({ to: target, subject: "SkillSpring parent verification code", text: message });
    } else {
      delivery = await sendSms({ to: target, text: message });
    }

    return res.json({
      message:
        delivery?.delivered === false
          ? `Verification code generated for ${channel}, but delivery is not configured yet.`
          : `Verification code sent to ${channel}`,
      channel,
      purpose,
      target,
      expiresAt,
      delivery,
      devCode:
        process.env.ALLOW_DEV_OTP_ECHO === "true" || delivery?.delivered === false ? code : undefined,
    });
  } catch (error) {
    console.error("Parent send contact code error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/contact/verify-code", parentAuth, async (req, res) => {
  try {
    const parent = await ParentUser.findByPk(req.parentId);
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();
    const purpose = String(req.body?.purpose || "initial").trim().toLowerCase();

    if (!["email", "phone"].includes(channel)) return res.status(400).json({ message: "Invalid channel" });
    if (!code) return res.status(400).json({ message: "Verification code is required" });

    const isEmail = channel === "email";
    const otpCode = isEmail ? parent.emailOtpCode : parent.phoneOtpCode;
    const otpTarget = isEmail ? parent.emailOtpTarget : parent.phoneOtpTarget;
    const otpPurpose = isEmail ? parent.emailOtpPurpose : parent.phoneOtpPurpose;
    const otpExpiry = isEmail ? parent.emailOtpExpiresAt : parent.phoneOtpExpiresAt;

    if (!otpCode || !otpTarget || !otpExpiry) return res.status(400).json({ message: "No active verification request" });
    if (otpCode !== code) return res.status(400).json({ message: "Invalid verification code" });
    if (new Date(otpExpiry) < new Date()) return res.status(400).json({ message: "Verification code expired" });
    if (otpPurpose !== purpose) return res.status(400).json({ message: "Verification purpose mismatch" });

    const clearOtp = isEmail
      ? { emailOtpCode: null, emailOtpTarget: null, emailOtpPurpose: null, emailOtpExpiresAt: null }
      : { phoneOtpCode: null, phoneOtpTarget: null, phoneOtpPurpose: null, phoneOtpExpiresAt: null };

    const applyPayload = { ...clearOtp };

    if (purpose === "initial") {
      if (isEmail) {
        applyPayload.email = normalizeEmail(otpTarget);
        applyPayload.emailVerified = true;
      } else {
        applyPayload.phone = normalizePhone(otpTarget);
        applyPayload.phoneVerified = true;
      }
    } else if (purpose === "change-current") {
      const unlockUntil = new Date(Date.now() + 10 * 60 * 1000);
      if (isEmail) applyPayload.canChangeEmailUntil = unlockUntil;
      else applyPayload.canChangePhoneUntil = unlockUntil;
    } else if (purpose === "change-new") {
      if (isEmail) {
        if (!parent.canChangeEmailUntil || new Date(parent.canChangeEmailUntil) < new Date()) {
          return res.status(400).json({ message: "Current email verification expired" });
        }
        const existingParent = await ParentUser.findOne({
          where: {
            id: { [Op.ne]: parent.id },
            [Op.or]: [where(fn("lower", col("email")), normalizeEmail(otpTarget))],
          },
        });
        if (existingParent) {
          return res.status(400).json({ message: "Email already in use" });
        }
        applyPayload.email = normalizeEmail(otpTarget);
        applyPayload.emailVerified = true;
        applyPayload.canChangeEmailUntil = null;
      } else {
        if (!parent.canChangePhoneUntil || new Date(parent.canChangePhoneUntil) < new Date()) {
          return res.status(400).json({ message: "Current phone verification expired" });
        }
        applyPayload.phone = normalizePhone(otpTarget);
        applyPayload.phoneVerified = true;
        applyPayload.canChangePhoneUntil = null;
      }
    }

    await parent.update(applyPayload);
    return res.json({ message: `${channel} verification successful`, parent: toParentPayload(parent) });
  } catch (error) {
    console.error("Parent verify contact code error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/student/live-session/activity", studentAuth, async (req, res) => {
  try {
    const { message, action = "suggested", kind = "suggestion", metadata = null } = req.body || {};
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      return res.status(400).json({ message: "Missing live session message" });
    }

    let session = await LiveSessionActivity.findOne({
      where: { studentId: req.userId, status: { [Op.in]: ["active", "inactive"] } },
      order: [["createdAt", "DESC"]],
    });

    if (!session) {
      session = await LiveSessionActivity.findOne({
        where: { studentId: req.userId },
        order: [["createdAt", "DESC"]],
      });
    }

    if (!session) {
      const parsedSessionId = Number(metadata?.sessionId || 0);
      const safeStudySessionId = Number.isFinite(parsedSessionId) && parsedSessionId > 0 ? parsedSessionId : null;

      session = await LiveSessionActivity.create({
        studentId: req.userId,
        studySessionId: safeStudySessionId,
        joinTime: new Date(),
        lastActiveAt: new Date(),
        leaveTime: new Date(),
        status: "ended",
        activityLog: "[]",
      });
    }

    const entry = {
      message: cleanMessage,
      action: String(action || "suggested"),
      kind: String(kind || "suggestion"),
      metadata: metadata || null,
      timestamp: new Date().toISOString(),
    };

    const currentLog = parseJsonArray(session.activityLog);
    const activityLog = [...currentLog, entry].slice(-100);

    await session.update({
      activityLog: JSON.stringify(activityLog),
    });

    res.json({
      message: "Live session activity saved",
      entry,
      activityLog,
      session,
    });
  } catch (error) {
    console.error("Live session activity error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
