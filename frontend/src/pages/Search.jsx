import { useState } from "react";
import { Link } from "react-router-dom";
import { searchDocuments } from "../api";

const POS_OPTIONS = ["", "NOUN", "VERB", "ADJ", "ADV", "PROPN", "PRON", "DET", "ADP", "NUM"];
const FILE_TYPES = ["", "text", "pdf", "image", "audio", "url"];
const LICENSES = ["", "open", "research", "restricted"];

export default function Search() {
  const [filters, setFilters] = useState({
    q: "", pos: "", file_type: "", domain: "", license: "",
    date_from: "", date_to: "",
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const upd = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!filters.q.trim()) return;
    setLoading(true); setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== "")
      );
      const data = await searchDocuments(params);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed");
    } finally { setLoading(false); }
  };

  return (
    <div>
      <h1>Search</h1>
      <div className="card">
        <form onSubmit={submit}>
          <label className="label">Query</label>
          <input
            value={filters.q}
            onChange={(e) => upd("q", e.target.value)}
            placeholder="Search keywords..."
            autoFocus
          />
          <div className="row">
            <div>
              <label className="label">POS</label>
              <select value={filters.pos} onChange={(e) => upd("pos", e.target.value)}>
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p || "(any)"}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source type</label>
              <select value={filters.file_type} onChange={(e) => upd("file_type", e.target.value)}>
                {FILE_TYPES.map((p) => <option key={p} value={p}>{p || "(any)"}</option>)}
              </select>
            </div>
            <div>
              <label className="label">License</label>
              <select value={filters.license} onChange={(e) => upd("license", e.target.value)}>
                {LICENSES.map((p) => <option key={p} value={p}>{p || "(any)"}</option>)}
              </select>
            </div>
          </div>
          <div className="row">
            <div>
              <label className="label">Domain</label>
              <input value={filters.domain} onChange={(e) => upd("domain", e.target.value)} placeholder="news, science, ..." />
            </div>
            <div>
              <label className="label">Date from</label>
              <input type="date" value={filters.date_from} onChange={(e) => upd("date_from", e.target.value)} />
            </div>
            <div>
              <label className="label">Date to</label>
              <input type="date" value={filters.date_to} onChange={(e) => upd("date_to", e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={loading}>{loading ? "Searching..." : "Search"}</button>
        </form>
      </div>

      {error && <div className="error">{error}</div>}

      {results && (
        <div className="card">
          <p className="muted">{results.count} result(s) for "{results.query}"</p>
          {results.results.map((r) => (
            <div key={r.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #eee" }}>
              <Link to={`/documents/${r.raw_document_id}`}>
                <strong>{r.filename}</strong>
              </Link>
              <span className="badge" style={{ marginLeft: 8 }}>{r.file_type}</span>
              <div className="snippet">{r.snippet}...</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
