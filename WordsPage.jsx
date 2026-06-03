import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { wordsAPI } from "../api/client";
import { useDebounce } from "../hooks/useDebounce";

const STATUS_LABELS = { new: "New", in_progress: "In Progress", learned: "Learned", mastered: "Mastered" };
const STATUS_COLORS = { new: "#aaa", in_progress: "#4fc3c3", learned: "#5acd7e", mastered: "#e8c547" };

export default function WordsPage() {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteId, setDeleteId] = useState(null);

  const debouncedSearch = useDebounce(search, 400);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await wordsAPI.list(params);
      // Support paginated { results, count } or plain array
      if (Array.isArray(res.data)) {
        setWords(res.data);
        setTotalPages(1);
        setTotalCount(res.data.length);
      } else {
        setWords(res.data.results || []);
        setTotalCount(res.data.count || 0);
        setTotalPages(Math.ceil((res.data.count || 0) / 20));
      }
    } catch {
      setError("Failed to load words. Make sure your API is running.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, categoryFilter]);
  useEffect(() => { fetchWords(); }, [fetchWords]);

  const handleDelete = async (id) => {
    try {
      await wordsAPI.delete(id);
      setWords((w) => w.filter((x) => x.id !== id));
      setDeleteId(null);
    } catch {
      alert("Delete failed. Please try again.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Word Entries</h1>
          <p className="page-sub">{totalCount} entries total</p>
        </div>
        <Link to="/words/new" className="btn-primary">+ Add Word</Link>
      </div>

      {/* Search & Filters */}
      <div className="filters-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search words, translations, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input
          className="filter-input"
          type="text"
          placeholder="Filter by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        />
        {(search || statusFilter || categoryFilter) && (
          <button className="btn-ghost" onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); }}>
            Clear All
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-block">Loading entries…</div>
      ) : words.length === 0 ? (
        <div className="empty-state">
          <span>📭</span>
          <p>No entries found. <Link to="/words/new">Add your first word</Link> or adjust your filters.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Translation</th>
                <th>Category</th>
                <th>Status</th>
                <th>Language</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.word || w.term || w.entry}</strong></td>
                  <td className="text-muted">{w.translation || w.definition || "—"}</td>
                  <td>
                    {w.category ? (
                      <span className="tag">{w.category}</span>
                    ) : "—"}
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: STATUS_COLORS[w.status] + "22", color: STATUS_COLORS[w.status] }}>
                      {STATUS_LABELS[w.status] || w.status || "—"}
                    </span>
                  </td>
                  <td className="text-muted">{w.language || w.source_language || "—"}</td>
                  <td>
                    <div className="action-btns">
                      <button className="icon-btn" title="Edit" onClick={() => navigate(`/words/${w.id}/edit`)}>✏️</button>
                      <button className="icon-btn danger" title="Delete" onClick={() => setDeleteId(w.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Entry</h3>
            <p>Are you sure you want to delete this entry? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
