const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

const ParentUser = require("../models/ParentUser");
const ParentAlert = require("../models/ParentAlert");
const LiveSessionActivity = require("../models/LiveSessionActivity");
const StudySession = require("../models/StudySession");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const ALERT_DEDUP_WINDOW_MS = 45 * 1000;
const ALERT_PERSIST_DEDUP_MINUTES = 15;
const SLEEP_INACTIVITY_SECONDS = Number(process.env.SLEEP_INACTIVITY_SECONDS || 10);
const SLEEPY_ALERT_SECONDS = Number(process.env.SLEEPY_ALERT_SECONDS || 10);
const INACTIVITY_MILESTONES_SECONDS = [60, 120, 180, 300];
const NO_FACE_MILESTONES_SECONDS = [45, 90, 150];
const SLEEP_STREAK_STAGES = [2, 4, 6];
const LOW_FOCUS_STAGES = [3, 6];
const LOW_FOCUS_THRESHOLD = 30;
const HIGH_STRESS_THRESHOLD = 70;

const activeStudents = new Map();
const recentAlertMap = new Map();

const toStudentRoom = (studentId) => `student:${studentId}`;
const toParentRoom = (parentId) => `parent:${parentId}`;

function cleanRecentAlerts() {
  const now = Date.now();
  for (const [key, at] of recentAlertMap.entries()) {
    if (now - at > ALERT_DEDUP_WINDOW_MS) {
      recentAlertMap.delete(key);
    }
  }
}

function canEmitAlert(studentId, alertType) {
  cleanRecentAlerts();
  const key = `${studentId}:${alertType}`;
  const lastAt = recentAlertMap.get(key);
  if (lastAt && Date.now() - lastAt < ALERT_DEDUP_WINDOW_MS) {
    return false;
  }
  recentAlertMap.set(key, Date.now());
  return true;
}

function getMilestone(seconds, thresholds) {
  let milestone = 0;
  for (const threshold of thresholds) {
    if (seconds >= threshold) {
      milestone = threshold;
    }
  }
  return milestone;
}

function getStage(streak, thresholds) {
  let stage = 0;
  for (const threshold of thresholds) {
    if (streak >= threshold) {
      stage = threshold;
    }
  }
  return stage;
}

function toIso(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

async function fetchApprovedParents(studentId) {
  return ParentUser.findAll({
    where: {
      linkedStudentId: studentId,
      approvalStatus: "approved",
    },
  });
}

async function createAlertRecords(studentId, alertType, severity, message, metadata) {
  const parents = await fetchApprovedParents(studentId);
  if (!parents.length) return [];

  const createdAlerts = [];
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
          [Op.gte]: new Date(Date.now() - ALERT_PERSIST_DEDUP_MINUTES * 60 * 1000),
        },
      },
    });

    if (existing) {
      createdAlerts.push(existing);
      continue;
    }

    if (dashboardEnabled) {
      const alert = await ParentAlert.create({
        parentId: parent.id,
        studentId,
        alertType,
        severity,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        deliveredByEmail: false,
      });

      createdAlerts.push(alert);
    }
  }

  return createdAlerts;
}

async function emitParentAlert(io, studentId, alertType, severity, message, metadata) {
  const alerts = await createAlertRecords(studentId, alertType, severity, message, metadata);
  const parentPayload = {
    alertType,
    severity,
    message,
    metadata: metadata || null,
    createdAt: new Date(),
  };

  const parents = await fetchApprovedParents(studentId);
  for (const parent of parents) {
    const dashboardEnabled = parent.notifyByDashboard !== false;
    if (dashboardEnabled) {
      io.to(toParentRoom(parent.id)).emit("parent_realtime_alert", parentPayload);
    }
  }

  return alerts;
}

