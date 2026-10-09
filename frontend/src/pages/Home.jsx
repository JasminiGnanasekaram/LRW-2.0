import { useState } from "react";
import { Link } from "react-router-dom";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const FEATURES = [
  {
    title: "Multi-format upload",
    desc: "Text, PDF, image (OCR), audio, and direct URL ingestion in one flow.",
    icon: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
  },
  {
    title: "NLP analysis",
    desc: "Automatic tokenization, POS tagging, frequency counts, and distribution charts.",
    icon: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
  },
  {
    title: "Full-text search",
    desc: "Filter across your corpus by keyword, POS, domain, date, license, and file type.",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  {
    title: "Flexible export",
    desc: "Download individual documents or your entire corpus as JSON or CSV.",
    icon: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
  },
  {
    title: "Role-based access",
    desc: "Admin, researcher, student, and guest roles with fine-grained permissions.",
    icon: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
  {
    title: "License tagging",
    desc: "Mark every document as open, research-only, or restricted — searchable by license.",
    icon: (
      <>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </>
    ),
  },
];

const STEPS = [
  { name: "Upload", desc: "Add a file, paste a URL, or send an image for OCR." },
  { name: "Process", desc: "Automatic cleaning, tokenization, and POS analysis runs immediately." },
  { name: "Explore", desc: "View charts, tokens, and metadata — or search across your whole corpus." },
  { name: "Export", desc: "Download as JSON or CSV for any downstream NLP pipeline." },
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
];

const HERO_STATS = [
  ["5+", "Source formats"],
  ["NLP", "POS & tokenization"],
  ["CSV/JSON", "Export ready"],
  ["2", "User roles"],
];

const FOOTER_LINKS = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms of Service", to: "/terms" },
  { label: "Contact Support", to: "/contact" },
];

const DEFAULT_DEMO_TEXT =
  "The quick brown fox jumps over the lazy dog. Automatic tokenization and POS analysis runs immediately inside your language resource workspace.";

const WORDS_BY_TAG = {
  DET: "the a an this that these those",
  PRON: "i you he she it we they me him her us them my your his its our their",
  ADP: "in on at by for with about against between into through during before after above below to of from over under",
  CONJ: "and but or so yet nor because although if since unless",
  AUX: "can could will would should may might must",
  VERB: "is am are was were be been being have has had do does did jumps run runs running walk walks look looks build analyze explore extract process uploads upload search export manage love learn",
  ADJ: "quick brown lazy amazing language linguistic multi local global simple powerful flexible automatic beautiful green new free",
  NOUN: "fox dog cat mouse workspace corpus project code user data text platform resource analysis details feature steps format pdf license access website application insight role team",
};

const POS_DICT = Object.fromEntries(
  Object.entries(WORDS_BY_TAG).flatMap(([tag, words]) => words.split(" ").map((word) => [word, tag]))
);

const SUFFIX_RULES = [
  { tag: "VERB", test: (w) => /(ing|ed|es)$/.test(w) || (w.endsWith("s") && w.length > 3) },
  { tag: "OTHER", test: (w) => w.endsWith("ly") },
  { tag: "ADJ", test: (w) => /(ous|ful|ble|ive|al|y)$/.test(w) },
  { tag: "NOUN", test: (w) => /(tion|ment|ness|ity|er|or)$/.test(w) },
];

const POS_INFO = {
  NOUN: { bg: "#e8f0fe", color: "#1a73e8", border: "#d2e3fc", label: "Noun", desc: "A word that represents a person, place, thing, or idea. Nouns act as the core subject or object of a clause." },
  VERB: { bg: "#e6f4ea", color: "#137333", border: "#ceead6", label: "Verb", desc: "A word expressing an action, occurrence, or state of being. The core driver of the sentence structure." },
  ADJ: { bg: "#f3e8fd", color: "#86118d", border: "#f3e8fd", label: "Adjective", desc: "A modifier that describes or clarifies a noun or pronoun, specifying qualities, sizes, or properties." },
  DET: { bg: "#fef7e0", color: "#b06000", border: "#feecb5", label: "Determiner", desc: "A word placed before a noun to clarify reference or specify number/definiteness (e.g., the, a, those)." },
  ADP: { bg: "#fce8e6", color: "#c5221f", border: "#fad2cf", label: "Preposition", desc: "An adposition (preposition) indicating spatial, temporal, or logical relationship to another word (e.g., in, on, to)." },
  PRON: { bg: "#e2f3f5", color: "#007a87", border: "#bfeef2", label: "Pronoun", desc: "A grammatical substitute for a noun or noun phrase (e.g., i, they, she, it)." },
  AUX: { bg: "#e6f4ea", color: "#137333", border: "#ceead6", label: "Auxiliary Verb", desc: "An auxiliary helper verb providing additional tense, grammatical mood, or voice structure." },
  CONJ: { bg: "#fff0e6", color: "#a8470a", border: "#fddcc4", label: "Conjunction", desc: "A word that connects words, phrases, or clauses (e.g., and, but, because)." },
  OTHER: { bg: "#f1f3f4", color: "#3c4043", border: "#e8eaed", label: "Punctuation/Other", desc: "Punctuation or a minor part-of-speech category." },
};

function tagWord(word) {
  const w = word.toLowerCase().trim();
  if (!w) return "OTHER";
  if (POS_DICT[w]) return POS_DICT[w];
  return SUFFIX_RULES.find((rule) => rule.test(w))?.tag ?? "NOUN";
}

function tokenize(text) {
  return text.split(/(\s+)/).map((part, index) => {
    if (!part.trim()) return { text: part, isSpace: true, index };
    const clean = part.replace(/[^\p{L}\p{N}']/gu, "");
    return { text: part, clean, tag: tagWord(clean), isSpace: false, index };
  });
}

const styles = {
  page: { fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh" },
  container: { maxWidth: 960, margin: "0 auto" },
  centered: { textAlign: "center" },
  ctaRow: { display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" },
  statsRow: {
    display: "flex",
    justifyContent: "center",
    gap: 48,
    flexWrap: "wrap",
    paddingTop: 40,
    borderTop: "1px solid rgba(255,255,255,0.12)",
  },
  statValue: { fontSize: 32, fontWeight: 700, color: "#fff", fontFamily: "var(--font-head)" },
  statLabel: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  highlight: { color: "var(--sage)", textDecoration: "underline", textDecorationColor: "rgba(143,184,154,0.4)" },
  step: { padding: "0 12px", textAlign: "center" },
  stepNumber: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    margin: "0 auto 16px",
    borderRadius: "50%",
    background: "var(--forest)",
    boxShadow: "0 4px 10px rgba(26,58,42,0.2)",
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
  },
  cardTitle: { marginBottom: 8, fontSize: 15, fontWeight: 600, color: "var(--forest)" },
  cardText: { fontSize: 13, lineHeight: 1.6, color: "var(--ink-mid)" },
  sourceCard: {
    padding: "20px 24px",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--ivory)",
    cursor: "default",
    transition: "transform 0.2s var(--ease), border-color 0.2s",
  },
  roleCard: {
    padding: 24,
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--paper)",
    boxShadow: "var(--shadow-xs)",
    transition: "transform 0.2s var(--ease)",
  },
  roleDot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    marginBottom: 16,
    borderRadius: "50%",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
    padding: "32px 24px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    background: "#0c1510",
  },
  footerBrand: {
    fontFamily: "var(--font-head)",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "rgba(255,255,255,0.5)",
  },
  footerLink: { fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.2s" },
  inspector: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginTop: 24,
    padding: 18,
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--ivory)",
    textAlign: "left",
  },
  inspectorBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: "50%",
    fontSize: 14,
    fontWeight: 700,
  },
};

