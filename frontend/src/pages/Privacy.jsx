import { Link } from "react-router-dom";

const sections = [
  ["Information we collect", "We collect account details, uploaded documents, metadata, and the activity records needed to operate LRW."],
  ["How we use your data", "Your data powers authentication, document processing, NLP analysis, search, and export within your corpus."],
  ["Data storage and security", "Data is stored in the application's configured database. Passwords are hashed and administrative access is restricted."],
  ["Your rights", "You may request access to, correction of, or deletion of your account and associated data by contacting an administrator."],
  ["Changes to this policy", "This policy may be updated periodically. Continued use of LRW after an update indicates acceptance of the revised policy."],
];

export default function Privacy() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>Legal</p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", color: "#fff" }}>Privacy Policy</h1>
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