async function ensureActiveSession(studentId, sessionId) {
  const student = await User.findByPk(Number(studentId));
  if (!student) {
    throw new Error("Student not found for realtime session");
  }

  const existing = await LiveSessionActivity.findOne({
    where: { studentId, status: "active" },
    order: [["createdAt", "DESC"]],
  });

  if (existing) return existing;

  let validStudySessionId = null;
  if (sessionId) {
    const maybeSession = await StudySession.findOne({
      where: {
        id: Number(sessionId),
        userId: Number(studentId),
      },
    });

    if (maybeSession) {
      validStudySessionId = maybeSession.id;
    }
  }

  return LiveSessionActivity.create({
    studentId,
    studySessionId: validStudySessionId,
    joinTime: new Date(),
    lastActiveAt: new Date(),
    status: "active",
  });
}

async function markStudentOffline(io, studentId, reason = "offline") {
  if (!studentId) return;

  const state = activeStudents.get(String(studentId));
  activeStudents.delete(String(studentId));

  const session = await LiveSessionActivity.findOne({
    where: {
      studentId,
      status: { [Op.in]: ["active", "inactive"] },
    },
    order: [["createdAt", "DESC"]],
  });

  if (session) {
    await session.update({
      leaveTime: new Date(),
      status: "ended",
    });
  }

  io.to(toStudentRoom(studentId)).emit("student_status_update", {
    studentId,
    status: "offline",
    reason,
    endedAt: new Date().toISOString(),
  });

  if (canEmitAlert(studentId, "student_offline")) {
    await emitParentAlert(
      io,
      studentId,
      reason === "tab_closed" ? "student_tab_closed" : "student_left_class",
      "high",
      reason === "tab_closed"
        ? "Student appears to have closed the study tab."
        : "Student went offline during a live session.",
      {
        reason,
        lastActivityAt: state?.lastActivityAt || null,
      }
    );
  }
}

