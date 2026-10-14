import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../api";

const PASSWORD_RULES = [
  { test: (v) => v.length >= 8, message: "Password must be at least 8 characters." },
  { test: (v) => /[A-Z]/.test(v), message: "Must include at least one capital letter." },
  { test: (v) => /[0-9]/.test(v), message: "Must include at least one number." },
  {
    test: (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v),
    message: "Must include at least one special character (!@#$...).",
  },
];

const validatePassword = (value) => PASSWORD_RULES.find((rule) => !rule.test(value))?.message ?? "";

const styles = {
  heading: { fontFamily: "var(--font-head)", color: "var(--forest)" },
  muted: { color: "var(--ink-lt)", fontSize: 14 },
};

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordError = password ? validatePassword(password) : "";

  const submit = async (e) => {
    e.preventDefault();
    if (validatePassword(password)) return;

    setLoading(true);
    setError("");
    try {
      await resetPassword(token, password);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card fade-up" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ ...styles.heading, marginBottom: 8 }}>Invalid link</h2>
          <p style={{ ...styles.muted, marginBottom: 24 }}>No reset token found in this link.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-full">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div className="auth-logo">
          LR<span>W</span>
        </div>
        <h2 style={{ ...styles.heading, margin: "16px 0 6px" }}>Set new password</h2>
        <p style={{ ...styles.muted, fontSize: 13, marginBottom: 28 }}>
          Min. 8 characters, one uppercase, one number, one special character.
        </p>

        <form onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
              required
            />
            {passwordError && (
              <div className="alert-error" role="alert" style={{ marginTop: 6 }}>
                {passwordError}
              </div>
            )}
          </div>

          {error && (
            <div className="alert-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading || !password || !!passwordError}>
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
