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
    </div>
  );
}
