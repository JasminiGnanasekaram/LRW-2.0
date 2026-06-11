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
  const [showFilters, setShowFilters] = useState(false);

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
      setError(err.response?.data?.detail || "Search failed.");
    } finally { setLoading(false); }
  };

  const activeFilterCount = [filters.pos, filters.file_type, filters.domain, filters.license, filters.date_from, filters.date_to]
    .filter(Boolean).length;

  return (
    <div className="page">
      <div className="page-header fade-up">
        <h1 className="page-title">Search Corpus</h1>
        <p className="page-subtitle">Search across all documents by keywords, POS tags, type, and more</p>
      </div>

      <div className="card fade-up fade-up-1">
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 10, marginBottom: showFilters ? 20 : 0 }}>
            <input
              value={filters.q}
              onChange={(e) => upd("q", e.target.value)}
              placeholder="Search keywords…"
              autoFocus
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowFilters(!showFilters)}
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Filters {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flexShrink: 0 }}>
              {loading ? "…" : "Search"}
            </button>
          </div>

          {showFilters && (
            <div style={{ paddingTop: 4 }}>
              <div className="row">
                <div>
                  <label className="label">POS tag</label>
                  <select value={filters.pos} onChange={(e) => upd("pos", e.target.value)}>
                    {POS_OPTIONS.map((p) => <option key={p} value={p}>{p || "Any"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Source type</label>
                  <select value={filters.file_type} onChange={(e) => upd("file_type", e.target.value)}>
                    {FILE_TYPES.map((p) => <option key={p} value={p}>{p || "Any"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">License</label>
                  <select value={filters.license} onChange={(e) => upd("license", e.target.value)}>
                    {LICENSES.map((p) => <option key={p} value={p}>{p || "Any"}</option>)}
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="label">Domain</label>
                  <input value={filters.domain} onChange={(e) => upd("domain", e.target.value)} placeholder="news, science…" />
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
            </div>
          )}
        </form>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {results && (
        <div className="card fade-up">
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 18, color: "var(--forest)" }}>
              {results.count} result{results.count !== 1 ? "s" : ""}
            </span>
            <span className="muted">for "{results.query}"</span>
          </div>

          {results.results.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No results found</div>
              <p>Try different keywords or broaden your filters.</p>
            </div>
          )}

          {results.results.map((r) => (
            <div key={r.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Link to={`/documents/${r.raw_document_id}`} style={{ fontWeight: 600, color: "var(--forest)", fontSize: 15 }}>
                  {r.filename}
                </Link>
                <span className="badge">{r.file_type}</span>
              </div>
              <p className="snippet" style={{ maxHeight: "none", padding: "8px 12px", fontSize: 13 }}>
                {r.snippet}…
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
