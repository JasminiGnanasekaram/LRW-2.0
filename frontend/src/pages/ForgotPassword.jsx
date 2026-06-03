import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await forgotPassword(email); } catch {}
    setDone(true); setLoading(false);
  };

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div className="auth-logo">LR<span>W</span></div>

        {done ? (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>Check your email</h2>
            <p style={{ color: "var(--ink-lt)", fontSize: 14, marginBottom: 24 }}>
              If an account exists for <strong style={{ color: "var(--ink)" }}>{email}</strong>, a reset link has been sent.
            </p>
            <Link to="/login" className="btn btn-primary btn-full">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", margin: "16px 0 6px" }}>Reset password</h2>
            <p style={{ color: "var(--ink-lt)", fontSize: 13, marginBottom: 28 }}>
              Enter your email and we'll send a reset link.
            </p>

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

              <button disabled={loading} type="submit" className="btn btn-primary btn-full" style={{ marginBottom: 16 }}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div style={{ textAlign: "center" }}>
              <Link to="/login" style={{ color: "var(--forest)", fontSize: 13 }}>← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
