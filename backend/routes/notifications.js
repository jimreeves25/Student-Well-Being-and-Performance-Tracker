const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/User");
const ParentUser = require("../models/ParentUser");
const ContactVerification = require("../models/ContactVerification");
const NotificationPreference = require("../models/NotificationPreference");
const NotificationLog = require("../models/NotificationLog");
const { sendEmail } = require("../services/emailService");
const { generateOtpCode, hashOtp, verifyOtp, getOtpExpiryDate } = require("../utils/otp");
const {
  getPreferencesForOwner,
  normalizeTimeString,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationHistory,
  sendNotificationToOwner,
  recordUserActivity,
  safeParseJson,
} = require("../utils/notificationEngine");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const ALLOW_DEV_OTP_ECHO = process.env.ALLOW_DEV_OTP_ECHO === "true";

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizePhone = (value = "") => String(value).replace(/\s+/g, "").trim();
const isValidEmail = (value = "") => /^\S+@\S+\.\S+$/.test(String(value).trim());
const isValidE164 = (value = "") => /^\+[1-9]\d{1,14}$/.test(normalizePhone(value));

const parsePhoneToE164 = (value = "") => {
  const raw = normalizePhone(value);
  if (!raw) return null;

  if (isValidE164(raw)) return raw;

  const digits = raw.replace(/\D/g, "");

  // Common local input: 10-digit Indian mobile number.
  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }

  // Common alternate input: starts with country code but no plus.
  if (/^91\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
};

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const resolvePrincipal = async (req) => {
  if (req.auth?.role === "parent") {
    const parent = await ParentUser.findByPk(req.auth.parentId);
    return { role: "parent", ownerId: req.auth.parentId, record: parent };
  }

  const user = await User.findByPk(req.auth.userId);
  return { role: "student", ownerId: req.auth.userId, record: user };
};

const createOtpVerification = async ({ ownerId, role, type, newValue }) => {
  const code = generateOtpCode();
  const otpHash = await hashOtp(code);
  const record = await ContactVerification.create({
    userId: ownerId,
    role,
    otpHash,
    type,
    newValue,
    expiresAt: getOtpExpiryDate(),
    used: false,
  });

  return { code, record };
};

const sendVerificationDelivery = async ({ type, target, code }) => {
  const message = `Your verification code is ${code}. It expires in 10 minutes.`;
  return sendEmail({ to: target, subject: "Contact verification code", text: message });
};

const requestSetupOtp = async ({ ownerId, role, email }) => {
  const results = [];
  const allowDevOtp = ALLOW_DEV_OTP_ECHO && process.env.NODE_ENV !== "production";

  if (email) {
    const { code, record } = await createOtpVerification({ ownerId, role, type: "email", newValue: email });
    const delivery = await sendVerificationDelivery({ type: "email", target: email, code });
    if (!delivery?.delivered && !allowDevOtp) {
      throw new Error("Email provider is not configured. Set SMTP credentials in backend/.env");
    }
    const emailResult = {
      type: "email",
      verificationId: record.id,
      target: email,
      delivered: Boolean(delivery?.delivered),
      provider: delivery?.provider || null,
    };
    if (!delivery?.delivered && allowDevOtp) {
      emailResult.devCode = code;
      emailResult.devMode = true;
    }
    results.push(emailResult);
  }

  return results;
};

const confirmVerification = async ({ verificationId, otp }) => {
  const verification = await ContactVerification.findByPk(verificationId);
  if (!verification || verification.used) {
    return { ok: false, message: "Verification not found" };
  }

  if (new Date(verification.expiresAt) < new Date()) {
    return { ok: false, message: "Verification code expired" };
  }

  const isValid = await verifyOtp(otp, verification.otpHash);
  if (!isValid) {
    return { ok: false, message: "Invalid verification code" };
  }

  await verification.update({ used: true });
  return { ok: true, verification };
};

router.post("/student/setup", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    if (principal.role !== "student") {
      return res.status(403).json({ message: "Student access required" });
    }

    const email = normalizeEmail(req.body?.email || principal.record?.email || "");
    const step = String(req.body?.step || "request").trim().toLowerCase();

    if (step === "request") {
      if (!isValidEmail(email)) return res.status(400).json({ message: "Valid email is required" });

      const verificationIds = await requestSetupOtp({ ownerId: principal.ownerId, role: principal.role, email });
      return res.json({ message: "Verification codes sent", verificationIds });
    }

    const { emailVerificationId, emailOtp } = req.body || {};
    if (!emailVerificationId || !emailOtp) {
      return res.status(400).json({ message: "Email verification code is required" });
    }

    const emailResult = await confirmVerification({ verificationId: emailVerificationId, otp: String(emailOtp).trim() });
    if (!emailResult.ok) return res.status(400).json({ message: emailResult.message });

    await principal.record.update({
      email: normalizeEmail(emailResult.verification.newValue),
      isContactSetup: true,
      emailVerified: true,
    });

    return res.json({
      message: "Student contact setup completed",
      user: {
        id: principal.record.id,
        email: normalizeEmail(emailResult.verification.newValue),
        isContactSetup: true,
      },
    });
  } catch (error) {
    console.error("[notifications] student setup error", error);
    return res.status(500).json({ message: "Failed to complete student setup" });
  }
});

