const express = require("express");
const jwt = require("jsonwebtoken");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const JSZip = require("jszip");
const { all, run } = require("../db/chatPersistenceDb");

const router = express.Router();

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_SYSTEM_PROMPT = "You are Pluto, a warm, friendly AI companion for students. Talk naturally like a helpful ChatGPT-style assistant. Keep replies concise, practical, and conversational. Avoid robotic phrasing and avoid markdown artifacts like ### or ** unless asked.";
const MAX_ATTACHMENT_TEXT = 18000;

function parseNumericId(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getUserIdFromToken(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_secret_key");
    return parseNumericId(decoded?.userId);
  } catch (_error) {
    return null;
  }
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return null;
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return null;
  }

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";
  const isBase64 = header.includes(";base64");

  try {
    const buffer = isBase64
      ? Buffer.from(body, "base64")
      : Buffer.from(decodeURIComponent(body), "utf8");
    return { mimeType, buffer };
  } catch (_error) {
    return null;
  }
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlToText(xml) {
  return decodeXmlEntities(String(xml || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const slides = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path)?.async("string");
    const text = xmlToText(xml || "");
    if (text) {
      slides.push(text);
    }
  }

  return slides.join("\n\n");
}

async function extractAttachmentText(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return "";
  }

  if (typeof attachment.textContent === "string" && attachment.textContent.trim()) {
    return attachment.textContent.trim().slice(0, MAX_ATTACHMENT_TEXT);
  }

  const parsed = parseDataUrl(attachment.dataUrl);
  if (!parsed) {
    return "";
  }

  const lowerName = String(attachment.name || "").toLowerCase();
  const mimeType = String(attachment.mimeType || parsed.mimeType || "application/octet-stream").toLowerCase();

  try {
    if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
      const result = await pdfParse(parsed.buffer);
      return String(result?.text || "").trim().slice(0, MAX_ATTACHMENT_TEXT);
    }

    if (
      mimeType.includes("wordprocessingml") ||
      lowerName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: parsed.buffer });
      return String(result?.value || "").trim().slice(0, MAX_ATTACHMENT_TEXT);
    }

    if (mimeType.includes("presentationml") || lowerName.endsWith(".pptx")) {
      const text = await extractPptxText(parsed.buffer);
      return text.slice(0, MAX_ATTACHMENT_TEXT);
    }

    if (mimeType.startsWith("text/") || lowerName.endsWith(".md") || lowerName.endsWith(".csv") || lowerName.endsWith(".json")) {
      return parsed.buffer.toString("utf8").trim().slice(0, MAX_ATTACHMENT_TEXT);
    }
  } catch (error) {
    console.warn("[ATTACHMENT] Failed to extract text", {
      name: attachment?.name,
      mimeType,
      error: error?.message,
    });
  }

  return "";
}

