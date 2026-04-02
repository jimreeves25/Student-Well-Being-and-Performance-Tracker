const express = require("express");

const router = express.Router();

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function buildFallbackReply(messages = []) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && message?.content)?.content;

  const prompt = String(latestUserMessage || "").toLowerCase();

  if (/stress|anxious|panic|overwhelm/.test(prompt)) {
    return "Try this quick reset: breathe in for 4 seconds and out for 6 seconds for 1 minute, relax your shoulders, then do one small task for 10 minutes.";
  }

  if (/sleep|tired|drowsy|fatigue/.test(prompt)) {
    return "For better energy: keep a fixed wake-up time, avoid intense screen use 30 minutes before bed, and do a 10-minute wind-down routine tonight.";
  }

  if (/schedule|plan|timetable|routine/.test(prompt)) {
    return "Simple study plan: 1) 25-45 minutes on your hardest topic, 2) 5-10 minute break, 3) second focused block, then a 5-minute recap of key takeaways.";
  }

  return "I can help with study planning, focus, stress, and sleep routines. Tell me your goal for today and I will give you a practical 3-step plan.";
}

router.post("/", async (req, res) => {
  const { messages = [], systemPrompt = "", model } = req.body || {};

  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return res.json({
      content: [{ text: buildFallbackReply(messages) }],
      mode: "offline-fallback",
      warning: "Missing OPENROUTER_API_KEY on server",
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array." });
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Student Wellness AI Coach",
      },
      body: JSON.stringify({
        model: String(model || DEFAULT_MODEL),
        messages: [
          ...(systemPrompt ? [{ role: "system", content: String(systemPrompt) }] : []),
          ...messages,
        ],
        max_tokens: 1000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.json({
        content: [{ text: buildFallbackReply(messages) }],
        mode: "offline-fallback",
        warning: data?.error?.message || "OpenRouter API error",
      });
    }

    const reply = data?.choices?.[0]?.message?.content || "No response generated.";
    return res.json({ content: [{ text: reply }] });
  } catch (err) {
    return res.json({
      content: [{ text: buildFallbackReply(messages) }],
      mode: "offline-fallback",
      warning: err.message || "Server error",
    });
  }
});

module.exports = router;

