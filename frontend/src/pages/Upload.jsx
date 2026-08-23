import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument, getErrorMessage, MAX_UPLOAD_BYTES, api } from "../api";

const FILE_TYPES = [
  { value: "text",  label: "Text file", desc: ".txt" },
  { value: "pdf",   label: "PDF",       desc: ".pdf" },
  { value: "image", label: "Image",     desc: ".jpg, .png, .pdf" },
  { value: "audio", label: "Audio",     desc: ".mp3, .wav, .m4a" },
  { value: "url",   label: "URL",       desc: "web page" },
];

const ACCEPT = {
  pdf:   ".pdf",
  image: ".jpg,.jpeg,.png,.webp,.bmp,.pdf",
  audio: ".mp3,.wav,.m4a,.ogg",
  text:  ".txt",
};

export default function Upload() {
  const [fileType, setFileType] = useState("text");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState({
    source: "", author: "", publication_date: "",
    domain: "", category: "", license: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => abortRef.current?.abort(), []);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fetchSummary = async (selectedFile, selectedType, selectedUrl) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSummaryLoading(true);
    setSummary("");
    try {
      const formData = new FormData();
      let endpoint;

      if (selectedType === "url") {
        formData.append("url", selectedUrl);
        endpoint = "/summarize/url";
      } else {
        formData.append("file", selectedFile, selectedFile.name);
        endpoint = `/summarize/${selectedType}`;
      }

      const { data } = await api.post(endpoint, formData, { signal: controller.signal });
      setSummary(data?.summary || "");
    } catch {
      setSummary(""); // summarizer is optional — fail silently
    } finally {
      if (!controller.signal.aborted) setSummaryLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setError("");
    setSummary("");
    const selected = e.target.files?.[0] || null;

    if (!selected) { setFile(null); return; }

    if (selected.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large (${(selected.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`);
      setFile(null);
      resetFileInput();
      return;
    }
    if (selected.size === 0) {
      setError("That file is empty.");
      setFile(null);
      resetFileInput();
      return;
    }

    setFile(selected);
    fetchSummary(selected, fileType, null);
  };

  const handleTypeChange = (value) => {
    setFileType(value);
    setFile(null);
    setUrl("");
    setSummary("");
    setError("");
    abortRef.current?.abort();
    setSummaryLoading(false);
    resetFileInput();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    // Manual validation — the file input is hidden, so the browser's own
    // `required` cannot be used on it.
    if (fileType === "url") {
      if (!url.trim()) return setError("Please enter a URL.");
    } else if (!file) {
      return setError("Please choose a file before uploading.");
    }
    if (!meta.source.trim()) return setError("Source is required.");
    if (!meta.domain)        return setError("Domain is required.");
    if (!meta.license)       return setError("License is required.");

    setLoading(true);
    try {
      const result = await uploadDocument({
        file,
        fileType,
        url: fileType === "url" ? url : undefined,
        metadata: meta,
      });

      const id = result?.id ?? result?.document_id ?? result?._id;
      if (!id) {
        setError("Upload succeeded but the server did not return a document id.");
        return;
      }
      navigate(`/documents/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = (filled) => ({
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--paper)",
    color: filled ? "var(--ink)" : "var(--ink-lt)",
    fontSize: 14,
    height: 38,
  });

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Upload Document</h1>
        <p className="page-subtitle">Add a new document to your corpus for NLP processing</p>
      </div>

      <form onSubmit={submit} noValidate>

        <div className="card fade-up fade-up-1">
          <div className="card-title">Source type</div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 10,
          }}>
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
                  onChange={() => handleTypeChange(value)}
                  style={{ display: "none" }}
                />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-lt)" }}>{desc}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            {fileType === "url" ? (
              <div className="field">
                <label htmlFor="url-inp">URL</label>
                <input
                  id="url-inp"
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setSummary(""); }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) fetchSummary(null, "url", v);
                  }}
                  placeholder="https://example.com/article"
                />
              </div>
            ) : (
              <div className="field">
                <label>File</label>
                <div
                  className="upload-zone"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleFileChange({ target: { files: [dropped] } });
                  }}
                  style={{ position: "relative" }}
                >
                  {/* `required` removed — a hidden required input blocks form submit in Chrome */}
                  <input
                    ref={fileInputRef}
                    id="file-inp"
                    type="file"
                    accept={ACCEPT[fileType] || "*"}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-mid)" }}>
                    {file ? file.name : "Click to choose a file"}
                  </div>
                  {file ? (
                    <p className="muted" style={{ marginTop: 4 }}>
                      {(file.size / 1024).toFixed(0)} KB — click to change
                    </p>
                  ) : (
                    <p className="muted" style={{ marginTop: 4 }}>or drag and drop</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {summaryLoading && (
            <div style={{
              marginTop: 16, padding: "12px 16px", background: "var(--mint)",
              borderRadius: "var(--radius)", fontSize: 14, color: "var(--ink-mid)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span className="spin" style={{ display: "inline-block" }}>⏳</span>
              Generating content summary…
            </div>
          )}

          {summary && !summaryLoading && (
            <div style={{
              marginTop: 16, padding: "14px 16px", background: "var(--mint)",
              borderLeft: "4px solid var(--forest)", borderRadius: "var(--radius)",
              fontSize: 14, lineHeight: 1.8, color: "var(--ink)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                fontWeight: 600, fontSize: 13, color: "var(--forest)",
              }}>
                📋 Content Summary
              </div>
              <p style={{ margin: 0, color: "var(--ink)" }}>{summary}</p>
            </div>
          )}
        </div>

        <div className="card fade-up fade-up-2" style={{ marginTop: 20 }}>
          <div className="card-title">
            Metadata{" "}
            <span style={{ fontSize: 13, color: "var(--ink-lt)", fontWeight: 400 }}>
              (* required)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="field">
                <label htmlFor="m-source">SOURCE <span style={{ color: "red" }}>*</span></label>
                <input
                  id="m-source"
                  type="text"
                  value={meta.source}
                  onChange={(e) => setMeta({ ...meta, source: e.target.value })}
                  placeholder="e.g. Reuters"
                />
              </div>

              <div className="field">
                <label htmlFor="m-domain">DOMAIN <span style={{ color: "red" }}>*</span></label>
                <select
                  id="m-domain"
                  value={meta.domain}
                  onChange={(e) => setMeta({ ...meta, domain: e.target.value })}
                  style={selectStyle(!!meta.domain)}
                >
                  <option value="">Select domain...</option>
                  <option value="news">News</option>
                  <option value="science">Science</option>
                  <option value="law">Law</option>
                  <option value="technology">Technology</option>
                  <option value="health">Health</option>
                  <option value="education">Education</option>
                  <option value="finance">Finance</option>
                  <option value="business">Business</option>
                  <option value="sports">Sports</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="government">Government</option>
                  <option value="research">Research</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="m-date">PUBLICATION DATE</label>
                <input
                  id="m-date"
                  type="date"
                  value={meta.publication_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setMeta({ ...meta, publication_date: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="field">
                <label htmlFor="m-author">AUTHOR</label>
                <input
                  id="m-author"
                  type="text"
                  value={meta.author}
                  onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>

              <div className="field">
                <label htmlFor="m-category">CATEGORY</label>
                <input
                  id="m-category"
                  type="text"
                  value={meta.category}
                  onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                  placeholder="Category"
                />
              </div>

              <div className="field">
                <label htmlFor="m-license">LICENSE <span style={{ color: "red" }}>*</span></label>
                <select
                  id="m-license"
                  value={meta.license}
                  onChange={(e) => setMeta({ ...meta, license: e.target.value })}
                  style={selectStyle(!!meta.license)}
                >
                  <option value="">Select license...</option>
                  <option value="public-domain">Public Domain</option>
                  <option value="cc0">CC0</option>
                  <option value="cc-by">CC BY</option>
                  <option value="cc-by-sa">CC BY-SA</option>
                  <option value="cc-by-nc">CC BY-NC</option>
                  <option value="cc-by-nd">CC BY-ND</option>
                  <option value="mit">MIT</option>
                  <option value="apache-2.0">Apache 2.0</option>
                  <option value="gpl-3.0">GPL 3.0</option>
                  <option value="proprietary">Proprietary</option>
                  <option value="restricted">Restricted</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="alert-error fade-up" role="alert">{error}</div>}

        <div
          className="fade-up fade-up-3"
          style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}
        >
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button disabled={loading} type="submit" className="btn btn-primary" style={{ minWidth: 160 }}>
            {loading ? "Processing…" : "Upload & Process →"}
          </button>
        </div>
      </form>
    </div>
  );
}