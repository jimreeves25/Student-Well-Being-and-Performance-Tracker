const OTP_TTL_MINUTES = Number(process.env.CONTACT_OTP_TTL_MINUTES || 10);

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const getOtpExpiryDate = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

const normalizePhone = (value = "") => String(value).replace(/\s+/g, "").trim();

const isValidEmail = (value = "") => /^\S+@\S+\.\S+$/.test(String(value).trim());

const isValidPhone = (value = "") => /^\+?[0-9\-()]{7,20}$/.test(normalizePhone(value));

module.exports = {
  OTP_TTL_MINUTES,
  generateOtpCode,
  getOtpExpiryDate,
  normalizePhone,
  isValidEmail,
  isValidPhone,
};
