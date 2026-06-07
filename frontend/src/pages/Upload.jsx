import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument } from "../api";

export default function Upload() {
  const [fileType, setFileType] = useState("text");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState({
    source: "", author: "", publication_date: "",
    domain: "", category: "", license: "open",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await uploadDocument({
        file, fileType,
        url: fileType === "url" ? url : undefined,
        metadata: meta,
      });
      navigate(`/documents/${result.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally { setLoading(false); }
  };

  const FILE_TYPES = [
    { value: "text", label: "Text file", desc: ".txt" },
    { value: "pdf", label: "PDF", desc: ".pdf" },
    { value: "image", label: "Image (OCR)", desc: ".jpg, .png" },
    { value: "audio", label: "Audio (STT)", desc: "not yet implemented" },
    { value: "url", label: "URL", desc: "web page" },
  ];

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Upload Document</h1>
        <p className="page-subtitle">Add a new document to your corpus for NLP processing</p>
      </div>

      <form onSubmit={submit}>
        {/* Source type */}
        <div className="card fade-up fade-up-1">
          <div className="card-title">Source type</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {FILE_TYPES.map(({ value, label, desc }) => (
              <label
                key={value}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "12px 14px",
                  border: `2px solid ${fileType === value ? "var(--forest)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  background: fileType === value ? "var(--mint)" : "var(--paper)",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="file_type"
                  value={value}
                  checked={fileType === value}
                  onChange={() => setFileType(value)}
                  style={{ display: "none" }}
                />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>{label}</span>
                <span style={{ fontSize: 11, color: "var(--ink-lt)" }}>{desc}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            {fileType === "url" ? (
              <div className="field">
                <label>URL</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://example.com/article" />
              </div>
            ) : (
              <div className="field">
                <label>File</label>
                <div
                  className="upload-zone"
                  onClick={() => document.getElementById("file-inp").click()}
                  style={{ position: "relative" }}
                >
                  <input
                    id="file-inp"
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files[0])}
                    required
                  />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-mid)" }}>
                    {file ? file.name : "Click to choose a file"}
                  </div>
                  {!file && <p className="muted" style={{ marginTop: 4 }}>or drag and drop</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="card fade-up fade-up-2">
          <div className="card-title">Metadata <span style={{ fontWeight: 400, color: "var(--ink-lt)", fontSize: 14 }}>(optional)</span></div>
          <div className="row">
            <div className="field">
              <label>Source</label>
              <input value={meta.source} placeholder="e.g. Reuters" onChange={(e) => setMeta({ ...meta, source: e.target.value })} />
            </div>
            <div className="field">
              <label>Author</label>
              <input value={meta.author} placeholder="Author name" onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Domain</label>
              <input value={meta.domain} placeholder="news, science, law…" onChange={(e) => setMeta({ ...meta, domain: e.target.value })} />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={meta.category} placeholder="Category" onChange={(e) => setMeta({ ...meta, category: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Publication date</label>
              <input type="date" value={meta.publication_date} onChange={(e) => setMeta({ ...meta, publication_date: e.target.value })} />
            </div>
            <div className="field">
              <label>License</label>
              <select value={meta.license} onChange={(e) => setMeta({ ...meta, license: e.target.value })}>
                <option value="open">Open</option>
                <option value="research">Research only</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>
        </div>

        {error && <div className="alert-error fade-up">{error}</div>}

        <div className="fade-up fade-up-3" style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button disabled={loading} type="submit" className="btn btn-primary" style={{ minWidth: 160 }}>
            {loading ? "Processing…" : "Upload & Process →"}
          </button>
        </div>
      </form>
    </div>
  );
}
