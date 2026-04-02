const BACKEND_CHAT_URL =
  process.env.REACT_APP_CHAT_API_URL?.trim() ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001/api/chat"
    : "/api/chat");

const classifyIntent = (message = "") => {
  const text = String(message).toLowerCase();
  if (/schedule|plan|timetable|routine/.test(text)) return "schedule";
  if (/stress|anxious|overwhelm|panic/.test(text)) return "stress";
  if (/sleep|tired|drowsy|fatigue/.test(text)) return "sleep";
  if (/focus|concentrate|distraction|procrast/.test(text)) return "focus";
  if (/motivat|demotivat|lazy|stuck/.test(text)) return "motivation";
  return "general";
};

const buildStudentProfile = (context = {}) => {
  // Handle null or undefined context
  context = context || {};
  
  const stressLevel = Number(context.stressLevel || 50);
  const avgSleepHours = Number(context.avgSleepHours || 7);
  const avgStudyHours = Number(context.avgStudyHours || 4);
  const moodRating = Number(context.moodRating || 5);

  return {
    stressLevel,
    avgSleepHours,
    avgStudyHours,
    moodRating,
    stressBand: stressLevel >= 70 ? "high" : stressLevel >= 45 ? "moderate" : "low",
    sleepBand: avgSleepHours < 6 ? "low" : avgSleepHours < 7.5 ? "okay" : "good",
  };
};

const formatOfflinePlan = (steps = []) => steps.map((step, index) => `${index + 1}. ${step}`).join("\n");

const generateRuleBasedChatReply = (message, context = {}, history = []) => {
  const profile = buildStudentProfile(context);
  const intent = classifyIntent(message);
  const recentUserPrompts = history
    .filter((item) => item?.role === "user")
    .slice(-2)
    .map((item) => String(item.content || "").trim())
    .filter(Boolean);

  const sharedTip = profile.stressBand === "high"
    ? "Keep blocks short (25 minutes) with 5-minute reset breaks."
    : "Use focused blocks and single-tasking for best retention.";

  if (intent === "schedule") {
    const block = profile.stressBand === "high" ? 25 : 45;
    return `Here is a simple plan for today:\n${formatOfflinePlan([
      `${block}-minute deep-work block on your hardest topic first`,
      "5-10 minute break with water and posture reset",
      `${block}-minute second block on medium topic`,
      "Quick recap: write 3 key takeaways in 5 minutes",
    ])}\n${sharedTip}`;
  }

  if (intent === "stress") {
    return `Try this 3-step stress reset now:\n${formatOfflinePlan([
      "Breathe 4 seconds in, 6 seconds out for 1 minute",
      "Relax shoulders/jaw and unclench hands",
      "Start one tiny task for just 10 minutes",
    ])}\n${sharedTip}`;
  }

  if (intent === "sleep") {
    const sleepTip = profile.sleepBand === "low"
      ? "Aim for +45 minutes earlier bedtime tonight."
      : "Protect your sleep window to keep focus stable.";
    return `For better energy and less drowsiness:\n${formatOfflinePlan([
      "Stop intense screen usage 30 minutes before sleep",
      "Keep a consistent wake-up time",
      "Use a 10-minute wind-down routine",
    ])}\n${sleepTip}`;
  }

  if (intent === "focus") {
    return `Use this quick focus method:\n${formatOfflinePlan([
      "Choose one task and one outcome",
      "Set a timer (25-40 minutes) and mute distractions",
      "After timer ends, take a short movement break",
    ])}\n${sharedTip}`;
  }

  const continuity = recentUserPrompts.length
    ? `I also noticed your recent asks: ${recentUserPrompts.join(" | ")}. `
    : "";

  return `${continuity}I can help with study plans, stress control, sleep habits, and focus. Tell me your goal for today and I’ll give a practical 3-step plan.`;
};

