import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument } from "../api";

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

  // ── Summary states ──
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const navigate = useNavigate();

  const getAcceptAttribute = () => {
    if (fileType === "pdf")   return ".pdf";
    if (fileType === "image") return ".jpg,.jpeg,.png,.webp,.bmp,.pdf";
    if (fileType === "audio") return ".mp3,.wav,.m4a,.ogg";
    if (fileType === "text")  return ".txt";
    return "*";
  };

  // ── Fetch summary from local backend ──
  const fetchSummary = async (selectedFile, selectedType, selectedUrl) => {
    setSummaryLoading(true);
    setSummary("");

    try {
      const formData = new FormData();

      if (selectedType === "url") {
        formData.append("url", selectedUrl);
        const res = await fetch("http://localhost:8000/summarize/url", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setSummary(data.summary);

      } else {
        formData.append("file", selectedFile);
        const endpoint = {
          text:  "text",
          pdf:   "pdf",
          image: "image",
          audio: "audio",
        }[selectedType];

        const res = await fetch(`http://localhost:8000/summarize/${endpoint}`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setSummary(data.summary);
      }

    } catch (err) {
      setSummary("Could not generate summary. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!meta.source.trim()) return setError("Source is required.");
    if (!meta.domain.trim())  return setError("Domain is required.");
    if (!meta.license)        return setError("License is required.");

    if (fileType === "url") {
      if (!url.trim()) return setError("URL is required for URL uploads.");
    } else {
      if (!file) return setError("Please choose a file to upload.");
    }

    setLoading(true);
    try {
      const result = await uploadDocument({
        file,
        fileType,
        url: fileType === "url" ? url.trim() : undefined,
        metadata: meta,
      });
      navigate(`/documents/${result.id}`);
    } catch (err) {
      setError(
        err.response?.data?.detail || err.message || "Upload failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const FILE_TYPES = [
    { value: "text",  label: "Text file", desc: ".txt" },
    { value: "pdf",   label: "PDF",       desc: ".pdf" },
    { value: "image", label: "Image",     desc: ".jpg, .png, .pdf" },
    { value: "audio", label: "Audio",     desc: ".mp3, .wav, .m4a" },
    { value: "url",   label: "URL",       desc: "web page" },
  ];

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Upload Document</h1>
        <p className="page-subtitle">
          Add a new document to your corpus for NLP processing
        </p>
      </div>

      <form onSubmit={submit}>

        {/* ── Source type card ── */}
        <div className="card fade-up fade-up-1">
          <div className="card-title">Source type</div>

          {/* File type selector buttons */}
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
                  onChange={() => {
                    setFileType(value);
                    setFile(null);
                    setSummary("");
                  }}
                  style={{ display: "none" }}
                />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-lt)" }}>{desc}</span>
              </label>
            ))}
          </div>

          {/* File / URL input */}
          <div style={{ marginTop: 20 }}>
            {fileType === "url" ? (
              <div className="field">
                <label>URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setSummary("");
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      fetchSummary(null, "url", e.target.value.trim());
                    }
                  }}
                  required
                  placeholder="https://example.com/article"
                />
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
                    accept={getAcceptAttribute()}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const selected = e.target.files[0];
                      setFile(selected);
                      setSummary("");
                      if (selected) fetchSummary(selected, fileType, null);
                    }}
                    required
                  />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-mid)" }}>
                    {file ? file.name : "Click to choose a file"}
                  </div>
                  {!file && (
                    <p className="muted" style={{ marginTop: 4 }}>or drag and drop</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Summary Loading indicator ── */}
          {summaryLoading && (
            <div style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "var(--mint)",
              borderRadius: "var(--radius)",
              fontSize: 14,
              color: "var(--ink-mid)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
              Generating content summary…
            </div>
          )}

          {/* ── Summary Result block ── */}
          {summary && !summaryLoading && (
            <div style={{
              marginTop: 16,
              padding: "14px 16px",
              background: "var(--mint)",
              borderLeft: "4px solid var(--forest)",
              borderRadius: "var(--radius)",
              fontSize: 14,
              lineHeight: 1.8,
              color: "var(--ink)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                fontWeight: 600,
                fontSize: 13,
                color: "var(--forest)",
              }}>
                📋 Content Summary
              </div>
              <p style={{ margin: 0, color: "var(--ink)" }}>{summary}</p>
            </div>
          )}

        </div>

        {/* ── Metadata card ── */}
        <div className="card fade-up fade-up-2" style={{ marginTop: 20 }}>
          <div className="card-title">
            Metadata{" "}
            <span style={{ fontSize: 13, color: "var(--ink-lt)", fontWeight: 400 }}>
              (* required)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px 20px" }}>

            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="field">
                <label>SOURCE <span style={{ color: "red" }}>*</span></label>
                <input
                  type="text"
                  value={meta.source}
                  onChange={(e) => setMeta({ ...meta, source: e.target.value })}
                  placeholder="e.g. Reuters"
                  required
                />
              </div>
              <div className="field">
                  <label>DOMAIN <span style={{ color: "red" }}>*</span></label>
                  <select
                    value={meta.domain}
                    onChange={(e) => setMeta({ ...meta, domain: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--paper)",
                      color: meta.domain ? "var(--ink)" : "var(--ink-lt)",
                      fontSize: 14,
                      height: 38,
                    }}
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
                <label>PUBLICATION DATE</label>
                <input
                  type="date"
                  value={meta.publication_date}
                  onChange={(e) => setMeta({ ...meta, publication_date: e.target.value })}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="field">
                <label>AUTHOR</label>
                <input
                  type="text"
                  value={meta.author}
                  onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                  placeholder="Author name"
                />
              </div>
              <div className="field">
                <label>CATEGORY</label>
                <input
                  type="text"
                  value={meta.category}
                  onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                  placeholder="Category"
                />
              </div>
              <div className="field">
                  <label>LICENSE <span style={{ color: "red" }}>*</span></label>
                  <select
                    value={meta.license}
                    onChange={(e) => setMeta({ ...meta, license: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--paper)",
                      color: meta.license ? "var(--ink)" : "var(--ink-lt)",
                      fontSize: 14,
                      height: 38,
                    }}
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

        {error && <div className="alert-error fade-up">{error}</div>}

        {/* ── Action buttons ── */}
        <div
          className="fade-up fade-up-3"
          style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}
        >
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            disabled={loading}
            type="submit"
            className="btn btn-primary"
            style={{ minWidth: 160 }}
          >
            {loading ? "Processing…" : "Upload & Process →"}
          </button>
        </div>

      </form>
    </div>
  );
}