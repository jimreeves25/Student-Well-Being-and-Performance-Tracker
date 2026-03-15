const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { Op, fn, col, where } = require("sequelize");

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeStudentId = (value = "") => String(value).trim();

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

    if (!identity || !password) {
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
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
