const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const ParentLinkRequest = require("../models/ParentLinkRequest");
const DailyLog = require("../models/DailyLog");
const StudySession = require("../models/StudySession");
const LiveSessionActivity = require("../models/LiveSessionActivity");
const ParentAlert = require("../models/ParentAlert");
const Assignment = require("../models/Assignment");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const LOW_STUDY_HOURS_THRESHOLD = 1.5;
const INACTIVE_SECONDS_THRESHOLD = 600;

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

const sendEmailNotification = async ({ to, subject, message }) => {
  // Stub: wired for future SMTP provider integration.
  console.log("[email-notification]", { to, subject, message });
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

    const alert = await ParentAlert.create({
      parentId: parent.id,
      studentId,
      alertType,
      severity,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
      deliveredByEmail: false,
    });

    if (parent.notifyByEmail) {
      await sendEmailNotification({
        to: parent.email,
        subject: `Student Monitoring Alert: ${alertType}`,
        message,
      });
      await alert.update({ deliveredByEmail: true });
    }
  }
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, studentId, verificationCode } = req.body;

    if (!name || !email || !password || !studentId || !verificationCode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingParent = await ParentUser.findOne({ where: { email } });
    if (existingParent) {
      return res.status(400).json({ message: "Parent account already exists" });
    }

    const student = await User.findOne({ where: { studentId } });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const codeExpired = !student.parentLinkCodeExpiresAt || new Date(student.parentLinkCodeExpiresAt) < new Date();
    const codeInvalid = student.parentLinkCode !== verificationCode;
    if (codeExpired || codeInvalid) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const parent = await ParentUser.create({
      name,
      email,
      password: hashedPassword,
      approvalStatus: "pending",
      linkedStudentId: null,
    });

    await ParentLinkRequest.create({
      parentId: parent.id,
      studentId: student.id,
      verificationCode,
      status: "pending",
    });

    res.status(201).json({
      message: "Parent account created. Waiting for student approval.",
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        approvalStatus: parent.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Parent signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const parent = await ParentUser.findOne({ where: { email } });

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
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        approvalStatus: parent.approvalStatus,
        linkedStudentId: parent.linkedStudentId,
      },
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

    const alerts = await ParentAlert.findAll({
      where: { parentId: req.parentId },
      order: [["createdAt", "DESC"]],
      limit: 30,
    });

    res.json(
      alerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        isRead: alert.isRead,
        createdAt: alert.createdAt,
        metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
      }))
    );
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

    res.json({
      generatedAt: new Date(),
      weekly,
      engagement: {
        activeMinutes,
        inactiveMinutes,
      },
    });
  } catch (error) {
    console.error("Parent reports error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
