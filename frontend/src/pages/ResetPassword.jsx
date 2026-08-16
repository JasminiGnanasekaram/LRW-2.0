import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../api";

// FIX: same strong password rules as Register page
function validatePassword(value) {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Must include at least one capital letter.";
  if (!/[0-9]/.test(value)) return "Must include at least one number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value))
    return "Must include at least one special character (!@#$...).";
  return "";
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(validatePassword(value));
  };

  const submit = async (e) => {
    e.preventDefault();
    const pwdErr = validatePassword(password);
    if (pwdErr) { setPasswordError(pwdErr); return; }
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
        <p style={{ color: "var(--ink-lt)", fontSize: 13, marginBottom: 28 }}>
          Min. 8 characters, one uppercase, one number, one special character.
        </p>

        <form onSubmit={submit}>
          <div className="auth-field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              required
              placeholder="••••••••"
              autoFocus
            />
            {passwordError && (
              <div className="alert-error" style={{ marginTop: 6, fontSize: 13 }}>
                {passwordError}
              </div>
            )}
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button
            disabled={loading || !!passwordError}
            type="submit"
            className="btn btn-primary btn-full"
          >
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}