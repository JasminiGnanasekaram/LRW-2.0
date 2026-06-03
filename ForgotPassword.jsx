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

    try {
      await forgotPassword(email);
    } catch {}

    setDone(true);
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #1a3a2a, #d4e8d0)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#EAE0D5",
          padding: "35px",
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            marginBottom: 25,
            color: "#1a3a2a",
          }}
        >
          Forgot Password
        </h1>

        {done ? (
          <>
            <p
              style={{
                color: "#555",
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              If an account exists for <strong>{email}</strong>, a reset link
              has been sent.
            </p>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link
                to="/login"
                style={{
                  color: "#1a3a2a",
                  fontWeight: "600",
                  textDecoration: "none",
                }}
              >
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: "600",
                color: "#1a3a2a",
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5c0",
                outline: "none",
                marginBottom: 20,
                fontSize: "15px",
                boxSizing: "border-box",
              }}
            />

            <button
              disabled={loading}
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                border: "none",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #1a3a2a, #d4e8d0)",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <p
              style={{
                marginTop: 18,
                textAlign: "center",
              }}
            >
              <Link
                to="/login"
                style={{
                  color: "#1a3a2a",
                  textDecoration: "none",
                  fontWeight: "600",
                }}
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}