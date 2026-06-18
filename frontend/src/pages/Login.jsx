import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setUnverified(false); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail || "Login failed. Please check your credentials.";
      // FIX: detect unverified and show resend link
      if (err.response?.status === 403 && detail.toLowerCase().includes("not verified")) {
        setUnverified(true);
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div className="auth-logo">LR<span>W</span></div>
        <p className="auth-tagline">Language Resource Workspace</p>

        <form onSubmit={submit}>
          <div className="auth-field">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          {/* FIX: resend link appears when email is not verified */}
          {unverified && (
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 13 }}>
              <Link
                to={`/resend-verification${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                style={{ color: "var(--forest)", fontWeight: 600 }}
              >
                Resend verification email →
              </Link>
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 8 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <hr className="divider" />

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-lt)" }}>
          <Link to="/forgot-password" style={{ color: "var(--forest)" }}>Forgot your password?</Link>
          <span style={{ margin: "0 10px" }}>·</span>
          <span>No account? <Link to="/register" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign up</Link></span>
        </div>
      </div>
    </div>
  );
}