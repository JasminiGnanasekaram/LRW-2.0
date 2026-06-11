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
      setError(err.response?.data?.detail || "Reset failed. The link may have expired.");
    } finally { setLoading(false); }
  };

  if (!token) return (
    <div className="auth-shell">
      <div className="auth-card fade-up" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>Invalid link</h2>
        <p style={{ color: "var(--ink-lt)", fontSize: 14, marginBottom: 24 }}>
          No reset token found in this link.
        </p>
        <Link to="/forgot-password" className="btn btn-primary btn-full">Request a new link</Link>
      </div>
    </div>
  );

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div className="auth-logo">LR<span>W</span></div>
        <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", margin: "16px 0 6px" }}>Set new password</h2>
        <p style={{ color: "var(--ink-lt)", fontSize: 13, marginBottom: 28 }}>Choose a strong password (min. 6 characters).</p>

        <form onSubmit={submit}>
          <div className="auth-field">
            <label>New password</label>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button disabled={loading} type="submit" className="btn btn-primary btn-full">
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
