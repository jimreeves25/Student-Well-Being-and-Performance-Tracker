/**
 * EXAMPLE: Real-Time Data Sync Implementation
 * 
 * Shows how to use the new useDataSync hook for auto-refetch
 * and automatic cache invalidation.
 * 
 * Usage in existing Dashboard.jsx:
 * 1. Import the hook
 * 2. Replace fetch logic with useDataSync
 * 3. Wrap mutations with useDataMutation
 * 4. Automatic refetch happens on save!
 */

// ============================================================
// EXAMPLE 1: Auto-Fetch Dashboard Summary
// ============================================================

import { useDataSync, useDataMutation, useCacheInvalidation, invalidateCache } from "../hooks/useDataSync";
import { getDashboardSummary, saveDailyLog } from "../services/api";

function DashboardExample() {
  // Auto-fetch summary every 30 seconds
  const { 
    data: summary, 
    loading: summaryLoading, 
    error: summaryError,
    refetch 
  } = useDataSync(
    () => getDashboardSummary(),
    { 
      autoRefetchInterval: 30000,  // 30 seconds
      onError: (err) => console.error("Dashboard fetch failed:", err)
    }
  );

  // Save daily log & auto-refetch summary
  const { 
    mutate: handleSaveDailyLog, 
    loading: saveLoading,
    error: saveError 
  } = useDataMutation(
    (logData) => saveDailyLog(logData),
    () => refetch()  // Auto-refetch summary after saving log
  );

  const handleFormSubmit = async (logData) => {
    try {
      await handleSaveDailyLog(logData);
      console.log("Log saved! Summary will refetch automatically...");
    } catch (err) {
      console.error("Failed to save log:", err);
    }
  };

  if (summaryLoading) return <div>Loading dashboard...</div>;
  if (summaryError) return <div>Error: {summaryError.message}</div>;

  return (
    <div>
      <h2>Wellness Dashboard</h2>
      
      {/* Display summary data */}
      <div className="stats">
        <p>Stress Index: {summary?.stressIndex}</p>
        <p>Academic Score: {summary?.academicScore}</p>
        <p>Avg Sleep: {summary?.weeklyStats.avgSleepHours} hours</p>
      </div>

      {/* Form to save daily log */}
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        handleFormSubmit({
          studyHours: formData.get('studyHours'),
          sleepHours: formData.get('sleepHours'),
          moodRating: formData.get('moodRating'),
        });
      }}>
        <input type="number" name="studyHours" placeholder="Study hours" required />
        <input type="number" name="sleepHours" placeholder="Sleep hours" required />
        <input type="number" name="moodRating" placeholder="Mood rating" min="1" max="10" required />
        
        <button disabled={saveLoading}>
          {saveLoading ? "Saving..." : "Save Daily Log"}
        </button>
        
        {saveError && <span style={{ color: 'red' }}>{saveError.message}</span>}
      </form>

      {/* Manual refetch button */}
      <button onClick={() => refetch()}>
        Refresh Data Now
      </button>
    </div>
  );
}

// ============================================================
// EXAMPLE 2: Multiple Data Syncs with Cache Invalidation
// ============================================================

function DashboardAdvanced() {
  // Fetch multiple data sources
  const summary = useDataSync(() => getDashboardSummary());
  const logs = useDataSync(() => getDailyLogs());
  const sessions = useDataSync(() => getStudySessions());

  // Listen for cache invalidation events
  useCacheInvalidation("dashboard-summary", () => summary.refetch());
  useCacheInvalidation("daily-logs", () => logs.refetch());
  useCacheInvalidation("study-sessions", () => sessions.refetch());

  // Save and trigger ALL related cache invalidations
  const handleSaveLog = async (logData) => {
    await saveDailyLog(logData);
    
    // Trigger all related refetches
    invalidateCache("dashboard-summary");  // Re-fetch summary stats
    invalidateCache("daily-logs");         // Re-fetch logs list
  };

  return (
    <div>
      <Component data={summary.data} loading={summary.loading} />
      <Component data={logs.data} loading={logs.loading} />
      <Component data={sessions.data} loading={sessions.loading} />
      
      <button onClick={() => handleSaveLog({/* data */})}>
        Save and Sync All
      </button>
    </div>
  );
}

