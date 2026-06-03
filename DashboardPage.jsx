import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { analyticsAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#e8c547", "#4fc3c3", "#e05a5a", "#7c6af7", "#5acd7e", "#f0874a"];

const MOCK_OVERVIEW = {
  total_words: 0, learned: 0, in_progress: 0, mastered: 0,
};
const MOCK_PROGRESS = [
  { date: "Mon", learned: 0 }, { date: "Tue", learned: 0 },
  { date: "Wed", learned: 0 }, { date: "Thu", learned: 0 },
  { date: "Fri", learned: 0 }, { date: "Sat", learned: 0 },
  { date: "Sun", learned: 0 },
];
const MOCK_CATEGORIES = [
  { name: "Nouns", value: 0 }, { name: "Verbs", value: 0 },
  { name: "Adjectives", value: 0 }, { name: "Phrases", value: 0 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(MOCK_OVERVIEW);
  const [progress, setProgress] = useState(MOCK_PROGRESS);
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.overview().catch(() => ({ data: MOCK_OVERVIEW })),
      analyticsAPI.progress().catch(() => ({ data: MOCK_PROGRESS })),
      analyticsAPI.categoryBreakdown().catch(() => ({ data: MOCK_CATEGORIES })),
    ]).then(([ov, pr, cat]) => {
      setOverview(ov.data);
      setProgress(Array.isArray(pr.data) ? pr.data : MOCK_PROGRESS);
      setCategories(Array.isArray(cat.data) ? cat.data : MOCK_CATEGORIES);
    }).finally(() => setLoadingStats(false));
  }, []);

  const statCards = [
    { label: "Total Words", value: overview.total_words ?? 0, icon: "📚", color: "var(--accent)" },
    { label: "Learned", value: overview.learned ?? 0, icon: "✅", color: "#5acd7e" },
    { label: "In Progress", value: overview.in_progress ?? 0, icon: "⚡", color: "#4fc3c3" },
    { label: "Mastered", value: overview.mastered ?? 0, icon: "🏆", color: "#e8c547" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Welcome back, <strong>{user?.username || "learner"}</strong></p>
        </div>
        <Link to="/words/new" className="btn-primary">+ Add Word</Link>
      </div>

      <div className="stat-grid">
        {statCards.map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-icon">{s.icon}</span>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loadingStats ? (
        <div className="loading-block">Loading analytics…</div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card wide">
            <h3>Weekly Learning Progress</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progress}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="learned" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Word Categories</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={80} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <Link to="/words" className="action-card">
            <span>📖</span>
            <div>
              <strong>Browse Words</strong>
              <p>Search and manage your lexicon</p>
            </div>
          </Link>
          <Link to="/words/new" className="action-card">
            <span>✏️</span>
            <div>
              <strong>Add Entry</strong>
              <p>Create a new word or phrase</p>
            </div>
          </Link>
          <Link to="/import" className="action-card">
            <span>📥</span>
            <div>
              <strong>Import CSV</strong>
              <p>Bulk upload from file</p>
            </div>
          </Link>
          <Link to="/export" className="action-card">
            <span>📤</span>
            <div>
              <strong>Export Data</strong>
              <p>Download as CSV or JSON</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