// AI Chatbot Service
export const sendChatMessage = async (message, context = {}, history = []) => {
  try {
    // Handle null or undefined context
    context = context || {};
    
    const recentConversation = history
      .slice(-6)
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 500),
      }));

    const response = await fetch(BACKEND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.REACT_APP_OPENROUTER_MODEL || undefined,
        systemPrompt: `You are a helpful AI study assistant for students. You help with:
- Creating study schedules based on stress levels and sleep patterns
- Providing wellness advice
- Answering questions about productivity and time management
- Motivating students
- Suggesting optimal study and break times

Student Context:
- Stress Level: ${context.stressLevel || "Unknown"}
- Average Sleep: ${context.avgSleepHours || "Unknown"} hours
- Average Study: ${context.avgStudyHours || "Unknown"} hours
- Current Mood: ${context.moodRating || "Unknown"}/10

Response method (easy training rules):
- Adapt suggestions to stress and sleep first.
- Give 3 concrete steps max.
- If user asks for schedule, return a time-block plan.
- Use recent conversation context when relevant.

Be friendly, concise, and practical. Keep responses under 150 words.`,
        messages: [
          {
            role: "user",
            content: "Conversation context follows. Respond to the latest user message.",
          },
          ...recentConversation,
          {
            role: "user",
            content: message
          }
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Chat request failed");

    const reply =
      data?.content?.[0]?.text ||
      data?.choices?.[0]?.message?.content ||
      "No response generated.";

    return {
      message: reply,
      success: true,
      mode: "backend-openrouter",
    };
  } catch (error) {
    console.error("AI Chat error:", error);
    return {
      message: generateRuleBasedChatReply(message, context, history),
      success: true,
      mode: "offline-trained-rules",
      error: error.message,
    };
  }
};

// AI-Powered Auto Scheduler
export const generateSmartSchedule = async (params) => {
  const {
    subjects = [],
    stressIndex = 50,
    avgSleepHours = 7,
    availableHours = 8,
    startTime = "09:00",
  } = params;

  try {
    const prompt = `Create an optimal study schedule for a student with:
- Stress Index: ${stressIndex}/100
- Average Sleep: ${avgSleepHours} hours
- Available Study Time: ${availableHours} hours
- Start Time: ${startTime}
- Subjects: ${subjects.map(s => `${s.name} (${s.difficulty})`).join(", ")}

Generate a JSON schedule with:
1. Optimal study blocks based on cognitive peaks
2. Strategic break times based on stress level
3. Subject order (hardest when most alert)
4. Break duration adjusted for stress

Return ONLY valid JSON in this format:
{
  "schedule": [
    {
      "time": "09:00-10:30",
      "type": "study",
      "subject": "Subject Name",
      "duration": 90,
      "reason": "Peak cognitive performance"
    },
    {
      "time": "10:30-10:45",
      "type": "break",
      "activity": "Short walk",
      "duration": 15,
      "reason": "Prevent mental fatigue"
    }
  ],
  "summary": "Brief schedule summary",
  "tips": ["Tip 1", "Tip 2"]
}`;

    const response = await fetch(BACKEND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.REACT_APP_OPENROUTER_MODEL || undefined,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data?.error || "Schedule request failed");
    }

    const content =
      data?.content?.[0]?.text ||
      data?.choices?.[0]?.message?.content ||
      "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const scheduleData = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        ...scheduleData,
      };
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Auto-scheduler error:", error);
    // Fallback to rule-based scheduling
    return generateFallbackSchedule(params);
  }
};