async function callOpenRouter(messages, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing OpenRouter API key");
  }

  const controller = new AbortController();
  const timeoutMs = 20000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: String(systemPrompt || DEFAULT_SYSTEM_PROMPT) },
          ...messages,
        ],
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      const apiMessage = data?.error?.message || "OpenRouter API failed";
      throw new Error(apiMessage);
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error("Empty AI response");
    }

    return reply;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("AI request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// A. Create Chat
// POST /api/chats
router.post("/chats", async (req, res) => {
  try {
    const tokenUserId = getUserIdFromToken(req);
    const bodyUserId = parseNumericId(req.body?.userId);
    const userId = bodyUserId || tokenUserId;
    const title = String(req.body?.title || "New Conversation").trim() || "New Conversation";

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await run(
      "INSERT INTO chats (userId, title) VALUES (?, ?)",
      [userId, title]
    );

    return res.status(201).json({ chatId: result.lastID });
  } catch (error) {
    console.error("[POST /api/chats] Database error:", error);
    return res.status(500).json({ error: "Failed to create chat" });
  }
});

// B. Get Chats
// GET /api/chats/:userId
router.get("/chats/:userId(\\d+)", async (req, res) => {
  try {
    const userId = parseNumericId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const chats = await all(
      "SELECT id, userId, title, createdAt FROM chats WHERE userId = ? ORDER BY createdAt DESC",
      [userId]
    );

    return res.json({ chats });
  } catch (error) {
    console.error("[GET /api/chats/:userId] Database error:", error);
    return res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// C. Save Message
// POST /api/messages
router.post("/messages", async (req, res) => {
  try {
    const chatId = parseNumericId(req.body?.chatId);
    const role = String(req.body?.role || "").trim();
    const content = String(req.body?.content || "").trim();

    if (!chatId || !content || !["user", "assistant"].includes(role)) {
      return res.status(400).json({ error: "chatId, valid role, and content are required" });
    }

    const result = await run(
      "INSERT INTO messages (chatId, role, content) VALUES (?, ?, ?)",
      [chatId, role, content]
    );

    return res.status(201).json({ messageId: result.lastID });
  } catch (error) {
    console.error("[POST /api/messages] Database error:", error);
    return res.status(500).json({ error: "Failed to save message" });
  }
});

// D. Get Messages
// GET /api/messages/:chatId
router.get("/messages/:chatId", async (req, res) => {
  try {
    const chatId = parseNumericId(req.params.chatId);
    if (!chatId) {
      return res.status(400).json({ error: "Invalid chatId" });
    }

    const messages = await all(
      "SELECT id, chatId, role, content, timestamp FROM messages WHERE chatId = ? ORDER BY timestamp ASC",
      [chatId]
    );

    return res.json({ messages });
  } catch (error) {
    console.error("[GET /api/messages/:chatId] Database error:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// 3. CHAT + AI INTEGRATION
// POST /api/chat
// Input: { chatId, message } or { message }
router.post("/chat", async (req, res) => {
  try {
    const chatId = parseNumericId(req.body?.chatId);
    const userMessage = String(req.body?.message || "").trim();
    const systemPrompt = String(req.body?.systemPrompt || "").trim();
    const contextMessages = Array.isArray(req.body?.contextMessages) ? req.body.contextMessages : [];
    const attachment = req.body?.attachment || null;

    if (!userMessage) {
      return res.status(400).json({ error: "message is required" });
    }

    let history = [{ role: "user", content: userMessage }];

    if (contextMessages.length) {
      history = contextMessages
        .map((msg) => ({
          role: msg?.role === "assistant" ? "assistant" : "user",
          content: String(msg?.content || "").trim(),
        }))
        .filter((msg) => msg.content.length > 0);
    }

    if (chatId) {
      // 1) Save user message
      await run(
        "INSERT INTO messages (chatId, role, content) VALUES (?, 'user', ?)",
        [chatId, userMessage]
      );

      // Build context from chat history for better responses.
      history = await all(
        "SELECT role, content FROM messages WHERE chatId = ? ORDER BY timestamp ASC",
        [chatId]
      );
    }

    let providerMessages = history.map((row) => ({
      role: row?.role === "assistant" ? "assistant" : "user",
      content: String(row?.content || ""),
    }));

    if (attachment && typeof attachment === "object") {
      const lastUserIndex = [...providerMessages]
        .map((m) => m.role)
        .lastIndexOf("user");

      if (
        attachment.kind === "image" &&
        typeof attachment.dataUrl === "string" &&
        attachment.dataUrl.startsWith("data:image/")
      ) {
        const baseText =
          lastUserIndex >= 0
            ? String(providerMessages[lastUserIndex].content || userMessage)
            : userMessage;

        const imagePrompt = [
          baseText,
          `Attached image: ${String(attachment.name || "image")}.`,
          "Please analyze what is visible and answer the user's doubt clearly.",
        ].join("\n\n");

        const multimodal = {
          role: "user",
          content: [
            { type: "text", text: imagePrompt },
            { type: "image_url", image_url: { url: attachment.dataUrl } },
          ],
        };

        if (lastUserIndex >= 0) {
          providerMessages[lastUserIndex] = multimodal;
        } else {
          providerMessages.push(multimodal);
        }
      }

      if (attachment.kind !== "image") {
        const extractedText = await extractAttachmentText(attachment);
        const name = String(attachment.name || "file");
        const mime = String(attachment.mimeType || "unknown");

        const note = extractedText
          ? [
              `Attached file: ${name} (${mime})`,
              "Use this extracted content to answer the user's doubt:",
              extractedText,
            ].join("\n\n")
          : [
              `Attached file: ${name} (${mime})`,
              "I could not extract readable text from this file format. Ask the user for specific slide/page text if needed, and still answer based on their question.",
            ].join("\n\n");

        if (lastUserIndex >= 0) {
          providerMessages[lastUserIndex] = {
            role: "user",
            content: `${providerMessages[lastUserIndex].content}\n\n${note}`,
          };
        } else {
          providerMessages.push({ role: "user", content: note });
        }
      }
    }

    // 2) Call OpenRouter API (existing logic behavior)
    const aiText = await callOpenRouter(
      providerMessages,
      systemPrompt || DEFAULT_SYSTEM_PROMPT
    );

    if (chatId) {
      // 4) Save AI response
      await run(
        "INSERT INTO messages (chatId, role, content) VALUES (?, 'assistant', ?)",
        [chatId, aiText]
      );
    }

    // 5) Return AI response
    return res.json({ reply: aiText });
  } catch (error) {
    console.error("[POST /api/chat] Error:", error);
    return res.status(500).json({ error: "Failed to process chat" });
  }
});

module.exports = router;
