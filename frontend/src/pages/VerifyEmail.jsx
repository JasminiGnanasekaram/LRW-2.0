import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const token = params.get("token");
  const called = useRef(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Missing token."); return; }
    if (called.current) return;
    called.current = true;

    verifyEmail(token)
      .then(() => setStatus("ok"))
      .catch((e) => {
        setStatus("error");
        setError(e.response?.data?.detail || "Verification failed.");
      });
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card fade-up" style={{ textAlign: "center" }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div>
            <p style={{ color: "var(--ink-lt)" }}>Verifying your email…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>Email verified!</h2>
            <p style={{ color: "var(--ink-lt)", fontSize: 14, marginBottom: 24 }}>Your account is now active.</p>
            <Link to="/login" className="btn btn-primary btn-full">Sign in now →</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>Verification failed</h2>
            <div className="alert-error" style={{ textAlign: "left" }}>{error}</div>
            <Link to="/resend-verification" className="btn btn-primary btn-full" style={{ marginTop: 8 }}>
              Resend verification link
            </Link>
            <Link to="/login" className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}