function Hover({ as: Tag = "div", base, hover, children, ...rest }) {
  const [active, setActive] = useState(false);
  return (
    <Tag
      style={{ ...base, ...(active ? hover : null) }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function Section({ background, centered, tag, title, subtitle, borderBottom, children }) {
  return (
    <section
      className="home-section"
      style={{ background, borderBottom: borderBottom ? "1px solid var(--border)" : undefined }}
    >
      <div style={{ ...styles.container, ...(centered ? styles.centered : null) }}>
        <span className="section-tag">{tag}</span>
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle" style={centered ? { margin: "0 auto 48px" } : undefined}>
          {subtitle}
        </p>
        {children}
      </div>
    </section>
  );
}

function AuthButtons({ primaryLabel, style }) {
  return (
    <div style={{ ...styles.ctaRow, ...style }}>
      <Link to="/register">
        <button className="btn-hero-primary">{primaryLabel}</button>
      </Link>
      <Link to="/login">
        <button className="btn-hero-secondary">Sign in</button>
      </Link>
    </div>
  );
}

function LiveDemo() {
  const [text, setText] = useState(DEFAULT_DEMO_TEXT);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const tokens = tokenize(text);
  const selected = tokens.find((tok) => tok.index === selectedIndex && !tok.isSpace);
  const selectedInfo = selected && POS_INFO[selected.tag];

  return (
    <div className="demo-container">
      <textarea
        className="demo-textarea"
        aria-label="Text to analyze"
        value={text}
        maxLength={200}
        placeholder="Type something here to analyze..."
        onChange={(e) => {
          setText(e.target.value);
          setSelectedIndex(null);
        }}
      />

      <div style={{ textAlign: "left", marginBottom: 12 }}>
        <span className="label" style={{ fontSize: 11 }}>
          Real-time NLP Output (Click a word to inspect)
        </span>
      </div>

      <div className="demo-tokens">
        {tokens.map((tok) => {
          if (tok.isSpace) {
            return (
              <span key={tok.index} style={{ whiteSpace: "pre" }}>
                {tok.text}
              </span>
            );
          }
          const info = POS_INFO[tok.tag];
          const isSelected = tok.index === selectedIndex;
          return (
            <span
              key={tok.index}
              className="demo-token-tag"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedIndex(tok.index)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedIndex(tok.index)}
              style={{
                backgroundColor: info.bg,
                color: info.color,
                borderColor: isSelected ? "var(--forest)" : info.border,
                boxShadow: isSelected ? "0 0 0 2px var(--forest-lt)" : "none",
                transform: isSelected ? "translateY(-2px)" : "none",
                fontWeight: isSelected ? 600 : 500,
              }}
            >
              {tok.text}
              <span className="demo-token-pos" style={{ color: info.color }}>
                {tok.tag}
              </span>
            </span>
          );
        })}
      </div>

      <div className="demo-legend">
        {Object.entries(POS_INFO).map(([key, { color, label }]) => (
          <div key={key} className="demo-legend-item">
            <div className="demo-dot" style={{ backgroundColor: color }} />
            <span style={{ fontWeight: 600, color: "var(--ink-mid)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={styles.inspector}>
        <div
          style={{
            ...styles.inspectorBadge,
            background: selectedInfo?.bg ?? "var(--border)",
            color: selectedInfo?.color ?? "var(--ink-lt)",
          }}
        >
          {selected ? selected.tag : "?"}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--forest)" }}>
            {selected ? `Token: "${selected.clean}"` : "Linguistic Inspector"}
          </div>
          <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.45, color: "var(--ink-mid)" }}>
            {selectedInfo
              ? selectedInfo.desc
              : "Click on any color-coded word token above to reveal its linguistic role and structural information."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div style={styles.page}>
      <section className="home-hero">
        <div className="hero-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Language Resource Workspace
        </div>

        <h1 className="hero-title">
          Build, analyze and explore your <span style={styles.highlight}>language corpus</span>
        </h1>

        <p className="hero-subtitle">
          Upload documents, run NLP pipelines, search your entire corpus, and export structured linguistic data — all in one place.
        </p>

        <AuthButtons primaryLabel="Get started free" style={{ marginBottom: 56 }} />

        <div style={styles.statsRow}>
          {HERO_STATS.map(([value, label]) => (
            <div key={label} style={{ ...styles.centered, minWidth: 100 }}>
              <div style={styles.statValue}>{value}</div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <Section
        background="var(--ivory)"
        centered
        borderBottom
        tag="Interactive Preview"
        title="Try the Live NLP Analyzer"
        subtitle="Type or edit the sentence below to see our client-side tokenizer and Part-of-Speech analyzer label terms in real-time."
      >
        <LiveDemo />
      </Section>

      <Section
        background="var(--paper)"
        tag="Everything you need"
        title="A complete corpus management platform"
        subtitle="From raw file ingestion to analyzed linguistic matrices — LRW handles the full pipelines."
      >
        <div className="grid-features">
          {FEATURES.map(({ title, desc, icon }) => (
            <div key={title} className="home-card">
              <div className="home-card-icon">
                <Icon>{icon}</Icon>
              </div>
              <div className="home-card-title">{title}</div>
              <div className="home-card-desc">{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        background="var(--cream)"
        centered
        tag="How it works"
        title="From upload to insight in four steps"
        subtitle="Our streamlined lifecycle processes files immediately and aggregates stats across the corpus."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
          {STEPS.map(({ name, desc }, i) => (
            <div key={name} style={styles.step}>
              <div style={styles.stepNumber}>{i + 1}</div>
              <div style={styles.cardTitle}>{name}</div>
              <div style={styles.cardText}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        background="var(--paper)"
        tag="Source types"
        title="Ingest from anywhere"
        subtitle="Five source types so you can build a diverse, mixed-media corpus without preprocessing outside the platform."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {SOURCES.map(({ label, sub }) => (
            <Hover
              key={label}
              base={styles.sourceCard}
              hover={{ transform: "translateY(-3px)", borderColor: "var(--sage)" }}
            >
              <div style={{ ...styles.cardTitle, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--ink-lt)" }}>{sub}</div>
            </Hover>
          ))}
        </div>
      </Section>

      <Section
        background="var(--cream)"
        tag="Access control"
        title="Built for every member of your team"
        subtitle="Two predefined roles with granular access controls — from researchers with full access to guest explorers."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {ROLES.map(({ name, color, desc }) => (
            <Hover key={name} base={styles.roleCard} hover={{ transform: "translateY(-4px)" }}>
              <div style={{ ...styles.roleDot, background: `${color}22` }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
              </div>
              <div style={{ ...styles.cardTitle, fontSize: 16 }}>{name}</div>
              <div style={styles.cardText}>{desc}</div>
            </Hover>
          ))}
        </div>
      </Section>

      <section className="home-hero" style={{ padding: "80px 24px" }}>
        <h2 className="hero-title" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>
          Ready to build your corpus?
        </h2>
        <p className="hero-subtitle" style={{ color: "rgba(255,255,255,0.6)", marginBottom: 36 }}>
          Create a free account and upload your first document in under two minutes.
        </p>
        <AuthButtons primaryLabel="Create free account" />
      </section>

      <footer style={styles.footer}>
        <span style={styles.footerBrand}>LRW</span>
        <div style={{ display: "flex", gap: 24 }}>
          {FOOTER_LINKS.map(({ label, to }) => (
            <Hover key={to} as={Link} to={to} base={styles.footerLink} hover={{ color: "#fff" }}>
              {label}
            </Hover>
          ))}
        </div>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          &copy; {new Date().getFullYear()} Language Resource Workspace
        </span>
      </footer>
    </div>
  );
}
