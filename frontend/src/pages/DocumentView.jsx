import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocumentURL } from "../api";

const PIE_COLORS = ["#2962ff", "#8e24aa", "#00897b", "#ef6c00", "#c62828", "#558b2f", "#283593", "#6a1b9a"];

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("cleaned");
  const [error, setError] = useState("");

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"));
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!doc) return <p className="muted">Loading...</p>;

  const posData = Object.entries(doc.nlp?.pos_distribution || {})
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count);
  const topWordsData = (doc.nlp?.top_words || [])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  return (
    <div>
      <h1>{doc.filename}</h1>
      <p className="muted">
        <span className="badge">{doc.file_type}</span>{" "}
        Uploaded {new Date(doc.created_at).toLocaleString()} ·
        Tokens: {doc.nlp?.token_count ?? "-"}
      </p>

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["cleaned", "raw", "nlp", "charts", "metadata"].map((t) => (
            <button key={t} className={tab === t ? "" : "ghost"} onClick={() => setTab(t)} type="button">{t}</button>
          ))}
          <a href={exportDocumentURL(id, "json")} target="_blank" rel="noreferrer" style={{ marginLeft: "auto" }}>
            <button className="ghost" type="button">Export JSON</button>
          </a>
          <a href={exportDocumentURL(id, "csv")} target="_blank" rel="noreferrer">
            <button className="ghost" type="button">Export CSV</button>
          </a>
        </div>

        {tab === "cleaned" && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw" && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {tab === "nlp" && doc.nlp && (
          <div>
            <h2>POS Distribution</h2>
            <div>
              {Object.entries(doc.nlp.pos_distribution || {}).map(([pos, n]) => (
                <span key={pos} className="pos-chip">{pos}: {n}</span>
              ))}
            </div>
            <h2 style={{ marginTop: 24 }}>Tokens (first 200)</h2>
            <div className="snippet">
              {(doc.nlp.tokens || []).slice(0, 200).map((t, i) => (
                <span key={i} className="pos-chip" title={t.tag}>{t.text} <em>({t.pos})</em></span>
              ))}
            </div>
          </div>
        )}

        {tab === "charts" && doc.nlp && (
          <div>
            <h2>POS Distribution</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={posData} dataKey="count" nameKey="pos"
                    cx="50%" cy="50%" outerRadius={100} label
                  >
                    {posData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <h2 style={{ marginTop: 32 }}>Top Words</h2>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={topWordsData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="word" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2962ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
