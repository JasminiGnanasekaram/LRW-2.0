import React, { useState } from 'react';

export default function Contact() {
  const [status, setStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("Your message has been sent. Our support team will get back to you shortly.");
    e.target.reset();
  };

  return (
    <div style={{ fontFamily: "var(--font-body)", color: "var(--ink)", background: "var(--ivory)", minHeight: "100vh", paddingTop: 80 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--forest)", marginBottom: 16 }}>Contact Support</h1>
        <p style={{ lineHeight: 1.6, marginBottom: 32, color: "var(--ink-mid)" }}>
          Need help? Have a question about the platform? Fill out the form below and our team will be in touch.
        </p>
        
        {status && (
          <div style={{ background: "var(--sage)", color: "#fff", padding: "12px 16px", borderRadius: "var(--radius)", marginBottom: 24, fontWeight: 500 }}>
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>Name</label>
            <input 
              type="text" 
              required 
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#fff" }}
              placeholder="Your name"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>Email</label>
            <input 
              type="email" 
              required 
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#fff" }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>Message</label>
            <textarea 
              required 
              rows={5}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#fff", resize: "vertical" }}
              placeholder="How can we help you?"
            />
          </div>
          <button 
            type="submit" 
            style={{ 
              background: "var(--forest)", color: "#fff", border: "none", padding: "12px 24px", 
              borderRadius: "var(--radius)", fontSize: 15, fontWeight: 600, cursor: "pointer",
              alignSelf: "flex-start", transition: "background 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--forest-lt)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--forest)"}
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
