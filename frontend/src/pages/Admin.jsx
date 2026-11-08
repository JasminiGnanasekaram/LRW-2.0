import { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { adminStats, adminListUsers, adminUpdateUser, adminDeleteUser } from "../api";

const ROLES = ["admin", "researcher", "student", "guest"];
const ROLE_COLORS = { admin: "#1a3a2a", researcher: "#4a7c59", student: "#8fb89a", guest: "#c8e3cc" };
const PER_PAGE = 10;

// Only the numbers an admin actually needs (the backend sends more).
const STAT_CARDS = [
  { key: "users", label: "Total users" },
  { key: "verified_users", label: "Verified users" },
  { key: "blocked_users", label: "Blocked users" },
  { key: "raw_documents", label: "Uploaded documents" },
];

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function ConfirmDialog({ user, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      onClick={() => !busy && onCancel()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, padding: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(26, 58, 42, 0.45)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 420, width: "100%", marginBottom: 0, boxShadow: "var(--shadow-lg)" }}
      >
        <div id="delete-title" className="card-title">Delete {user.name}?</div>
        <p className="muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>
          This permanently removes the account for {user.email}. You can't undo this.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);       // first load only
  const [refreshing, setRefreshing] = useState(false); // later reloads keep the page on screen
  const [busyId, setBusyId] = useState(null);          // user currently being changed
  const [confirmUser, setConfirmUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);

  const showMsg = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); setTimeout(() => setError(""), 3500); }
    else { setSuccess(msg); setError(""); setTimeout(() => setSuccess(""), 3500); }
  };

  const refresh = async ({ background = false } = {}) => {
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const [s, u] = await Promise.all([adminStats(), adminListUsers()]);
      setStats(s); setUsers(u);
    } catch (err) {
      showMsg(err.response?.data?.detail || "Couldn't load admin data. Try refreshing.", true);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const updateRole = async (u, role) => {
    setBusyId(u.id);
    try {
      await adminUpdateUser(u.id, { role });
      await refresh({ background: true });
      showMsg(`${u.name} is now ${role === "admin" ? "an admin" : `a ${role}`}.`);
    } catch (e) {
      showMsg(e.response?.data?.detail || "Couldn't change the role.", true);
    } finally { setBusyId(null); }
  };

  const toggleBlock = async (u) => {
    setBusyId(u.id);
    try {
      await adminUpdateUser(u.id, { blocked: !u.blocked });
      await refresh({ background: true });
      showMsg(`${u.name} ${u.blocked ? "unblocked" : "blocked"}.`);
    } catch (e) {
      showMsg(e.response?.data?.detail || "Couldn't update the user.", true);
    } finally { setBusyId(null); }
  };

  const deleteUser = async () => {
    const u = confirmUser;
    if (!u) return;
    setBusyId(u.id);
    try {
      await adminDeleteUser(u.id);
      setConfirmUser(null);
      await refresh({ background: true });
      showMsg(`${u.name} deleted.`);
    } catch (e) {
      setConfirmUser(null);
      showMsg(e.response?.data?.detail || "Couldn't delete the user.", true);
    } finally { setBusyId(null); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchR = !filterRole || u.role === filterRole;
      const matchS =
        !filterStatus ||
        (filterStatus === "active" && !u.blocked && u.verified) ||
        (filterStatus === "blocked" && u.blocked) ||
        (filterStatus === "unverified" && !u.verified && !u.blocked);
      return matchQ && matchR && matchS;
    });
  }, [users, search, filterRole, filterStatus]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pages); // stays valid after a delete or filter change
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const roleCounts = ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r).length }));

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page-wide">
      <div className="page-header fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Admin dashboard</h1>
          <p className="page-subtitle">Manage users and monitor system statistics</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => refresh({ background: true })} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && <div className="alert-error fade-up" role="alert">{error}</div>}
      {success && <div className="alert-success fade-up" role="status">{success}</div>}

      {/* Stats */}
      {stats && (
        <div className="stats-grid fade-up fade-up-1">
          {STAT_CARDS.map(({ key, label }) => (
            <StatCard key={key} label={label} value={stats[key] ?? 0} />
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card fade-up fade-up-2">
        <div className="card-title">Users by role</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={roleCounts} barSize={36}>
              <XAxis dataKey="role" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
                {roleCounts.map((r) => (
                  <Cell key={r.role} fill={ROLE_COLORS[r.role] || "#8fb89a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Users table */}
      <div className="card fade-up fade-up-3">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Users</div>
          <span className="badge">{filtered.length}</span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              aria-label="Search users"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: 200, padding: "6px 10px", fontSize: 13, marginBottom: 0 }}
            />
            <select
              aria-label="Filter by role"
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
              style={{ width: "auto", padding: "6px 10px", fontSize: 13, marginBottom: 0 }}
            >
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ width: "auto", padding: "6px 10px", fontSize: 13, marginBottom: 0 }}
            >
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
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--ink-lt)" }}>
                    {users.length === 0 ? "No users yet." : "No users match your search or filters."}
                  </td>
                </tr>
              )}
              {paginated.map((u) => {
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} style={busy ? { opacity: 0.6 } : undefined}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={busy}
                        onChange={(e) => updateRole(u, e.target.value)}
                        style={{ width: "auto", padding: "4px 8px", fontSize: 13, marginBottom: 0 }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.blocked
                        ? <span className="badge badge-red">Blocked</span>
                        : u.verified
                          ? <span className="badge">Active</span>
                          : <span className="badge badge-amber">Unverified</span>
                      }
                    </td>
                    <td className="muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => toggleBlock(u)}
                          style={u.blocked ? { borderColor: "var(--forest)", color: "var(--forest)" } : { borderColor: "var(--warn)", color: "var(--warn)" }}
                        >
                          {busy ? "Saving…" : u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setConfirmUser(u)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 4px", borderTop: "1px solid var(--border)", marginTop: 8 }}>
            <span className="muted">
              {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === currentPage ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  style={{ minWidth: 34 }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmUser && (
        <ConfirmDialog
          user={confirmUser}
          busy={busyId === confirmUser.id}
          onCancel={() => setConfirmUser(null)}
          onConfirm={deleteUser}
        />
      )}
    </div>
  );
}
