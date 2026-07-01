import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      window.dispatchEvent(new CustomEvent('lrw_user_updated'));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
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
