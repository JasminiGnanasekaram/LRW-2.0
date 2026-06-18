import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument } from "../api";

const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("cleaned");
  const [error, setError] = useState("");

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .catch((e) => setError(e.response?.data?.detail || "Failed to load document."));
  }, [id]);

  if (error) return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="alert-error">{error}</div>
      <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
    </div>
  );
  if (!doc) return <div className="page"><p className="muted">Loading…</p></div>;

  const posData = Object.entries(doc.nlp?.pos_distribution || {})
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count);
  const topWordsData = (doc.nlp?.top_words || []).slice(0, 15).map(([word, count]) => ({ word, count }));

  const TABS = [
    { key: "cleaned", label: "Cleaned" },
    { key: "raw", label: "Raw" },
    { key: "nlp", label: "NLP Data" },
    { key: "charts", label: "Charts" },
    { key: "metadata", label: "Metadata" },
  ];

  const POS_LABELS = {
  // English
  NOUN: "Noun", VERB: "Verb", ADJ: "Adjective", ADV: "Adverb",
  PROPN: "Proper Noun", DET: "Determiner", ADP: "Preposition",
  PRON: "Pronoun", CCONJ: "Conjunction", PUNCT: "Punctuation",
  NUM: "Number", AUX: "Auxiliary Verb", PART: "Particle", X: "Other",
  // Tamil (same keys, already covered above)
};

  return (
    <div className="page">
      <div className="page-header fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <Link to="/" className="muted" style={{ fontSize: 13, marginBottom: 6, display: "inline-block" }}>← Dashboard</Link>
            <h1 className="page-title" style={{ wordBreak: "break-word" }}>{doc.filename}</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge">{doc.file_type}</span>
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.nlp?.token_count && (
                <span className="muted">{doc.nlp.token_count.toLocaleString()} tokens</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportDocument(id, "json")}>↓ JSON</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportDocument(id, "csv")}>↓ CSV</button>
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab-btn${tab === key ? " active" : ""}`} onClick={() => setTab(key)} type="button">
              {label}
            </button>
          ))}
        </div>

        {tab === "cleaned" && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw" && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {tab === "nlp" && doc.nlp && (
          <div>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 12 }}>POS Distribution</h3>
            <div style={{ marginBottom: 28 }}>
              {Object.entries(doc.nlp.pos_distribution || {}).map(([pos, n]) => (
                <span key={pos} className="pos-chip">{POS_LABELS[pos] || pos}: {n}</span>
              ))}
            </div>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 12 }}>Tokens (first 200)</h3>
            <div className="snippet" style={{ maxHeight: 240 }}>
              {(doc.nlp.token_details || []).slice(0, 200).map((t, i) => (
               <span key={i} className="pos-chip" title={t.tag}>{t.text} <em>({POS_LABELS[t.pos] || t.pos})</em></span>
            ))}
            </div>
          </div>
        )}

        {tab === "charts" && doc.nlp && (
          <div>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 20 }}>POS Distribution</h3>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={posData} dataKey="count" nameKey="pos" cx="50%" cy="50%" outerRadius={100} label>
                    {posData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", margin: "28px 0 20px" }}>Top Words</h3>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={topWordsData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="word" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a3a2a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
