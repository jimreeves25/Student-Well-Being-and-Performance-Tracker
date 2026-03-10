import React, { useEffect, useMemo, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import '../styles/TensorInsights.css';

const stressScale = { Low: 30, Medium: 60, High: 85 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toNumericLog = (log) => {
  const study = Number(log?.studyHours) || 0;
  const sleep = Number(log?.sleepHours) || 0;
  const screen = Number(log?.screenTime) || 0;
  const stress = log?.stressLevel && stressScale[log.stressLevel]
    ? stressScale[log.stressLevel]
    : typeof log?.moodRating === 'number'
      ? clamp(100 - (log.moodRating * 5), 10, 100)
      : 55;
  const mood = typeof log?.moodRating === 'number' ? log.moodRating : 5;

  return { study, sleep, screen, stress, mood };
};

const normalizeColumns = (rows) => {
  if (!rows.length) {
    return { normalized: [], mins: [], ranges: [] };
  }

  const columnCount = rows[0].length;
  const mins = Array.from({ length: columnCount }, (_, index) => Math.min(...rows.map((row) => row[index])));
  const maxes = Array.from({ length: columnCount }, (_, index) => Math.max(...rows.map((row) => row[index])));
  const ranges = maxes.map((max, index) => Math.max(1e-6, max - mins[index]));

  const normalized = rows.map((row) => row.map((value, index) => (value - mins[index]) / ranges[index]));
  return { normalized, mins, ranges };
};

function TensorInsights({ logs = [] }) {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const numericLogs = useMemo(() => logs.map(toNumericLog), [logs]);
  const hasEnoughData = numericLogs.length >= 3;

  useEffect(() => {
    let isCancelled = false;

    const runPredictions = async () => {
      if (!hasEnoughData) {
        setResult(null);
        setStatus('idle');
        setError('');
        return;
      }

      setStatus('training');
      setError('');

      const stressModel = tf.sequential();
      const focusModel = tf.sequential();

      let stressXTensor;
      let stressYTensor;
      let stressXNormTensor;
      let stressYNormTensor;
      let focusXTensor;
      let focusYTensor;
      let focusXNormTensor;
      let focusYNormTensor;
      let nextStressInputTensor;
      let nextFocusInputTensor;

      try {
        const stressInputs = [];
        const stressTargets = [];

        for (let index = 1; index < numericLogs.length; index += 1) {
          const prev = numericLogs[index - 1];
          const current = numericLogs[index];
          stressInputs.push([prev.study, prev.sleep, prev.screen, prev.stress]);
          stressTargets.push([current.stress]);
        }

        const focusInputs = numericLogs.map((entry) => [entry.study, entry.sleep, entry.screen, entry.stress]);
        const focusTargets = numericLogs.map((entry) => {
          const focusProxy = clamp(
            (entry.mood * 8) + (entry.sleep * 6) + (entry.study * 4) - (entry.screen * 3.2) - (entry.stress * 0.45),
            0,
            100,
          );
          return [focusProxy];
        });

        const stressXNorm = normalizeColumns(stressInputs);
        const stressYNorm = normalizeColumns(stressTargets);
        const focusXNorm = normalizeColumns(focusInputs);
        const focusYNorm = normalizeColumns(focusTargets);

        stressXTensor = tf.tensor2d(stressInputs);
        stressYTensor = tf.tensor2d(stressTargets);
        stressXNormTensor = tf.tensor2d(stressXNorm.normalized);
        stressYNormTensor = tf.tensor2d(stressYNorm.normalized);

        focusXTensor = tf.tensor2d(focusInputs);
        focusYTensor = tf.tensor2d(focusTargets);
        focusXNormTensor = tf.tensor2d(focusXNorm.normalized);
        focusYNormTensor = tf.tensor2d(focusYNorm.normalized);

        stressModel.add(tf.layers.dense({ inputShape: [4], units: 12, activation: 'relu' }));
        stressModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        stressModel.add(tf.layers.dense({ units: 1 }));
        stressModel.compile({ optimizer: tf.train.adam(0.03), loss: 'meanSquaredError' });

        focusModel.add(tf.layers.dense({ inputShape: [4], units: 10, activation: 'relu' }));
        focusModel.add(tf.layers.dense({ units: 1 }));
        focusModel.compile({ optimizer: tf.train.adam(0.03), loss: 'meanSquaredError' });

        await stressModel.fit(stressXNormTensor, stressYNormTensor, {
          epochs: 80,
          batchSize: Math.min(8, stressInputs.length),
          shuffle: true,
          verbose: 0,
        });

        await focusModel.fit(focusXNormTensor, focusYNormTensor, {
          epochs: 70,
          batchSize: Math.min(8, focusInputs.length),
          shuffle: true,
          verbose: 0,
        });

        const latest = numericLogs[numericLogs.length - 1];

        const nextStressInput = [
          (latest.study - stressXNorm.mins[0]) / stressXNorm.ranges[0],
          (latest.sleep - stressXNorm.mins[1]) / stressXNorm.ranges[1],
          (latest.screen - stressXNorm.mins[2]) / stressXNorm.ranges[2],
          (latest.stress - stressXNorm.mins[3]) / stressXNorm.ranges[3],
        ];

        nextStressInputTensor = tf.tensor2d([nextStressInput]);
        const nextStressNormValue = stressModel.predict(nextStressInputTensor).dataSync()[0];
        const nextStress = clamp(
          (nextStressNormValue * stressYNorm.ranges[0]) + stressYNorm.mins[0],
          0,
          100,
        );

        const nextFocusInput = [
          (latest.study - focusXNorm.mins[0]) / focusXNorm.ranges[0],
          (latest.sleep - focusXNorm.mins[1]) / focusXNorm.ranges[1],
          (latest.screen - focusXNorm.mins[2]) / focusXNorm.ranges[2],
          (nextStress - focusXNorm.mins[3]) / focusXNorm.ranges[3],
        ];

        nextFocusInputTensor = tf.tensor2d([nextFocusInput]);
        const nextFocusNormValue = focusModel.predict(nextFocusInputTensor).dataSync()[0];
        const nextFocus = clamp(
          (nextFocusNormValue * focusYNorm.ranges[0]) + focusYNorm.mins[0],
          0,
          100,
        );

        const stressTrainPrediction = stressModel.predict(stressXNormTensor).dataSync();
        const stressActual = stressTargets.map((value) => value[0]);
        const denormalizedStressPredictions = Array.from(stressTrainPrediction).map(
          (value) => (value * stressYNorm.ranges[0]) + stressYNorm.mins[0],
        );
        const mae = denormalizedStressPredictions.reduce(
          (sum, prediction, index) => sum + Math.abs(prediction - stressActual[index]),
          0,
        ) / Math.max(1, denormalizedStressPredictions.length);

        const samplePenalty = Math.max(0, 14 - numericLogs.length) * 2;
        const confidence = clamp(Math.round(100 - (mae * 1.2) - samplePenalty), 35, 96);

        const trendDelta = nextStress - latest.stress;
        const trendLabel = trendDelta >= 3 ? 'Likely increasing' : trendDelta <= -3 ? 'Likely decreasing' : 'Likely stable';

        if (!isCancelled) {
          setResult({
            nextStress: Math.round(nextStress),
            nextFocus: Math.round(nextFocus),
            confidence,
            trendLabel,
          });
          setStatus('ready');
        }
      } catch (modelError) {
        if (!isCancelled) {
          setStatus('error');
          setError('Tensor model could not train from current data. Add more logs and retry.');
        }
      } finally {
        stressModel.dispose();
        focusModel.dispose();
        stressXTensor?.dispose();
        stressYTensor?.dispose();
        stressXNormTensor?.dispose();
        stressYNormTensor?.dispose();
        focusXTensor?.dispose();
        focusYTensor?.dispose();
        focusXNormTensor?.dispose();
        focusYNormTensor?.dispose();
        nextStressInputTensor?.dispose();
        nextFocusInputTensor?.dispose();
      }
    };

    runPredictions();

    return () => {
      isCancelled = true;
    };
  }, [hasEnoughData, numericLogs, refreshTick]);

  const handleRefresh = () => {
    if (status === 'training') return;
    setRefreshTick((prev) => prev + 1);
  };

  if (!hasEnoughData) {
    return (
      <div className="tensor-insights-card">
        <div className="tensor-header">
          <h3>🤖 TensorFlow.js Insights</h3>
          <span className="tensor-chip">Need more data</span>
        </div>
        <p>Add at least 3 days of daily logs to activate TensorFlow.js model predictions.</p>
      </div>
    );
  }

  return (
    <div className="tensor-insights-card">
      <div className="tensor-header">
        <h3>🤖 TensorFlow.js Insights</h3>
        <div className="tensor-header-actions">
          <span className="tensor-chip">Browser ML</span>
          <button
            className="tensor-refresh-btn"
            onClick={handleRefresh}
            disabled={status === 'training'}
          >
            {status === 'training' ? 'Running...' : 'Run ML now'}
          </button>
        </div>
      </div>

      {status === 'training' && (
        <p className="tensor-status">Training TensorFlow.js models on your recent habits...</p>
      )}

      {status === 'error' && <p className="tensor-error">{error}</p>}

      {status === 'ready' && result && (
        <div className="tensor-grid">
          <div className="tensor-metric">
            <span>Predicted Stress</span>
            <strong>{result.nextStress}/100</strong>
          </div>
          <div className="tensor-metric">
            <span>Predicted Focus</span>
            <strong>{result.nextFocus}/100</strong>
          </div>
          <div className="tensor-metric">
            <span>Model Confidence</span>
            <strong>{result.confidence}%</strong>
          </div>
          <div className="tensor-metric">
            <span>Stress Trend</span>
            <strong>{result.trendLabel}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default TensorInsights;