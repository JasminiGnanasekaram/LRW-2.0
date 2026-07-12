import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: `By creating an account or using Language Resource Workbench ("LRW", "the Service"), you agree to these Terms of Service. If you do not agree, please discontinue use. LRW is offered for academic and demonstration purposes and is provided "as is" without express or implied warranties.`,
  },
  {
    title: "2. Accounts and roles",
    body: `LRW supports two account types: Guest (read-only access to open-licensed documents) and Researcher/NLP Developer (upload, analysis, search, and export access). You are responsible for keeping your login credentials secure and for all activity carried out under your account.`,
  },
  {
    title: "3. Acceptable use",
    body: `Do not upload unlawful material or content that infringes third-party intellectual property, privacy, or licensing rights. You agree not to interfere with the Service, attempt unauthorized access, or disrupt the underlying platform and APIs.`,
  },
  {
    title: "4. User-submitted content",
    body: `You retain ownership of any documents, audio, or other files you upload. By submitting content, you grant LRW a limited license to store, process (for example, tokenize, OCR, transcribe), and display that content within the Service. You must ensure you have the right to upload and process all submitted material.`,
  },
  {
    title: "5. License tagging",
    body: `LRW allows users to tag documents as open, research-only, or restricted. These tags are provided by the uploader and are not independently verified by LRW. Users are responsible for accurately representing the licensing status of their content.`,
  },
  {
    title: "6. Service availability",
    body: `LRW is provided on a best-effort basis and does not guarantee uptime, durability, or availability. As a research-oriented demonstration project, features, data, and access may change or be reset without notice.`,
  },
  {
    title: "7. Termination",
    body: `LRW administrators may suspend or terminate accounts that violate these Terms or engage in abusive, unlawful, or harmful behavior.`,
  },
  {
    title: "8. Changes to these terms",
    body: `These Terms may be revised periodically. Continued use of LRW after updates are published indicates your acceptance of the revised terms.`,
  },
  {
    title: "9. Contact",
    body: `If you have questions about these Terms, please reach out via the Contact page in the footer.`,
  },
];

export default function Terms() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
          Legal
        </p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>
          Last updated: July 2026
        </p>
      </section>

      <section style={{ padding: "56px 32px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {SECTIONS.map(({ title, body }) => (
            <div key={title} style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 17, fontWeight: 700, color: "var(--forest)", marginBottom: 8 }}>
                {title}
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-lt)", lineHeight: 1.75 }}>{body}</p>
            </div>
          ))}

          <div style={{ marginTop: 48, textAlign: "center" }}>
            <Link to="/home" style={{ fontSize: 13, color: "var(--forest)", fontWeight: 600 }}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
