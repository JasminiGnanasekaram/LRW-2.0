import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authAPI } from "../api/client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "", password2: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.password2) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await authAPI.register({ username: form.username, email: form.email, password: form.password });
      navigate("/login?registered=1");
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">⬡</span>
          <h1>LRW</h1>
          <p>Language Resource Workbench</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Create Account</h2>
          {error && <div className="auth-error">{error}</div>}
          <div className="field-group">
            <label>Username</label>
            <input name="username" type="text" value={form.username} onChange={handleChange} required autoFocus />
          </div>
          <div className="field-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} required />
          </div>
          <div className="field-group">
            <label>Confirm Password</label>
            <input name="password2" type="password" value={form.password2} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
          <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
      <div className="auth-bg">
        <div className="bg-word">語</div>
        <div className="bg-word">लेख</div>
        <div className="bg-word">Wort</div>
        <div className="bg-word">كلمة</div>
        <div className="bg-word">palabra</div>
        <div className="bg-word">слово</div>
      </div>
    </div>
  );
}