router.post("/parent/setup", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    if (principal.role !== "parent") {
      return res.status(403).json({ message: "Parent access required" });
    }

    const name = String(req.body?.name || principal.record?.name || "").trim();
    const email = normalizeEmail(req.body?.email || principal.record?.email || "");
    const studentId = String(req.body?.studentId || principal.record?.linkedStudentId || "").trim();
    const step = String(req.body?.step || "request").trim().toLowerCase();

    if (step === "request") {
      if (!name || !isValidEmail(email) || !studentId) {
        return res.status(400).json({ message: "Name, email, and student ID are required" });
      }

      const verificationIds = await requestSetupOtp({ ownerId: principal.ownerId, role: principal.role, email });
      return res.json({ message: "Verification codes sent", verificationIds });
    }

    const { emailVerificationId, emailOtp } = req.body || {};
    if (!emailVerificationId || !emailOtp) {
      return res.status(400).json({ message: "Email verification code is required" });
    }

    const emailResult = await confirmVerification({ verificationId: emailVerificationId, otp: String(emailOtp).trim() });
    if (!emailResult.ok) return res.status(400).json({ message: emailResult.message });

    await principal.record.update({
      name,
      email: normalizeEmail(emailResult.verification.newValue),
      verifiedAt: new Date(),
      emailVerified: true,
      linkedStudentId: studentId || principal.record.linkedStudentId,
    });

    return res.json({
      message: "Parent setup completed",
      parent: {
        id: principal.record.id,
        name,
        email: normalizeEmail(emailResult.verification.newValue),
        verifiedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[notifications] parent setup error", error);
    return res.status(500).json({ message: "Failed to complete parent setup" });
  }
});

router.post("/verify-otp", auth, async (req, res) => {
  try {
    const verificationId = Number(req.body?.verificationId);
    const otp = String(req.body?.otp || "").trim();

    if (!verificationId || !otp) {
      return res.status(400).json({ message: "verificationId and otp are required" });
    }

    const result = await confirmVerification({ verificationId, otp });
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    return res.json({ message: "OTP verified", verification: { id: result.verification.id, type: result.verification.type, newValue: result.verification.newValue } });
  } catch (error) {
    console.error("[notifications] verify otp error", error);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
});

router.post("/contact/change-request", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const type = String(req.body?.type || "").trim().toLowerCase();
    const rawNewValue = String(req.body?.newValue || "").trim();
    const newValue = type === "phone" ? parsePhoneToE164(rawNewValue) : rawNewValue;

    if (!["email", "phone"].includes(type)) {
      return res.status(400).json({ message: "type must be email or phone" });
    }

    if (type === "email" && !isValidEmail(newValue)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (type === "phone" && !newValue) {
      return res.status(400).json({ message: "Valid phone number is required" });
    }

    const currentValue = principal.record?.[type] || "";
    if (!currentValue) {
      return res.status(400).json({ message: `No current ${type} registered` });
    }

    const { code, record } = await createOtpVerification({ ownerId: principal.ownerId, role: principal.role, type, newValue });
    await sendVerificationDelivery({ type, target: currentValue, code });

    return res.json({ message: "OTP sent to current contact", verificationId: record.id });
  } catch (error) {
    console.error("[notifications] contact change request error", error);
    return res.status(500).json({ message: "Failed to request contact change" });
  }
});

router.post("/contact/confirm-change", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const verificationId = Number(req.body?.verificationId);
    const otp = String(req.body?.otp || "").trim();

    if (!verificationId || !otp) {
      return res.status(400).json({ message: "verificationId and otp are required" });
    }

    const result = await confirmVerification({ verificationId, otp });
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const verification = result.verification;
    const oldValue = String(principal.record?.[verification.type] || "").trim();
    const newValue = String(verification.newValue || "").trim();

    await principal.record.update({
      [verification.type]: newValue,
    });

    const confirmationMessage = "Your contact was updated successfully.";
    const deliveryTasks = [];

    if (verification.type === "email") {
      if (oldValue && oldValue !== newValue) {
        deliveryTasks.push(sendEmail({ to: oldValue, subject: "Contact updated", text: confirmationMessage }));
      }
      deliveryTasks.push(sendEmail({ to: newValue, subject: "Contact updated", text: confirmationMessage }));
    }

    await Promise.allSettled(deliveryTasks);

    await sendNotificationToOwner({
      ownerId: principal.ownerId,
      role: principal.role,
      type: `contact_updated_${verification.type}`,
      title: "Contact updated",
      message: confirmationMessage,
      metadata: { oldValue, newValue, verificationType: verification.type },
      channels: ["email"],
    });

    return res.json({ message: "Contact updated successfully", [verification.type]: newValue });
  } catch (error) {
    console.error("[notifications] contact confirm error", error);
    return res.status(500).json({ message: "Failed to confirm contact change" });
  }
});

