import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument, api } from "../api";

const FILE_TYPES = [
  { value: "text", label: "Text file", desc: ".txt", accept: ".txt" },
  { value: "pdf", label: "PDF", desc: ".pdf", accept: ".pdf" },
  { value: "image", label: "Image", desc: ".jpg, .png, .pdf", accept: ".jpg,.jpeg,.png,.webp,.bmp,.pdf" },
  { value: "audio", label: "Audio", desc: ".mp3, .wav, .m4a", accept: ".mp3,.wav,.m4a,.ogg" },
  { value: "url", label: "URL", desc: "web page" },
];

const DOMAINS = [
  ["news", "News"],
  ["science", "Science"],
  ["law", "Law"],
  ["technology", "Technology"],
  ["health", "Health"],
  ["education", "Education"],
  ["finance", "Finance"],
  ["business", "Business"],
  ["sports", "Sports"],
  ["entertainment", "Entertainment"],
  ["government", "Government"],
  ["research", "Research"],
  ["other", "Other"],
];

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

const EMPTY_META = {
  source: "",
  author: "",
  publication_date: "",
  domain: "",
  category: "",
  license: "",
};

const styles = {
  typeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 },
  typeCard: (active) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    margin: 0,
    padding: "12px 14px",
    border: `2px solid ${active ? "var(--forest)" : "var(--border)"}`,
    borderRadius: "var(--radius)",
    background: active ? "var(--mint)" : "var(--paper)",
    cursor: "pointer",
    letterSpacing: 0,
    textTransform: "none",
    transition: "border-color 0.15s, background 0.15s",
  }),
  radio: { position: "absolute", opacity: 0, pointerEvents: "none" },
  typeLabel: { marginBottom: 2, fontSize: 13, fontWeight: 600, color: "var(--ink)" },
  typeDesc: { fontSize: 11, fontWeight: 400, color: "var(--ink-lt)" },
  uploadZone: (dragging) => ({
    position: "relative",
    borderColor: dragging ? "var(--sage)" : undefined,
    background: dragging ? "#fafdf9" : undefined,
  }),
  summaryLoading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: "12px 16px",
    borderRadius: "var(--radius)",
    background: "var(--mint)",
    fontSize: 14,
    color: "var(--ink-mid)",
  },
  summary: {
    marginTop: 16,
    padding: "14px 16px",
    borderLeft: "4px solid var(--forest)",
    borderRadius: "var(--radius)",
    background: "var(--mint)",
    fontSize: 14,
    lineHeight: 1.8,
    color: "var(--ink)",
  },
  summaryHeading: { marginBottom: 6, fontSize: 13, fontWeight: 600, color: "var(--forest)" },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 20 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 },
};

