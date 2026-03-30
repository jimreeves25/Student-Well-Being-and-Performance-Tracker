const express = require("express");
const router = express.Router();
const DailyLog = require("../models/DailyLog");
const StudySession = require("../models/StudySession");
const { Op } = require("sequelize");

const jwt = require("jsonwebtoken");

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const avg = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stressLabelToScore = (label = "Medium") => {
  const map = { Low: 25, Medium: 55, High: 85 };
  return map[label] ?? 55;
};

const trainAdaptiveStressWeights = (logs = []) => {
  const defaults = {
    sleepWeight: 1,
    moodWeight: 1,
    exerciseWeight: 1,
    stressInputWeight: 1,
  };

  if (logs.length < 5) return defaults;

  const highStressCutoff = 70;
  const lowStressCutoff = 50;

  const lowSleepLogs = logs.filter((log) => Number(log.sleepHours || 0) < 6);
  const lowSleepHighStressRate = lowSleepLogs.length
    ? lowSleepLogs.filter((log) => stressLabelToScore(log.stressLevel) >= highStressCutoff).length / lowSleepLogs.length
    : 0;

  const lowMoodLogs = logs.filter((log) => Number(log.moodRating || 0) <= 4);
  const lowMoodHighStressRate = lowMoodLogs.length
    ? lowMoodLogs.filter((log) => stressLabelToScore(log.stressLevel) >= highStressCutoff).length / lowMoodLogs.length
    : 0;

  const activeLogs = logs.filter((log) => Number(log.exerciseMinutes || 0) >= 30);
  const activeLowStressRate = activeLogs.length
    ? activeLogs.filter((log) => stressLabelToScore(log.stressLevel) <= lowStressCutoff).length / activeLogs.length
    : 0;

  return {
    sleepWeight: 1 + (lowSleepHighStressRate * 0.4),
    moodWeight: 1 + (lowMoodHighStressRate * 0.35),
    exerciseWeight: 1 + (activeLowStressRate * 0.3),
    stressInputWeight: 1.05,
  };
};

const computeStressIndexFromLog = (log, weights) => {
  if (!log) return 50;

  const sleepHours = Number(log.sleepHours || 0);
  const moodRating = Number(log.moodRating || 5);
  const exerciseMinutes = Number(log.exerciseMinutes || 0);
  const stressSignal = stressLabelToScore(log.stressLevel);

  const sleepPenalty = clamp((7.5 - sleepHours) * 12, 0, 45) * weights.sleepWeight;
  const moodPenalty = clamp((6 - moodRating) * 8, 0, 35) * weights.moodWeight;
  const exerciseRelief = clamp(exerciseMinutes * 0.22, 0, 20) * weights.exerciseWeight;
  const stressInput = ((stressSignal - 50) * 0.6) * weights.stressInputWeight;

  const score = 35 + sleepPenalty + moodPenalty + stressInput - exerciseRelief;
  return Math.round(clamp(score, 0, 100));
};

