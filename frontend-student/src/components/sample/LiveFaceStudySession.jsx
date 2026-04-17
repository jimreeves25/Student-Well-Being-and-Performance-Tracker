import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  endLiveSessionTracking,
  heartbeatLiveSessionTracking,
  saveLiveSessionActivity,
  startLiveSessionTracking,
} from "../../services/api";
import {
  connectStudentSocket,
  disconnectStudentSocket,
} from "../../services/socket";
import "../../styles/LiveFaceStudySession.css";

const DETECTION_INTERVAL_MS = 500;
const SUGGESTION_INTERVAL_MS = 60000;
const ALERT_HISTORY_LIMIT = 6;
const POPUP_TTL_MS = 7000;
const ALERT_COOLDOWN_MS = 45000;
const DROWSY_ALERT_THRESHOLD = 35;
const DROWSY_MOOD_THRESHOLD = 48;
const SLEEP_EYE_CLOSURE_THRESHOLD = 58;
const SLEEP_FATIGUE_THRESHOLD = 62;
const DROWSY_PERSIST_FRAMES = 2;
const DROWSY_CLEAR_FRAMES = 4;
const FACE_LANDMARKER_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_DETECTOR_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

const getActivitySet = (moodTag, stressScore, fatigueScore) => {
  if (moodTag === "Sleepy" || fatigueScore >= 70) {
    return [
      "Stand up and do 20 seconds of light stretching.",
      "Splash cold water on your face, then resume.",
      "Do 15 deep blinks and drink water.",
    ];
  }

  if (stressScore >= 70) {
    return [
      "Try a 4-6 breathing cycle for 45 seconds.",
      "Close extra tabs and keep only one active task.",
      "Relax your jaw and shoulders before next block.",
    ];
  }

  if (moodTag === "Frustrated") {
    return [
      "Switch to a 5-minute easy warm-up question.",
      "Write one tiny next step and do only that.",
      "Take a 60-second reset, then return slowly.",
    ];
  }

  if (moodTag === "Deep Focus") {
    return [
      "Keep this focus: continue for 20 minutes.",
      "Avoid checking phone until next break.",
      "Mark one milestone before pausing.",
    ];
  }

  return [
    "Sit upright and keep your eyes near top-third of screen.",
    "Use a 25-minute focus timer with 5-minute break.",
    "Work on one task only for the next 10 minutes.",
  ];
};

const generateLiveFaceSuggestion = async (sessionContext = {}, studentContext = {}) => {
  const moodTag = sessionContext.moodTag || "Steady";
  const stressScore = Number(sessionContext.stressScore || studentContext.stressLevel || 0);
  const fatigueScore = Number(sessionContext.fatigueScore || 0);
  const drowsyRisk = Number(sessionContext.drowsyRisk || 0);
  const reason = sessionContext.reason || "periodic";

  if (!sessionContext.isFaceDetected && Number(sessionContext.noFaceStreakSeconds || 0) >= 20) {
    return {
      message: "I cannot see you clearly right now. Sit upright, move back into frame, and restart with one 10-minute focus sprint.",
    };
  }

  if (reason === "drowsy") {
    return {
      message:
        "You look tired right now. Stand up for 45 seconds, drink water, then do one small task for 8 minutes before reassessing.",
    };
  }

  if (reason === "stress" || stressScore >= 70) {
    return {
      message:
        "Stress seems elevated. Slow your breathing for 45 seconds, relax shoulders, and continue with only one clear step for the next 10 minutes.",
    };
  }

  if (drowsyRisk >= 60 || fatigueScore >= 65) {
    return {
      message:
        "Fatigue is building. Take a 2-minute reset away from the screen, then return for a shorter focused block.",
    };
  }

  const activitySet = getActivitySet(moodTag, stressScore, fatigueScore);
  return {
    message: activitySet[0] || "Keep going with one focused task for 10 minutes.",
  };
};

