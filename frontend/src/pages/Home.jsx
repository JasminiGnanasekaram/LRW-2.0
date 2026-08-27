import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "📤", title: "Multi-format upload", desc: "Text, PDF, image (OCR), audio, and direct URL ingestion in one flow.", color: "var(--mint)" },
  { icon: "📊", title: "NLP analysis", desc: "Automatic tokenization, POS tagging, frequency counts, and distribution charts.", color: "#e6f1fb" },
  { icon: "🔍", title: "Full-text search", desc: "Filter across your corpus by keyword, POS, domain, date, license, and file type.", color: "#ede7f6" },
  { icon: "💾", title: "Flexible export", desc: "Download individual documents or your entire corpus as JSON or CSV.", color: "#fff4e0" },
  { icon: "👥", title: "Role-based access", desc: "Guest and Researcher/ NLP Developer roles with fine-grained permissions.", color: "#e1f5ee" },
  { icon: "🔒", title: "License tagging", desc: "Mark every document as open, research-only, or restricted — searchable by license.", color: "#fce8e0" },
];

const STEPS = [
  { n: "1", name: "Upload", desc: "Add a file, paste a URL, or send an image for OCR" },
  { n: "2", name: "Process", desc: "Automatic cleaning, tokenization, and POS analysis runs immediately" },
  { n: "3", name: "Explore", desc: "View charts, tokens, and metadata — or search across your whole corpus" },
  { n: "4", name: "Export", desc: "Download as JSON or CSV for any downstream NLP pipeline" },
];

const SOURCES = [
  { label: "Plain text", sub: ".txt, any encoding" },
  { label: "PDF", sub: "Text extracted automatically" },
  { label: "Image", sub: "OCR to extract text" },
  { label: "Audio", sub: "Speech-to-text pipeline" },
  { label: "URL", sub: "Web page content fetch" },
];

const ROLES = [
  { name: "Guest", color: "#5F5E5A", desc: "Read-only browsing of open-licensed documents without an account." },
  { name: "Researcher/ NLP Developer", color: "#3B6D11", desc: "Upload, analyze, search, and export. Full corpus access." },
];

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Upload", to: "/upload" },
      { label: "Search", to: "/search" },
      { label: "Sign in", to: "/login" },
      { label: "Get started", to: "/register" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Licenses", to: "/licenses" },
    ],
  },
];