const computeAcademicScore = (sessions = []) => {
  if (!sessions.length) {
    return {
      academicScore: 0,
      academicBreakdown: {
        durationScore: 0,
        consistencyScore: 0,
        completionScore: 0,
      },
    };
  }

  const totalDurationMinutes = sessions.reduce((sum, session) => sum + Number(session.duration || 0), 0);
  const uniqueStudyDays = new Set(
    sessions.map((session) => new Date(session.scheduledDate || session.createdAt).toISOString().slice(0, 10))
  ).size;
  const completedCount = sessions.filter((session) => session.completed).length;

  // 30-day target benchmarks.
  const durationScore = clamp((totalDurationMinutes / 1800) * 100, 0, 100); // ~60 min/day
  const consistencyScore = clamp((uniqueStudyDays / 20) * 100, 0, 100); // active on ~20+ days/month
  const completionScore = clamp((completedCount / Math.max(1, sessions.length)) * 100, 0, 100);

  const academicScore = Math.round(
    clamp((durationScore * 0.5) + (consistencyScore * 0.35) + (completionScore * 0.15), 0, 100)
  );

  return {
    academicScore,
    academicBreakdown: {
      durationScore: Math.round(durationScore),
      consistencyScore: Math.round(consistencyScore),
      completionScore: Math.round(completionScore),
    },
  };
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Get dashboard summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [weeklyLogs, allRecentLogs, todayLog, recentSessions, upcomingSessionRows] = await Promise.all([
      DailyLog.findAll({
        where: {
          userId,
          date: { [Op.gte]: sevenDaysAgo },
        },
        order: [["date", "DESC"]],
      }),
      DailyLog.findAll({
        where: {
          userId,
          date: { [Op.gte]: thirtyDaysAgo },
        },
        order: [["date", "DESC"]],
      }),
      DailyLog.findOne({
        where: {
          userId,
          date: { [Op.gte]: todayStart },
        },
        order: [["date", "DESC"]],
      }),
      StudySession.findAll({
        where: {
          userId,
          scheduledDate: { [Op.gte]: thirtyDaysAgo },
        },
        order: [["scheduledDate", "DESC"]],
      }),
      StudySession.findAll({
        where: {
          userId,
          scheduledDate: { [Op.gte]: now },
          completed: false,
        },
        order: [["scheduledDate", "ASC"]],
        limit: 5,
      }),
    ]);

    let upcomingSessions = upcomingSessionRows;

    if (upcomingSessions.length === 0) {
      upcomingSessions = await StudySession.findAll({
        where: {
          userId,
          completed: false,
        },
        order: [["scheduledDate", "DESC"]],
        limit: 5,
      });
    }

    const avgStudyHours = avg(weeklyLogs.map((log) => Number(log.studyHours || 0)));
    const avgSleepHours = avg(weeklyLogs.map((log) => Number(log.sleepHours || 0)));
    const avgScreenTime = avg(weeklyLogs.map((log) => Number(log.screenTime || 0)));
    const avgExercise = avg(weeklyLogs.map((log) => Number(log.exerciseMinutes || 0)));
    const avgFocusMinutes = avg(weeklyLogs.map((log) => Number(log.focusMinutes || 0)));
    const avgBreakMinutes = avg(weeklyLogs.map((log) => Number(log.breakMinutes || 0)));

    // Lightweight on-the-fly adaptive model trained from user's recent logs.
    const stressModelWeights = trainAdaptiveStressWeights(allRecentLogs);
    const stressSourceLogs = todayLog ? [todayLog] : allRecentLogs.slice(0, 7);
    const stressScores = stressSourceLogs.map((log) => computeStressIndexFromLog(log, stressModelWeights));
    const stressIndex = stressScores.length ? Math.round(avg(stressScores)) : 50;

    // Determine stress level category
    let stressCategory = "Medium";
    if (stressIndex < 35) stressCategory = "Low";
    else if (stressIndex > 65) stressCategory = "High";

    // Generate recommendations
    const recommendations = [];
    if (avgSleepHours < 7) {
      recommendations.push("Try to get at least 7-8 hours of sleep for better performance");
    }
    if (avgExercise < 30) {
      recommendations.push("Aim for at least 30 minutes of exercise daily");
    }
    if (avgScreenTime > 8) {
      recommendations.push("Consider reducing screen time for better eye health");
    }
    if (avgStudyHours < 4) {
      recommendations.push("Increase study time to improve academic performance");
    }

    const { academicScore, academicBreakdown } = computeAcademicScore(recentSessions);

    res.json({
      todayLog: todayLog || null,
      weeklyStats: {
        avgStudyHours: parseFloat(avgStudyHours.toFixed(1)),
        avgSleepHours: parseFloat(avgSleepHours.toFixed(1)),
        avgScreenTime: parseFloat(avgScreenTime.toFixed(1)),
        avgExercise: parseFloat(avgExercise.toFixed(1)),
        avgFocusMinutes: parseFloat(avgFocusMinutes.toFixed(1)),
        avgBreakMinutes: parseFloat(avgBreakMinutes.toFixed(1)),
      },
      stressIndex: Math.round(stressIndex),
      academicScore,
      academicBreakdown,
      stressCategory,
      upcomingSessions,
      recommendations,
      recentLogs: weeklyLogs.slice(0, 7),
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create or update daily log
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const logData = req.body;

    // Check if log for today exists
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let log = await DailyLog.findOne({
      where: {
        userId,
        date: { [Op.gte]: today },
      },
    });

    if (log) {
      // Update existing log
      await log.update(logData);
    } else {
      // Create new log
      log = await DailyLog.create({
        userId,
        date: new Date(),
        ...logData,
      });
    }

    res.json({
      message: "Daily log saved successfully",
      log,
    });
  } catch (error) {
    console.error("Save log error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all logs
router.get("/logs", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const logs = await DailyLog.findAll({
      where: { userId },
      order: [["date", "DESC"]],
      limit: 30,
    });
    res.json(logs);
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create study session
router.post("/study-session", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { subject, scheduledDate, duration, notes } = req.body;

    console.log("Creating study session:", { userId, subject, scheduledDate, duration, notes });

    // Validate required fields
    if (!subject || !scheduledDate || !duration) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        received: { subject, scheduledDate, duration } 
      });
    }

    const session = await StudySession.create({
      userId,
      subject,
      scheduledDate: new Date(scheduledDate),
      duration: parseInt(duration),
      notes: notes || "",
    });

    console.log("Study session created successfully:", session.id);

    res.status(201).json({
      message: "Study session created successfully",
      session,
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get study sessions
router.get("/study-sessions", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const sessions = await StudySession.findAll({
      where: { userId },
      order: [["scheduledDate", "DESC"]],
    });
    res.json(sessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/study-session/:id/complete", authMiddleware, async (req, res) => {
  try {
    const session = await StudySession.findOne({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    await session.update({ completed: true });

    res.json({
      message: "Session marked as completed",
      session,
    });
  } catch (error) {
    console.error("Complete session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
