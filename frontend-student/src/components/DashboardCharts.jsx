 import React, { useMemo, useState } from 'react';
import {
  StressIndexChart,
  StudySleepChart,
  ActivityRadarChart,
  ScreenTimeChart,
} from './AnalyticsCharts';
import TensorInsights from './TensorInsights';
import '../styles/DashboardCharts.css';

const fallbackLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const stressScale = { Low: 30, Medium: 60, High: 85 };

const formatLogLabel = (log, index) => {
  const rawDate = log?.date || log?.createdAt || log?.updatedAt;
  if (!rawDate) return `Log ${index + 1}`;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return `Log ${index + 1}`;
  }
  return parsed.toLocaleDateString(undefined, { weekday: 'short' });
};

const mapStressValue = (log) => {
  if (log?.stressLevel && stressScale[log.stressLevel]) {
    return stressScale[log.stressLevel];
  }
  if (typeof log?.moodRating === 'number') {
    return Math.max(10, Math.min(100, 100 - log.moodRating * 5));
  }
  return 55;
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

function DashboardCharts({ summary, hasDailyLogs, onRequestLog }) {
  const [timeRange, setTimeRange] = useState('7d');
  const [focusMetric, setFocusMetric] = useState('stress');

  const orderedLogs = useMemo(() => {
    if (!summary?.recentLogs?.length) return [];
    return [...summary.recentLogs]
      .filter((log) => log)
      .sort((a, b) => new Date(a?.date || a?.createdAt || 0) - new Date(b?.date || b?.createdAt || 0));
  }, [summary]);

  const rangedLogs = useMemo(() => {
    if (!orderedLogs.length) return [];
    const sliceSize = timeRange === '3d' ? 3 : 7;
    return orderedLogs.slice(-sliceSize);
  }, [orderedLogs, timeRange]);

  const hasChartData = hasDailyLogs && rangedLogs.length > 0;
  const labels = useMemo(
    () => (hasChartData ? rangedLogs.map(formatLogLabel) : fallbackLabels),
    [hasChartData, rangedLogs],
  );

  const studyValues = useMemo(
    () => (hasChartData ? rangedLogs.map((log) => Number(log?.studyHours) || 0) : [4, 3.5, 5, 4.5, 6, 3, 2]),
    [hasChartData, rangedLogs],
  );

  const sleepValues = useMemo(
    () => (hasChartData ? rangedLogs.map((log) => Number(log?.sleepHours) || 0) : [7, 6.5, 7.5, 7, 6, 8, 8.5]),
    [hasChartData, rangedLogs],
  );

  const screenValues = useMemo(
    () => (hasChartData ? rangedLogs.map((log) => Number(log?.screenTime) || 0) : [6, 7.5, 8, 6.5, 9, 5, 4]),
    [hasChartData, rangedLogs],
  );

  const stressValues = useMemo(
    () => (hasChartData ? rangedLogs.map(mapStressValue) : [45, 52, 58, 51, 65, 42, 55]),
    [hasChartData, rangedLogs],
  );

  const focusDetails = useMemo(() => {
    if (!hasChartData) {
      return {
        title: 'Analytics Locked',
        value: '--',
        suffix: '',
        insight: 'Add your first daily log to unlock personalized insights.',
      };
    }

    if (focusMetric === 'sleep') {
      const bestIdx = sleepValues.indexOf(Math.max(...sleepValues));
      return {
        title: 'Average Sleep',
        value: average(sleepValues).toFixed(1),
        suffix: 'h/night',
        insight: `Best rest: ${labels[bestIdx] || 'N/A'}`,
      };
    }

    if (focusMetric === 'screen') {
      const lowestIdx = screenValues.indexOf(Math.min(...screenValues));
      return {
        title: 'Screen Time',
        value: average(screenValues).toFixed(1),
        suffix: 'h/day',
        insight: `Lowest usage: ${labels[lowestIdx] || 'N/A'}`,
      };
    }

    const calmIdx = stressValues.indexOf(Math.min(...stressValues));
    return {
      title: 'Stress Index',
      value: Math.round(average(stressValues)),
      suffix: '/100',
      insight: `Calmest day: ${labels[calmIdx] || 'N/A'}`,
    };
  }, [focusMetric, hasChartData, labels, sleepValues, screenValues, stressValues]);

  const stressDataset = { labels, values: stressValues };
  const studySleepDataset = { labels, study: studyValues, sleep: sleepValues };
  const screenDataset = { labels, values: screenValues };

  const lockedPanel = (
    <div className="charts-locked-panel">
      <p>Analytics activate after you add at least one daily log entry.</p>
      <button className="btn-primary" onClick={onRequestLog}>
        Add Daily Log
      </button>
    </div>
  );

  return (
    <div className="dashboard-charts-section">
      <div className="charts-section-header">
        <h2>Weekly Analytics</h2>
        <p>Explore trends with interactive range and focus controls.</p>
      </div>

      {!hasChartData ? (
        lockedPanel
      ) : (
        <>
          <div className="chart-control-bar">
            <div className="control-group">
              <span>Range</span>
              <button
                className={`control-pill ${timeRange === '3d' ? 'active' : ''}`}
                onClick={() => setTimeRange('3d')}
              >
                3 Days
              </button>
              <button
                className={`control-pill ${timeRange === '7d' ? 'active' : ''}`}
                onClick={() => setTimeRange('7d')}
              >
                Weekly
              </button>
            </div>
            <div className="control-group">
              <span>Focus</span>
              <button
                className={`control-pill ${focusMetric === 'stress' ? 'active' : ''}`}
                onClick={() => setFocusMetric('stress')}
              >
                Stress
              </button>
              <button
                className={`control-pill ${focusMetric === 'sleep' ? 'active' : ''}`}
                onClick={() => setFocusMetric('sleep')}
              >
                Sleep
              </button>
              <button
                className={`control-pill ${focusMetric === 'screen' ? 'active' : ''}`}
                onClick={() => setFocusMetric('screen')}
              >
                Screen Time
              </button>
            </div>
          </div>

          <div className="chart-focus-card">
            <div className="focus-label">Current Focus</div>
            <h3>{focusDetails.title}</h3>
            <div className="focus-value">
              {focusDetails.value}
              <span>{focusDetails.suffix}</span>
            </div>
            <p>{focusDetails.insight}</p>
          </div>

          <TensorInsights logs={orderedLogs} />

          <div className="mini-charts-grid">
            <div className={`mini-chart-card ${focusMetric === 'stress' ? 'is-active' : ''}`}>
              <div className="mini-chart-title">
                <span className="chart-icon">📈</span>
                <h3>Stress Trend</h3>
              </div>
              <div className="mini-chart-container">
                <StressIndexChart data={stressDataset} />
              </div>
            </div>

            <div className={`mini-chart-card ${focusMetric === 'sleep' ? 'is-active' : ''}`}>
              <div className="mini-chart-title">
                <span className="chart-icon">⏰</span>
                <h3>Study vs Sleep</h3>
              </div>
              <div className="mini-chart-container">
                <StudySleepChart summary={summary} dataset={studySleepDataset} />
              </div>
            </div>

            <div className="mini-chart-card">
              <div className="mini-chart-title">
                <span className="chart-icon">🎯</span>
                <h3>Activity Overview</h3>
              </div>
              <div className="mini-chart-container">
                <ActivityRadarChart summary={summary} />
              </div>
            </div>

            <div className={`mini-chart-card ${focusMetric === 'screen' ? 'is-active' : ''}`}>
              <div className="mini-chart-title">
                <span className="chart-icon">📱</span>
                <h3>Screen Time</h3>
              </div>
              <div className="mini-chart-container">
                <ScreenTimeChart summary={summary} dataset={screenDataset} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardCharts;