export const generateLiveFaceSuggestion = async (sessionContext = {}, studentContext = {}) => {
  try {
    const response = await fetch(BACKEND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.REACT_APP_OPENROUTER_MODEL || undefined,
        messages: [
          {
            role: "system",
            content: `You are a real-time study coach.
Give one short, practical suggestion for the student right now.
Rules:
- Keep it under 40 words.
- Be supportive and specific.
- Focus on stress regulation, attention, posture, breathing, break timing, or reducing distractions.
- If face is missing for long, suggest returning to frame and focus.
- If stress is high, suggest a micro-regulation action (breathing reset, posture release, brief pause).
- If fatigue is high, suggest eye-rest and hydration.
- If drowsy risk is high, suggest immediate activation activity (stand up, stretch, cold water, quick movement).
- If trend is worsening, suggest a smaller study block and reset.
- No medical claims.`
          },
          {
            role: "user",
            content: `Live Session Data:
- Elapsed Minutes: ${sessionContext.elapsedMinutes || 0}
- Face Detected Now: ${sessionContext.isFaceDetected ? "Yes" : "No"}
- No-Face Streak (seconds): ${sessionContext.noFaceStreakSeconds || 0}
- Face Presence Rate: ${sessionContext.facePresenceRate || 0}%
- Emotion: ${sessionContext.emotion || "Unknown"}
- Mood Tag: ${sessionContext.moodTag || "Unknown"}
- Stress Score: ${sessionContext.stressScore || 0}/100 (${sessionContext.stressBand || "Unknown"})
- Fatigue Score: ${sessionContext.fatigueScore || 0}/100
- Drowsy Risk: ${sessionContext.drowsyRisk || 0}/100
- Focus Score: ${sessionContext.focusScore || 0}/100
- Avg Stress Trend: ${sessionContext.avgStress || 0}/100
- Avg Fatigue Trend: ${sessionContext.avgFatigue || 0}/100
- Stress Trend Delta: ${sessionContext.stressTrendDelta || 0}
- Fatigue Trend Delta: ${sessionContext.fatigueTrendDelta || 0}
- Latest Live Alert: ${sessionContext.latestLiveAlert || "None"}
- Current Regulation Prompt: ${sessionContext.regulationTip || "None"}
- Trigger Reason: ${sessionContext.reason || "periodic"}

Student Context:
- Stress Level: ${studentContext.stressLevel || "Unknown"}
- Average Sleep: ${studentContext.avgSleepHours || "Unknown"} hours
- Average Study: ${studentContext.avgStudyHours || "Unknown"} hours
- Current Mood: ${studentContext.moodRating || "Unknown"}/10`
          }
        ],
        max_tokens: 120,
        temperature: 0.5,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data?.error || "Suggestion request failed");

    return {
      message:
        data?.content?.[0]?.text ||
        data?.choices?.[0]?.message?.content ||
        "Take a 30-second reset breath and refocus on one clear task.",
      success: true,
    };
  } catch (error) {
    console.error("Live face suggestion error:", error);
    return {
      message: "Keep your face in frame, sit upright, and work in a 25-minute focus block with a short break.",
      success: false,
      error: error.message,
    };
  }
};

// Fallback rule-based scheduler
const generateFallbackSchedule = (params) => {
  const {
    subjects = [],
    stressIndex = 50,
    avgSleepHours = 7,
    startTime = "09:00",
  } = params;

  const schedule = [];
  let currentTime = parseTime(startTime);
  
  // Sort subjects by difficulty (hardest first when fresh)
  const sortedSubjects = [...subjects].sort((a, b) => {
    const difficultyMap = { hard: 3, medium: 2, easy: 1 };
    return (difficultyMap[b.difficulty] || 0) - (difficultyMap[a.difficulty] || 0);
  });

  // Adjust study/break ratio based on stress
  const baseStudyBlock = stressIndex > 70 ? 45 : stressIndex > 40 ? 60 : 90;
  const breakDuration = stressIndex > 70 ? 20 : stressIndex > 40 ? 15 : 10;

  sortedSubjects.forEach((subject, index) => {
    const studyDuration = subject.weightage ? subject.weightage * 60 : baseStudyBlock;
    
    schedule.push({
      time: `${formatTime(currentTime)}-${formatTime(currentTime + studyDuration)}`,
      type: "study",
      subject: subject.name,
      duration: studyDuration,
      reason: index === 0 ? "Peak cognitive performance" : "Sustained focus period",
    });

    currentTime += studyDuration;

    // Add break if not last subject
    if (index < sortedSubjects.length - 1) {
      schedule.push({
        time: `${formatTime(currentTime)}-${formatTime(currentTime + breakDuration)}`,
        type: "break",
        activity: stressIndex > 70 ? "Relaxation exercise" : "Short walk",
        duration: breakDuration,
        reason: "Prevent mental fatigue",
      });
      currentTime += breakDuration;
    }
  });

  return {
    success: true,
    schedule,
    summary: `${sortedSubjects.length} study blocks with optimized breaks based on your stress level`,
    tips: [
      avgSleepHours < 7 ? "Try to get 7-8 hours of sleep for better focus" : "Great sleep! Keep it up",
      stressIndex > 70 ? "Take longer breaks to manage stress" : "Your stress level allows for focused work",
      "Stay hydrated during study sessions",
    ],
  };
};

// Helper functions
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};
