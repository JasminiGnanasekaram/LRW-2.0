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
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        <h1>Forgot password</h1>
        {done ? (
          <>
            <p className="muted">If an account exists for <strong>{email}</strong>, a reset link has been sent.</p>
            <Link to="/login">Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button disabled={loading} type="submit">{loading ? "Sending..." : "Send reset link"}</button>
            <p className="muted" style={{ marginTop: 12 }}><Link to="/login">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
