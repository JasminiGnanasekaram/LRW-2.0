import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Information we collect",
    body: `When you register, we collect your name, email address, and a securely hashed password. We also store the documents, files, and metadata you upload, along with minimal activity and session records needed to keep the Service running.`,
  },
  {
    title: "2. Email verification",
    body: `LRW uses your email address to send a one-time verification link during registration and to deliver password reset instructions when requested. This process is handled through the Gmail API and Google's OAuth2 framework. We do not use your email for marketing and do not share it with third parties.`,
  },
  {
    title: "3. How we use your data",
    body: `Your data is used to power core functionality: authenticate your account, associate uploads with your profile, run NLP processing (tokenization, POS tagging, OCR, transcription) on submitted content, and enable search and export within your own corpus.`,
  },
  {
    title: "4. Data storage",
    body: `Data is stored in MongoDB and session/cache data is stored in Redis. As an academic/development project, this data is held in a local or lab environment and is not shared with third-party analytics or advertising services.`,
  },
  {
    title: "5. Cookies and sessions",
    body: `LRW uses JWT tokens for authentication and session management. These tokens are used only to keep you signed in and are not used for cross-site tracking or advertising.`,
  },
  {
    title: "6. Third-party services",
    body: `LRW integrates with the Gmail API to send verification and reset emails, and may use external NLP or transcription services for certain uploads. These providers receive only the minimum information needed to perform their function.`,
  },
  {
    title: "7. Your rights",
    body: `You may request access to, correction of, or deletion of your account and associated data by contacting an administrator. Deleting your account removes your profile and, where feasible, the uploaded documents associated with it.`,
  },
  {
    title: "8. Data security",
    body: `Passwords are hashed before storage and are never stored or transmitted in plaintext. Administrative access is limited to explicitly authorized accounts.`,
  },
  {
    title: "9. Children's privacy",
    body: `LRW is intended for academic and research use and is not directed at children under 13. We do not knowingly collect personal information from children under 13.`,
  },
  {
    title: "10. Changes to this policy",
    body: `This Privacy Policy may be updated periodically. Continued use of LRW after changes are posted constitutes acceptance of the revised policy.`,
  },
];

export default function Privacy() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}>
      <section style={{ background: "var(--forest)", padding: "56px 32px 48px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
          Legal
        </p>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Privacy Policy
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
