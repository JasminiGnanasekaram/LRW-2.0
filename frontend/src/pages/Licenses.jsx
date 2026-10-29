import { Link } from "react-router-dom";

const BACKEND_LIBS = [
  { name: "FastAPI", license: "MIT", desc: "Primary Python API framework" },
  { name: "Uvicorn", license: "BSD-3-Clause", desc: "ASGI server powering backend requests" },
  { name: "Pydantic", license: "MIT", desc: "Data validation and configuration models" },
  { name: "Motor (MongoDB)", license: "Apache-2.0", desc: "Asynchronous MongoDB driver" },
  { name: "Redis-py", license: "MIT", desc: "Redis client for cache and session storage" },
  { name: "PyMuPDF (fitz)", license: "AGPL-3.0 / Commercial", desc: "PDF parsing and extraction" },
  { name: "Passlib / bcrypt", license: "BSD-2-Clause", desc: "Secure password hashing" },
  { name: "python-jose", license: "MIT", desc: "JWT generation and verification" },
  { name: "Groq SDK", license: "Apache-2.0", desc: "LLM-backed summarization" },
];

const FRONTEND_LIBS = [
  { name: "React", license: "MIT", desc: "Component-driven UI library" },
  { name: "Vite", license: "MIT", desc: "Fast build tool and development server" },
  { name: "React Router", license: "MIT", desc: "Client-side routing" },
  { name: "Axios", license: "MIT", desc: "HTTP client for API requests" },
];

const SERVICES = [
  { name: "Gmail API", license: "Google APIs Terms of Service", desc: "Email verification and password reset delivery" },
  { name: "MongoDB", license: "SSPL", desc: "Primary document and user database" },
  { name: "Redis", license: "RSALv2 / SSPLv1", desc: "Cache and session storage" },
];

function Table({ rows }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      {rows.map((r, i) => (
        <div
          key={r.name}
          style={{
            display: "grid", gridTemplateColumns: "1fr auto", gap: 8,
            padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-lt)", marginTop: 2 }}>{r.desc}</div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--forest)",
            background: "var(--ivory)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "3px 10px", height: "fit-content", whiteSpace: "nowrap",
          }}>
            {r.license}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Licenses() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
          Legal
        </p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Licenses and attributions
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 10, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          LRW is built on the following open-source software and third-party services.
        </p>
      </section>

      <section style={{ padding: "56px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, color: "var(--forest)", marginBottom: 12 }}>
              Backend dependencies
            </h2>
            <Table rows={BACKEND_LIBS} />
          </div>

          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, color: "var(--forest)", marginBottom: 12 }}>
              Frontend dependencies
            </h2>
            <Table rows={FRONTEND_LIBS} />
          </div>

          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700, color: "var(--forest)", marginBottom: 12 }}>
              Third-party services
            </h2>
            <Table rows={SERVICES} />
          </div>

          <p style={{ fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.7 }}>
            License labels are provided for general reference and reflect the terms commonly
            associated with each project at the time of publication. For authoritative license
            details, consult each project's official repository or service provider documentation.
          </p>

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
