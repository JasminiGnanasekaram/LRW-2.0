import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments, exportAllURL } from "../api";

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e.response?.data?.detail || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1 style={{ marginRight: "auto" }}>Your Documents</h1>
        {docs.length > 0 && (
          <a href={exportAllURL("csv")} target="_blank" rel="noreferrer">
            <button className="ghost" type="button">Export all (CSV)</button>
          </a>
        )}
      </div>
      <div className="card">
        {loading && <p className="muted">Loading...</p>}
        {error && <div className="error">{error}</div>}
        {!loading && docs.length === 0 && (
          <p className="muted">
            No documents yet. <Link to="/upload">Upload your first document.</Link>
          </p>
        )}
        {docs.length > 0 && (
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
                  <td>{d.filename}</td>
                  <td><span className="badge">{d.file_type}</span></td>
                  <td>{d.nlp?.token_count ?? "-"}</td>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                  <td><Link to={`/documents/${d.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


















