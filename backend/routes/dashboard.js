const express = require("express");
const router = express.Router();
const DailyLog = require("../models/DailyLog");
const StudySession = require("../models/StudySession");
const { Op } = require("sequelize");

const jwt = require("jsonwebtoken");

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

    // Get logs from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await DailyLog.findAll({
      where: {
        userId,
        date: { [Op.gte]: sevenDaysAgo },
      },
      order: [["date", "DESC"]],
    });

    // Get today's log
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLog = await DailyLog.findOne({
      where: {
        userId,
        date: { [Op.gte]: today },
      },
    });

    // Get upcoming study sessions
    let upcomingSessions = await StudySession.findAll({
      where: {
        userId,
        scheduledDate: { [Op.gte]: new Date() },
        completed: false,
      },
      order: [["scheduledDate", "ASC"]],
      limit: 5,
    });

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

    const avgStudyHours = logs.length
      ? logs.reduce((sum, log) => sum + log.studyHours, 0) / logs.length
      : 0;
    const avgSleepHours = logs.length
      ? logs.reduce((sum, log) => sum + log.sleepHours, 0) / logs.length
      : 0;
    const avgScreenTime = logs.length
      ? logs.reduce((sum, log) => sum + log.screenTime, 0) / logs.length
      : 0;
    const avgExercise = logs.length
      ? logs.reduce((sum, log) => sum + log.exerciseMinutes, 0) / logs.length
      : 0;
    const avgFocusMinutes = logs.length
      ? logs.reduce((sum, log) => sum + (log.focusMinutes || 0), 0) / logs.length
      : 0;
    const avgBreakMinutes = logs.length
      ? logs.reduce((sum, log) => sum + (log.breakMinutes || 0), 0) / logs.length
      : 0;

    // Calculate stress index (0-100)
    let stressIndex = 50; // default medium
    if (todayLog) {
      const stressFactors = {
        Low: 20,
        Medium: 50,
        High: 80,
      };
      const sleepFactor = todayLog.sleepHours < 6 ? 20 : todayLog.sleepHours > 8 ? -10 : 0;
      const exerciseFactor = todayLog.exerciseMinutes > 30 ? -15 : 10;
      const screenFactor = todayLog.screenTime > 8 ? 15 : 0;

      stressIndex = Math.max(
        0,
        Math.min(100, stressFactors[todayLog.stressLevel] + sleepFactor + exerciseFactor + screenFactor)
      );
    }

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
      stressCategory,
      upcomingSessions,
      recommendations,
      recentLogs: logs.slice(0, 7),
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
