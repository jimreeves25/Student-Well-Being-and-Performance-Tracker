const nodemailer = require("nodemailer");

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

const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getMailer();
  const from =
    String(process.env.EMAIL_FROM || "").trim() ||
    String(process.env.SMTP_USER || "").trim() ||
    String(process.env.GMAIL_USER || "").trim() ||
    "no-reply@tracker.local";

  if (!mailer) {
    console.log("[email-fallback]", { to, subject, text });
    return { delivered: false, provider: "fallback" };
  }

  await mailer.sendMail({ from, to, subject, text, html });
  return { delivered: true, provider: cachedProvider || "smtp" };
};

module.exports = { sendEmail };