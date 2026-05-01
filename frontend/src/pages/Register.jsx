import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(name, email, password, role);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto" }}>
        <div className="card">
          <h1>Check your email</h1>
          <p className="muted">
            We sent a verification link to <strong>{email}</strong>. Click the link to activate your account, then sign in.
          </p>
          <p className="muted">
            (In dev mode without SMTP, the link is printed to the backend console.)
          </p>
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="card">
        <h1>Create account</h1>
        <form onSubmit={submit}>
          <label className="label">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label className="label">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Password (min 6 chars)</label>
          <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <label className="label">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="researcher">Researcher / NLP Developer</option>
            <option value="admin">Admin</option>
          </select>
          {error && <div className="error">{error}</div>}
          <button disabled={loading} type="submit">{loading ? "Creating..." : "Create account"}</button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
