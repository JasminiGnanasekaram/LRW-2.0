import { useState } from "react";
import { Link } from "react-router-dom";
import { wordsAPI } from "../api/client";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [loadingCSV, setLoadingCSV] = useState(false);
  const [loadingJSON, setLoadingJSON] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleExportCSV = async () => {
    setError(""); setSuccess("");
    setLoadingCSV(true);
    try {
      const res = await wordsAPI.exportCSV();
      const blob = new Blob([res.data], { type: "text/csv" });
      downloadBlob(blob, `lrw-export-${new Date().toISOString().slice(0, 10)}.csv`);
      setSuccess("CSV downloaded successfully.");
    } catch {
      setError("CSV export failed. Make sure your API supports this endpoint.");
    } finally {
      setLoadingCSV(false);
    }
  };

  const handleExportJSON = async () => {
    setError(""); setSuccess("");
    setLoadingJSON(true);
    try {
      const res = await wordsAPI.exportJSON();
      const blob = new Blob([res.data], { type: "application/json" });
      downloadBlob(blob, `lrw-export-${new Date().toISOString().slice(0, 10)}.json`);
      setSuccess("JSON downloaded successfully.");
    } catch {
      setError("JSON export failed. Make sure your API supports this endpoint.");
    } finally {
      setLoadingJSON(false);
    }
  };

  return (
    <div className="page form-page">
      <div className="page-header">
        <div>
          <h1>Export Data</h1>
          <p className="page-sub">Download your entire word collection</p>
        </div>
        <Link to="/words" className="btn-ghost">← Back to Words</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="export-grid">
        <div className="export-card">
          <div className="export-icon">📊</div>
          <h3>CSV Export</h3>
          <p>Download all your word entries as a CSV spreadsheet. Compatible with Excel, Google Sheets, and other tools.</p>
          <div className="export-meta">
            <span>Includes: word, translation, language, category, status, tags, notes</span>
          </div>
          <button className="btn-primary" onClick={handleExportCSV} disabled={loadingCSV}>
            {loadingCSV ? <span className="spinner" /> : "⬇ Download CSV"}
          </button>
        </div>

        <div className="export-card">
          <div className="export-icon">🗂</div>
          <h3>JSON Export</h3>
          <p>Download all entries in JSON format. Ideal for backups, migrations, or integrating with other apps.</p>
          <div className="export-meta">
            <span>Includes: full entry data with all fields and metadata</span>
          </div>
          <button className="btn-primary" onClick={handleExportJSON} disabled={loadingJSON}>
            {loadingJSON ? <span className="spinner" /> : "⬇ Download JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}
