const { sendEmail } = require("../services/emailService");
const { sendSms } = require("../services/smsService");

const sendEmailAndSms = async ({ email, phone, subject, message }) => {
  const results = await Promise.allSettled([
    email ? sendEmail({ to: email, subject, text: message }) : Promise.resolve({ delivered: false, provider: "skipped" }),
    phone ? sendSms({ to: phone, text: message }) : Promise.resolve({ delivered: false, provider: "skipped" }),
  ]);

  return {
    email: results[0].status === "fulfilled" ? results[0].value : { delivered: false, error: results[0].reason?.message },
    sms: results[1].status === "fulfilled" ? results[1].value : { delivered: false, error: results[1].reason?.message },
  };
};

module.exports = { sendEmailAndSms };