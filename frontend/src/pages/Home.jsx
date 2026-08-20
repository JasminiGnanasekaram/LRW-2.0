import { useState } from "react";
import { Link } from "react-router-dom";

const FEATURES = [
  { title: "Multi-format upload", desc: "Text, PDF, image (OCR), audio, and direct URL ingestion in one flow." },
  { title: "NLP analysis", desc: "Automatic tokenization, POS tagging, frequency counts, and distribution charts." },
  { title: "Full-text search", desc: "Filter across your corpus by keyword, POS, domain, date, license, and file type." },
  { title: "Flexible export", desc: "Download individual documents or your entire corpus as JSON or CSV." },
  { title: "Role-based access", desc: "Admin, researcher, student, and guest roles with fine-grained permissions." },
  { title: "License tagging", desc: "Mark every document as open, research-only, or restricted — searchable by license." },
];

const STEPS = [
  { n: "1", name: "Upload", desc: "Add a file, paste a URL, or send an image for OCR." },
  { n: "2", name: "Process", desc: "Automatic cleaning, tokenization, and POS analysis runs immediately." },
  { n: "3", name: "Explore", desc: "View charts, tokens, and metadata — or search across your whole corpus." },
  { n: "4", name: "Export", desc: "Download as JSON or CSV for any downstream NLP pipeline." },
];

const SOURCES = [
  { label: "Plain text", sub: ".txt, any encoding" },
  { label: "PDF", sub: "Text extracted automatically" },
  { label: "Image", sub: "OCR to extract text" },
  { label: "Audio", sub: "Speech-to-text pipeline" },
  { label: "URL", sub: "Web page content fetch" },
];

