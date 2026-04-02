export function generateInsight({ mood, studyTime, performance }) {
  if (mood === 0 && studyTime === 0) {
    return "No activity yet. Log your mood or start a study session.";
  }

  if (mood < 40) {
    return "Low mood detected. Keep it light and focus on small tasks.";
  }

  if (studyTime < 30) {
    return "You studied very little. Start a 20-minute focused session.";
  }

  if (performance < 50) {
    return "Your performance is dropping. Focus on revision today.";
  }

  if (mood > 70 && performance > 70) {
    return "Great energy and performance. Go for deep work sessions.";
  }

  return "You're doing okay. Maintain consistency.";
}

export function generatePlan({ mood, performance }) {
  const plan = [];

  if (mood < 40) {
    plan.push("Start with a light 15-minute session");
    plan.push("Take a 10-minute break");
  } else {
    plan.push("Do a 25-minute focused session");
    plan.push("Take a 5-minute break");
  }

  if (performance < 50) {
    plan.push("Revise previous topics");
  } else {
    plan.push("Practice new concepts");
  }

  plan.push("Do a quick self-review");
  plan.push("End with a short relaxation or walk");

  return plan;
}