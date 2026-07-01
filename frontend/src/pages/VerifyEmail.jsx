import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const token = params.get("token");
  const redirectStatus = params.get("status");
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (redirectStatus === "success") {
      setStatus("ok");
      return;
    }
    if (redirectStatus === "invalid") {
      setStatus("error");
      setError("Invalid or expired verification link.");
      return;
    }
    if (!token) {
      setStatus("error");
      setError("Missing token.");
      return;
    }
    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;
    verifyEmail(token)
      .then(() => {
        setStatus("ok");
        window.history.replaceState(null, "", "/verify-email?status=success");
      })
      .catch((e) => {
        setStatus("error");
        setError(e.response?.data?.detail || "Verification failed.");
      });
  }, [token, redirectStatus]);

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
            <Link to="/login" className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
