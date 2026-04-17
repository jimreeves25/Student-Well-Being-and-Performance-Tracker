const nodemailer = require("nodemailer");
const twilio = require("twilio");

let cachedTransporter = null;
let cachedProvider = null;

const getMailer = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (host && user && pass) {
    cachedProvider = "smtp";
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    return cachedTransporter;
  }

  const gmailUser = String(process.env.GMAIL_USER || "").trim();
  const gmailPass = String(process.env.GMAIL_APP_PASSWORD || "").trim();

  if (!gmailUser || !gmailPass) {
    return null;
  }

  cachedProvider = "gmail";
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  return cachedTransporter;
};

const getSmsClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
};

const sendEmail = async ({ to, subject, text }) => {
  const from =
    String(process.env.EMAIL_FROM || "").trim() ||
    String(process.env.SMTP_USER || "").trim() ||
    String(process.env.GMAIL_USER || "").trim() ||
    "no-reply@skillspring.local";
  const mailer = getMailer();

  if (!mailer) {
    console.log("[email-fallback]", { to, subject, text });
    return { delivered: false, provider: "fallback" };
  }

  await mailer.sendMail({ from, to, subject, text });
  return { delivered: true, provider: cachedProvider || "smtp" };
};

const sendSms = async ({ to, text }) => {
  const client = getSmsClient();
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!client || !from) {
    console.log("[sms-fallback]", { to, text });
    return { delivered: false, provider: "fallback" };
  }

  await client.messages.create({ to, from, body: text });
  return { delivered: true, provider: "twilio" };
};

module.exports = {
  sendEmail,
  sendSms,
};
