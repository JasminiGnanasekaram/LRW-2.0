import React, { useState, useRef, useEffect } from "react";
import { currentUser, updateProfile, uploadAvatar } from "../api";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(currentUser() || {});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: user.name || "",
    email: user.email || "",
    dob: user.date_of_birth || user.dob || "",
    bio: user.bio || "",
    phone: user.phone || "",
    address: user.address || "",
    gender: user.gender || "",
  });

  const fileRef = useRef(null);

  // Sync state if currentUser changes
  useEffect(() => {
    const u = currentUser();
    if (u) {
      setUser(u);
      setForm({
        name: u.name || "",
        email: u.email || "",
        dob: u.date_of_birth || u.dob || "",
        bio: u.bio || "",
        phone: u.phone || "",
        address: u.address || "",
        gender: u.gender || "",
      });
    }
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // 1. Save to Backend API
      const patchData = {
        name: form.name,
        phone: form.phone,
        date_of_birth: form.dob,
        address: form.address,
        gender: form.gender,
        bio: form.bio,
      };
      
      const updatedUser = await updateProfile(patchData);
      setUser(updatedUser);
      
      // 2. Dispatch event for TopBar and other components to sync
      window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: updatedUser }));
      
      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      console.error(err);
      // Fallback local persistence if backend is offline or errors
      const fallbackUser = {
        ...user,
        name: form.name,
        phone: form.phone,
        date_of_birth: form.dob,
        address: form.address,
        gender: form.gender,
        bio: form.bio,
      };
      localStorage.setItem("lrw_user", JSON.stringify(fallbackUser));
      setUser(fallbackUser);
      window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: fallbackUser }));
      
      setSuccess("Profile saved locally (Offline Mode).");
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await uploadAvatar(file);
      setUser(updatedUser);
      window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: updatedUser }));
      setSuccess("Avatar updated successfully!");
    } catch (err) {
      console.error(err);
      // Fallback FileReader for local preview if offline
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const fallbackUser = { ...user, avatar_url: dataUrl, image: dataUrl };
        localStorage.setItem("lrw_user", JSON.stringify(fallbackUser));
        setUser(fallbackUser);
        window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: fallbackUser }));
        setSuccess("Avatar updated locally (Offline Mode).");
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
    }
  };

  // Get display avatar
  const avatarSrc = user.avatar_url || user.image || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=4a7c59&color=fff&size=128`;

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h1 className="page-title">My Account</h1>
        <div className="page-subtitle">Manage your personal information, contact details, and security</div>
      </div>

      {success && <div className="alert-success" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {success}
      </div>}
      {error && <div className="alert-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {error}
      </div>}

      <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
        {/* Left Column - Profile Summary Card */}
        <div style={{ flex: "0 0 320px", width: "100%" }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" }}>
            {/* Avatar Container with Hover Overlay */}
            <div 
              onClick={() => fileRef.current && fileRef.current.click()}
              style={{
                position: "relative",
                width: 120,
                height: 120,
                borderRadius: "50%",
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                border: "4px solid var(--paper)",
                outline: "2px solid var(--forest-lt)",
                transition: "transform 0.2s",
                marginBottom: 16,
              }}
              className="avatar-hover-container"
            >
              <img 
                src={avatarSrc} 
                alt="avatar" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                opacity: 0,
                transition: "opacity 0.25s ease",
              }} className="avatar-overlay">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 4 }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 500 }}>Change Photo</span>
              </div>
            </div>

            <input 
              ref={fileRef} 
              type="file" 
              accept="image/*" 
              style={{ display: "none" }} 
              onChange={(e) => handleAvatarUpload(e.target.files && e.target.files[0])} 
            />

            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--forest)", margin: "4px 0" }}>{user.name || "User"}</h2>
            <div className="muted" style={{ marginBottom: 12 }}>{user.email}</div>
            
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <span className="badge">{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Guest"}</span>
              {user.verified ? (
                <span className="badge badge-blue">Verified</span>
              ) : (
                <span className="badge badge-amber">Unverified</span>
              )}
            </div>

            {user.created_at && (
              <div style={{ width: "100%", borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4, fontSize: 12, color: "var(--ink-lt)", display: "flex", justifyContent: "space-between" }}>
                <span>Joined</span>
                <span>{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
              </div>
            )}

            <button 
              className="btn btn-ghost btn-sm btn-full" 
              style={{ marginTop: 20 }}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancel Editing" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* Right Column - Profile Form / Details Card */}
        <div style={{ flex: 1, width: "100%" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="card-title" style={{ marginBottom: 0 }}>Basic Information</h2>
              {editing && <span className="muted" style={{ fontSize: 12 }}>Editing Mode</span>}
            </div>

            {!editing ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Full Name</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{user.name || "—"}</div>
                </div>

                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Email Address</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{user.email || "—"}</div>
                </div>

                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Date of Birth</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                    {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "—"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Gender</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                    {user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : "—"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Phone Number</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{user.phone || "—"}</div>
                </div>

                <div style={{ borderBottom: "1px solid #f9f7f5", paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 4 }}>Location Address</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{user.address || "—"}</div>
                </div>

                <div style={{ gridColumn: "1 / -1", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--ink-lt)", marginBottom: 6 }}>About / Biography</div>
                  <p style={{ fontSize: 14, color: "var(--ink-mid)", lineHeight: 1.6, background: "var(--ivory)", padding: 12, borderRadius: "var(--radius)", border: "1px solid var(--border)", whiteSpace: "pre-line" }}>
                    {user.bio || "No biography provided yet. Click 'Edit Profile' to add something about yourself."}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field">
                    <label className="label">Full Name</label>
                    <input 
                      type="text"
                      name="name" 
                      value={form.name} 
                      onChange={onChange} 
                      placeholder="e.g. Jasmini Gnanasekaram"
                      required
                    />
                  </div>
                  
                  <div className="field">
                    <label className="label">Email Address (Read-only)</label>
                    <input 
                      type="email"
                      name="email" 
                      value={form.email} 
                      disabled
                      style={{ background: "var(--ivory)", cursor: "not-allowed" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field">
                    <label className="label">Date of Birth</label>
                    <input 
                      type="date" 
                      name="dob" 
                      value={form.dob ? form.dob.split("T")[0] : ""} 
                      onChange={onChange} 
                    />
                  </div>

                  <div className="field">
                    <label className="label">Gender</label>
                    <select name="gender" value={form.gender} onChange={onChange}>
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field">
                    <label className="label">Phone Number</label>
                    <input 
                      type="text" 
                      name="phone" 
                      value={form.phone} 
                      onChange={onChange} 
                      placeholder="e.g. +1 (555) 123-4567"
                    />
                  </div>

                  <div className="field">
                    <label className="label">Location Address</label>
                    <input 
                      type="text" 
                      name="address" 
                      value={form.address} 
                      onChange={onChange} 
                      placeholder="City, Country"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="label">About / Biography</label>
                  <textarea 
                    name="bio" 
                    value={form.bio} 
                    onChange={onChange} 
                    rows={4} 
                    placeholder="Tell us about yourself, your research interests, or background..."
                  />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{ minWidth: 100 }}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    onClick={() => {
                      setEditing(false);
                      setForm({
                        name: user.name || "",
                        email: user.email || "",
                        dob: user.date_of_birth || user.dob || "",
                        bio: user.bio || "",
                        phone: user.phone || "",
                        address: user.address || "",
                        gender: user.gender || "",
                      });
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
