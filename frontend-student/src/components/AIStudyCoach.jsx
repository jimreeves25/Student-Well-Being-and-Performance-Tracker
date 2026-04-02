import { useEffect, useState } from "react";
import { getUserData } from "../utils/storage";
import { generateInsight, generatePlan } from "../utils/aiCoach";

export default function AIStudyCoach() {
  const [data, setData] = useState(getUserData());
  const [insight, setInsight] = useState("");
  const [plan, setPlan] = useState([]);

  useEffect(() => {
    const syncData = () => {
      const newData = getUserData();
      setData(newData);
      setInsight(generateInsight(newData));
    };

    syncData();
    const interval = setInterval(syncData, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleGeneratePlan = () => {
    const newPlan = generatePlan(data);
    setPlan(newPlan);
  };

  return (
    <div className="ai-coach-card">
      <h3>AI Coach Insight</h3>

      <p>Mood: {data.mood}</p>
      <p>Study Time: {data.studyTime} mins</p>
      <p>Performance: {data.performance}</p>

      <p>
        <strong>{insight}</strong>
      </p>

      <button type="button" className="btn-primary" onClick={handleGeneratePlan}>
        Generate Plan
      </button>

      <ul className="ai-coach-plan-list">
        {plan.map((step, index) => (
          <li key={`${step}-${index}`}>{step}</li>
        ))}
      </ul>
    </div>
  );
}