const ROLES = [
  { name: "Researcher", color: "#3B6D11", desc: "Upload, analyze, search, and export. Full corpus access." },
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

const FEATURE_ICONS = {
  "Multi-format upload": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  "NLP analysis": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  "Full-text search": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  "Flexible export": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  "Role-based access": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  "License tagging": (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
};

const POS_DICT = {
  the: "DET", a: "DET", an: "DET", this: "DET", that: "DET", these: "DET", those: "DET",
  i: "PRON", you: "PRON", he: "PRON", she: "PRON", it: "PRON", we: "PRON", they: "PRON", me: "PRON", him: "PRON", her: "PRON", us: "PRON", them: "PRON", my: "PRON", your: "PRON", his: "PRON", its: "PRON", our: "PRON", their: "PRON",
  in: "ADP", on: "ADP", at: "ADP", by: "ADP", for: "ADP", with: "ADP", about: "ADP", against: "ADP", between: "ADP", into: "ADP", through: "ADP", during: "ADP", before: "ADP", after: "ADP", above: "ADP", below: "ADP", to: "ADP", of: "ADP", from: "ADP", over: "ADP", under: "ADP",
  and: "CCONJ", but: "CCONJ", or: "CCONJ", so: "CCONJ", yet: "CCONJ", nor: "CCONJ", because: "SCONJ", although: "SCONJ", if: "SCONJ", since: "SCONJ", unless: "SCONJ",
  is: "VERB", am: "VERB", are: "VERB", was: "VERB", were: "VERB", be: "VERB", been: "VERB", being: "VERB", have: "VERB", has: "VERB", had: "VERB", do: "VERB", does: "VERB", did: "VERB", can: "AUX", could: "AUX", will: "AUX", would: "AUX", should: "AUX", may: "AUX", might: "AUX", must: "AUX",
  jumps: "VERB", run: "VERB", runs: "VERB", running: "VERB", walk: "VERB", walks: "VERB", look: "VERB", looks: "VERB", build: "VERB", analyze: "VERB", explore: "VERB", extract: "VERB", process: "VERB", uploads: "VERB", upload: "VERB", search: "VERB", export: "VERB", manage: "VERB", love: "VERB", learn: "VERB",
  quick: "ADJ", brown: "ADJ", lazy: "ADJ", amazing: "ADJ", language: "ADJ", linguistic: "ADJ", multi: "ADJ", local: "ADJ", global: "ADJ", simple: "ADJ", powerful: "ADJ", flexible: "ADJ", automatic: "ADJ", beautiful: "ADJ", green: "ADJ", new: "ADJ", free: "ADJ",
  fox: "NOUN", dog: "NOUN", cat: "NOUN", mouse: "NOUN", workspace: "NOUN", corpus: "NOUN", project: "NOUN", code: "NOUN", user: "NOUN", data: "NOUN", text: "NOUN", platform: "NOUN", resource: "NOUN", analysis: "NOUN", details: "NOUN", feature: "NOUN", steps: "NOUN", format: "NOUN", pdf: "NOUN", license: "NOUN", access: "NOUN", website: "NOUN", application: "NOUN", insight: "NOUN", role: "NOUN", team: "NOUN",
};

const POS_COLORS = {
  NOUN: { bg: "#e8f0fe", color: "#1a73e8", border: "#d2e3fc", label: "Noun" },
  VERB: { bg: "#e6f4ea", color: "#137333", border: "#ceead6", label: "Verb" },
  ADJ: { bg: "#f3e8fd", color: "#86118d", border: "#f3e8fd", label: "Adjective" },
  DET: { bg: "#fef7e0", color: "#b06000", border: "#feecb5", label: "Determiner" },
  ADP: { bg: "#fce8e6", color: "#c5221f", border: "#fad2cf", label: "Preposition" },
  PRON: { bg: "#e2f3f5", color: "#007a87", border: "#bfeef2", label: "Pronoun" },
  AUX: { bg: "#e6f4ea", color: "#137333", border: "#ceead6", label: "Auxiliary Verb" },
  OTHER: { bg: "#f1f3f4", color: "#3c4043", border: "#e8eaed", label: "Punctuation/Other" }
};

function tagWord(word) {
  const cleanWord = word.toLowerCase().trim();
  if (!cleanWord) return "OTHER";

  if (POS_DICT[cleanWord]) {
    return POS_DICT[cleanWord];
  }

  if (cleanWord.endsWith("ing") || cleanWord.endsWith("ed") || cleanWord.endsWith("es") || cleanWord.endsWith("s") && cleanWord.length > 3) {
    return "VERB";
  }
  if (cleanWord.endsWith("ly")) {
    return "OTHER";
  }
  if (cleanWord.endsWith("ous") || cleanWord.endsWith("ful") || cleanWord.endsWith("ble") || cleanWord.endsWith("ive") || cleanWord.endsWith("al") || cleanWord.endsWith("y")) {
    return "ADJ";
  }
  if (cleanWord.endsWith("tion") || cleanWord.endsWith("ment") || cleanWord.endsWith("ness") || cleanWord.endsWith("ity") || cleanWord.endsWith("er") || cleanWord.endsWith("or")) {
    return "NOUN";
  }

  return "NOUN";
}

export default function Home() {
  const [demoText, setDemoText] = useState(
    "The quick brown fox jumps over the lazy dog. Automatic tokenization and POS analysis runs immediately inside your language resource workspace."
  );
  const [selectedToken, setSelectedToken] = useState(null);

  const getPosDescription = (tag) => {
    switch (tag) {
      case "NOUN": return "A word that represents a person, place, thing, or idea. Nouns act as the core subject or object of a clause.";
      case "VERB": return "A word expressing an action, occurrence, or state of being. The core driver of the sentence structure.";
      case "ADJ": return "A modifier that describes or clarifies a noun or pronoun, specifying qualities, sizes, or properties.";
      case "DET": return "A word placed before a noun to clarify reference or specify number/definiteness (e.g., the, a, those).";
      case "ADP": return "An adposition (preposition) indicating spatial, temporal, or logical relationship to another word (e.g., in, on, to).";
      case "PRON": return "A grammatical substitute for a noun or noun phrase (e.g., i, they, she, it).";
      case "AUX": return "An auxiliary helper verb providing additional tense, grammatical mood, or voice structure.";
      default: return "Punctuation, conjunction, or minor part of speech category.";
    }
  };

  const parsedTokens = demoText.split(/(\s+)/).map((part, index) => {
    if (part.trim() === "") {
      return { text: part, isSpace: true, index };
    }
    const clean = part.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const tag = tagWord(clean);
    return { text: part, clean, tag, isSpace: false, index };
  });

  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh" }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="home-hero">
        <div className="hero-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Language Resource Workbench
        </div>

        <h1 className="hero-title">
          Build, analyze and explore your <span style={{ color: "var(--sage)", textDecoration: "underline", decorationColor: "rgba(143,184,154,0.4)" }}>language corpus</span>
        </h1>

        <p className="hero-subtitle">
          Upload documents, run NLP pipelines, search your entire corpus, and export structured linguistic data — all in one place.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 56 }}>
          <Link to="/register">
            <button className="btn-hero-primary">
              Get started free
            </button>
          </Link>
          <Link to="/login">
            <button className="btn-hero-secondary">
              Sign in
            </button>
          </Link>
        </div>

        <div style={{
          display: "flex", justifyContent: "center", gap: 48,
          paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.12)", flexWrap: "wrap",
        }}>
          {[["5+", "Source formats"], ["NLP", "POS & tokenization"], ["CSV/JSON", "Export ready"], ["2", "User roles"]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "var(--font-head)" }}>{val}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interactive Live Demo ─────────────────────────── */}
      <section className="home-section" style={{ background: "var(--ivory)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <span className="section-tag">Interactive Preview</span>
          <h2 className="section-title">Try the Live NLP Analyzer</h2>
          <p className="section-subtitle" style={{ margin: "0 auto 40px" }}>
            Type or edit the sentence below to see our client-side tokenizer and Part-of-Speech analyzer label terms in real-time.
          </p>

          <div className="demo-container">
            <textarea
              className="demo-textarea"
              value={demoText}
              onChange={(e) => {
                setDemoText(e.target.value);
                setSelectedToken(null);
              }}
              placeholder="Type something here to analyze..."
              maxLength={200}
            />

            <div style={{ textAlign: "left", marginBottom: 12 }}>
              <span className="label" style={{ fontSize: 11 }}>Real-time NLP Output (Click a word to inspect)</span>
            </div>

            <div className="demo-tokens">
              {parsedTokens.map((tok, idx) => {
                if (tok.isSpace) {
                  return <span key={idx} style={{ whiteSpace: "pre" }}>{tok.text}</span>;
                }
                const colorConfig = POS_COLORS[tok.tag] || POS_COLORS.OTHER;
                const isSelected = selectedToken && selectedToken.index === tok.index;
                return (
                  <span
                    key={idx}
                    className="demo-token-tag"
                    onClick={() => setSelectedToken(tok)}
                    style={{
                      backgroundColor: colorConfig.bg,
                      color: colorConfig.color,
                      borderColor: isSelected ? "var(--forest)" : colorConfig.border,
                      boxShadow: isSelected ? "0 0 0 2px var(--forest-lt)" : "none",
                      transform: isSelected ? "translateY(-2px)" : "none",
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {tok.text}
                    <span className="demo-token-pos" style={{ color: colorConfig.color }}>
                      {tok.tag}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* POS Legend */}
            <div className="demo-legend">
              {Object.entries(POS_COLORS).map(([key, value]) => (
                <div key={key} className="demo-legend-item">
                  <div className="demo-dot" style={{ backgroundColor: value.color }} />
                  <span style={{ fontWeight: 600, color: "var(--ink-mid)" }}>{value.label}</span>
                </div>
              ))}
            </div>

            {/* Selected Word Info Box */}
            <div style={{
              marginTop: 24, padding: 18, borderRadius: "var(--radius)",
              background: "var(--ivory)", border: "1.5px solid var(--border)",
              textAlign: "left", display: "flex", gap: 16, alignItems: "center"
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: selectedToken ? (POS_COLORS[selectedToken.tag]?.bg || "#fff") : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700,
                color: selectedToken ? (POS_COLORS[selectedToken.tag]?.color || "#000") : "var(--ink-lt)", flexShrink: 0
              }}>
                {selectedToken ? selectedToken.tag : "?"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--forest)" }}>
                  {selectedToken ? `Token: "${selectedToken.clean}"` : "Linguistic Inspector"}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-mid)", marginTop: 2, lineHeight: 1.45 }}>
                  {selectedToken ? getPosDescription(selectedToken.tag) : "Click on any color-coded word token above to reveal its linguistic role and structural information."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="home-section" style={{ background: "var(--paper)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <span className="section-tag">Everything you need</span>
          <h2 className="section-title">A complete corpus management platform</h2>
          <p className="section-subtitle">
            From raw file ingestion to analyzed linguistic matrices — LRW handles the full pipelines.
          </p>

          <div className="grid-features">
            {FEATURES.map(({ title, desc }) => (
              <div key={title} className="home-card">
                <div className="home-card-icon">
                  {FEATURE_ICONS[title]}
                </div>
                <div className="home-card-title">{title}</div>
                <div className="home-card-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ──────────────────────────────────────── */}
      <section className="home-section" style={{ background: "var(--cream)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <span className="section-tag">How it works</span>
          <h2 className="section-title">From upload to insight in four steps</h2>
          <p className="section-subtitle" style={{ margin: "0 auto 48px" }}>
            Our streamlined lifecycle processes files immediately and aggregates stats across the corpus.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            {STEPS.map(({ n, name, desc }, i) => (
              <div key={n} style={{ padding: "0 12px", textAlign: "center", position: "relative" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", background: "var(--forest)",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, margin: "0 auto 16px",
                  boxShadow: "0 4px 10px rgba(26,58,42,0.2)"
                }}>{n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--forest)" }}>{name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Source types ──────────────────────────────────── */}
      <section className="home-section" style={{ background: "var(--paper)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <span className="section-tag">Source types</span>
          <h2 className="section-title">Ingest from anywhere</h2>
          <p className="section-subtitle">
            Five source types so you can build a diverse, mixed-media corpus without preprocessing outside the platform.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {SOURCES.map(({ label, sub }) => (
              <div key={label} style={{
                background: "var(--ivory)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)", padding: "20px 24px",
                transition: "transform 0.2s var(--ease), border-color 0.2s",
                cursor: "default"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "var(--sage)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--forest)" }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--ink-lt)" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ─────────────────────────────────────────── */}
      <section className="home-section" style={{ background: "var(--cream)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <span className="section-tag">Access control</span>
          <h2 className="section-title">Built for every member of your team</h2>
          <p className="section-subtitle">
            Two predefined roles with granular access controls — from researchers with full access to guest explorers.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {ROLES.map(({ name, color, desc }) => (
              <div key={name} style={{
                background: "var(--paper)", border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-lg)", padding: "24px",
                boxShadow: "var(--shadow-xs)", transition: "transform 0.2s var(--ease)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--forest)" }}>{name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="home-hero" style={{ padding: "80px 24px" }}>
        <h2 className="hero-title" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
          Ready to build your corpus?
        </h2>
        <p className="hero-subtitle" style={{ color: "rgba(255,255,255,0.6)", marginBottom: 36 }}>
          Create a free account and upload your first document in under two minutes.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <Link to="/register">
            <button className="btn-hero-primary">
              Create free account
            </button>
          </Link>
          <Link to="/login">
            <button className="btn-hero-secondary">
              Sign in
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
<<<<<<< HEAD
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
=======
      <footer style={{
        background: "#0c1510", padding: "32px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20,
        borderTop: "1px solid rgba(255,255,255,0.05)"
      }}>
        <span style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.01em" }}>LRW</span>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Privacy Policy", path: "/privacy" },
            { label: "Terms of Service", path: "/terms" },
            { label: "Contact Support", path: "/contact" }
          ].map(l => (
            <Link key={l.label} to={l.path} style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
            >{l.label}</Link>
>>>>>>> origin/kirupaN
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