const inferEmotionAndStress = (blendshapeCategories = []) => {
  const scoreMap = blendshapeCategories.reduce((acc, category) => {
    acc[category.categoryName] = category.score;
    return acc;
  }, {});

  const average = (...keys) => {
    if (!keys.length) return 0;
    const total = keys.reduce((sum, key) => sum + (scoreMap[key] || 0), 0);
    return total / keys.length;
  };

  const smile = average("mouthSmileLeft", "mouthSmileRight");
  const frown = average("mouthFrownLeft", "mouthFrownRight");
  const browDown = average("browDownLeft", "browDownRight");
  const mouthPress = average("mouthPressLeft", "mouthPressRight");
  const eyeSquint = average("eyeSquintLeft", "eyeSquintRight");
  const eyeBlink = average("eyeBlinkLeft", "eyeBlinkRight");
  const eyeWide = average("eyeWideLeft", "eyeWideRight");
  const browInnerUp = scoreMap.browInnerUp || 0;
  const mouthPucker = scoreMap.mouthPucker || 0;
  const cheekPuff = scoreMap.cheekPuff || 0;
  const jawOpen = scoreMap.jawOpen || 0;
  const mouthDimple = average("mouthDimpleLeft", "mouthDimpleRight");

  const stressRaw =
    (frown * 0.28) +
    (browDown * 0.22) +
    (mouthPress * 0.18) +
    (eyeSquint * 0.14) +
    (browInnerUp * 0.1) +
    (mouthPucker * 0.08) -
    (smile * 0.2);

  const fatigueRaw =
    (eyeBlink * 0.35) +
    (eyeSquint * 0.2) +
    (jawOpen * 0.25) +
    (browInnerUp * 0.1) +
    (1 - eyeWide) * 0.1;

  const eyeClosureSignal = clampPercent(((eyeBlink * 0.55) + (eyeSquint * 0.25) + ((1 - eyeWide) * 0.2)) * 100);
  const yawnSignal = clampPercent(((jawOpen * 0.7) + (mouthPucker * 0.15) + (browInnerUp * 0.15)) * 100);

  const focusRaw =
    (1 - eyeBlink) * 0.35 +
    (1 - eyeSquint) * 0.2 +
    (1 - jawOpen) * 0.2 +
    (smile * 0.15) +
    (1 - frown) * 0.1;

  const stressScore = clampPercent(stressRaw * 100);
  const fatigueScore = clampPercent(fatigueRaw * 100);
  const drowsyRisk = clampPercent((eyeClosureSignal * 0.65) + (yawnSignal * 0.35));
  const focusScore = clampPercent(focusRaw * 100);

  let moodTag = "Balanced";
  if (drowsyRisk >= DROWSY_MOOD_THRESHOLD) {
    moodTag = "Sleepy";
  } else if (stressScore >= 78 && frown > 0.35) {
    moodTag = "Frustrated";
  } else if (stressScore >= 70) {
    moodTag = "Overloaded";
  } else if (fatigueScore >= 62) {
    moodTag = "Low Energy";
  } else if (focusScore >= 68 && stressScore < 60) {
    moodTag = "Deep Focus";
  } else if ((smile + mouthDimple + cheekPuff) / 3 > 0.35) {
    moodTag = "Motivated";
  }

  const emotion =
    moodTag === "Frustrated" ? "Tense" :
    moodTag === "Overloaded" ? "Stressed" :
    moodTag === "Low Energy" ? "Tired" :
    moodTag === "Sleepy" ? "Drowsy" :
    moodTag === "Deep Focus" ? "Focused" :
    moodTag === "Motivated" ? "Positive" :
    "Calm";

  let regulationTip = "Maintain upright posture and keep your breathing steady.";
  if (drowsyRisk >= DROWSY_MOOD_THRESHOLD) {
    regulationTip = "You look sleepy. Stand for 30 seconds, wash face or sip water, then restart with one quick task.";
  } else if (stressScore >= 75) {
    regulationTip = "Take 3 slow breaths (4 sec in, 6 sec out), relax your shoulders, then restart with one small task.";
  } else if (fatigueScore >= 65) {
    regulationTip = "Take a 60-second eye break: look away from screen, blink gently, drink water, then resume.";
  } else if (stressScore >= 55) {
    regulationTip = "Reduce intensity for 2 minutes: slower pace, single-tab focus, and short deep-breath reset.";
  } else if (focusScore >= 70) {
    regulationTip = "Great focus detected. Protect it: keep one-tab study and continue this block for 15-20 minutes.";
  }

  return {
    emotion,
    moodTag,
    stressScore,
    fatigueScore,
    drowsyRisk,
    focusScore,
    eyeClosureSignal,
    yawnSignal,
    regulationTip,
  };
};

