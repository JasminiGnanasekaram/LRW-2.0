import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { analyticsAPI } from "../api/client";

const COLORS = ["#e8c547", "#4fc3c3", "#e05a5a", "#7c6af7", "#5acd7e", "#f0874a"];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [progress, setProgress] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.overview().catch(() => ({ data: null })),
      analyticsAPI.progress().catch(() => ({ data: [] })),
      analyticsAPI.categoryBreakdown().catch(() => ({ data: [] })),
    ]).then(([ov, pr, cat]) => {
      setOverview(ov.data);
      setProgress(Array.isArray(pr.data) ? pr.data : []);
      setCategories(Array.isArray(cat.data) ? cat.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const masteryData = overview
    ? [
        { name: "New", value: overview.new ?? 0 },
        { name: "In Progress", value: overview.in_progress ?? 0 },
        { name: "Learned", value: overview.learned ?? 0 },
        { name: "Mastered", value: overview.mastered ?? 0 },
      ].filter((d) => d.value > 0)
    : [];

  if (loading) return <div className="page"><div className="loading-block">Loading analytics…</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="page-sub">Your learning insights at a glance</p>
        </div>
      </div>

      {overview && (
        <div className="stat-grid">
          {[
            { label: "Total Words", value: overview.total_words ?? 0, icon: "📚" },
            { label: "Mastered", value: overview.mastered ?? 0, icon: "🏆" },
            { label: "Streak (days)", value: overview.streak ?? 0, icon: "🔥" },
            { label: "This Week", value: overview.this_week ?? 0, icon: "📅" },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <span className="stat-icon">{s.icon}</span>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="charts-grid">
        {progress.length > 0 && (
          <div className="chart-card wide">
            <h3>Learning Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={progress}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="learned" stroke="#5acd7e" strokeWidth={2.5} name="Learned" />
                {progress[0]?.mastered !== undefined && (
                  <Line type="monotone" dataKey="mastered" stroke="#e8c547" strokeWidth={2.5} name="Mastered" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {masteryData.length > 0 && (
          <div className="chart-card">
            <h3>Mastery Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={masteryData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={4} dataKey="value">
                  {masteryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {categories.length > 0 && (
          <div className="chart-card">
            <h3>Words by Category</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!overview && progress.length === 0 && categories.length === 0 && (
        <div className="empty-state">
          <span>📊</span>
          <p>No analytics data yet. Connect your API endpoints to see insights.</p>
        </div>
      )}
    </div>
  );
}