export default function Home() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ background: "var(--forest)", padding: "72px 32px 80px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 20, padding: "4px 16px", fontSize: 12,
          color: "rgba(255,255,255,0.75)", marginBottom: 28,
        }}>
          Language Resource Workbench
        </div>

        <h1 style={{
          fontFamily: "var(--font-head)", fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 700, color: "#fff", lineHeight: 1.15,
          letterSpacing: "-0.03em", maxWidth: 600, margin: "0 auto 18px",
        }}>
          Build, analyze and explore your{" "}
          <span style={{ color: "var(--sage)" }}>language corpus</span>
        </h1>

        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.65 }}>
          Upload documents, run NLP pipelines, search your entire corpus, and export structured linguistic data — all in one place.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link to="/register">
            <button style={{
              background: "#fff", color: "var(--forest)", border: "none",
              padding: "12px 32px", borderRadius: "var(--radius)", fontSize: 15,
              fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)",
            }}>
              Get started free
            </button>
          </Link>
          <Link to="/login">
            <button style={{
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              padding: "12px 28px", borderRadius: "var(--radius)", fontSize: 15,
              cursor: "pointer", fontFamily: "var(--font-body)",
            }}>
              Sign in
            </button>
          </Link>
        </div>

        <div style={{
          display: "flex", justifyContent: "center", gap: 48, marginTop: 56,
          paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.12)", flexWrap: "wrap",
        }}>
          {[["5+", "Source formats"], ["NLP", "POS & tokenization"], ["CSV", "Export ready"], ["2", "User roles"]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "var(--font-head)" }}>{val}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section style={{ padding: "64px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--forest-lt)", marginBottom: 8 }}>Everything you need</p>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--forest)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            A complete corpus management platform
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-lt)", maxWidth: 480, marginBottom: 36, lineHeight: 1.65 }}>
            From raw file to analyzed linguistic data — LRW handles the full pipeline.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {FEATURES.map(({ icon, title, desc, color }) => (
              <div key={title} style={{
                background: "var(--paper)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "22px",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>
                  {icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-lt)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ──────────────────────────────────────── */}
      <section style={{ background: "var(--cream)", padding: "64px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--forest-lt)", marginBottom: 8 }}>How it works</p>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--forest)", marginBottom: 40, letterSpacing: "-0.02em" }}>
            From upload to insight in four steps
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 0 }}>
            {STEPS.map(({ n, name, desc }, i) => (
              <div key={n} style={{ padding: "0 16px", textAlign: "center", position: "relative" }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", top: 18, right: -4, fontSize: 20, color: "var(--ink-faint)" }}>›</div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: "var(--forest)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 600, margin: "0 auto 14px",
                }}>{n}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-lt)", lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Source types ──────────────────────────────────── */}
      <section style={{ padding: "64px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--forest-lt)", marginBottom: 8 }}>Source types</p>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--forest)", marginBottom: 8, letterSpacing: "-0.02em" }}>Ingest from anywhere</h2>
          <p style={{ fontSize: 14, color: "var(--ink-lt)", maxWidth: 440, marginBottom: 32, lineHeight: 1.65 }}>
            Five source types so you can build a diverse, mixed-media corpus without preprocessing outside the platform.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {SOURCES.map(({ label, sub }) => (
              <div key={label} style={{
                background: "var(--paper)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "16px 18px",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--ink-lt)" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ─────────────────────────────────────────── */}
      <section style={{ padding: "64px 32px", background: "var(--cream)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--forest-lt)", marginBottom: 8 }}>Access control</p>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 28, fontWeight: 700, color: "var(--forest)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Built for every member of your team
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-lt)", maxWidth: 440, marginBottom: 32, lineHeight: 1.65 }}>
            Three roles with the right level of access — from full system control to read-only corpus browsing.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            {ROLES.map(({ name, color, desc }) => (
              <div key={name} style={{
                background: "var(--paper)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "22px",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>{name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-lt)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section style={{ background: "var(--forest)", padding: "72px 32px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 12 }}>
          Ready to build your corpus?
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginBottom: 32 }}>
          Create a free account and upload your first document in under two minutes.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link to="/register">
            <button style={{
              background: "#fff", color: "var(--forest)", border: "none",
              padding: "12px 32px", borderRadius: "var(--radius)", fontSize: 15,
              fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)",
            }}>
              Create free account
            </button>
          </Link>
          <Link to="/login">
            <button style={{
              background: "transparent", color: "#fff",
              border: "1px solid rgba(255,255,255,0.35)",
              padding: "12px 28px", borderRadius: "var(--radius)", fontSize: 15,
              cursor: "pointer", fontFamily: "var(--font-body)",
            }}>
              Sign in
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{ background: "#111d16", padding: "56px 32px 0" }}>
        <div style={{
          maxWidth: 960, margin: "0 auto", display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, 1fr)", gap: 32,
          paddingBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 700, color: "#fff" }}>
              LR<span style={{ color: "var(--sage)" }}>W</span>
            </span>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 12, lineHeight: 1.6, maxWidth: 240 }}>
              A corpus management platform for uploading, processing, and analyzing language data.
            </p>
          </div>

          {FOOTER_COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                {heading}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(({ label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          maxWidth: 960, margin: "0 auto", padding: "20px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            © 2026 Language Resource Workbench. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            Built with FastAPI, React &amp; MongoDB
          </span>
        </div>
      </footer>
    </div>
  );
}
