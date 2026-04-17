const twilio = require("twilio");

let cachedClient = null;

const getTwilioClient = () => {
  if (cachedClient) return cachedClient;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return null;
  }

  cachedClient = twilio(sid, token);
  return cachedClient;
};

const sendTwilioSms = async ({ to, text }) => {
  const client = getTwilioClient();
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!client || !from) {
    return { delivered: false, provider: "unconfigured" };
  }

  await client.messages.create({ to, from, body: text });
  return { delivered: true, provider: "twilio" };
};

const sendMsg91Sms = async ({ to, text }) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;

  if (!authKey || !senderId) {
    return { delivered: false, provider: "unconfigured" };
  }

  const response = await fetch("https://api.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      sender: senderId,
      mobiles: String(to).replace(/^\+/, ""),
      message: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`MSG91 failed with status ${response.status}`);
  }

  return { delivered: true, provider: "msg91" };
};

const sendSms = async ({ to, text }) => {
  const twilioResult = await sendTwilioSms({ to, text });
  if (twilioResult.delivered) return twilioResult;

  try {
    const msg91Result = await sendMsg91Sms({ to, text });
    if (msg91Result.delivered) return msg91Result;
  } catch (error) {
    console.log("[sms-msg91-error]", error.message);
  }

  console.log("[sms-fallback]", { to, text });
  return { delivered: false, provider: "fallback" };
};

module.exports = { sendSms };