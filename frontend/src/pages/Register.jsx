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
      <div style={container}>
        <div style={card}>
          <h2>📧 Check your email</h2>
          <p style={muted}>Verification link sent to <b>{email}</b></p>
          <Link to="/login" style={link}>Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={wrapper}>

        {/* LEFT SIDE */}
        <div style={leftPanel}>
          <h2 style={{ color: "#fff" }}>Join Our Community ✨</h2>
          <p style={{ color: "#ddd", marginTop: "10px" }}>
            Create your account and start your journey with us.
          </p>
        </div>

        {/* RIGHT SIDE */}
        <div style={rightPanel}>
          <h2 style={{ textAlign: "center" }}>Create Account ✨</h2>

          <form onSubmit={submit}>
            <input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={input}
            />

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={input}
            />

            <input
              type="password"
              placeholder="Create password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={input}
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={input}
            >
              <option value="student">Student</option>
              <option value="researcher">Researcher / NLP Developer</option>
              <option value="admin">Admin</option>
            </select>

            {error && <div style={{ color: "red" }}>{error}</div>}

            <button disabled={loading} style={button}>
              {loading ? "Creating..." : "Create account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "15px" }}>
            Already have an account?{" "}
            <Link to="/login" style={link}>Sign in</Link>
          </p>
        </div>

      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#eef2ff"
};

const wrapper = {
  display: "flex",
  width: "850px",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
};

const leftPanel = {
  flex: 1,
  padding: "40px",
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center"
};

const rightPanel = {
  flex: 1,
  padding: "40px",
  background: "#fff"
};

const input = {
  width: "100%",
  padding: "12px",
  marginTop: "12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "14px"
};

const button = {
  width: "100%",
  marginTop: "20px",
  padding: "12px",
  border: "none",
  borderRadius: "8px",
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  color: "#fff",
  fontSize: "16px",
  cursor: "pointer"
};

const link = {
  color: "#667eea",
  textDecoration: "none",
  fontWeight: "500"
};

const muted = {
  color: "#666"
};

const card = {
  padding: "30px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
};