import { useState, useEffect, useRef } from "react";

const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "" },
  { code: "ta", label: "Tamil",   native: "தமிழ்",   flag: "" },
  { code: "si", label: "Sinhala", native: "සිංහල",   flag: "" },
];

export function useUILanguage() {
  const [lang, setLang] = useState(
    () => localStorage.getItem("lrw_ui_lang") || "en"
  );
  const change = (code) => {
    setLang(code);
    localStorage.setItem("lrw_ui_lang", code);
  };
  return [lang, change];
}

export const UI_STRINGS = {
  en: {
    dashboard: "Dashboard", upload: "Upload",
    search: "Search",       admin: "Admin",
    signOut: "Sign out",    signIn: "Sign in",
    getStarted: "Get started",
  },
  ta: {
    dashboard: "டாஷ்போர்டு", upload: "பதிவேற்று",
    search: "தேடு",           admin: "நிர்வாகம்",
    signOut: "வெளியேறு",      signIn: "உள்நுழை",
    getStarted: "தொடங்குங்கள்",
  },
  si: {
    dashboard: "උපකරණ පුවරුව", upload: "උඩුගත කරන්න",
    search: "සොයන්න",           admin: "පරිපාලන",
    signOut: "ඉවත් වන්න",       signIn: "පිවිසෙන්න",
    getStarted: "ආරම්භ කරන්න",
  },
};

export default function LanguageSwitcher({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 6, padding: "5px 10px",
          color: "#fff", fontSize: 13, cursor: "pointer",
          fontFamily: "var(--font-body)",
        }}
        title="Change interface language"
      >
        <span>{current.flag}</span>
        <span>{current.native}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", borderRadius: 8, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          border: "1px solid var(--border)", minWidth: 160, zIndex: 999,
        }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { onChange(l.code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 16px",
                background: lang === l.code ? "var(--mint)" : "transparent",
                border: "none", borderBottom: "1px solid var(--border)",
                cursor: "pointer", fontSize: 14,
                color: "var(--ink)", fontFamily: "var(--font-body)",
                fontWeight: lang === l.code ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.native}</div>
                <div style={{ fontSize: 11, color: "var(--ink-lt)" }}>{l.label}</div>
              </div>
              {lang === l.code && (
                <span style={{ marginLeft: "auto", color: "var(--forest)" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}