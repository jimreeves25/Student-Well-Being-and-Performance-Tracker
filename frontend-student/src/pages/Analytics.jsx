import React from 'react';
import {
  StressIndexChart,
  StudySleepChart,
  WellnessBreakdownChart,
  ActivityRadarChart,
  WeeklyPerformanceChart,
  ScreenTimeChart,
} from '../components/AnalyticsCharts';
import '../styles/Analytics.css';

function Analytics({ summary }) {
  if (!summary) {
    return (
      <div className="analytics-container">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  const hasDailyLogs = Boolean(summary?.recentLogs?.length);

  if (!hasDailyLogs) {
    return (
      <div className="analytics-container analytics-locked">
        <div className="locked-card">
          <h2>Analytics Unlock After Your First Daily Log</h2>
          <p>Add a quick entry on the dashboard to activate charts, insights, and recommendations.</p>
          <div className="locked-actions">
            <button onClick={() => { window.location.hash = ''; }} className="back-to-dashboard-btn">
              ← Back to Dashboard
            </button>
            <button className="unlock-log-btn" onClick={() => { window.location.hash = ''; }}>
              Add Daily Log
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <h1>📊 Student Wellness Analytics</h1>
        <p>Comprehensive insights into your wellness journey</p>
        <button 
          onClick={() => { window.location.hash = ''; }}
          className="back-to-dashboard-btn"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat-item">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <span className="stat-label">Avg Study</span>
            <span className="stat-value">{summary?.weeklyStats?.avgStudyHours || 0}h</span>
          </div>
        </div>
        <div className="quick-stat-item">
          <div className="stat-icon">😴</div>
          <div className="stat-info">
            <span className="stat-label">Avg Sleep</span>
            <span className="stat-value">{summary?.weeklyStats?.avgSleepHours || 0}h</span>
          </div>
        </div>
        <div className="quick-stat-item">
          <div className="stat-icon">💪</div>
          <div className="stat-info">
            <span className="stat-label">Avg Exercise</span>
            <span className="stat-value">{summary?.weeklyStats?.avgExercise || 0}m</span>
          </div>
        </div>
        <div className="quick-stat-item">
          <div className="stat-icon">😊</div>
          <div className="stat-info">
            <span className="stat-label">Mood Rating</span>
            <span className="stat-value">{summary?.todayLog?.moodRating || 5}/10</span>
          </div>
        </div>
        <div className="quick-stat-item">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-label">Stress Index</span>
            <span className="stat-value">{summary?.stressIndex || 0}</span>
          </div>
        </div>
        <div className="quick-stat-item">
          <div className="stat-icon">📱</div>
          <div className="stat-info">
            <span className="stat-label">Avg Screen Time</span>
            <span className="stat-value">{summary?.weeklyStats?.avgScreenTime || 0}h</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Stress Index Trend */}
        <div className="chart-card large">
          <div className="chart-header">
            <h2>Stress Index Trend</h2>
            <p className="chart-subtitle">Weekly stress pattern analysis</p>
          </div>
          <div className="chart-content">
            <StressIndexChart data={summary?.stressTrend} />
          </div>
        </div>

        {/* Activity Radar */}
        <div className="chart-card large">
          <div className="chart-header">
            <h2>Weekly Activity Overview</h2>
            <p className="chart-subtitle">Performance across all wellness areas</p>
          </div>
          <div className="chart-content">
            <ActivityRadarChart summary={summary} />
          </div>
        </div>

        {/* Study vs Sleep */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h2>Study vs Sleep Analysis</h2>
            <p className="chart-subtitle">Daily comparison</p>
          </div>
          <div className="chart-content">
            <StudySleepChart summary={summary} />
          </div>
        </div>

        {/* Screen Time */}
        <div className="chart-card medium">
          <div className="chart-header">
            <h2>Screen Time Tracker</h2>
            <p className="chart-subtitle">Weekly screen usage pattern</p>
          </div>
          <div className="chart-content">
            <ScreenTimeChart summary={summary} />
          </div>
        </div>

        {/* Wellness Breakdown */}
        <div className="chart-card small">
          <div className="chart-header">
            <h2>Wellness Score</h2>
            <p className="chart-subtitle">Daily breakdown</p>
          </div>
          <div className="chart-content">
            <WellnessBreakdownChart summary={summary} />
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="chart-card small">
          <div className="chart-header">
            <h2>Performance Score</h2>
            <p className="chart-subtitle">Weekly trend</p>
          </div>
          <div className="chart-content">
            <WeeklyPerformanceChart summary={summary} />
          </div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="insights-section">
        <h2>🎯 Key Insights</h2>
        <div className="insights-grid">
          <div className="insight-card success">
            <div className="insight-icon">✅</div>
            <h3>Strength</h3>
            <p>Your stress management has improved by 15% this week. Keep up the great work!</p>
          </div>
          <div className="insight-card warning">
            <div className="insight-icon">⚠️</div>
            <h3>Attention Needed</h3>
            <p>Screen time is slightly above recommended levels. Consider taking more breaks.</p>
          </div>
          <div className="insight-card info">
            <div className="insight-icon">💡</div>
            <h3>Recommendation</h3>
            <p>Increase exercise by 10 minutes daily to boost mood and reduce stress.</p>
          </div>
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="trend-analysis">
        <h2>📈 Trend Analysis</h2>
        <div className="trend-items">
          <div className="trend-item">
            <div className="trend-title">Sleep Quality</div>
            <div className="trend-bar">
              <div className="trend-fill" style={{ width: '75%' }}></div>
            </div>
            <span className="trend-label">75% - Good</span>
          </div>
          <div className="trend-item">
            <div className="trend-title">Study Consistency</div>
            <div className="trend-bar">
              <div className="trend-fill" style={{ width: '82%' }}></div>
            </div>
            <span className="trend-label">82% - Excellent</span>
          </div>
          <div className="trend-item">
            <div className="trend-title">Exercise Routine</div>
            <div className="trend-bar">
              <div className="trend-fill" style={{ width: '58%' }}></div>
            </div>
            <span className="trend-label">58% - Fair</span>
          </div>
          <div className="trend-item">
            <div className="trend-title">Nutrition</div>
            <div className="trend-bar">
              <div className="trend-fill" style={{ width: '70%' }}></div>
            </div>
            <span className="trend-label">70% - Good</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
