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
        file,
        fileType,
        url: fileType === "url" ? url : undefined,
        metadata: meta,
      });
      navigate(`/documents/${result.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Upload Document</h1>
      <div className="card">
        <form onSubmit={submit}>
          <label className="label">Source type</label>
          <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="text">Text file (.txt)</option>
            <option value="pdf">PDF</option>
            <option value="image">Image (OCR)</option>
            <option value="audio">Audio (STT - not yet implemented)</option>
            <option value="url">URL</option>
          </select>

          {fileType === "url" ? (
            <>
              <label className="label">URL</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." />
            </>
          ) : (
            <>
              <label className="label">File</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
            </>
          )}

          <h2>Metadata</h2>
          <div className="row">
            <div>
              <label className="label">Source</label>
              <input value={meta.source} onChange={(e) => setMeta({ ...meta, source: e.target.value })} />
            </div>
            <div>
              <label className="label">Author</label>
              <input value={meta.author} onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="label">Publication date</label>
              <input type="date" value={meta.publication_date} onChange={(e) => setMeta({ ...meta, publication_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Domain</label>
              <input value={meta.domain} onChange={(e) => setMeta({ ...meta, domain: e.target.value })} placeholder="news, science, ..." />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="label">Category</label>
              <input value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} />
            </div>
            <div>
              <label className="label">License</label>
              <select value={meta.license} onChange={(e) => setMeta({ ...meta, license: e.target.value })}>
                <option value="open">Open</option>
                <option value="research">Research</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <button disabled={loading} type="submit">
            {loading ? "Processing..." : "Upload & Process"}
          </button>
        </form>
      </div>
    </div>
  );
}
