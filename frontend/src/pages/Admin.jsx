import { useEffect, useState } from "react";
import { adminStats, adminListUsers, adminUpdateUser, adminDeleteUser } from "../api";

const ROLES = ["admin", "researcher", "student", "guest"];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([adminStats(), adminListUsers()]);
      setStats(s); setUsers(u); setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const updateRole = async (id, role) => {
    try { await adminUpdateUser(id, { role }); refresh(); }
    catch (e) { setError(e.response?.data?.detail || "Update failed"); }
  };
  const toggleBlock = async (u) => {
    try { await adminUpdateUser(u.id, { blocked: !u.blocked }); refresh(); }
    catch (e) { setError(e.response?.data?.detail || "Update failed"); }
  };
  const deleteUser = async (id) => {
    if (!confirm("Delete this user permanently?")) return;
    try { await adminDeleteUser(id); refresh(); }
    catch (e) { setError(e.response?.data?.detail || "Delete failed"); }
  };

  if (loading) return <p className="muted">Loading...</p>;

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {error && <div className="error">{error}</div>}

      {stats && (
        <div className="card">
          <h2>System Stats</h2>
          <div className="row">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} style={{ minWidth: 140 }}>
                <div className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>{k.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 28, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Users ({users.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th>
              <th>Verified</th><th>Blocked</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} style={{ width: "auto", marginBottom: 0 }}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.verified ? "✓" : "—"}</td>
                <td>{u.blocked ? "✓" : "—"}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}</td>
                <td>
                  <button className="ghost" onClick={() => toggleBlock(u)} style={{ padding: "4px 10px", marginRight: 4 }}>
                    {u.blocked ? "Unblock" : "Block"}
                  </button>
                  <button className="ghost" onClick={() => deleteUser(u.id)} style={{ padding: "4px 10px", borderColor: "#c62828", color: "#c62828" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
