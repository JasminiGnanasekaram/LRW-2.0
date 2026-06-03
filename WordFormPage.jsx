import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { wordsAPI } from "../api/client";

const STATUSES = ["new", "in_progress", "learned", "mastered"];

const EMPTY_FORM = {
  word: "", translation: "", category: "", status: "new",
  language: "", notes: "", examples: "", tags: "",
};

export default function WordFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    wordsAPI.get(id)
      .then((res) => {
        const d = res.data;
        setForm({
          word: d.word || d.term || d.entry || "",
          translation: d.translation || d.definition || "",
          category: d.category || "",
          status: d.status || "new",
          language: d.language || d.source_language || "",
          notes: d.notes || "",
          examples: Array.isArray(d.examples) ? d.examples.join("\n") : (d.examples || ""),
          tags: Array.isArray(d.tags) ? d.tags.join(", ") : (d.tags || ""),
        });
      })
      .catch(() => setError("Failed to load entry."))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        examples: form.examples ? form.examples.split("\n").filter(Boolean) : [],
      };
      if (isEdit) {
        await wordsAPI.update(id, payload);
      } else {
        await wordsAPI.create(payload);
      }
      navigate("/words");
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Save failed. Check your input and try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-block">Loading…</div></div>;

  return (
    <div className="page form-page">
      <div className="page-header">
        <div>
          <h1>{isEdit ? "Edit Entry" : "New Entry"}</h1>
          <p className="page-sub">{isEdit ? `Editing entry #${id}` : "Add a word to your lexicon"}</p>
        </div>
        <Link to="/words" className="btn-ghost">← Back</Link>
      </div>

      <form onSubmit={handleSubmit} className="entry-form">
        {error && <div className="error-banner">{error}</div>}

        <div className="form-row">
          <div className="field-group">
            <label>Word / Term <span className="required">*</span></label>
            <input name="word" value={form.word} onChange={handleChange} placeholder="e.g. Serendipity" required />
          </div>
          <div className="field-group">
            <label>Translation / Definition <span className="required">*</span></label>
            <input name="translation" value={form.translation} onChange={handleChange} placeholder="e.g. A lucky discovery" required />
          </div>
        </div>

        <div className="form-row">
          <div className="field-group">
            <label>Language</label>
            <input name="language" value={form.language} onChange={handleChange} placeholder="e.g. English, Spanish, 日本語" />
          </div>
          <div className="field-group">
            <label>Category</label>
            <input name="category" value={form.category} onChange={handleChange} placeholder="e.g. Nouns, Phrases, Idioms" />
          </div>
          <div className="field-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-group">
          <label>Tags <span className="hint">(comma-separated)</span></label>
          <input name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. formal, common, B2" />
        </div>

        <div className="field-group">
          <label>Example Sentences <span className="hint">(one per line)</span></label>
          <textarea
            name="examples"
            value={form.examples}
            onChange={handleChange}
            rows={3}
            placeholder="She found the old book by serendipity."
          />
        </div>

        <div className="field-group">
          <label>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="Any additional notes, mnemonics, or context…" />
        </div>

        <div className="form-actions">
          <Link to="/words" className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : (isEdit ? "Save Changes" : "Create Entry")}
          </button>
        </div>
      </form>
    </div>
  );
}
