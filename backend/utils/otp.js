const bcrypt = require("bcryptjs");

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_TTL_MINUTES = Number(process.env.CONTACT_OTP_TTL_MINUTES || 10);
const BCRYPT_ROUNDS = Number(process.env.OTP_BCRYPT_ROUNDS || 10);

const generateOtpCode = () => {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

const hashOtp = async (code) => bcrypt.hash(String(code || ""), BCRYPT_ROUNDS);

const verifyOtp = async (code, hash) => {
  if (!code || !hash) return false;
  return bcrypt.compare(String(code), String(hash));
};

const getOtpExpiryDate = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  generateOtpCode,
  hashOtp,
  verifyOtp,
  getOtpExpiryDate,
};