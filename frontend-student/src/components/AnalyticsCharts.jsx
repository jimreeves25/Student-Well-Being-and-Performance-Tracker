import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AXIS_TICK_COLOR = '#d8e3ef';
const GRID_COLOR = 'rgba(216, 227, 239, 0.22)';
const LEGEND_COLOR = '#e9f2fb';

const baseLegend = {
  display: true,
  position: 'top',
  labels: {
    color: LEGEND_COLOR,
    usePointStyle: true,
    padding: 18,
    boxWidth: 12,
    boxHeight: 12,
    font: { size: 13, weight: '600' },
  },
};

const baseTooltip = {
  backgroundColor: 'rgba(10, 14, 28, 0.94)',
  titleColor: '#ffffff',
  bodyColor: '#e9f2fb',
  borderColor: 'rgba(102, 174, 232, 0.55)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  titleFont: { size: 13, weight: '700' },
  bodyFont: { size: 13 },
};

const axisScales = (max = undefined) => ({
  y: {
    beginAtZero: true,
    ...(Number.isFinite(max) ? { max } : {}),
    grid: { color: GRID_COLOR, lineWidth: 1.1 },
    border: { color: GRID_COLOR },
    ticks: { color: AXIS_TICK_COLOR, font: { size: 12, weight: '600' }, precision: 0 },
  },
  x: {
    grid: { color: 'rgba(216, 227, 239, 0.1)' },
    border: { color: GRID_COLOR },
    ticks: { color: AXIS_TICK_COLOR, font: { size: 12, weight: '600' } },
  },
});

// Stress Index Trend
export const StressIndexChart = ({ data }) => {
  const chartData = {
    labels: data?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Stress Level',
        data: data?.values || [45, 52, 58, 51, 65, 42, 55],
        borderColor: 'rgba(244, 67, 54, 1)',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: 'rgba(244, 67, 54, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        pointHoverRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: baseLegend,
      tooltip: baseTooltip,
    },
    scales: axisScales(100),
  };

  return <Line data={chartData} options={options} />;
};

// Study Hours vs Sleep Hours
export const StudySleepChart = ({ summary, dataset }) => {
  const labels = dataset?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const studySeries = dataset?.study || [4, 3.5, 5, 4.5, 6, 3, 2];
  const sleepSeries = dataset?.sleep || [7, 6.5, 7.5, 7, 6, 8, 8.5];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Study Hours',
        data: studySeries,
        backgroundColor: 'rgba(102, 126, 234, 0.7)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: 'Sleep Hours',
        data: sleepSeries,
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: baseLegend,
      tooltip: {
        ...baseTooltip,
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': ' + context.parsed.y + 'h';
          },
        },
      },
    },
    scales: axisScales(),
  };

  return <Bar data={chartData} options={options} />;
};

// Wellness Breakdown Doughnut
export const WellnessBreakdownChart = ({ summary }) => {
  const chartData = {
    labels: ['Sleep Quality', 'Exercise', 'Nutrition', 'Mental Health'],
    datasets: [
      {
        label: 'Wellness Score',
        data: [
          summary?.todayLog?.sleepQuality === 'Excellent' ? 25 : 20,
          summary?.todayLog?.exerciseMinutes > 30 ? 25 : 20,
          summary?.todayLog?.mealsCount >= 3 ? 25 : 20,
          summary?.todayLog?.moodRating >= 7 ? 25 : 20,
        ],
        backgroundColor: [
          'rgba(76, 175, 80, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(33, 150, 243, 0.8)',
          'rgba(156, 39, 176, 0.8)',
        ],
        borderColor: [
          'rgba(76, 175, 80, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(33, 150, 243, 1)',
          'rgba(156, 39, 176, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        ...baseLegend,
        position: 'right',
      },
      tooltip: {
        ...baseTooltip,
        callbacks: {
          label: function(context) {
            return context.label + ': ' + context.parsed + '%';
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
};

// Activity Radar Chart
export const ActivityRadarChart = ({ summary }) => {
  const chartData = {
    labels: ['Study', 'Sleep', 'Exercise', 'Nutrition', 'Mental Health', 'Water Intake'],
    datasets: [
      {
        label: 'Weekly Average',
        data: [
          (summary?.weeklyStats?.avgStudyHours || 4) * 2.5, // Scale to 10
          (summary?.weeklyStats?.avgSleepHours || 7) * 1.4, // Scale to 10
          Math.min((summary?.weeklyStats?.avgExercise || 20) / 3, 10), // Scale to 10
          (summary?.todayLog?.mealsCount || 3) * 3.3, // Scale to 10
          (summary?.todayLog?.moodRating || 5) * 2, // Scale to 10
          Math.min((summary?.todayLog?.waterIntake || 2) * 5, 10), // Scale to 10
        ],
        borderColor: 'rgba(102, 126, 234, 1)',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderWidth: 2,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(102, 126, 234, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
      {
        label: 'Target',
        data: [10, 10, 10, 10, 10, 10],
        borderColor: 'rgba(202, 188, 239, 1)',
        backgroundColor: 'rgba(202, 188, 239, 0.1)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(202, 188, 239, 1)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: baseLegend,
      tooltip: baseTooltip,
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        grid: { color: GRID_COLOR },
        angleLines: { color: GRID_COLOR },
        pointLabels: { color: LEGEND_COLOR, font: { size: 12, weight: '600' } },
        ticks: { color: AXIS_TICK_COLOR, font: { size: 11, weight: '600' }, backdropColor: 'transparent' },
      },
    },
  };

  return <Radar data={chartData} options={options} />;
};

// Weekly Performance Chart
export const WeeklyPerformanceChart = ({ summary }) => {
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Performance Score',
        data: [72, 78, 85, 80, 88, 75, 82],
        borderColor: 'rgba(76, 175, 80, 1)',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(76, 175, 80, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: baseLegend,
      tooltip: {
        ...baseTooltip,
        callbacks: {
          label: function(context) {
            return 'Score: ' + context.parsed.y + '%';
          },
        },
      },
    },
    scales: axisScales(100),
  };

  return <Line data={chartData} options={options} />;
};

// Screen Time Analysis
export const ScreenTimeChart = ({ summary, dataset }) => {
  const labels = dataset?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = dataset?.values || [6, 7.5, 8, 6.5, 9, 5, 4];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Screen Time (hours)',
        data: values,
        backgroundColor: 'rgba(255, 152, 0, 0.7)',
        borderColor: 'rgba(255, 152, 0, 1)',
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: baseLegend,
      tooltip: {
        ...baseTooltip,
        callbacks: {
          label: function(context) {
            return context.parsed.y + 'h';
          },
        },
      },
    },
    scales: axisScales(),
  };

  return <Bar data={chartData} options={options} />;
};
