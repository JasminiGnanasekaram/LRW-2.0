import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
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
          <h2>Sign In</h2>
          {error && <div className="auth-error">{error}</div>}
          <div className="field-group">
            <label>Username</label>
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder="your_username"
              required
              autoFocus
            />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
          <p className="auth-footer">
            No account? <Link to="/register">Create one</Link>
          </p>
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
