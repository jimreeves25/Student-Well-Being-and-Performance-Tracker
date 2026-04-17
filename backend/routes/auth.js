const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const ContactVerification = require("../models/ContactVerification");
const { Op, fn, col, where } = require("sequelize");
const { sendEmail, sendSms } = require("../utils/contactDelivery");
const {
  generateOtpCode,
  getOtpExpiryDate,
  normalizePhone,
  isValidEmail,
  isValidPhone,
} = require("../utils/verification");

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeStudentId = (value = "") => String(value).trim();
let gmailTransporter = null;

const getGmailTransporter = () => {
  if (gmailTransporter) return gmailTransporter;

  const user = String(process.env.GMAIL_USER || "").trim();
  const pass = String(process.env.GMAIL_APP_PASSWORD || "").trim();
  if (!user || !pass) return null;

  // Gmail SMTP requires 2FA on the Google account and an App Password from
  // https://myaccount.google.com/apppasswords (do not use the normal password).
  gmailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return gmailTransporter;
};

const parseJsonObject = (value, fallback = {}) => {
  try {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const toUserPayload = (user) => ({
  id: user.id,
  name: user.name,
  studentId: user.studentId,
  email: user.email,
  phone: user.phone || "",
  isContactSetup: Boolean(user.isContactSetup),
  profilePicture: user.profilePicture || "",
  themeMode: user.themeMode || "system",
  notificationsEnabled: Boolean(user.notificationsEnabled),
  notificationPrefs: parseJsonObject(user.notificationPrefs, {}),
  emailVerified: Boolean(user.emailVerified),
  phoneVerified: Boolean(user.phoneVerified),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

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
      isContactSetup: false,
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
      user: toUserPayload(user),
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
      user: toUserPayload(user),
    });
    console.log("[AUTH] Login success", { userId: user.id, email: user.email });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      user: toUserPayload(user),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const nextName = String(req.body?.name || user.name).trim();
    const nextEmail = normalizeEmail(req.body?.email || user.email);
    const nextPhone = req.body?.phone == null ? user.phone : String(req.body.phone).trim();
    const nextProfilePicture =
      req.body?.profilePicture == null ? user.profilePicture : String(req.body.profilePicture);
    const nextThemeMode = req.body?.themeMode == null ? user.themeMode : String(req.body.themeMode).trim();
    const nextNotificationsEnabled =
      req.body?.notificationsEnabled == null ? Boolean(user.notificationsEnabled) : Boolean(req.body.notificationsEnabled);
    const nextNotificationPrefs =
      req.body?.notificationPrefs == null
        ? parseJsonObject(user.notificationPrefs, {})
        : parseJsonObject(req.body.notificationPrefs, {});

    if (!nextName) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!nextEmail || !/^\S+@\S+\.\S+$/.test(nextEmail)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const existing = await User.findOne({
      where: {
        id: { [Op.ne]: user.id },
        [Op.or]: [where(fn("lower", col("email")), nextEmail)],
      },
    });

    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    if (nextEmail !== user.email) {
      return res.status(400).json({ message: "Email address cannot be changed." });
    }

    await user.update({
      name: nextName,
      email: nextEmail,
      phone: nextPhone || null,
      profilePicture: nextProfilePicture || null,
      themeMode: nextThemeMode || "system",
      notificationsEnabled: nextNotificationsEnabled,
      notificationPrefs: JSON.stringify(nextNotificationPrefs || {}),
    });

    return res.json({
      message: "Profile updated successfully",
      user: toUserPayload(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/send-otp", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetEmail = normalizeEmail(user.email || "");
    if (!targetEmail) {
      return res.status(400).json({ message: "User email is required to send OTP" });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await ContactVerification.create({
      userId: user.id,
      role: "student",
      otpHash,
      type: "auth:otp",
      newValue: user.email || user.phone || String(user.id),
      expiresAt,
      used: false,
    });

    const transporter = getGmailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: String(process.env.GMAIL_USER || "").trim(),
          to: targetEmail,
          subject: "Your Verification OTP",
          text: `Your OTP is: ${otp}. Valid for 10 minutes. Do not share this.`,
        });
      } catch (mailError) {
        console.warn("[auth/send-otp] Gmail send failed, using console fallback", {
          userId: user.id,
          email: targetEmail,
          error: mailError.message,
        });
        console.log(`OTP for ${targetEmail}: ${otp}`);
      }
    } else {
      console.log(`OTP for ${targetEmail}: ${otp}`);
    }

    return res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/verify-otp", authMiddleware, async (req, res) => {
  try {
    const otp = String(req.body?.otp || "").trim();

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const records = await ContactVerification.findAll({
      where: {
        userId: req.userId,
        role: "student",
        type: "auth:otp",
        used: false,
        expiresAt: { [Op.gt]: new Date() },
      },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    for (const record of records) {
      const isMatch = await bcrypt.compare(otp, record.otpHash);
      if (isMatch) {
        await record.update({ used: true });
        return res.json({ success: true, message: "OTP verified" });
      }
    }

    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/contact/send-code", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "initial").trim().toLowerCase();
    const requestedTarget = String(req.body?.target || "").trim();

    if (!["email", "phone"].includes(channel)) {
      return res.status(400).json({ message: "channel must be email or phone" });
    }

    const isEmail = channel === "email";
    const currentTarget = isEmail ? user.email : (user.phone || "");
    let target = requestedTarget || currentTarget;
    if (isEmail) target = normalizeEmail(target);
    else target = normalizePhone(target);

    if (!target) {
      return res.status(400).json({ message: `${channel} is required` });
    }

    if (isEmail && !isValidEmail(target)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (!isEmail && !isValidPhone(target)) {
      return res.status(400).json({ message: "Enter a valid phone number" });
    }

    const now = new Date();

    if (purpose === "change-current" && target !== currentTarget) {
      return res.status(400).json({ message: `Current ${channel} does not match profile` });
    }

    if (purpose === "change-new") {
      const canChangeUntil = isEmail ? user.canChangeEmailUntil : user.canChangePhoneUntil;
      if (!canChangeUntil || new Date(canChangeUntil) < now) {
        return res.status(400).json({ message: `Verify current ${channel} first` });
      }
      if (target === currentTarget) {
        return res.status(400).json({ message: `New ${channel} must be different` });
      }

      if (isEmail) {
        const emailTaken = await User.findOne({
          where: {
            id: { [Op.ne]: user.id },
            [Op.or]: [where(fn("lower", col("email")), target)],
          },
        });
        if (emailTaken) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    const updatePayload = isEmail
      ? {
          emailOtpCode: code,
          emailOtpTarget: target,
          emailOtpPurpose: purpose,
          emailOtpExpiresAt: expiresAt,
        }
      : {
          phoneOtpCode: code,
          phoneOtpTarget: target,
          phoneOtpPurpose: purpose,
          phoneOtpExpiresAt: expiresAt,
        };

    await user.update(updatePayload);

    const message = `Your verification code is ${code}. It expires in 10 minutes.`;
    let delivery;
    if (isEmail) {
      delivery = await sendEmail({
        to: target,
        subject: "SkillSpring verification code",
        text: message,
      });
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
    console.error("Send contact code error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/contact/verify-code", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();
    const purpose = String(req.body?.purpose || "initial").trim().toLowerCase();

    if (!["email", "phone"].includes(channel)) {
      return res.status(400).json({ message: "channel must be email or phone" });
    }
    if (!code) return res.status(400).json({ message: "Verification code is required" });

    const isEmail = channel === "email";
    const otpCode = isEmail ? user.emailOtpCode : user.phoneOtpCode;
    const otpTarget = isEmail ? user.emailOtpTarget : user.phoneOtpTarget;
    const otpPurpose = isEmail ? user.emailOtpPurpose : user.phoneOtpPurpose;
    const otpExpiry = isEmail ? user.emailOtpExpiresAt : user.phoneOtpExpiresAt;

    if (!otpCode || !otpTarget || !otpExpiry) {
      return res.status(400).json({ message: "No active verification request" });
    }

    if (otpCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (new Date(otpExpiry) < new Date()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    if (otpPurpose !== purpose) {
      return res.status(400).json({ message: "Verification purpose mismatch" });
    }

    const clearOtp = isEmail
      ? {
          emailOtpCode: null,
          emailOtpTarget: null,
          emailOtpPurpose: null,
          emailOtpExpiresAt: null,
        }
      : {
          phoneOtpCode: null,
          phoneOtpTarget: null,
          phoneOtpPurpose: null,
          phoneOtpExpiresAt: null,
        };

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
        if (!user.canChangeEmailUntil || new Date(user.canChangeEmailUntil) < new Date()) {
          return res.status(400).json({ message: "Current email verification expired" });
        }
        applyPayload.email = normalizeEmail(otpTarget);
        applyPayload.emailVerified = true;
        applyPayload.canChangeEmailUntil = null;
      } else {
        if (!user.canChangePhoneUntil || new Date(user.canChangePhoneUntil) < new Date()) {
          return res.status(400).json({ message: "Current phone verification expired" });
        }
        applyPayload.phone = normalizePhone(otpTarget);
        applyPayload.phoneVerified = true;
        applyPayload.canChangePhoneUntil = null;
      }
    }

    await user.update(applyPayload);

    return res.json({
      message: `${channel} verification successful`,
      user: toUserPayload(user),
    });
  } catch (error) {
    console.error("Verify contact code error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
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
