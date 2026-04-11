const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// POST /api/chat route
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt || "You are a helpful assistant." },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError = data?.error?.message || data?.message || "OpenRouter request failed";
      return res.status(response.status).json({ error: apiError });
    }

    const text = data?.choices?.[0]?.message?.content || "No response generated.";
    return res.json({ content: [{ text }] });
  } catch (error) {
    console.error("OpenRouter API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Proxy server running on http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("⚠️  OPENROUTER_API_KEY is not set in .env — requests will fail");
  }
});
