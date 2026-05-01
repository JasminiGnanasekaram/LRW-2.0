import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const token = params.get("token");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Missing token"); return; }
    verifyEmail(token)
      .then(() => setStatus("ok"))
      .catch((e) => { setStatus("error"); setError(e.response?.data?.detail || "Verification failed"); });
  }, [token]);

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        {status === "verifying" && <p className="muted">Verifying...</p>}
        {status === "ok" && (
          <>
            <h1>Email verified</h1>
            <p>Your account is active. <Link to="/login">Sign in now.</Link></p>
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
