import axios from "axios";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPTS = {
  "study-help": "You are an expert AI Study Coach. Help students understand concepts, solve problems, and learn effectively. Be encouraging, clear, and use step-by-step examples.",
  "quiz-me": "You are a quiz master AI. Give one question at a time on the topic the student picks. Wait for their answer, then give feedback and the correct answer if wrong. Be encouraging.",
  "plan-my-day": "You are a productivity coach. Help students plan their study sessions, manage time, and set priorities. Ask about their subjects and deadlines to make a personalized plan.",
  "wellness": "You are a wellness coach for students. Help with stress, sleep, burnout, and study-life balance. Be empathetic and supportive. Suggest professional help for serious concerns.",
};

export const sendMessageToAI = async (messages, modeId = "study-help") => {
  const systemPrompt = SYSTEM_PROMPTS[modeId] || SYSTEM_PROMPTS["study-help"];

  const response = await axios.post(
    ANTHROPIC_URL,
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data.content[0].text;
};
