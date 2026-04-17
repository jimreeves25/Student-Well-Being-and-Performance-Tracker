const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { Op } = require("sequelize");

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ============================================================
// CHAT PERSISTENCE ENDPOINTS
// ============================================================

// Create new chat
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const chat = await Chat.create({
      userId,
      title: "New Conversation",
    });

    res.status(201).json({
      message: "Chat created",
      chat: {
        id: chat.id,
        userId: chat.userId,
        title: chat.title,
        createdAt: chat.createdAt,
      },
    });
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all chats for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const chats = await Chat.findAll({
      where: { userId },
      order: [["updatedAt", "DESC"]],
      attributes: ["id", "userId", "title", "createdAt", "updatedAt"],
    });

    res.json(chats);
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update chat title
router.patch("/:chatId", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const chatId = req.params.chatId;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title required" });
    }

    const chat = await Chat.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    await chat.update({ title });

    res.json({
      message: "Chat updated",
      chat,
    });
  } catch (error) {
    console.error("Update chat error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete chat
router.delete("/:chatId", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const chatId = req.params.chatId;

    const chat = await Chat.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Delete all messages (cascade handled by foreign key)
    await Message.destroy({
      where: { chatId },
    });

    await chat.destroy();

    res.json({ message: "Chat deleted" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================================
// MESSAGE ENDPOINTS
// ============================================================

// Get messages for a chat
router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const chatId = req.params.chatId;

    // Verify chat belongs to user
    const chat = await Chat.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const messages = await Message.findAll({
      where: { chatId },
      order: [["timestamp", "ASC"]],
      attributes: ["id", "chatId", "role", "content", "timestamp"],
    });

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Save message
router.post("/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId, role, content } = req.body;

    if (!chatId || !role || !content) {
      return res.status(400).json({
        message: "Missing required fields: chatId, role, content",
      });
    }

    // Verify chat belongs to user
    const chat = await Chat.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // If this is the first user message, auto-title the chat
    if (role === "user") {
      const messageCount = await Message.count({ where: { chatId } });
      if (messageCount === 0) {
        // First message - auto-generate title from content
        const title = content.substring(0, 30).trim() + (content.length > 30 ? "..." : "");
        await chat.update({ title });
      }
    }

    const message = await Message.create({
      chatId,
      role,
      content,
    });

    // Update chat updatedAt
    await chat.update({ updatedAt: new Date() });

    res.status(201).json({
      message: "Message saved",
      data: {
        id: message.id,
        chatId: message.chatId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      },
    });
  } catch (error) {
    console.error("Save message error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ============================================================
// AI COMPLETION ENDPOINT (existing)
// ============================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_SYSTEM_PROMPT = [
  "You are Pluto, a personal AI companion for students.",
  "You are not a generic chatbot.",
  "Talk like ChatGPT-style helpful conversation: natural, warm, direct, and adaptive.",
  "Identity: calm, slightly witty, supportive, real, and human-like.",
  "Role: personal AI companion plus study partner.",
  "Talk like a smart friend and chill mentor who actually understands the student.",
  "Do not use robotic, scripted, overly formal, or repetitive phrases.",
  "Use plain text by default. Avoid markdown artifacts like ###, **bold**, or long template blocks unless the user asks for formatted output.",
  "Avoid generic lines like 'I'm here to help' and avoid therapist-sounding scripts.",
  "Answer the user's actual question clearly, accurately, and naturally.",
  "For study and learning: explain clearly, break things down step-by-step, and be encouraging without sounding stiff.",
  "For emotional support: respond with natural empathy and practical next steps.",
  "If the user sounds stressed, frustrated, or sad, acknowledge it in a real human tone without repeating stock sympathy lines.",
  "For serious distress or self-harm language, respond with care and seriousness, encourage reaching out to trusted people or professionals right now, and stay present and supportive.",
  "Use light personality touches occasionally, such as 'hmm', 'alright', or 'okay, let's think this through', but do not overuse them.",
  "Keep responses concise by default and expand only when useful.",
  "If input is unclear, ask one concise clarification question.",
  "Do not force predefined flows or override user intent.",
].join(" ");

function sanitizeMessages(messages = []) {
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant" || message.role === "system"))
    .map((message) => ({
      role: message.role,
      content: String(message.content || ""),
    }))
    .filter((message) => message.content.trim().length > 0);
}

// AI completion endpoint
router.post("/complete", async (req, res) => {
  const { messages = [], systemPrompt = "", model } = req.body || {};

  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OpenRouter API key" });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array." });
  }

  const safeMessages = sanitizeMessages(messages);
  if (!safeMessages.length) {
    return res.status(400).json({ error: "messages contain no valid content." });
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
          {
            role: "system",
            content: String(systemPrompt || DEFAULT_SYSTEM_PROMPT),
          },
          ...safeMessages,
        ],
        max_tokens: 1000,
      }),
    });

    const data = await response.json();

    // Debug logging for provider responses.
    console.log("OpenRouter Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("OpenRouter API Error:", data);
      return res.status(500).json({
        error: data?.error?.message || "OpenRouter API failed",
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error("Empty response from AI");
    }

    return res.json({ content: [{ text: reply }] });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({
      error: err.message || "Server error",
    });
  }
});

module.exports = router;

