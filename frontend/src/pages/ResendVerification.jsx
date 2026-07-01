import { useState } from "react";
import { Link } from "react-router-dom";
import { resendVerification } from "../api";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      await resendVerification(email.trim());
      setStatus("done");
      setMessage("If that email exists and is unverified, a new link has been sent. Check your inbox.");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 6 }}>
            Resend Verification
          </h2>
          <p style={{ color: "var(--ink-lt)", fontSize: 14 }}>
            Enter your email address and we'll send you a new verification link.
          </p>
        </div>

        {status === "done" ? (
          <>
            <div className="alert-success" style={{ marginBottom: 20 }}>{message}</div>
            <Link to="/login" className="btn btn-primary btn-full">Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="resend-email">Email address</label>
              <input
                id="resend-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {status === "error" && (
              <div className="alert-error" style={{ marginBottom: 12 }}>{message}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={status === "loading"}
              style={{ marginTop: 8 }}
            >
              {status === "loading" ? "Sending…" : "Send verification email"}
            </button>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Link to="/login" style={{ color: "var(--forest)", fontSize: 13 }}>
                ← Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
