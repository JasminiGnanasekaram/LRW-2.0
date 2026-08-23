import { useState } from "react";
import { Link } from "react-router-dom";
import { register, getErrorMessage } from "../api";

const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

function validatePassword(value) {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Must include at least one capital letter.";
  if (!/[a-z]/.test(value)) return "Must include at least one lowercase letter.";
  if (!/[0-9]/.test(value)) return "Must include at least one number.";
  if (!SPECIAL.test(value)) return "Must include at least one special character (!@#$...).";
  return "";
}

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [role, setRole] = useState("guest");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(validatePassword(value));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) return setError("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return setError("Please enter a valid email address.");
    }

    const pwdErr = validatePassword(password);
    if (pwdErr) { setPasswordError(pwdErr); return; }
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await register(cleanName, cleanEmail, password, role);
      setEmail(cleanEmail);
      setDone(true);
    } catch (err) {
      // getErrorMessage always returns a STRING — the old code passed
      // FastAPI's 422 detail ARRAY straight into JSX and crashed React.
      setError(getErrorMessage(err, "Registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card fade-up" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 8 }}>
            Check your inbox
          </h2>
          <p style={{ color: "var(--ink-lt)", marginBottom: 24, fontSize: 14 }}>
            A verification link has been sent to{" "}
            <strong style={{ color: "var(--ink)" }}>{email}</strong>
          </p>
          <Link to="/login" className="btn btn-primary btn-full">Back to sign in</Link>
          <Link to="/resend-verification" className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>
            Resend verification email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-split">
      <div className="auth-split-left">
        <div style={{
          fontFamily: "var(--font-head)", fontSize: 32, fontWeight: 700,
          marginBottom: 16, lineHeight: 1.2,
        }}>
          Build your language corpus
        </div>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.7, maxWidth: 340 }}>
          Upload, process, and analyze text documents with NLP tools. Search across your corpus and
          export structured data.
        </p>
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Multi-format support", desc: "Text, PDF, images, audio, URLs" },
            { label: "Full-text search", desc: "Filter by POS, type, date, domain" },
            { label: "NLP insights", desc: "Token counts, POS distribution, top words" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-split-right">
        <div style={{ maxWidth: 400, width: "100%" }}>
          <div className="auth-logo" style={{ textAlign: "left", marginBottom: 4 }}>LR<span>W</span></div>
          <p className="auth-tagline" style={{ textAlign: "left", marginBottom: 32 }}>
            Create your account
          </p>

          <form onSubmit={submit} noValidate>
            <div className="auth-field">
              <label htmlFor="r-name">Full name</label>
              <input
                id="r-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="r-email">Email address</label>
              <input
                id="r-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="r-password">Password</label>
              <input
                id="r-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={handlePasswordChange}
              />
              {passwordError && (
                <div className="alert-error" style={{ marginTop: 6, fontSize: 13 }}>
                  {passwordError}
                </div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="r-confirm">Confirm password</label>
              <input
                id="r-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm && confirm !== password && (
                <div className="alert-error" style={{ marginTop: 6, fontSize: 13 }}>
                  Passwords do not match.
                </div>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="r-role">Role</label>
              <select id="r-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="guest">Guest</option>
                <option value="researcher">Researcher / NLP Developer</option>
              </select>
            </div>

            {error && <div className="alert-error" role="alert">{error}</div>}

            <button
              disabled={loading}
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: 8 }}
            >
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          <hr className="divider" />
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-lt)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--forest)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}