router.get("/preferences", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const preferences = await getPreferencesForOwner(principal.ownerId, principal.role);
    return res.json({ preferences });
  } catch (error) {
    console.error("[notifications] preferences get error", error);
    return res.status(500).json({ message: "Failed to load notification preferences" });
  }
});

router.put("/preferences", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const payload = req.body || {};

    const [preferences] = await NotificationPreference.findOrCreate({
      where: { userId: principal.ownerId, role: principal.role },
      defaults: { userId: principal.ownerId, role: principal.role },
    });

    const updatePayload = {
      emailOn: payload.emailOn ?? preferences.emailOn,
      dailyLogReminderTime: normalizeTimeString(payload.dailyLogReminderTime) || preferences.dailyLogReminderTime,
    };

    await preferences.update(updatePayload);
    return res.json({ preferences: updatePayload });
  } catch (error) {
    console.error("[notifications] preferences update error", error);
    return res.status(500).json({ message: "Failed to update notification preferences" });
  }
});

router.get("/history", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const notifications = await getNotificationHistory({ ownerId: principal.ownerId, role: principal.role, limit });

    return res.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        channel: notification.channel,
        title: notification.title,
        messagePreview: notification.messagePreview,
        sentAt: notification.sentAt,
        status: notification.status,
        readAt: notification.readAt,
      })),
    });
  } catch (error) {
    console.error("[notifications] history error", error);
    return res.status(500).json({ message: "Failed to load notification history" });
  }
});

router.get("/inbox", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const notifications = await NotificationLog.findAll({
      where: { userId: principal.ownerId, role: principal.role },
      order: [["sentAt", "DESC"]],
      limit: 10,
    });

    return res.json({
      unreadCount: notifications.filter((item) => !item.readAt).length,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        channel: notification.channel,
        title: notification.title,
        messagePreview: notification.messagePreview,
        sentAt: notification.sentAt,
        status: notification.status,
        readAt: notification.readAt,
      })),
    });
  } catch (error) {
    console.error("[notifications] inbox error", error);
    return res.status(500).json({ message: "Failed to load notifications" });
  }
});

router.patch("/:id/read", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const notification = await markNotificationRead({ ownerId: principal.ownerId, role: principal.role, notificationId: Number(req.params.id) });
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("[notifications] mark read error", error);
    return res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

router.post("/read-all", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    await markAllNotificationsRead({ ownerId: principal.ownerId, role: principal.role });
    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("[notifications] mark all read error", error);
    return res.status(500).json({ message: "Failed to mark notifications as read" });
  }
});

router.post("/parent/note", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    if (principal.role !== "parent") {
      return res.status(403).json({ message: "Parent access required" });
    }

    const studentId = Number(req.body?.studentId || principal.record?.linkedStudentId);
    const message = String(req.body?.message || "").trim();

    if (!studentId || !message) {
      return res.status(400).json({ message: "studentId and message are required" });
    }

    await sendNotificationToOwner({
      ownerId: studentId,
      role: "student",
      type: "parent_note",
      title: "Message from parent",
      message,
      metadata: { parentId: principal.ownerId },
      channels: ["email"],
    });

    return res.json({ message: "Note sent to student" });
  } catch (error) {
    console.error("[notifications] parent note error", error);
    return res.status(500).json({ message: "Failed to send note" });
  }
});

router.post("/activity", auth, async (req, res) => {
  try {
    const principal = await resolvePrincipal(req);
    const activityType = String(req.body?.activityType || "app_open").trim() || "app_open";
    const source = String(req.body?.source || "web").trim() || "web";
    const metadata = req.body?.metadata || {};

    await recordUserActivity({
      ownerId: principal.ownerId,
      role: principal.role,
      activityType,
      source,
      metadata,
    });

    return res.json({ message: "Activity recorded" });
  } catch (error) {
    console.error("[notifications] activity error", error);
    return res.status(500).json({ message: "Failed to record activity" });
  }
});

module.exports = router;