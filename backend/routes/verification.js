const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Op, fn, col, where } = require("sequelize");
const VerificationOtp = require("../models/VerificationOtp");
const ContactVerification = require("../models/ContactVerification");
const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const { sendEmail } = require("../services/emailService");
const { sendSms } = require("../services/smsService");
const {
  generateOtpCode,
  getOtpExpiryDate,
  normalizePhone,
  isValidEmail,
  isValidPhone,
} = require("../utils/verification");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const ALLOW_DEV_OTP_ECHO = process.env.ALLOW_DEV_OTP_ECHO === "true";

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizePhoneE164 = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\+[1-9]\d{1,14}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return raw;
};

const otpAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded?.role === "parent" && decoded?.parentId) {
      const parent = await ParentUser.findByPk(decoded.parentId);
      if (!parent) return res.status(401).json({ message: "Invalid token owner" });
      req.otpPrincipal = { ownerId: parent.id, role: "parent" };
      return next();
    }

    if (decoded?.userId) {
      const user = await User.findByPk(decoded.userId);
      if (!user) return res.status(401).json({ message: "Invalid token owner" });
      req.otpPrincipal = { ownerId: user.id, role: "student" };
      return next();
    }

    return res.status(401).json({ message: "Invalid token payload" });
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

router.post("/send-otp", otpAuth, async (req, res) => {
  try {
    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "setup").trim().toLowerCase();
    const targetRaw = String(req.body?.target || "").trim();

    if (!["email", "phone", "sms"].includes(channel)) {
      return res.status(400).json({ message: "channel must be email or phone" });
    }

    const normalizedChannel = channel === "sms" ? "phone" : channel;
    const target =
      normalizedChannel === "email" ? normalizeEmail(targetRaw) : normalizePhoneE164(targetRaw);

    if (normalizedChannel === "email" && !isValidEmail(target)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (normalizedChannel === "phone" && !/^\+[1-9]\d{1,14}$/.test(target)) {
      return res.status(400).json({ message: "Valid phone number is required" });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await ContactVerification.create({
      userId: req.otpPrincipal.ownerId,
      role: req.otpPrincipal.role,
      otpHash,
      type: `${normalizedChannel}:${purpose}`,
      newValue: target,
      expiresAt,
      used: false,
    });

    const message = `Your verification code is ${otp}. It expires in 10 minutes.`;
    const delivery =
      normalizedChannel === "email"
        ? await sendEmail({ to: target, subject: "Your OTP Code", text: message })
        : await sendSms({ to: target, text: message });

    if (!delivery?.delivered) {
      if (ALLOW_DEV_OTP_ECHO && process.env.NODE_ENV !== "production") {
        return res.json({
          success: true,
          devMode: true,
          devCode: otp,
          message:
            normalizedChannel === "email"
              ? "Email provider is not configured. Using development OTP echo."
              : "SMS provider is not configured. Using development OTP echo.",
        });
      }

      return res.status(503).json({
        success: false,
        message:
          normalizedChannel === "email"
            ? "Email provider is not configured. Set SMTP credentials in backend/.env"
            : "SMS provider is not configured. Set Twilio or MSG91 credentials in backend/.env",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("[verification] send-otp error", error);
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

router.post("/verify-otp", otpAuth, async (req, res) => {
  try {
    const otp = String(req.body?.otp || "").trim();
    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "setup").trim().toLowerCase();
    const targetRaw = String(req.body?.target || "").trim();

    if (!otp) {
      return res.status(400).json({ verified: false, message: "otp is required" });
    }

    const normalizedChannel = channel === "sms" ? "phone" : channel;
    const typeFilter = normalizedChannel ? `${normalizedChannel}:${purpose}` : null;
    const target =
      !targetRaw
        ? null
        : normalizedChannel === "email"
          ? normalizeEmail(targetRaw)
          : normalizePhoneE164(targetRaw);

    const whereClause = {
      userId: req.otpPrincipal.ownerId,
      role: req.otpPrincipal.role,
      used: false,
      expiresAt: { [Op.gt]: new Date() },
    };

    if (typeFilter) whereClause.type = typeFilter;
    if (target) whereClause.newValue = target;

    const candidates = await ContactVerification.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    for (const candidate of candidates) {
      const match = await bcrypt.compare(otp, candidate.otpHash);
      if (match) {
        await candidate.update({ used: true });
        return res.json({ verified: true });
      }
    }

    return res.json({ verified: false });
  } catch (error) {
    console.error("[verification] verify-otp error", error);
    return res.status(500).json({ verified: false, message: "Failed to verify OTP" });
  }
});

const getOtpMailer = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Use JSON transport in dev if SMTP is not configured so sendMail still works.
  return nodemailer.createTransport({ jsonTransport: true });
};

const sendEmailOtp = async ({ to, code }) => {
  const transporter = getOtpMailer();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@skillspring.local";
  const info = await transporter.sendMail({
    from,
    to,
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log("[otp-email] Delivered", { to, messageId: info.messageId });
  } else {
    console.log("[otp-email-mock] SMTP is not configured, generated email OTP", { to, code });
  }
};

router.post("/send-email-code", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || "");
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    await VerificationOtp.create({
      channel: "email",
      target: email,
      code,
      expiresAt,
      verifiedAt: null,
    });

    await sendEmailOtp({ to: email, code });

    return res.json({
      message: "Email verification code sent.",
      expiresAt,
      devCode: process.env.ALLOW_DEV_OTP_ECHO === "true" ? code : undefined,
    });
  } catch (error) {
    console.error("[verification] send-email-code error", error);
    return res.status(500).json({ message: "Failed to send email code." });
  }
});

router.post("/verify-email-code", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || "");
    const code = String(req.body?.code || "").trim();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email is required." });
    }
    if (!code) {
      return res.status(400).json({ message: "Verification code is required." });
    }

    const otp = await VerificationOtp.findOne({
      where: {
        channel: "email",
        target: email,
        verifiedAt: null,
        expiresAt: { [Op.gte]: new Date() },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!otp || otp.code !== code) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    await otp.update({ verifiedAt: new Date() });

    const user = await User.findOne({ where: where(fn("lower", col("email")), email) });
    if (user) {
      await user.update({ emailVerified: true, email });
    }

    return res.json({
      message: "Email verified successfully.",
      verified: true,
      user: user
        ? {
            id: user.id,
            email: user.email,
            phone: user.phone || "",
            emailVerified: Boolean(user.emailVerified),
            phoneVerified: Boolean(user.phoneVerified),
          }
        : undefined,
    });
  } catch (error) {
    console.error("[verification] verify-email-code error", error);
    return res.status(500).json({ message: "Failed to verify email code." });
  }
});

router.post("/send-phone-code", async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone || "");
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }

    const code = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    await VerificationOtp.create({
      channel: "phone",
      target: phone,
      code,
      expiresAt,
      verifiedAt: null,
    });

    // Mock SMS delivery for now.
    console.log("[otp-phone-mock] Generated phone OTP", { phone, code });

    return res.json({
      message: "Phone verification code generated (mock SMS).",
      expiresAt,
      devCode: code,
    });
  } catch (error) {
    console.error("[verification] send-phone-code error", error);
    return res.status(500).json({ message: "Failed to send phone code." });
  }
});

router.post("/verify-phone-code", async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone || "");
    const code = String(req.body?.code || "").trim();

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }
    if (!code) {
      return res.status(400).json({ message: "Verification code is required." });
    }

    const otp = await VerificationOtp.findOne({
      where: {
        channel: "phone",
        target: phone,
        verifiedAt: null,
        expiresAt: { [Op.gte]: new Date() },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!otp || otp.code !== code) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    await otp.update({ verifiedAt: new Date() });

    const user = await User.findOne({ where: { phone } });
    if (user) {
      await user.update({ phoneVerified: true, phone });
    }

    return res.json({
      message: "Phone verified successfully.",
      verified: true,
      user: user
        ? {
            id: user.id,
            email: user.email,
            phone: user.phone || "",
            emailVerified: Boolean(user.emailVerified),
            phoneVerified: Boolean(user.phoneVerified),
          }
        : undefined,
    });
  } catch (error) {
    console.error("[verification] verify-phone-code error", error);
    return res.status(500).json({ message: "Failed to verify phone code." });
  }
});

module.exports = router;