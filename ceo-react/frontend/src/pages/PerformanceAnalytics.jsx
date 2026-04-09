import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useApp } from '../App';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
  },
  scales: {
    x: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
    y: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 }, padding: 16 } },
  },
};

export default function PerformanceAnalytics() {
  const { showToast } = useApp();
  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        api.getDailyReport(),
        api.getWeeklyScorecard(),
      ]);
      if (dailyRes.success) setDailyData(dailyRes);
      if (weeklyRes.success) setWeeklyData(weeklyRes);
      if (!dailyRes.success && !weeklyRes.success) {
        showToast('Failed to load analytics data', 'error');
      }
    } catch {
      showToast('Error loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  }

  const lineChartData = useMemo(() => {
    if (!dailyData || !dailyData.days) return null;
    const days = [...dailyData.days].reverse();
    return {
      labels: days.map(d => d.dateFormatted || d.date),
      datasets: [{
        label: 'Completion %',
        data: days.map(d => d.completionPct || 0),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    };
  }, [dailyData]);

  const barChartData = useMemo(() => {
    if (!dailyData || !dailyData.days) return null;
    const days = [...dailyData.days].slice(0, 14).reverse();
    return {
      labels: days.map(d => d.dateFormatted || d.date),
      datasets: [
        {
          label: 'Scheduled',
          data: days.map(d => d.scheduled || 0),
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderRadius: 4,
        },
        {
          label: 'Completed',
          data: days.map(d => d.completed || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.6)',
          borderRadius: 4,
        },
      ],
    };
  }, [dailyData]);

  const doughnutChartData = useMemo(() => {
    if (!dailyData || !dailyData.monthlySummary) return null;
    const { totalScheduled = 0, totalCompleted = 0 } = dailyData.monthlySummary;
    const incomplete = Math.max(0, totalScheduled - totalCompleted);
    return {
      labels: ['Completed', 'Incomplete'],
      datasets: [{
        data: [totalCompleted, incomplete],
        backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(239, 68, 68, 0.5)'],
        borderColor: ['rgba(34, 197, 94, 1)', 'rgba(239, 68, 68, 1)'],
        borderWidth: 1,
      }],
    };
  }, [dailyData]);

  const summaryStats = useMemo(() => {
    const stats = { avgCompletion: 0, bestDay: '--', totalWeeks: 0, bestWeek: '--' };
    if (dailyData && dailyData.monthlySummary) {
      stats.avgCompletion = dailyData.monthlySummary.overallCompletionPct || 0;
    }
    if (dailyData && dailyData.days && dailyData.days.length > 0) {
      const best = dailyData.days.reduce((prev, cur) =>
        (cur.completionPct || 0) > (prev.completionPct || 0) ? cur : prev
      , dailyData.days[0]);
      stats.bestDay = `${best.dateFormatted || best.date} (${best.completionPct || 0}%)`;
    }
    if (weeklyData && weeklyData.weeks) {
      stats.totalWeeks = weeklyData.weeks.filter(w => w.planned > 0).length;
      const activeWeeks = weeklyData.weeks.filter(w => w.planned > 0);
      if (activeWeeks.length > 0) {
        const best = activeWeeks.reduce((prev, cur) =>
          (cur.completionPct || 0) > (prev.completionPct || 0) ? cur : prev
        , activeWeeks[0]);
        stats.bestWeek = `W${best.weekNum} (${best.completionPct || 0}%)`;
      }
    }
    return stats;
  }, [dailyData, weeklyData]);

  if (loading) {
    return (
      <div>
        <div className="page-header"></div>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-outline" onClick={loadData}>Refresh</button>
      </div>

      {/* Summary Stats */}
      <div className="kpi-grid">
        <div className="kpi-card accent-primary">
          <div className="kpi-label">Avg Completion</div>
          <div className="kpi-value">{summaryStats.avgCompletion}%</div>
          <div className="kpi-change">Last 30 days</div>
        </div>
        <div className="kpi-card accent-success">
          <div className="kpi-label">Best Day</div>
          <div className="kpi-value" style={{ fontSize: '1rem' }}>{summaryStats.bestDay}</div>
          <div className="kpi-change">Highest completion</div>
        </div>
        <div className="kpi-card accent-info">
          <div className="kpi-label">Active Weeks</div>
          <div className="kpi-value">{summaryStats.totalWeeks}</div>
          <div className="kpi-change">With planned tasks</div>
        </div>
        <div className="kpi-card accent-accent">
          <div className="kpi-label">Best Week</div>
          <div className="kpi-value" style={{ fontSize: '1rem' }}>{summaryStats.bestWeek}</div>
          <div className="kpi-change">Highest completion</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>

        {/* Line Chart - Daily Completion */}
        <div className="glass-card">
          <div className="glass-card-header">Daily Completion % (Last 30 Days)</div>
          <div style={{ padding: '1rem 1.25rem', height: 300 }}>
            {lineChartData ? (
              <Line data={lineChartData} options={{
                ...chartDefaults,
                plugins: { ...chartDefaults.plugins, title: { display: false } },
                scales: {
                  ...chartDefaults.scales,
                  y: { ...chartDefaults.scales.y, min: 0, max: 100 },
                },
              }} />
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.5, paddingTop: '4rem' }}>No daily data available</p>
            )}
          </div>
        </div>

        {/* Bar Chart - Scheduled vs Completed */}
        <div className="glass-card">
          <div className="glass-card-header">Scheduled vs Completed (Last 14 Days)</div>
          <div style={{ padding: '1rem 1.25rem', height: 300 }}>
            {barChartData ? (
              <Bar data={barChartData} options={{
                ...chartDefaults,
                plugins: { ...chartDefaults.plugins, title: { display: false } },
                scales: {
                  ...chartDefaults.scales,
                  y: { ...chartDefaults.scales.y, beginAtZero: true },
                },
              }} />
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.5, paddingTop: '4rem' }}>No daily data available</p>
            )}
          </div>
        </div>

        {/* Doughnut Chart - Task Distribution */}
        <div className="glass-card">
          <div className="glass-card-header">Task Status Distribution</div>
          <div style={{ padding: '1rem 1.25rem', height: 300, display: 'flex', justifyContent: 'center' }}>
            {doughnutChartData ? (
              <div style={{ width: '100%', maxWidth: 280 }}>
                <Doughnut data={doughnutChartData} options={doughnutOptions} />
              </div>
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.5, paddingTop: '4rem' }}>No data available</p>
            )}
          </div>
        </div>

        {/* Weekly Trend */}
        {weeklyData && weeklyData.weeks && weeklyData.weeks.filter(w => w.planned > 0).length > 0 && (
          <div className="glass-card">
            <div className="glass-card-header">Weekly Completion Trend</div>
            <div style={{ padding: '1rem 1.25rem', height: 300 }}>
              <Line
                data={{
                  labels: weeklyData.weeks.filter(w => w.planned > 0).map(w => `W${w.weekNum}`),
                  datasets: [{
                    label: 'Completion %',
                    data: weeklyData.weeks.filter(w => w.planned > 0).map(w => w.completionPct || 0),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                  }],
                }}
                options={{
                  ...chartDefaults,
                  plugins: { ...chartDefaults.plugins, title: { display: false } },
                  scales: {
                    ...chartDefaults.scales,
                    y: { ...chartDefaults.scales.y, min: 0, max: 100 },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