function initializeRealtimeServer(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.auth = decoded;
      return next();
    } catch (error) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const role = socket.auth?.role || "student";

    if (role === "parent") {
      socket.join(toParentRoom(socket.auth.parentId));
    }

    socket.on("parent_subscribe", async (payload = {}) => {
      if (role !== "parent") return;
      const requestedStudentId = Number(payload.studentId || socket.auth.studentId || 0);
      if (!requestedStudentId) return;

      const parent = await ParentUser.findByPk(socket.auth.parentId);
      if (!parent || parent.approvalStatus !== "approved" || Number(parent.linkedStudentId) !== requestedStudentId) {
        socket.emit("socket_error", { message: "Not authorized to subscribe to this student" });
        return;
      }

      socket.join(toStudentRoom(requestedStudentId));

      const live = activeStudents.get(String(requestedStudentId));
      socket.emit("student_status_update", {
        studentId: requestedStudentId,
        status: live ? live.status : "offline",
        sessionId: live?.sessionId || null,
        startedAt: live?.startedAt || null,
        lastActivityAt: live?.lastActivityAt || null,
      });
    });

    socket.on("student_online", async (payload = {}) => {
      try {
        if (role !== "student") return;

        const studentId = Number(payload.studentId || socket.auth.userId || 0);
        if (!studentId || studentId !== Number(socket.auth.userId)) {
          socket.emit("socket_error", { message: "Invalid student identity" });
          return;
        }

        const sessionId = payload.sessionId ? Number(payload.sessionId) : null;
        const activeSession = await ensureActiveSession(studentId, sessionId);
        socket.join(toStudentRoom(studentId));

      const state = {
        studentId,
        sessionId: sessionId || activeSession.studySessionId || null,
        startedAt: activeSession.joinTime || new Date(),
        lastActivityAt: new Date(),
        status: "studying",
        lastInactivityDuration: 0,
        focusLevel: 0,
        cameraStatus: "active",
        sleepStreak: 0,
        lowFocusStreak: 0,
        recoveryStreak: 0,
        lastInactivityMilestone: 0,
        lastNoFaceMilestone: 0,
        lastSleepStage: 0,
        lastLowFocusStage: 0,
        recentSleepRisk: false,
        sleepyForSeconds: 0,
        sleepy10Alerted: false,
        drowsyAlarmAlerted: false,
      };
      activeStudents.set(String(studentId), state);

      io.to(toStudentRoom(studentId)).emit("student_status_update", {
        studentId,
        status: "studying",
        sessionId: state.sessionId,
        startedAt: state.startedAt,
      });

        if (canEmitAlert(studentId, "student_joined")) {
          await emitParentAlert(
            io,
            studentId,
            "student_joined_class",
            "low",
            "Student joined a live study session.",
            { sessionId: state.sessionId }
          );
        }
      } catch (error) {
        console.error("student_online realtime error:", error);
        socket.emit("socket_error", { message: "Unable to start live session" });
      }
    });

    socket.on("student_activity", async (payload = {}) => {
      try {
        if (role !== "student") return;

        const studentId = Number(payload.studentId || socket.auth.userId || 0);
        if (!studentId || studentId !== Number(socket.auth.userId)) {
          socket.emit("socket_error", { message: "Invalid student identity" });
          return;
        }

      const now = Date.now();
      const state = activeStudents.get(String(studentId)) || {
        studentId,
        sessionId: null,
        startedAt: new Date(now),
        lastActivityAt: new Date(now),
        status: "studying",
        lastInactivityDuration: 0,
        focusLevel: 0,
        cameraStatus: "active",
        sleepStreak: 0,
        lowFocusStreak: 0,
        recoveryStreak: 0,
        lastInactivityMilestone: 0,
        lastNoFaceMilestone: 0,
        lastSleepStage: 0,
        lastLowFocusStage: 0,
        recentSleepRisk: false,
        sleepyForSeconds: 0,
        sleepy10Alerted: false,
        drowsyAlarmAlerted: false,
      };

      const nextInactivity = Math.max(0, Number(payload.inactivityDuration || 0));
      const focusLevel = Math.max(0, Math.min(100, Number(payload.focusLevel || 0)));
      const cameraStatus = String(payload.cameraStatus || "active");
      const sleepDetection = Boolean(payload.sleepDetection);
      const typingActivity = Boolean(payload.typingActivity);
      const stressScore = Math.max(0, Math.min(100, Number(payload.stressScore || 0)));
      const fatigueScore = Math.max(0, Math.min(100, Number(payload.fatigueScore || 0)));
      const noFaceSeconds = Math.max(0, Number(payload.noFaceSeconds || 0));

      const previousAt = new Date(state.lastActivityAt || now).getTime();
      const deltaSeconds = Math.max(0, Math.round((now - previousAt) / 1000));
      state.lastActivityAt = new Date(now);
      state.focusLevel = focusLevel;
      state.cameraStatus = cameraStatus;
      state.lastInactivityDuration = nextInactivity;
      state.status = cameraStatus === "tab_closed" ? "offline" : nextInactivity > 12 ? "idle" : "studying";

      const sleepRiskSignal =
        sleepDetection ||
        (nextInactivity >= SLEEP_INACTIVITY_SECONDS && cameraStatus !== "active") ||
        fatigueScore >= HIGH_STRESS_THRESHOLD;
      state.sleepStreak = sleepRiskSignal ? state.sleepStreak + 1 : 0;
      state.sleepyForSeconds = sleepRiskSignal ? state.sleepyForSeconds + deltaSeconds : 0;

      if (sleepRiskSignal && !state.drowsyAlarmAlerted && canEmitAlert(studentId, "drowsy_alarm_activated")) {
        state.drowsyAlarmAlerted = true;

        const alertPayload = {
          studentId,
          inactivityDuration: nextInactivity,
          message: "Drowsy alarm activated. Student may be sleepy right now.",
          timestamp: new Date().toISOString(),
        };

        io.to(toStudentRoom(studentId)).emit("student_sleeping_alert", alertPayload);
        await emitParentAlert(
          io,
          studentId,
          "student_drowsy_alarm_activated",
          "high",
          "Drowsy alarm activated: your child appears sleepy. Please ask them to drink water or have a light snack and take a short reset break.",
          {
            inactivityDuration: nextInactivity,
            focusLevel,
            fatigueScore,
            cameraStatus,
            lastActivityAt: toIso(state.lastActivityAt),
          }
        );
      }

      if (!sleepRiskSignal) {
        state.sleepy10Alerted = false;
        state.drowsyAlarmAlerted = false;
      }

      if (
        state.sleepyForSeconds >= SLEEPY_ALERT_SECONDS &&
        !state.sleepy10Alerted &&
        canEmitAlert(studentId, "student_sleepy_10s")
      ) {
        state.sleepy10Alerted = true;
        await emitParentAlert(
          io,
          studentId,
          "student_sleepy_10s",
          "high",
          `Your child has shown sleepy behavior for at least ${SLEEPY_ALERT_SECONDS} seconds.`,
          {
            sleepyForSeconds: state.sleepyForSeconds,
            inactivityDuration: nextInactivity,
            focusLevel,
            fatigueScore,
            cameraStatus,
            lastActivityAt: toIso(state.lastActivityAt),
          }
        );
      }

      const lowFocusSignal =
        focusLevel <= LOW_FOCUS_THRESHOLD &&
        nextInactivity >= 15 &&
        (!typingActivity || stressScore >= HIGH_STRESS_THRESHOLD);
      state.lowFocusStreak = lowFocusSignal ? state.lowFocusStreak + 1 : 0;

      const recoveredSignal = focusLevel >= 45 && nextInactivity < 15 && typingActivity && cameraStatus === "active";
      state.recoveryStreak = recoveredSignal ? state.recoveryStreak + 1 : 0;

        activeStudents.set(String(studentId), state);

      io.to(toStudentRoom(studentId)).emit("student_activity_update", {
        studentId,
        focusLevel,
        cameraStatus,
        typingActivity,
        sleepDetection,
        stressScore,
        fatigueScore,
        noFaceSeconds,
        inactivityDuration: nextInactivity,
        status: state.status,
        timestamp: new Date(now).toISOString(),
      });

        const session = await ensureActiveSession(studentId, state.sessionId);
        const isInactive = nextInactivity > 12 || !typingActivity || cameraStatus !== "active";
        await session.update({
          lastActiveAt: new Date(now),
          activeSeconds: session.activeSeconds + (isInactive ? 0 : deltaSeconds),
          inactiveSeconds: session.inactiveSeconds + (isInactive ? deltaSeconds : 0),
          status: isInactive ? "inactive" : "active",
        });

        if (cameraStatus === "tab_closed") {
          await markStudentOffline(io, studentId, "tab_closed");
          return;
        }

      const inactivityMilestone = getMilestone(nextInactivity, INACTIVITY_MILESTONES_SECONDS);
      if (inactivityMilestone > state.lastInactivityMilestone && canEmitAlert(studentId, `inactive_${inactivityMilestone}`)) {
        state.lastInactivityMilestone = inactivityMilestone;
        const alertPayload = {
          studentId,
          inactivityDuration: nextInactivity,
          message: `Student inactive for ${Math.round(nextInactivity)} seconds during live session.`,
          timestamp: new Date().toISOString(),
        };

        io.to(toStudentRoom(studentId)).emit("student_sleeping_alert", alertPayload);
        await emitParentAlert(
          io,
          studentId,
          `student_inactive_${inactivityMilestone}s`,
          inactivityMilestone >= 180 ? "high" : "medium",
          inactivityMilestone >= 180
            ? `Your child has been inactive for ${Math.round(nextInactivity)} seconds and may have disengaged from the session.`
            : `Your child has been inactive for ${Math.round(nextInactivity)} seconds during the live study session.`,
          {
            inactivityDuration: nextInactivity,
            cameraStatus,
            typingActivity,
            focusLevel,
            stressScore,
            fatigueScore,
          }
        );
      }

      const sleepStage = getStage(state.sleepStreak, SLEEP_STREAK_STAGES);
      if (sleepStage > state.lastSleepStage && canEmitAlert(studentId, `sleep_stage_${sleepStage}`)) {
        state.lastSleepStage = sleepStage;
        state.recentSleepRisk = true;

        const alertPayload = {
          studentId,
          inactivityDuration: nextInactivity,
          message: "Sleep-like behavior detected during live study session.",
          timestamp: new Date().toISOString(),
        };

        io.to(toStudentRoom(studentId)).emit("student_sleeping_alert", alertPayload);
        await emitParentAlert(
          io,
          studentId,
          sleepStage >= 4 ? "student_sleeping_confirmed" : "student_sleeping_suspected",
          "high",
          sleepStage >= 4
            ? "Your child appears to be sleeping during the live class (sustained sleep pattern)."
            : "Your child may be falling asleep during the live class.",
          {
            inactivityDuration: nextInactivity,
            sleepDetection: true,
            sleepStreak: state.sleepStreak,
            noFaceSeconds,
            fatigueScore,
            cameraStatus,
            lastActivityAt: toIso(state.lastActivityAt),
          }
        );
      }

      const noFaceMilestone = getMilestone(noFaceSeconds, NO_FACE_MILESTONES_SECONDS);
      if (noFaceMilestone > state.lastNoFaceMilestone && canEmitAlert(studentId, `no_face_${noFaceMilestone}`)) {
        state.lastNoFaceMilestone = noFaceMilestone;
        await emitParentAlert(
          io,
          studentId,
          `camera_no_face_${noFaceMilestone}s`,
          noFaceMilestone >= 90 ? "high" : "medium",
          `Face not detected for ${Math.round(noFaceSeconds)} seconds during live session. Student may have left the camera view.`,
          {
            noFaceSeconds,
            inactivityDuration: nextInactivity,
            cameraStatus,
          }
        );
      }

      const lowFocusStage = getStage(state.lowFocusStreak, LOW_FOCUS_STAGES);
      if (lowFocusStage > state.lastLowFocusStage && canEmitAlert(studentId, `low_focus_${lowFocusStage}`)) {
        state.lastLowFocusStage = lowFocusStage;
        await emitParentAlert(
          io,
          studentId,
          "student_low_focus_streak",
          "medium",
          "Your child is showing sustained low focus in the live session.",
          {
            focusLevel,
            inactivityDuration: nextInactivity,
            lowFocusStreak: state.lowFocusStreak,
            stressScore,
            fatigueScore,
          }
        );
      }

      if (state.recentSleepRisk && state.recoveryStreak >= 2 && canEmitAlert(studentId, "recovered_focus")) {
        state.recentSleepRisk = false;
        state.sleepStreak = 0;
        state.lastSleepStage = 0;
        await emitParentAlert(
          io,
          studentId,
          "student_recovered_focus",
          "low",
          "Good update: your child appears active and focused again in the live session.",
          {
            focusLevel,
            inactivityDuration: nextInactivity,
            recoveredAt: new Date().toISOString(),
          }
        );
      }

      if (nextInactivity < 20) {
        state.lastInactivityMilestone = 0;
      }

      if (noFaceSeconds < 15) {
        state.lastNoFaceMilestone = 0;
      }

      if (!lowFocusSignal) {
        state.lastLowFocusStage = 0;
      }

        activeStudents.set(String(studentId), state);
      } catch (error) {
        console.error("student_activity realtime error:", error);
        socket.emit("socket_error", { message: "Live activity update failed" });
      }
    });

    socket.on("student_offline", async (payload = {}) => {
      if (role !== "student") return;
      const studentId = Number(payload.studentId || socket.auth.userId || 0);
      if (!studentId || studentId !== Number(socket.auth.userId)) return;

      const reason = payload.reason ? String(payload.reason) : "offline";
      await markStudentOffline(io, studentId, reason);
    });

    socket.on("disconnect", async () => {
      if (role !== "student") return;
      const studentId = Number(socket.auth.userId || 0);
      if (!studentId) return;
      await markStudentOffline(io, studentId, "socket_disconnected");
    });
  });

  console.log("[realtime] Socket.IO server initialized");
  return io;
}

module.exports = {
  initializeRealtimeServer,
};