// ============================================================
// EXAMPLE 3: Polling-Based Sync (Alternative to Interval)
// ============================================================

function DashboardWithPolling() {
  const [isVisible, setIsVisible] = useState(true);

  // Only refetch when page is visible (save bandwidth)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const summary = useDataSync(
    () => getDashboardSummary(),
    { 
      autoRefetchInterval: isVisible ? 30000 : 0  // Pause polling when hidden
    }
  );

  return <Dashboard summary={summary.data} />;
}

// ============================================================
// EXAMPLE 4: Mutation with Optimistic Updates
// ============================================================

function DashboardWithOptimistic() {
  const [summary, setSummary] = useState(null);
  const { mutate: handleSaveLog } = useDataMutation(
    (logData) => saveDailyLog(logData),
    async () => {
      // Auto-refetch will set the real data from backend
      const fresh = await getDashboardSummary();
      setSummary(fresh);
    }
  );

  const handleSubmit = async (logData) => {
    // Optimistic update - show immediate feedback
    setSummary({
      ...summary,
      todayLog: logData,
      stressIndex: calculateStressFromLog(logData)
    });

    try {
      // Save to backend
      await handleSaveLog(logData);
      // Auto-refetch replaces optimistic data with real data
    } catch (err) {
      // Revert on error - refetch gets real data
      await getDashboardSummary().then(setSummary);
      alert("Failed to save: " + err.message);
    }
  };

  return <SaveForm onSubmit={handleSubmit} />;
}

// ============================================================
// EXAMPLE 5: Real-Time Updates via WebSocket (Advanced)
// ============================================================

import io from "socket.io-client";

function DashboardWithRealTime() {
  const summary = useDataSync(() => getDashboardSummary());
  const [socketConnected, setSocketConnected] = useState(false);

  // Connect to real-time updates
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL);

    socket.on("connect", () => {
      setSocketConnected(true);
      console.log("Connected to real-time updates");
    });

    socket.on("dailyLogUpdated", (data) => {
      console.log("New log received:", data);
      // Refetch to get latest aggregated stats
      summary.refetch();
    });

    socket.on("disconnect", () => setSocketConnected(false));

    return () => socket.disconnect();
  }, [summary]);

  return (
    <div>
      <span style={{ color: socketConnected ? 'green' : 'red' }}>
        {socketConnected ? '🔴 Live' : '⚪ Offline'}
      </span>
      <Dashboard summary={summary.data} />
    </div>
  );
}

// ============================================================
// IMPLEMENTATION MIGRATION GUIDE
// ============================================================

/**
 * STEP 1: Replace useEffect fetch with useDataSync
 * 
 * BEFORE:
 * useEffect(() => {
 *   getDashboardSummary()
 *     .then(setSummary)
 *     .catch(setError);
 * }, []);
 * 
 * AFTER:
 * const { data: summary, error, refetch } = useDataSync(
 *   () => getDashboardSummary()
 * );
 */

/**
 * STEP 2: Wrap mutations with useDataMutation
 * 
 * BEFORE:
 * const handleSave = async (data) => {
 *   await saveDailyLog(data);
 *   // Manual refetch
 *   const fresh = await getDashboardSummary();
 *   setSummary(fresh);
 * };
 * 
 * AFTER:
 * const { mutate: handleSave } = useDataMutation(
 *   (data) => saveDailyLog(data),
 *   () => refetch()  // Auto-refetch
 * );
 */

/**
 * STEP 3: Enable cache invalidation for complex UIs
 * 
 * In component that saves:
 * await handleSave(data);
 * invalidateCache("dashboard-summary");
 * 
 * In component that displays:
 * useCacheInvalidation("dashboard-summary", () => refetch());
 */

export {
  DashboardExample,
  DashboardAdvanced,
  DashboardWithPolling,
  DashboardWithOptimistic,
  DashboardWithRealTime
};
