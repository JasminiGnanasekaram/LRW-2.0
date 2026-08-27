import { Link } from "react-router-dom";

const VALUES = [
  { icon: "📚", title: "Open by design", desc: "License-aware workflows keep legality visible and reuse decisions clear from the start." },
  { icon: "🧠", title: "NLP-first", desc: "Every document is analyzed on upload, so insights are available immediately without extra setup." },
  { icon: "🔐", title: "Access you control", desc: "Fine-grained roles ensure the right people can view and act on data without exposing everything." },
];

export default function About() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
          About
        </p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Built for people who work with language data
        </h1>
      </section>

      <section style={{ padding: "56px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 15, color: "var(--ink-lt)", lineHeight: 1.8, marginBottom: 40 }}>
            Language Resource Workbench (LRW) was created to simplify corpus development and remove
            the friction from language data workflows. Researchers and NLP developers no longer need
            to manage scattered files, ad hoc scripts, and spreadsheets just to make a dataset
            analysis-ready. LRW unifies upload, processing, search, and export in one polished
            workbench — so more energy goes into insight and less into infrastructure.
          </p>

          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 700, color: "var(--forest)", marginBottom: 20 }}>
            What we care about
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
            {VALUES.map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: "var(--paper)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "20px",
              }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-lt)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 700, color: "var(--forest)", marginBottom: 12 }}>
            The project
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-lt)", lineHeight: 1.8, marginBottom: 40 }}>
            LRW is developed as a research-driven platform with a FastAPI and MongoDB backend and a
            React frontend. This workbench is still evolving — new capabilities, permission models,
            and linguistic analysis tools are continuously being added.
          </p>

          <div style={{ textAlign: "center" }}>
            <Link to="/contact" style={{ fontSize: 13, color: "var(--forest)", fontWeight: 600, marginRight: 20 }}>
              Get in touch →
            </Link>
            <Link to="/home" style={{ fontSize: 13, color: "var(--forest)", fontWeight: 600 }}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
