const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Op, fn, col, where } = require("sequelize");

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeStudentId = (value = "") => String(value).trim();

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

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, studentId, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedStudentId = normalizeStudentId(studentId);
    const normalizedName = String(name || "").trim();

    if (!normalizedName || !normalizedStudentId || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          where(fn("lower", col("email")), normalizedEmail),
          where(fn("lower", col("studentId")), normalizedStudentId.toLowerCase()),
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name: normalizedName,
      studentId: normalizedStudentId,
      email: normalizedEmail,
      password: hashedPassword,
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, studentId: user.studentId, role: "student" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Signup successful",
      role: "student",
      token,
      user: {
        id: user.id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const identity = String(email || "").trim();

    console.log("[AUTH] Login attempt", {
      identity,
      hasPassword: Boolean(password),
    });

    if (!identity || !password) {
      console.warn("[AUTH] Missing credentials in login request");
      return res.status(400).json({ message: "Missing credentials" });
    }

    // Find user
    const user = await User.findOne({
      where: {
        [Op.or]: [
          where(fn("lower", col("email")), identity.toLowerCase()),
          where(fn("lower", col("studentId")), identity.toLowerCase()),
        ],
      },
    });

    console.log("[AUTH] User lookup result", {
      identity,
      found: Boolean(user),
      userId: user?.id || null,
    });

    if (!user) {
      console.warn("[AUTH] Login failed: user not found", { identity });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    let isMatch = false;

    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fallback for legacy plain-text records; migrate on successful login.
      isMatch = password === user.password;
      if (isMatch) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await user.update({ password: hashedPassword });
        console.log("[AUTH] Migrated legacy plain-text password to bcrypt hash", {
          userId: user.id,
          email: user.email,
        });
      }
    }

    if (!isMatch) {
      console.warn("[AUTH] Login failed: password mismatch", {
        identity,
        userId: user.id,
      });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, studentId: user.studentId, role: "student" },
      process.env.JWT_SECRET || "your_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      role: "student",
      token,
      user: {
        id: user.id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
      },
    });
    console.log("[AUTH] Login success", { userId: user.id, email: user.email });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current and new password are required."
      });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect."
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      message: "Server error.",
      error: error.message
    });
  }
});

module.exports = router;
