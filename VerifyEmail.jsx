import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const called = useRef(false); // ← prevents double-call in React StrictMode

  useEffect(() => {
    if (called.current) return; // already ran — skip
    called.current = true;      // mark as ran immediately

    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("Missing token");
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus("ok");
        setTimeout(() => navigate("/login"), 3000);
      })
      .catch((e) => {
        setStatus("error");
        setError(e.response?.data?.detail || "Verification failed");
      });
  }, []); // empty deps — run once on mount

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        {status === "verifying" && <p className="muted">Verifying...</p>}
        {status === "ok" && (
          <>
            <h1>Email verified ✅</h1>
            <p>Your account is active. Redirecting to login in 3 seconds...</p>
            <p><Link to="/login">Sign in now.</Link></p>
          </>
        )}
        {status === "error" && (
          <>
            <h1>Verification failed</h1>
            <div className="error">{error}</div>
            <p><Link to="/login">Back to sign in</Link></p>
          </>
        )}
      </div>
    </div>
  );
}