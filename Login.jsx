import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100vh",
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg,#1a3a2a, #d4e8d0)"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "600px",
        padding: "50px",
        borderRadius: "12px",
        background: "#EAE0D5",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          Welcome Back 👋
        </h2>

        <form onSubmit={submit}>
          <label style={{ fontWeight: "500" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <label style={{ fontWeight: "500", marginTop: "10px", display: "block" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{
              color: "red",
              marginTop: "10px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            style={{
              width: "100%",
              marginTop: "20px",
              padding: "10px",
              border: "none",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #1a3a2a, #d4e8d0)",
              color: "#fff",
              fontSize: "16px",
              cursor: "pointer",
              transition: "0.3s"
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "15px", fontSize: "14px" }}>
          <p>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "#386641" }}>
              Sign Up
            </Link>
          </p>
          <Link to="/forgot-password" style={{ color: "#386641" }}>
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginTop: "5px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  outline: "none",
  fontSize: "14px"
};