function LiveFaceStudySession({ studentContext = {} }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectorKindRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const suggestionTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const suggestionInFlightRef = useRef(false);
  const lastStressSuggestionAtRef = useRef(0);
  const lastDrowsySuggestionAtRef = useRef(0);
  const lastFaceMissingAlertAtRef = useRef(0);
  const lastMoodRef = useRef("Unknown");
  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const alarmModeRef = useRef("normal");
  const drowsyConsecutiveRef = useRef(0);
  const awakeConsecutiveRef = useRef(0);
  const drowsyEmaRef = useRef(null);
  const stressHistoryRef = useRef([]);
  const fatigueHistoryRef = useRef([]);
  const socketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const studentIdRef = useRef(null);
  const lastInteractionAtRef = useRef(Date.now());
  const lastTypingAtRef = useRef(0);
  const pageHiddenRef = useRef(false);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [faceDetections, setFaceDetections] = useState(0);
  const [noFaceStreak, setNoFaceStreak] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastSuggestion, setLastSuggestion] = useState("Start your session and keep your face in frame for real-time focus coaching.");
  const [detectorLabel, setDetectorLabel] = useState("Not initialized");
  const [emotion, setEmotion] = useState("Unknown");
  const [moodTag, setMoodTag] = useState("Unknown");
  const [stressScore, setStressScore] = useState(0);
  const [fatigueScore, setFatigueScore] = useState(0);
  const [drowsyRisk, setDrowsyRisk] = useState(0);
  const [focusScore, setFocusScore] = useState(0);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [avgStress, setAvgStress] = useState(0);
  const [avgFatigue, setAvgFatigue] = useState(0);
  const [stressTrendDelta, setStressTrendDelta] = useState(0);
  const [fatigueTrendDelta, setFatigueTrendDelta] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activityOptions, setActivityOptions] = useState(getActivitySet("Balanced", 0, 0));
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [cameraPopup, setCameraPopup] = useState(null);
  const [regulationTip, setRegulationTip] = useState("Live regulation tips will appear once detection starts.");

  const sessionStartRef = useRef(null);
  const activeSecondsRef = useRef(0);
  const inactiveSecondsRef = useRef(0);
  const isFaceDetectedRef = useRef(false);
  const realtimeStateRef = useRef({
    focusScore: 0,
    drowsyRisk: 0,
    stressScore: 0,
    fatigueScore: 0,
    noFaceSeconds: 0,
  });

  const noFaceSeconds = Math.round((noFaceStreak * DETECTION_INTERVAL_MS) / 1000);

  const resolveStudentId = useCallback(() => {
    if (studentIdRef.current) return studentIdRef.current;

    const rawUser = localStorage.getItem("user");
    if (!rawUser) return null;

    try {
      const parsed = JSON.parse(rawUser);
      const nextId = Number(parsed?.id || 0);
      if (!nextId) return null;
      studentIdRef.current = nextId;
      return nextId;
    } catch {
      return null;
    }
  }, []);

  const emitRealtimeActivity = useCallback((cameraStatus = null, forceSleepDetection = false) => {
    const studentId = resolveStudentId();
    if (!studentId || !socketRef.current) return;

    const now = Date.now();
    const inactivityDuration = Math.max(0, Math.round((now - lastInteractionAtRef.current) / 1000));
    const typingActivity = now - lastTypingAtRef.current <= 10000;
    const nextCameraStatus = cameraStatus || (pageHiddenRef.current ? "hidden" : (isFaceDetectedRef.current ? "active" : "inactive"));
    const realtimeState = realtimeStateRef.current;
    const sleepDetection =
      forceSleepDetection ||
      inactivityDuration > 60 ||
      nextCameraStatus === "tab_closed" ||
      realtimeState.drowsyRisk >= DROWSY_ALERT_THRESHOLD;

    socketRef.current.emit("student_activity", {
      studentId,
      focusLevel: Number(realtimeState.focusScore || 0),
      cameraStatus: nextCameraStatus,
      typingActivity,
      sleepDetection,
      inactivityDuration,
      stressScore: Number(realtimeState.stressScore || 0),
      fatigueScore: Number(realtimeState.fatigueScore || 0),
      noFaceSeconds: Number(realtimeState.noFaceSeconds || 0),
      sessionId: sessionIdRef.current,
    });
  }, [resolveStudentId]);

  const faceConfidence = useMemo(() => {
    const total = faceDetections + noFaceStreak;
    if (total === 0) return 0;
    return Math.round((faceDetections / total) * 100);
  }, [faceDetections, noFaceStreak]);

  const createLiveAlert = useCallback((message, severity = "info", kind = "general", showPopup = true) => {
    const alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      severity,
      kind,
      timestamp: new Date(),
    };

    setLiveAlerts((prev) => [alert, ...prev].slice(0, ALERT_HISTORY_LIMIT));
    if (showPopup) {
      setCameraPopup(alert);
    }
  }, []);

  const recordLiveSuggestion = useCallback(async (message, action, kind = "suggestion", metadata = null) => {
    if (!message) return;

    try {
      await saveLiveSessionActivity({ message, action, kind, metadata });
    } catch (error) {
      console.warn("Could not save live session activity:", error);
    }
  }, []);

  const primeAlarmAudio = useCallback(async () => {
    try {
      if (!soundEnabled) return false;

      const ContextClass = window.AudioContext || window.webkitAudioContext;
      if (!ContextClass) return false;

      if (!audioContextRef.current) {
        audioContextRef.current = new ContextClass();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      return true;
    } catch (audioError) {
      console.warn("Audio unlock failed:", audioError);
      return false;
    }
  }, [soundEnabled]);

  const playWakeTone = useCallback((mode = "normal") => {
    if (!soundEnabled) return;

    try {
      const ContextClass = window.AudioContext || window.webkitAudioContext;
      if (!ContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new ContextClass();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      const isSleepAlarm = mode === "sleep";
      const frequencies = isSleepAlarm ? [1320, 1080, 1320, 880] : [980, 820, 660];
      const gainValue = isSleepAlarm ? 0.9 : 0.28;

      frequencies.forEach((frequency, idx) => {
        const offset = idx * (isSleepAlarm ? 0.12 : 0.18);
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = isSleepAlarm ? "square" : (idx % 2 === 0 ? "triangle" : "square");
        oscillator.frequency.setValueAtTime(frequency, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(gainValue, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + (isSleepAlarm ? 0.1 : 0.14));
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + (isSleepAlarm ? 0.12 : 0.16));
      });
    } catch (audioError) {
      console.warn("Wake tone failed:", audioError);
    }
  }, [soundEnabled]);

  const stopDrowsyAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    alarmModeRef.current = "normal";
    setIsAlarmActive(false);
  }, []);

  const startDrowsyAlarm = useCallback((mode = "normal") => {
    if (!soundEnabled || alarmIntervalRef.current) return;

    alarmModeRef.current = mode;
    playWakeTone(mode);
    alarmIntervalRef.current = window.setInterval(() => {
      playWakeTone(alarmModeRef.current);
    }, mode === "sleep" ? 650 : 1200);
    setIsAlarmActive(true);
  }, [playWakeTone, soundEnabled]);

  const updateTrendMetrics = useCallback((nextStress, nextFatigue) => {
    stressHistoryRef.current = [...stressHistoryRef.current, nextStress].slice(-20);
    fatigueHistoryRef.current = [...fatigueHistoryRef.current, nextFatigue].slice(-20);

    const stressHistory = stressHistoryRef.current;
    const fatigueHistory = fatigueHistoryRef.current;

    const nextAvgStress = stressHistory.reduce((sum, value) => sum + value, 0) / Math.max(1, stressHistory.length);
    const nextAvgFatigue = fatigueHistory.reduce((sum, value) => sum + value, 0) / Math.max(1, fatigueHistory.length);

    const stressHalf = Math.floor(stressHistory.length / 2);
    const fatigueHalf = Math.floor(fatigueHistory.length / 2);

    if (stressHalf >= 3) {
      const oldStressAvg = stressHistory.slice(0, stressHalf).reduce((sum, value) => sum + value, 0) / stressHalf;
      const newStressAvg = stressHistory.slice(stressHalf).reduce((sum, value) => sum + value, 0) / (stressHistory.length - stressHalf);
      setStressTrendDelta(Math.round(newStressAvg - oldStressAvg));
    }

    if (fatigueHalf >= 3) {
      const oldFatigueAvg = fatigueHistory.slice(0, fatigueHalf).reduce((sum, value) => sum + value, 0) / fatigueHalf;
      const newFatigueAvg = fatigueHistory.slice(fatigueHalf).reduce((sum, value) => sum + value, 0) / (fatigueHistory.length - fatigueHalf);
      setFatigueTrendDelta(Math.round(newFatigueAvg - oldFatigueAvg));
    }

    setAvgStress(Math.round(nextAvgStress));
    setAvgFatigue(Math.round(nextAvgFatigue));
  }, []);

  const stopCamera = useCallback(() => {
    if (detectionTimerRef.current) {
      window.clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }

    if (suggestionTimerRef.current) {
      window.clearInterval(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }

    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (detectorRef.current?.close) {
      detectorRef.current.close();
    }

    stopDrowsyAlarm();

    if (audioContextRef.current?.close) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    detectorRef.current = null;
    detectorKindRef.current = null;
    setDetectorLabel("Not initialized");

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsRunning(false);
    setIsFaceDetected(false);
    isFaceDetectedRef.current = false;

    if (activeSecondsRef.current > 0 || inactiveSecondsRef.current > 0) {
      heartbeatLiveSessionTracking({
        activeSeconds: activeSecondsRef.current,
        inactiveSeconds: inactiveSecondsRef.current,
        isActive: isFaceDetectedRef.current,
      }).catch(() => {});
    }

    emitRealtimeActivity(isFaceDetectedRef.current ? "active" : "inactive");
    const studentId = resolveStudentId();
    if (socketRef.current && studentId) {
      socketRef.current.emit("student_offline", { studentId, reason: "student_stopped_session" });
    }

    endLiveSessionTracking().catch(() => {});
    disconnectStudentSocket();
    socketRef.current = null;
    sessionIdRef.current = null;
    activeSecondsRef.current = 0;
    inactiveSecondsRef.current = 0;
  }, [emitRealtimeActivity, resolveStudentId, stopDrowsyAlarm]);

  const stressBand = useMemo(() => {
    if (stressScore >= 75) return "High";
    if (stressScore >= 50) return "Moderate";
    return "Low";
  }, [stressScore]);

  const buildSessionSnapshot = useCallback(() => ({
    elapsedMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
    isFaceDetected,
    noFaceStreakSeconds: noFaceSeconds,
    facePresenceRate: faceConfidence,
    emotion,
    moodTag,
    stressScore,
    stressBand,
    fatigueScore,
    drowsyRisk,
    focusScore,
    isAlarmActive,
    avgStress,
    avgFatigue,
    stressTrendDelta,
    fatigueTrendDelta,
    latestLiveAlert: liveAlerts[0]?.message || "None",
    regulationTip,
  }), [
    elapsedSeconds,
    isFaceDetected,
    noFaceSeconds,
    faceConfidence,
    emotion,
    moodTag,
    stressScore,
    stressBand,
    fatigueScore,
    drowsyRisk,
    focusScore,
    isAlarmActive,
    avgStress,
    avgFatigue,
    stressTrendDelta,
    fatigueTrendDelta,
    liveAlerts,
    regulationTip,
  ]);

  const fetchSuggestion = useCallback(async (reason = "periodic") => {
    if (suggestionInFlightRef.current) return;

    suggestionInFlightRef.current = true;
    try {
      const response = await generateLiveFaceSuggestion(
        {
          ...buildSessionSnapshot(),
          reason,
        },
        studentContext
      );

      if (response?.message) {
        setLastSuggestion(response.message);
        recordLiveSuggestion(response.message, "suggested", "suggestion", { reason });
      }
    } catch (suggestionError) {
      console.error("Live suggestion error:", suggestionError);
    } finally {
      suggestionInFlightRef.current = false;
    }
  }, [buildSessionSnapshot, recordLiveSuggestion, studentContext]);

  const runFaceDetection = async () => {
    if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) {
      return;
    }

    try {
      let foundFace = false;

      if (detectorKindRef.current === "native") {
        const faces = await detectorRef.current.detect(videoRef.current);
        foundFace = Array.isArray(faces) && faces.length > 0;
      } else if (detectorKindRef.current === "mediapipe") {
        const result = detectorRef.current.detectForVideo(videoRef.current, performance.now());
        foundFace = Array.isArray(result?.faceLandmarks) && result.faceLandmarks.length > 0;

        if (foundFace) {
          const blendshapeCategories = result?.faceBlendshapes?.[0]?.categories || [];
          const inferredState = inferEmotionAndStress(blendshapeCategories);
          setEmotion(inferredState.emotion);
          setMoodTag(inferredState.moodTag);
          setStressScore(inferredState.stressScore);
          setFatigueScore(inferredState.fatigueScore);
          const nextEma = drowsyEmaRef.current === null
            ? inferredState.drowsyRisk
            : ((drowsyEmaRef.current * 0.65) + (inferredState.drowsyRisk * 0.35));

          drowsyEmaRef.current = nextEma;
          const smoothedDrowsyRisk = Math.round(nextEma);
          setDrowsyRisk(smoothedDrowsyRisk);
          setFocusScore(inferredState.focusScore);
          realtimeStateRef.current = {
            focusScore: inferredState.focusScore,
            drowsyRisk: smoothedDrowsyRisk,
            stressScore: inferredState.stressScore,
            fatigueScore: inferredState.fatigueScore,
            noFaceSeconds,
          };
          setRegulationTip(inferredState.regulationTip);
          setActivityOptions(getActivitySet(inferredState.moodTag, inferredState.stressScore, inferredState.fatigueScore));
          updateTrendMetrics(inferredState.stressScore, inferredState.fatigueScore);

          if (lastMoodRef.current !== inferredState.moodTag) {
            lastMoodRef.current = inferredState.moodTag;
            createLiveAlert(`Mood shift detected: ${inferredState.moodTag}`, "info", "mood", true);
          }

          const now = Date.now();
          if (inferredState.stressScore >= 70 && now - lastStressSuggestionAtRef.current > ALERT_COOLDOWN_MS) {
            lastStressSuggestionAtRef.current = now;
            createLiveAlert("Stress spike detected. Running a calming intervention.", "warn", "stress", true);
            fetchSuggestion("stress_high");
          }

          const shouldTriggerDrowsyAlarm =
            smoothedDrowsyRisk >= DROWSY_ALERT_THRESHOLD ||
            inferredState.eyeClosureSignal >= SLEEP_EYE_CLOSURE_THRESHOLD ||
            inferredState.fatigueScore >= SLEEP_FATIGUE_THRESHOLD ||
            inferredState.moodTag === "Sleepy";

          const isSleepyState = inferredState.moodTag === "Sleepy" || inferredState.fatigueScore >= SLEEP_FATIGUE_THRESHOLD;

          if (shouldTriggerDrowsyAlarm) {
            drowsyConsecutiveRef.current += 1;
            awakeConsecutiveRef.current = 0;
          } else {
            awakeConsecutiveRef.current += 1;
            drowsyConsecutiveRef.current = 0;
          }

          if (drowsyConsecutiveRef.current >= DROWSY_PERSIST_FRAMES) {
            startDrowsyAlarm(isSleepyState ? "sleep" : "normal");

            if (now - lastDrowsySuggestionAtRef.current > ALERT_COOLDOWN_MS) {
              lastDrowsySuggestionAtRef.current = now;
              createLiveAlert(
                isSleepyState
                  ? "Sleeping detected. Loud wake alarm active."
                  : "Persistent drowsiness detected. Continuous wake alarm active.",
                "critical",
                "drowsy",
                true
              );
              fetchSuggestion("drowsy_detected");
            }
          }

          if (awakeConsecutiveRef.current >= DROWSY_CLEAR_FRAMES) {
            stopDrowsyAlarm();
          }
        }
      } else if (detectorKindRef.current === "mediapipe-detector") {
        const result = detectorRef.current.detectForVideo(videoRef.current, performance.now());
        foundFace = Array.isArray(result?.detections) && result.detections.length > 0;
      }

      setIsFaceDetected(foundFace);
      isFaceDetectedRef.current = foundFace;

      if (foundFace) {
        activeSecondsRef.current += DETECTION_INTERVAL_MS / 1000;
        setFaceDetections((prev) => prev + 1);
        setNoFaceStreak(0);
        realtimeStateRef.current.noFaceSeconds = 0;
      } else {
        inactiveSecondsRef.current += DETECTION_INTERVAL_MS / 1000;
        setNoFaceStreak((prev) => prev + 1);
        realtimeStateRef.current.noFaceSeconds = noFaceSeconds;
        drowsyConsecutiveRef.current = 0;
        awakeConsecutiveRef.current = 0;
        drowsyEmaRef.current = null;
        stopDrowsyAlarm();

        const now = Date.now();
        if (now - lastFaceMissingAlertAtRef.current > ALERT_COOLDOWN_MS) {
          lastFaceMissingAlertAtRef.current = now;
          createLiveAlert("Face missing from frame. Please return to active posture.", "warn", "presence", true);
        }
      }
    } catch (detectError) {
      console.error("Face detection failed:", detectError);
    }
  };

  const initDetector = async () => {
    try {
      const visionTasks = await import("@mediapipe/tasks-vision");
      const vision = await visionTasks.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      detectorRef.current = await visionTasks.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      detectorKindRef.current = "mediapipe";
      setDetectorLabel("MediaPipe Face Landmarker (Emotion + Stress)");
    } catch (landmarkerError) {
      console.warn("FaceLandmarker init failed, falling back:", landmarkerError);

      if ("FaceDetector" in window) {
        detectorRef.current = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 1,
        });
        detectorKindRef.current = "native";
        setDetectorLabel("Native Browser Detector (face presence only)");
        return;
      }

      const visionTasks = await import("@mediapipe/tasks-vision");
      const vision = await visionTasks.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      detectorRef.current = await visionTasks.FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_DETECTOR_MODEL_PATH,
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });

      detectorKindRef.current = "mediapipe-detector";
      setDetectorLabel("MediaPipe Face Detector (presence only)");
    }
  };

  const startCamera = async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API is not available in this browser.");
      return;
    }

    try {
      await primeAlarmAudio();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      await initDetector();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play();
      }

      setIsRunning(true);
      setFaceDetections(0);
      setNoFaceStreak(0);
      isFaceDetectedRef.current = false;
      setElapsedSeconds(0);
      setEmotion("Unknown");
      setMoodTag("Unknown");
      setStressScore(0);
      setFatigueScore(0);
      setDrowsyRisk(0);
      setFocusScore(0);
      setIsAlarmActive(false);
      setAvgStress(0);
      setAvgFatigue(0);
      setStressTrendDelta(0);
      setFatigueTrendDelta(0);
      setLiveAlerts([]);
      setCameraPopup(null);
      setActivityOptions(getActivitySet("Balanced", 0, 0));
      setRegulationTip("Live regulation tips will appear once detection starts.");
      stressHistoryRef.current = [];
      fatigueHistoryRef.current = [];
      drowsyConsecutiveRef.current = 0;
      awakeConsecutiveRef.current = 0;
      drowsyEmaRef.current = null;
      lastMoodRef.current = "Unknown";
      lastInteractionAtRef.current = Date.now();
      lastTypingAtRef.current = Date.now();
      pageHiddenRef.current = false;
      realtimeStateRef.current = {
        focusScore: 0,
        drowsyRisk: 0,
        stressScore: 0,
        fatigueScore: 0,
        noFaceSeconds: 0,
      };
      sessionStartRef.current = Date.now();
      activeSecondsRef.current = 0;
      inactiveSecondsRef.current = 0;
      const liveSessionResponse = await startLiveSessionTracking().catch(() => null);
      sessionIdRef.current = liveSessionResponse?.session?.id || null;

      const studentToken = localStorage.getItem("token");
      const studentId = resolveStudentId();
      if (studentToken && studentId) {
        socketRef.current = connectStudentSocket(studentToken);
        socketRef.current?.emit("student_online", {
          studentId,
          sessionId: sessionIdRef.current,
        });
      }

      detectionTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        setElapsedSeconds(seconds);
        runFaceDetection();
      }, DETECTION_INTERVAL_MS);

      suggestionTimerRef.current = window.setInterval(() => {
        fetchSuggestion("periodic");
      }, SUGGESTION_INTERVAL_MS);

      heartbeatTimerRef.current = window.setInterval(() => {
        emitRealtimeActivity();

        if (activeSecondsRef.current === 0 && inactiveSecondsRef.current === 0) return;

        heartbeatLiveSessionTracking({
          activeSeconds: Math.round(activeSecondsRef.current),
          inactiveSeconds: Math.round(inactiveSecondsRef.current),
          isActive: isFaceDetectedRef.current,
        }).catch(() => {});

        activeSecondsRef.current = 0;
        inactiveSecondsRef.current = 0;
      }, 10000);

      fetchSuggestion("session_started");
    } catch (cameraError) {
      console.error("Camera start error:", cameraError);
      setError(cameraError.message || "Unable to access camera.");
      stopCamera();
    }
  };

  useEffect(() => {
    if (noFaceSeconds > 0 && noFaceSeconds % 10 === 0) {
      fetchSuggestion("face_missing");
    }
  }, [noFaceSeconds, fetchSuggestion]);

  useEffect(() => {
    realtimeStateRef.current.noFaceSeconds = noFaceSeconds;
  }, [noFaceSeconds]);

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const markTyping = () => {
      const now = Date.now();
      lastTypingAtRef.current = now;
      lastInteractionAtRef.current = now;
    };

    const onVisibility = () => {
      pageHiddenRef.current = document.hidden;
      if (!document.hidden) {
        lastInteractionAtRef.current = Date.now();
      }
    };

    const onBeforeUnload = () => {
      if (!isRunning) return;
      const studentId = resolveStudentId();
      if (!socketRef.current || !studentId) return;

      socketRef.current.emit("student_activity", {
        studentId,
        focusLevel: Number(realtimeStateRef.current.focusScore || 0),
        cameraStatus: "tab_closed",
        typingActivity: false,
        sleepDetection: true,
        inactivityDuration: Math.max(0, Math.round((Date.now() - lastInteractionAtRef.current) / 1000)),
      });
      socketRef.current.emit("student_offline", { studentId, reason: "tab_closed" });
    };

    window.addEventListener("mousemove", markInteraction);
    window.addEventListener("mousedown", markInteraction);
    window.addEventListener("touchstart", markInteraction);
    window.addEventListener("scroll", markInteraction, { passive: true });
    window.addEventListener("keydown", markTyping);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("mousemove", markInteraction);
      window.removeEventListener("mousedown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("scroll", markInteraction);
      window.removeEventListener("keydown", markTyping);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isRunning, resolveStudentId]);

  useEffect(() => {
    if (!cameraPopup) return;

    const timeout = window.setTimeout(() => {
      setCameraPopup(null);
    }, POPUP_TTL_MS);

    return () => window.clearTimeout(timeout);
  }, [cameraPopup]);

  useEffect(() => {
    if (!soundEnabled) {
      stopDrowsyAlarm();
    }
  }, [soundEnabled, stopDrowsyAlarm]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled((prev) => {
      const nextEnabled = !prev;

      if (nextEnabled) {
        primeAlarmAudio().catch(() => {});
      } else {
        stopDrowsyAlarm();
      }

      return nextEnabled;
    });
  }, [primeAlarmAudio, stopDrowsyAlarm]);

  const renderTrendTag = (delta) => {
    if (delta >= 8) return "↗ rising";
    if (delta <= -8) return "↘ improving";
    return "→ stable";
  };

  return (
    <div className="live-face-card">
      <div className="live-face-header">
        <h2>Live Face Study Session</h2>
        <p>Uses your system camera to monitor face presence and give real-time focus suggestions.</p>
        <p className="live-face-engine">Detector: {detectorLabel}</p>
      </div>

      <div className="live-face-controls">
        {!isRunning ? (
          <button className="btn-primary" onClick={startCamera}>
            Start Live Session
          </button>
        ) : (
          <button className="btn-logout" onClick={stopCamera}>
            Stop Session
          </button>
        )}
        <button className="live-face-sound-btn" onClick={handleSoundToggle}>
          {soundEnabled ? "🔔 Sound On" : "🔕 Sound Off"}
        </button>
        {isAlarmActive && <span className="live-face-alarm-chip">⚠ Drowsy Alarm Active</span>}
      </div>

      {error && <p className="live-face-error">{error}</p>}

      <div className="live-face-video-wrapper">
        <video ref={videoRef} className="live-face-video" autoPlay muted playsInline />
        <div className={`live-face-indicator ${isFaceDetected ? "face-present" : "face-missing"}`}>
          {isFaceDetected ? "Face detected" : "No face detected"}
        </div>
        {cameraPopup && (
          <div className={`live-face-popup popup-${cameraPopup.severity}`}>
            <strong>Live Response:</strong> {cameraPopup.message}
          </div>
        )}
      </div>

      <div className="live-face-metrics">
        <div>
          <span className="metric-label">Session Time</span>
          <strong>{Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</strong>
        </div>
        <div>
          <span className="metric-label">Face Presence</span>
          <strong>{faceConfidence}%</strong>
        </div>
        <div>
          <span className="metric-label">No-Face Streak</span>
          <strong>{noFaceSeconds}s</strong>
        </div>
        <div>
          <span className="metric-label">Detected Emotion</span>
          <strong>{emotion}</strong>
        </div>
        <div>
          <span className="metric-label">Mood Tag</span>
          <strong>{moodTag}</strong>
        </div>
        <div>
          <span className="metric-label">Stress Score</span>
          <strong>{stressScore}/100 ({stressBand})</strong>
        </div>
        <div>
          <span className="metric-label">Fatigue Score</span>
          <strong>{fatigueScore}/100</strong>
        </div>
        <div>
          <span className="metric-label">Drowsy Risk</span>
          <strong>{drowsyRisk}/100</strong>
        </div>
        <div>
          <span className="metric-label">Focus Score</span>
          <strong>{focusScore}/100</strong>
        </div>
        <div>
          <span className="metric-label">Stress Trend</span>
          <strong>{avgStress}/100 {renderTrendTag(stressTrendDelta)}</strong>
        </div>
        <div>
          <span className="metric-label">Fatigue Trend</span>
          <strong>{avgFatigue}/100 {renderTrendTag(fatigueTrendDelta)}</strong>
        </div>
      </div>

      <div className="live-face-activities">
        <h3>Instant Activity Prompts</h3>
        <ul>
          {activityOptions.map((activity, index) => (
            <li key={`${activity}-${index}`}>{activity}</li>
          ))}
        </ul>
      </div>

      <div className="live-face-regulation">
        <h3>Stress Regulation Prompt</h3>
        <p>{regulationTip}</p>
      </div>

      {liveAlerts.length > 0 && (
        <div className="live-face-alerts">
          <h3>Live Alert Feed</h3>
          <ul>
            {liveAlerts.map((alert) => (
              <li key={alert.id} className={`alert-${alert.severity}`}>
                <span>{alert.message}</span>
                <em>{alert.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="live-face-suggestion">
        <h3>Real-Time Suggestion</h3>
        <p>{lastSuggestion}</p>
      </div>
    </div>
  );
}

export default LiveFaceStudySession;
