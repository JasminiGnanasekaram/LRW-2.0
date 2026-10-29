import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { searchDocuments } from "../api";

const POS_OPTIONS = ["NOUN", "VERB", "ADJ", "ADV", "PROPN", "PRON", "DET", "ADP", "NUM"];
const FILE_TYPES = ["text", "pdf", "image", "audio", "url"];
const LICENSES = [
  ["public-domain", "Public Domain"],
  ["cc0", "CC0"],
  ["cc-by", "CC BY"],
  ["cc-by-sa", "CC BY-SA"],
  ["cc-by-nc", "CC BY-NC"],
  ["cc-by-nd", "CC BY-ND"],
  ["mit", "MIT"],
  ["apache-2.0", "Apache 2.0"],
  ["gpl-3.0", "GPL 3.0"],
  ["proprietary", "Proprietary"],
  ["restricted", "Restricted"],
  ["other", "Other"],
];

const FILTER_KEYS = ["pos", "file_type", "domain", "license", "date_from", "date_to"];
const EMPTY_FILTERS = { q: "", pos: "", file_type: "", domain: "", license: "", date_from: "", date_to: "" };
const DEBOUNCE_MS = 300;

const countActiveFilters = (filters) => FILTER_KEYS.filter((key) => filters[key]).length;

function FilterField({ id, label, children }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <FilterField id={id} label={label}>
      <select id={id} value={value} onChange={onChange}>
        <option value="">Any</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

const toOptions = (values) => values.map((value) => [value, value]);

export default function Search() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const requestIdRef = useRef(0);

  const activeFilterCount = countActiveFilters(filters);
  const update = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  const runSearch = useCallback(async (current) => {
    const requestId = ++requestIdRef.current;
    setError("");

    if (!current.q.trim() && !countActiveFilters(current)) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(current).filter(([, value]) => value !== ""));
      const data = await searchDocuments(params);
      if (requestId === requestIdRef.current) setResults(data);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err.response?.data?.detail || "Search failed.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(filters), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, runSearch]);

  const submit = (e) => {
    e.preventDefault();
    runSearch(filters);
  };

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
              type="text"
              aria-label="Search keywords"
              value={filters.q}
              onChange={update("q")}
              placeholder="Search keywords…"
              autoFocus
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((open) => !open)}
              style={{ flexShrink: 0 }}
            >
              Filters {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flexShrink: 0 }}>
              {loading ? "…" : "Search"}
            </button>
          </div>

          {showFilters && (
            <>
              <div className="row">
                <FilterSelect id="filter-pos" label="POS tag" value={filters.pos} onChange={update("pos")} options={toOptions(POS_OPTIONS)} />
                <FilterSelect id="filter-type" label="Source type" value={filters.file_type} onChange={update("file_type")} options={toOptions(FILE_TYPES)} />
                <FilterSelect id="filter-license" label="License" value={filters.license} onChange={update("license")} options={LICENSES} />
              </div>
              <div className="row">
                <FilterField id="filter-domain" label="Domain">
                  <input id="filter-domain" type="text" value={filters.domain} onChange={update("domain")} placeholder="news, science…" />
                </FilterField>
                <FilterField id="filter-from" label="Date from">
                  <input id="filter-from" type="date" value={filters.date_from} max={filters.date_to || undefined} onChange={update("date_from")} />
                </FilterField>
                <FilterField id="filter-to" label="Date to">
                  <input id="filter-to" type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={update("date_to")} />
                </FilterField>
              </div>
            </>
          )}
        </form>
      </div>

      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {results && (
        <div className="card fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 18, color: "var(--forest)" }}>
              {results.count} result{results.count !== 1 && "s"}
            </span>
            <span className="muted">for {results.query ? `"${results.query}"` : "all matching documents"}</span>
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
                <Link to={`/documents/${r.raw_document_id}`} style={{ fontSize: 15, fontWeight: 600 }}>
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
