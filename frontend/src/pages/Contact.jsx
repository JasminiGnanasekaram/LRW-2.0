import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh", padding: "56px 24px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ color: "var(--forest)", marginBottom: 12 }}>Contact Support</h1>
        <p style={{ lineHeight: 1.6, marginBottom: 28, color: "var(--ink-mid)" }}>Questions, feedback, or account issues? Send a message to the LRW support team.</p>
        {sent && <div className="alert-success" style={{ marginBottom: 20 }}>Your message has been sent. We will get back to you shortly.</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label>Name<input type="text" required placeholder="Your name" /></label>
          <label>Email<input type="email" required placeholder="you@example.com" /></label>
          <label>Message<textarea required rows={6} placeholder="How can we help?" /></label>
          <button className="btn btn-primary" type="submit">Send Message</button>
        </form>
      </div>
    </div>
  );
}
