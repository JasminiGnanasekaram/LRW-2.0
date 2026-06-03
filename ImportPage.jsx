import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { wordsAPI } from "../api/client";

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef();

  const handleFile = (f) => {
    if (f && f.name.endsWith(".csv")) {
      setFile(f);
      setError("");
      setResult(null);
    } else {
      setError("Please select a valid .csv file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await wordsAPI.importCSV(fd);
      setResult(res.data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed. Please check your CSV format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page form-page">
      <div className="page-header">
        <div>
          <h1>Import Words</h1>
          <p className="page-sub">Bulk upload entries from a CSV file</p>
        </div>
        <Link to="/words" className="btn-ghost">← Back to Words</Link>
      </div>

      <div className="import-card">
        <div className="csv-format">
          <h3>Expected CSV Format</h3>
          <div className="code-block">
            word,translation,language,category,status,tags,notes<br />
            Serendipity,A lucky find,English,Nouns,new,"formal,rare",Optional note<br />
            Ephemeral,Short-lived,English,Adjectives,in_progress,,
          </div>
          <p className="hint">Columns: <code>word</code>, <code>translation</code>, <code>language</code>, <code>category</code>, <code>status</code>, <code>tags</code>, <code>notes</code>. Only <code>word</code> is required.</p>
        </div>

        <div
          className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="file-selected">
              <span className="file-icon">📄</span>
              <strong>{file.name}</strong>
              <span className="text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
              <button className="btn-ghost sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</button>
            </div>
          ) : (
            <>
              <span className="drop-icon">📥</span>
              <p><strong>Drop your CSV here</strong> or click to browse</p>
              <p className="text-muted hint">Accepts .csv files only</p>
            </>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <div className="import-result success">
            <span>✅</span>
            <div>
              <strong>Import successful!</strong>
              <p>
                {result.created ?? result.imported ?? "—"} entries created
                {result.updated ? `, ${result.updated} updated` : ""}
                {result.errors?.length ? `, ${result.errors.length} errors` : ""}.
              </p>
              {result.errors?.length > 0 && (
                <ul className="error-list">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link to="/words" className="btn-ghost">Cancel</Link>
          <button className="btn-primary" onClick={handleSubmit} disabled={!file || loading}>
            {loading ? <span className="spinner" /> : "Upload & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
