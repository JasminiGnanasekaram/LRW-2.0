import { Link } from "react-router-dom";

const sections = [
  ["Accounts and roles", "You are responsible for your login credentials and all activity carried out under your account."],
  ["Acceptable use", "Do not upload unlawful material, infringing content, or content that interferes with the Service or its APIs."],
  ["User-submitted content", "You retain ownership of uploaded files and grant LRW a limited license to store and process them to provide the Service."],
  ["Service availability", "LRW is provided on a best-effort basis. Features, data, and access may change or be reset without notice."],
  ["Changes to these terms", "These Terms may be revised periodically. Continued use after updates are published indicates acceptance of the revised terms."],
];

export default function Terms() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>Legal</p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", color: "#fff" }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>Last updated: July 2026</p>
      </section>
      <section style={{ padding: "56px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {sections.map(([title, body]) => <div key={title} style={{ marginBottom: 32 }}><h2 style={{ fontFamily: "var(--font-head)", fontSize: 17, color: "var(--forest)", marginBottom: 8 }}>{title}</h2><p style={{ fontSize: 14, color: "var(--ink-lt)", lineHeight: 1.75 }}>{body}</p></div>)}
          <div style={{ marginTop: 48, textAlign: "center" }}><Link to="/home" style={{ fontSize: 13, color: "var(--forest)", fontWeight: 600 }}>← Back to home</Link></div>
        </div>
      </section>
    </div>
  );
}
