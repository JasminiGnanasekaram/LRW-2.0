<<<<<<< HEAD
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
=======
import React from 'react';

export default function Privacy() {
  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh", paddingTop: 80 }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--forest)", marginBottom: 24 }}>Privacy Policy</h1>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use the Language Resource Workspace (LRW).
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Information Collection</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          We collect information that you provide directly to us, such as when you create an account, upload documents, or contact support. This may include your name, email address, and any data contained within the documents you upload.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Use of Information</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          The information we collect is used to provide, maintain, and improve the LRW platform, to process your NLP analysis requests, and to communicate with you about your account and our services.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Data Security</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          We implement appropriate technical and organizational measures to protect the personal data that we collect and process about you. However, please be aware that no data transmission over the internet can be guaranteed to be 100% secure.
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)", marginTop: 32, marginBottom: 16 }}>Contact Us</h2>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>
          If you have any questions about this Privacy Policy, please contact us via our Support page.
        </p>
      </div>
>>>>>>> origin/kirupaN
    </div>
  );
}