function Field({ id, label, required, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SelectField({ id, label, placeholder, options, value, onChange, required }) {
  return (
    <Field id={id} label={label} required={required}>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        style={{ color: value ? "var(--ink)" : "var(--ink-lt)" }}
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const summaryRequestRef = useRef(0);

  const [fileType, setFileType] = useState("text");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState(EMPTY_META);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const accept = FILE_TYPES.find((type) => type.value === fileType)?.accept;
  const updateMeta = (key) => (e) => setMeta((prev) => ({ ...prev, [key]: e.target.value }));

  const clearSummary = () => {
    summaryRequestRef.current += 1;
    setSummary("");
    setSummaryLoading(false);
  };

  const fetchSummary = async (type, { file: selectedFile, url: selectedUrl }) => {
    const requestId = ++summaryRequestRef.current;
    setSummaryLoading(true);
    setSummary("");

    const formData = new FormData();
    if (type === "url") formData.append("url", selectedUrl);
    else formData.append("file", selectedFile);

    try {
      const { data } = await api.post(`/summarize/${type}`, formData);
      if (requestId === summaryRequestRef.current) setSummary(data.summary);
    } catch {
      if (requestId === summaryRequestRef.current) {
        setSummary("Could not generate summary. Please try again.");
      }
    } finally {
      if (requestId === summaryRequestRef.current) setSummaryLoading(false);
    }
  };

  const selectType = (value) => {
    setFileType(value);
    setFile(null);
    clearSummary();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectFile = (selected) => {
    setFile(selected || null);
    clearSummary();
    if (selected) fetchSummary(fileType, { file: selected });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const validate = () => {
    if (!meta.source.trim()) return "Source is required.";
    if (!meta.domain) return "Domain is required.";
    if (!meta.license) return "License is required.";
    if (fileType === "url" && !url.trim()) return "URL is required for URL uploads.";
    if (fileType !== "url" && !file) return "Please choose a file to upload.";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

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
      setError(err.response?.data?.detail || err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Upload Document</h1>
        <p className="page-subtitle">Add a new document to your corpus for NLP processing</p>
      </div>

      <form onSubmit={submit}>
        <div className="card fade-up fade-up-1">
          <div className="card-title">Source type</div>

          <div style={styles.typeGrid}>
            {FILE_TYPES.map(({ value, label, desc }) => (
              <label key={value} style={styles.typeCard(fileType === value)}>
                <input
                  type="radio"
                  name="file_type"
                  value={value}
                  checked={fileType === value}
                  onChange={() => selectType(value)}
                  style={styles.radio}
                />
                <span style={styles.typeLabel}>{label}</span>
                <span style={styles.typeDesc}>{desc}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            {fileType === "url" ? (
              <Field id="upload-url" label="URL">
                <input
                  id="upload-url"
                  type="url"
                  value={url}
                  placeholder="https://example.com/article"
                  required
                  onChange={(e) => {
                    setUrl(e.target.value);
                    clearSummary();
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value) fetchSummary("url", { url: value });
                  }}
                />
              </Field>
            ) : (
              <Field id="upload-file" label="File">
                <div
                  className="upload-zone"
                  style={styles.uploadZone(dragging)}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    id="upload-file"
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    style={{ display: "none" }}
                    onChange={(e) => selectFile(e.target.files[0])}
                  />
                  <div style={{ marginBottom: 8, fontSize: 28 }}>📂</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-mid)" }}>
                    {file ? file.name : "Click to choose a file"}
                  </div>
                  {!file && (
                    <p className="muted" style={{ marginTop: 4 }}>
                      or drag and drop
                    </p>
                  )}
                </div>
              </Field>
            )}
          </div>

          {summaryLoading && (
            <div style={styles.summaryLoading} role="status">
              <span>⏳</span>
              Generating content summary…
            </div>
          )}

          {summary && !summaryLoading && (
            <div style={styles.summary}>
              <div style={styles.summaryHeading}>📋 Content Summary</div>
              <p>{summary}</p>
            </div>
          )}
        </div>

        <div className="card fade-up fade-up-2">
          <div className="card-title">
            Metadata{" "}
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-lt)" }}>(* required)</span>
          </div>

          <div style={styles.metaGrid}>
            <Field id="meta-source" label="Source" required>
              <input
                id="meta-source"
                type="text"
                value={meta.source}
                onChange={updateMeta("source")}
                placeholder="e.g. Reuters"
                required
              />
            </Field>

            <Field id="meta-author" label="Author">
              <input
                id="meta-author"
                type="text"
                value={meta.author}
                onChange={updateMeta("author")}
                placeholder="Author name"
              />
            </Field>

            <SelectField
              id="meta-domain"
              label="Domain"
              placeholder="Select domain..."
              options={DOMAINS}
              value={meta.domain}
              onChange={updateMeta("domain")}
              required
            />

            <Field id="meta-category" label="Category">
              <input
                id="meta-category"
                type="text"
                value={meta.category}
                onChange={updateMeta("category")}
                placeholder="Category"
              />
            </Field>

            <Field id="meta-date" label="Publication date">
              <input
                id="meta-date"
                type="date"
                value={meta.publication_date}
                onChange={updateMeta("publication_date")}
              />
            </Field>

            <SelectField
              id="meta-license"
              label="License"
              placeholder="Select license..."
              options={LICENSES}
              value={meta.license}
              onChange={updateMeta("license")}
              required
            />
          </div>
        </div>

        {error && (
          <div className="alert-error fade-up" role="alert">
            {error}
          </div>
        )}

        <div className="fade-up fade-up-3" style={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160 }}>
            {loading ? "Processing…" : "Upload & Process →"}
          </button>
        </div>
      </form>
    </div>
  );
}
