import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await resetPassword(token, password);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed");
    } finally { setLoading(false); }
  };

  if (!token) return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        <h1>Invalid link</h1>
        <p className="muted">No reset token found. <Link to="/forgot-password">Request a new one</Link>.</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        <h1>Set a new password</h1>
        <form onSubmit={submit}>
          <label className="label">New password (min 6 chars)</label>
          <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button disabled={loading} type="submit">{loading ? "Saving..." : "Reset password"}</button>
        </form>
      </div>
    </div>
  );
}
