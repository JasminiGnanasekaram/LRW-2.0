import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
          Contact
        </p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Get in touch
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 10, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
          Questions, feedback, or issues with your account — reach out below.
        </p>
      </section>

      <section style={{ padding: "56px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            background: "var(--paper)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "28px",
          }}>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--forest-lt)", marginBottom: 6 }}>
                Email
              </div>
              <a href="mailto:languageresourceworkbench@gmail.com" style={{ fontSize: 15, fontWeight: 600, color: "var(--forest)", textDecoration: "none" }}>
                languageresourceworkbench@gmail.com
              </a>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--forest-lt)", marginBottom: 6 }}>
                Project repository
              </div>
              <a
                href="https://github.com/Menaka2024/LRW-2.0"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 14, color: "var(--forest)", textDecoration: "none" }}
              >
                github.com/Menaka2024/LRW-2.0
              </a>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--forest-lt)", marginBottom: 6 }}>
                Response time
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-lt)", lineHeight: 1.6 }}>
                This project is actively maintained by a small student team. We typically respond
                within a few days.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link to="/home" style={{ fontSize: 13, color: "var(--forest)", fontWeight: 600 }}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
