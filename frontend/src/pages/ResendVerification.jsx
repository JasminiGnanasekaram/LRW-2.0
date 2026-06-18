import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerification } from "../api";

export default function ResendVerification() {
  const [searchParams] = useSearchParams();
  // FIX: pre-fill email from URL query param when coming from Login page
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resendVerification(email);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card fade-up" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>
            Verification link sent!
          </h2>
          <p style={{ color: "var(--ink-lt)", fontSize: 14, marginBottom: 24 }}>
            A new verification link has been sent to{" "}
            <strong style={{ color: "var(--ink)" }}>{email}</strong>
          </p>
          <Link to="/login" className="btn btn-primary btn-full">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up">
        <div className="auth-logo">LR<span>W</span></div>
        <p className="auth-tagline">Resend verification email</p>

        <form onSubmit={submit}>
          <div className="auth-field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ marginTop: 8 }}
          >
            {loading ? "Sending…" : "Resend verification link →"}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-lt)" }}>
          Already verified?{" "}
          <Link to="/login" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}