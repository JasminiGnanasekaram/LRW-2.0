import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { adminStats, adminListUsers, adminUpdateUser, adminDeleteUser, adminActivity } from "../api";

const ROLES = ["admin", "researcher", "guest"];
const ROLE_COLORS = { admin: "#1a3a2a", researcher: "#4a7c59", guest: "#c8e3cc" };
const PER_PAGE = 10;

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label.replace(/_/g, " ")}</div>
      <div className="stat-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function FileTypeBadge({ type }) {
  const colors = {
    pdf:   { bg: "#e8f5e9", color: "#2d6a4f" },
    text:  { bg: "#e3f2fd", color: "#1565c0" },
    image: { bg: "#fff8e1", color: "#b45309" },
    audio: { bg: "#fce4ec", color: "#c62828" },
    url:   { bg: "#f3e5f5", color: "#7b1fa2" },
  };
  const c = colors[type] || { bg: "#f5f5f5", color: "#555" };
  return (
    <span style={{
      background: c.bg, color: c.color,
      borderRadius: 12, padding: "2px 10px",
      fontSize: 12, fontWeight: 600,
    }}>
      {(type || "—").toUpperCase()}
    </span>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);

  const showMsg = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(""), 3000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([adminStats(), adminListUsers()]);
      setStats(s); setUsers(u);
      try {
        const a = await adminActivity();
        setActivity(a);
      } catch {
        setActivity([]);
      }
    } catch (err) {
      showMsg(err.response?.data?.detail || "Failed to load admin data.", true);
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const updateRole = async (id, role) => {
    try { await adminUpdateUser(id, { role }); await refresh(); showMsg("Role updated."); }
    catch (e) { showMsg(e.response?.data?.detail || "Update failed.", true); }
  };

  const toggleBlock = async (u) => {
    try {
      await adminUpdateUser(u.id, { blocked: !u.blocked }); await refresh();
      showMsg(`${u.name} ${!u.blocked ? "blocked" : "unblocked"}.`);
    } catch (e) { showMsg(e.response?.data?.detail || "Update failed.", true); }
  };

  const deleteUser = async (u) => {
    if (!confirm(`Delete ${u.name} permanently? This cannot be undone.`)) return;
    try { await adminDeleteUser(u.id); await refresh(); showMsg(`${u.name} deleted.`); }
    catch (e) { showMsg(e.response?.data?.detail || "Delete failed.", true); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchR = !filterRole || u.role === filterRole;
      const matchS =
        !filterStatus ||
        (filterStatus === "active"     && !u.blocked && u.verified) ||
        (filterStatus === "blocked"    && u.blocked) ||
        (filterStatus === "unverified" && !u.verified);
      return matchQ && matchR && matchS;
    });
  }, [users, search, filterRole, filterStatus]);

  const pages      = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const roleCounts = ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r).length }));

  const FILE_TYPE_STATS = ["text", "pdf", "image", "audio", "url"].map((t) => ({
    type: t,
    count: activity.filter((a) => a.file_type === t).length,
  }));

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  const TABS = [
    { key: "overview", label: "📊 Overview" },
    { key: "users",    label: "👥 Users"    },
    { key: "activity", label: "📋 Activity" },
  ];

  return (
    <div className="page-wide">
      <div className="page-header fade-up" style={{
        display: "flex", alignItems: "flex-end",
        justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Monitor users, documents, and system activity</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
      </div>

      {error   && <div className="alert-error fade-up">{error}</div>}
      {success && <div className="alert-success fade-up">{success}</div>}

      <div style={{
        display: "flex", gap: 8, marginBottom: 24,
        borderBottom: "1px solid var(--border)", paddingBottom: 4,
      }}>
        {TABS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding: "8px 20px", borderRadius: 20, border: "none",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: tab === key ? "var(--forest)" : "var(--ivory)",
            color: tab === key ? "#fff" : "var(--ink)",
            transition: "background 0.15s",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          {stats && (
            <div className="stats-grid fade-up fade-up-1">
              {Object.entries(stats).map(([k, v]) => (
                <StatCard key={k} label={k} value={v} />
              ))}
            </div>
          )}

          <div className="fade-up fade-up-2" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20,
          }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Users by Role</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={roleCounts} barSize={28}>
                    <XAxis dataKey="role" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {roleCounts.map((r) => (
                        <Cell key={r.role} fill={ROLE_COLORS[r.role] || "#8fb89a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">User Status</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={[
                      { name: "Active",     value: users.filter((u) => !u.blocked && u.verified).length },
                      { name: "Blocked",    value: users.filter((u) => u.blocked).length },
                      { name: "Unverified", value: users.filter((u) => !u.verified && !u.blocked).length },
                    ]} dataKey="value" cx="50%" cy="50%" outerRadius={60} label>
                      {["#1a3a2a", "#c0392b", "#e67e22"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">Uploads by Type</div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={FILE_TYPE_STATS} barSize={24}>
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4a7c59" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card fade-up fade-up-3">
            <div className="card-title">Top Uploaders</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left",  padding: "8px 12px" }}>User</th>
                  <th style={{ textAlign: "left",  padding: "8px 12px" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "8px 12px" }}>Documents</th>
                </tr>
              </thead>
              <tbody>
                {[...users]
                  .sort((a, b) => (b.doc_count || 0) - (a.doc_count || 0))
                  .slice(0, 10)
                  .map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-lt)" }}>{u.email}</div>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          background: ROLE_COLORS[u.role] || "#ccc", color: "#fff",
                          borderRadius: 12, padding: "2px 10px", fontSize: 12,
                        }}>{u.role}</span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right",
                        fontWeight: 700, color: "var(--forest)" }}>
                        {u.doc_count || 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {tab === "users" && (
        <div className="card fade-up">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Users</div>
            <span className="badge">{filtered.length}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: 200, padding: "6px 10px", fontSize: 13, marginBottom: 0 }}
              />
              <select value={filterRole}
                onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                style={{ width: "auto", padding: "6px 10px", fontSize: 13, marginBottom: 0 }}>
                <option value="">All roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                style={{ width: "auto", padding: "6px 10px", fontSize: 13, marginBottom: 0 }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th>
                  <th>Status</th><th>Docs</th><th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--ink-lt)" }}>
                    No users match your filters.
                  </td></tr>
                )}
                {paginated.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <select value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        style={{ width: "auto", padding: "4px 8px", fontSize: 13, marginBottom: 0 }}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.blocked
                        ? <span className="badge badge-red">Blocked</span>
                        : u.verified
                          ? <span className="badge">Active</span>
                          : <span className="badge badge-amber">Unverified</span>}
                    </td>
                    <td className="muted">{u.doc_count ?? "—"}</td>
                    <td className="muted">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleBlock(u)}
                          style={u.blocked
                            ? { borderColor: "var(--forest)", color: "var(--forest)" }
                            : { borderColor: "var(--warn)", color: "var(--warn)" }}>
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0 4px", borderTop: "1px solid var(--border)", marginTop: 8,
            }}>
              <span className="muted">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button key={p}
                    className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setPage(p)} style={{ minWidth: 34 }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {tab === "activity" && (
        <div className="card fade-up">
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16,
          }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                User Activity
                <span className="badge" style={{ marginLeft: 8 }}>{activity.length}</span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Latest uploads across all users
              </p>
            </div>
          </div>

          {activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--ink-lt)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p>No activity yet. Documents uploaded by users will appear here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th><th>File</th><th>Type</th>
                    <th>Summary</th><th>Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={a.doc_id || i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.user_name}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-lt)" }}>{a.user_email}</div>
                        <span style={{
                          background: ROLE_COLORS[a.user_role] || "#ccc",
                          color: "#fff", borderRadius: 8,
                          padding: "1px 7px", fontSize: 10,
                        }}>{a.user_role}</span>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, wordBreak: "break-word" }}>
                          {a.filename || "—"}
                        </div>
                      </td>
                      <td><FileTypeBadge type={a.file_type} /></td>
                      <td style={{ maxWidth: 260 }}>
                        <span style={{
                          fontSize: 13, color: "var(--ink-lt)", display: "block",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", maxWidth: 260,
                        }}>
                          {a.summary || "—"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13, color: "var(--ink-lt)" }}>
                        {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}