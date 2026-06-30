import React, { useState, useRef } from "react";
import { currentUser } from "../api";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const u = currentUser() || {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: u.name || "",
    email: u.email || "",
    dob: u.dob || u.date_of_birth || u.birthdate || "",
    bio: u.bio || u.info || "",
    image: u.image || u.avatar || "",
  });
  const fileRef = useRef(null);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const save = () => {
    // Persist locally; backend update can be wired later
    const updated = { ...u, name: form.name, email: form.email, dob: form.dob, bio: form.bio, image: form.image };
    localStorage.setItem("lrw_user", JSON.stringify(updated));
    try { window.dispatchEvent(new CustomEvent('lrw_user_updated', { detail: updated })); } catch (e) { }
    setEditing(false);
    alert("Profile saved locally.");
  };

  const onFile = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setForm(prev => ({ ...prev, image: dataUrl }));
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1 className="page-title">Profile</h1>
        </div>
        <div className="page-subtitle">Manage your account information</div>
      </div>

      <div className="row">
        <div style={{ flex: "0 0 320px" }}>
          <div className="card">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img
                onClick={() => fileRef.current && fileRef.current.click()}
                src={form.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || "User")}&background=4a7c59&color=fff`}
                alt="avatar"
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: "cover", cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{form.name || "—"}</div>
                <div className="muted">{form.email || "—"}</div>
                <div style={{ marginTop: 8 }} className="badge">
                  {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "User"}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files && e.target.files[0])}
            />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div className="card">
            <div className="card-title">Basic information</div>
            {!editing && (
              <div>
                <div style={{ marginBottom: 8 }}><strong>Name:</strong> {form.name || '—'}</div>
                <div style={{ marginBottom: 8 }}><strong>Email:</strong> {form.email || '—'}</div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Date of birth:</strong> {form.dob ? new Date(form.dob).toLocaleDateString() : '—'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Additional information:</strong>
                  <div className="muted">{form.bio || '—'}</div>
                </div>
              </div>
            )}

            {editing && (
              <div>
                <div className="field">
                  <label className="label">Full name</label>
                  <input name="name" value={form.name} onChange={onChange} />
                </div>
                <div className="field">
                  <label className="label">Email</label>
                  <input name="email" value={form.email} onChange={onChange} />
                </div>
                <div className="field">
                  <label className="label">Date of birth</label>
                  <input type="date" name="dob" value={form.dob ? form.dob.split("T")[0] : ""} onChange={onChange} />
                </div>
                <div className="field">
                  <label className="label">Profile image URL</label>
                  <input name="image" value={form.image} onChange={onChange} />
                  <div style={{ marginTop: 6 }}>
                    <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files && e.target.files[0])} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">Additional information</label>
                  <textarea name="bio" value={form.bio} onChange={onChange} rows={4} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={save}>Save</button>
                  <button className="btn btn-ghost" onClick={() => { setEditing(false); setForm({ ...form }); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
