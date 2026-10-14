import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments, exportAll, deleteDocument } from "../api";
export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => {
        let msg = "Failed to load documents.";
        const detail = e.response?.data?.detail;
        if (detail) {
          msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        }
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      let msg = "Delete failed. Please try again.";
      const detail = err.response?.data?.detail;
      if (detail) {
        msg = typeof detail === "string" ? detail : JSON.stringify(detail);
      }
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page">
      <div
        className="page-header fade-up"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">Your Documents</h1>
          {!loading && (
            <p className="page-subtitle">
              {docs.length} document{docs.length !== 1 ? "s" : ""} in your corpus
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {docs.length > 0 && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportAll("csv")}>
              ↓ Export CSV
            </button>
          )}
          <Link to="/upload">
            <button className="btn btn-primary btn-sm" type="button">+ Upload</button>
          </Link>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        {loading && <p className="muted" style={{ padding: "24px 0" }}>Loading…</p>}
        {error && <div className="alert-error">{error}</div>}

        {!loading && docs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">No documents yet</div>
            <p>Upload your first document to get started.</p>
            <Link to="/upload" style={{ display: "inline-block", marginTop: 16 }}>
              <button className="btn btn-primary">Upload document</button>
            </Link>
          </div>
        )}

        {docs.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Tokens</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.filename}</td>
                    <td><span className="badge">{d.file_type}</span></td>
                    <td style={{ color: "var(--ink-mid)" }}>
                      {d.nlp?.token_count?.toLocaleString() ?? "—"}
                    </td>
                    <td className="muted">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Link to={`/documents/${d.id}`}>
                          <button className="btn btn-ghost btn-sm">View →</button>
                        </Link>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          style={{
                            background: "var(--danger)",
                            color: "#fff",
                            border: "none",
                            opacity: deletingId === d.id ? 0.6 : 1,
                            cursor: deletingId === d.id ? "not-allowed" : "pointer",
                          }}
                        >
                          {deletingId === d.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}