
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { searchDocuments } from "../api";

const EMPTY_FILTERS = {
  q: "",
  pos: "",
  file_type: "",
  domain: "",
  license: "",
  date_from: "",
  date_to: "",
};

const DEBOUNCE_MS = 300;

const POS_OPTIONS = [
  "", "NOUN", "VERB", "ADJ", "ADV",
  "PROPN", "PRON", "DET", "ADP", "NUM",
];

const FILE_TYPES = ["", "text", "pdf", "image", "audio", "url"];

const LICENSES = [
  { value: "", label: "Any" },
  { value: "public-domain", label: "Public Domain" },
  { value: "cc0", label: "CC0" },
  { value: "cc-by", label: "CC BY" },
  { value: "cc-by-sa", label: "CC BY-SA" },
  { value: "cc-by-nc", label: "CC BY-NC" },
  { value: "cc-by-nd", label: "CC BY-ND" },
  { value: "mit", label: "MIT" },
  { value: "apache-2.0", label: "Apache 2.0" },
  { value: "gpl-3.0", label: "GPL 3.0" },
  { value: "proprietary", label: "Proprietary" },
  { value: "restricted", label: "Restricted" },
  { value: "other", label: "Other" },
];

function FilterField({ id, label, children }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function Search() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const upd = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const update = (key) => (event) => {
    upd(key, event.target.value);
  };

  const runSearch = useCallback(async (searchFilters) => {
    const hasActiveFilters = [
      searchFilters.q,
      searchFilters.pos,
      searchFilters.file_type,
      searchFilters.domain,
      searchFilters.license,
      searchFilters.date_from,
      searchFilters.date_to,
    ].some((value) => Boolean(value.trim()));

    if (!hasActiveFilters) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }

    const params = Object.fromEntries(
      Object.entries(searchFilters).filter(([, value]) => value !== "")
    );

    setLoading(true);
    setError("");

    try {
      const data = await searchDocuments(params);
      setResults(data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Search failed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch(filters);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters, runSearch]);

  const submit = (event) => {
    event.preventDefault();
    runSearch(filters);
  };

  const activeFilterCount = [
    filters.pos,
    filters.file_type,
    filters.domain,
    filters.license,
    filters.date_from,
    filters.date_to,
  ].filter(Boolean).length;

  return (
    <div className="page">
      <div className="page-header fade-up">
        <h1 className="page-title">Search Corpus</h1>
        <p className="page-subtitle">
          Search across all documents by keywords, POS tags, type, and more
        </p>
      </div>

      <div className="card fade-up fade-up-1">
        <form onSubmit={submit}>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: showFilters ? 20 : 0,
            }}
          >
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
              Filters{" "}
              {activeFilterCount > 0 && (
                <span className="badge">{activeFilterCount}</span>
              )}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flexShrink: 0 }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {showFilters && (
            <>
              <div className="row">
                <div>
                  <label className="label" htmlFor="filter-pos">
                    POS tag
                  </label>
                  <select
                    id="filter-pos"
                    value={filters.pos}
                    onChange={update("pos")}
                  >
                    {POS_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p || "Any"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="filter-file-type">
                    Source type
                  </label>
                  <select
                    id="filter-file-type"
                    value={filters.file_type}
                    onChange={update("file_type")}
                  >
                    {FILE_TYPES.map((p) => (
                      <option key={p} value={p}>{p || "Any"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="filter-license">
                    License
                  </label>
                  <select
                    id="filter-license"
                    value={filters.license}
                    onChange={update("license")}
                  >
                    {LICENSES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row">
                <FilterField id="filter-domain" label="Domain">
                  <input
                    id="filter-domain"
                    type="text"
                    value={filters.domain}
                    onChange={update("domain")}
                    placeholder="news, science…"
                  />
                </FilterField>

                <FilterField id="filter-from" label="Date from">
                  <input
                    id="filter-from"
                    type="date"
                    value={filters.date_from}
                    max={filters.date_to || undefined}
                    onChange={update("date_from")}
                  />
                </FilterField>

                <FilterField id="filter-to" label="Date to">
                  <input
                    id="filter-to"
                    type="date"
                    value={filters.date_to}
                    min={filters.date_from || undefined}
                    onChange={update("date_to")}
                  />
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-head)",
                fontSize: 18,
                color: "var(--forest)",
              }}
            >
              {results.count} result{results.count !== 1 ? "s" : ""}
            </span>
            <span className="muted">
              for {results.query ? `"${results.query}"` : "all matching documents"}
            </span>
          </div>

          {results.results.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No results found</div>
              <p>Try different keywords or broaden your filters.</p>
            </div>
          )}

          {results.results.map((r) => (
            <div
              key={r.id}
              style={{
                padding: "16px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <Link
                  to={`/documents/${r.raw_document_id}`}
                  style={{ fontSize: 15, fontWeight: 600 }}
                >
                  {r.filename}
                </Link>
                <span className="badge">{r.file_type}</span>
              </div>

              <p
                className="snippet"
                style={{
                  maxHeight: "none",
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {r.snippet}…
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
