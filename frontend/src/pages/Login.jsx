import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Show success banner when redirected after email verification
  const justVerified = searchParams.get("verified") === "1";

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setUnverified(false); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail || "Login failed. Please check your credentials.";
      const isUnverified =
        err.response?.status === 403 &&
        /not.verified|unverified|verify/i.test(detail);
      if (isUnverified) setUnverified(true);
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

        {/* Success message after email verification */}
        {justVerified && (
          <div style={{
            background: "#e8f5e9", border: "1px solid #2d6a4f",
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
            color: "#2d6a4f", fontSize: 14, textAlign: "center", fontWeight: 500,
          }}>
            ✅ Email verified successfully! You can now sign in.
          </div>
        )}

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