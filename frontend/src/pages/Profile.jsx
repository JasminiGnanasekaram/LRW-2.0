import React, { useRef, useState } from "react";
import { currentUser, updateProfile, uploadAvatar } from "../api";

const toForm = (user = {}) => ({
  name: user.name || "",
  email: user.email || "",
  dob: user.date_of_birth || user.dob || "",
  gender: user.gender || "",
  phone: user.phone || "",
  address: user.address || "",
  bio: user.bio || "",
});

const formatDate = (value, options) => {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, options);
};

const errorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.message;
  return typeof detail === "string" ? detail : fallback;
};

const isNetworkError = (error) =>
  !error?.response &&
  ((typeof navigator !== "undefined" && !navigator.onLine) ||
    error?.code === "ERR_NETWORK" ||
    /network error|failed to fetch/i.test(error?.message || ""));

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(file);
  });

const detailStyle = { borderBottom: "1px solid var(--border)", paddingBottom: 10 };
const detailLabelStyle = {
  fontSize: 11,
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ink-lt)",
  marginBottom: 4,
};
const detailValueStyle = { fontSize: 15, fontWeight: 500, color: "var(--ink)" };
const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
};

function Detail({ label, value }) {
  return (
    <div style={detailStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value || "—"}</div>
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState(() => currentUser() || {});
  const [form, setForm] = useState(() => toForm(user));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef(null);

  const publishUser = (updated) => {
    setUser(updated);
    window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: updated }));
  };

  const saveLocally = (updated) => {
    localStorage.setItem("lrw_user", JSON.stringify(updated));
    publishUser(updated);
  };

  const startEditing = () => {
    setForm(toForm(user));
    setError("");
    setSuccess("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(toForm(user));
    setEditing(false);
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const changes = {
      name: form.name.trim(),
      phone: form.phone,
      date_of_birth: form.dob ? form.dob.slice(0, 10) : "",
      address: form.address,
      gender: form.gender,
      bio: form.bio,
    };

    try {
      const result = await updateProfile(changes);
      const updated = { ...user, ...changes, ...(result || {}) };
      publishUser(updated);
      setForm(toForm(updated));
      setEditing(false);
      setSuccess("Profile updated successfully!");
    } catch (err) {
      if (!isNetworkError(err)) {
        setError(errorMessage(err, "Failed to update profile."));
      } else {
        try {
          saveLocally({ ...user, ...changes });
          setEditing(false);
          setSuccess("Profile saved locally. Changes will not sync until you save online.");
        } catch {
          setError("Could not save the profile locally. Please try again.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file || loading) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await uploadAvatar(file);
      publishUser({ ...user, ...(result || {}) });
      setSuccess("Avatar updated successfully!");
    } catch (err) {
      if (!isNetworkError(err)) {
        setError(errorMessage(err, "Failed to upload avatar."));
      } else {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          saveLocally({ ...user, avatar_url: dataUrl, image: dataUrl });
          setSuccess("Avatar saved locally. Upload it again to sync online.");
        } catch {
          setError("Could not save the avatar locally. Try a smaller image.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const avatarSrc =
    user.avatar_url ||
    user.image ||
    user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "User")}&background=4a7c59&color=fff&size=128`;

  const role = user.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Guest";
  const gender = user.gender
    ? user.gender.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase())
    : "—";

  return (
    <div className="page fade-up">
      <div className="page-header">
        <h1 className="page-title">My Account</h1>
        <div className="page-subtitle">
          Manage your personal information, contact details, and security
        </div>
      </div>

      {success && <div className="alert-success" role="status">{success}</div>}
      {error && <div className="alert-error" role="alert">{error}</div>}

      <div className="row" style={{ alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 320px", minWidth: 260, maxWidth: "100%" }}>
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
          >
            <button
              type="button"
              className="avatar-hover-container"
              aria-label="Change profile photo"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
              style={{
                position: "relative",
                width: 120,
                height: 120,
                padding: 0,
                borderRadius: "50%",
                overflow: "hidden",
                cursor: loading ? "wait" : "pointer",
                boxShadow: "var(--shadow-sm)",
                border: "4px solid var(--paper)",
                outline: "2px solid var(--forest-lt)",
                marginBottom: 16,
              }}
            >
              <img
                src={avatarSrc}
                alt="Profile avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <span
                className="avatar-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  opacity: 0,
                  transition: "opacity 0.25s ease",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 500 }}>Change Photo</span>
              </span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Upload profile image"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                handleAvatarUpload(file);
              }}
            />

            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--forest)", margin: "4px 0" }}>
              {user.name || "User"}
            </h2>
            <div className="muted" style={{ marginBottom: 12 }}>{user.email}</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <span className="badge">{role}</span>
              <span className={`badge ${user.verified ? "badge-blue" : "badge-amber"}`}>
                {user.verified ? "Verified" : "Unverified"}
              </span>
            </div>

            {user.created_at && (
              <div
                style={{
                  width: "100%",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  marginTop: 4,
                  fontSize: 12,
                  color: "var(--ink-lt)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Joined</span>
                <span>{formatDate(user.created_at, { year: "numeric", month: "short" })}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-full"
              style={{ marginTop: 20 }}
              disabled={loading}
              onClick={editing ? cancelEditing : startEditing}
            >
              {editing ? "Cancel Editing" : "Edit Profile"}
            </button>
          </div>
        </div>

        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="card-title" style={{ marginBottom: 0 }}>Basic Information</h2>
              {editing && <span className="muted" style={{ fontSize: 12 }}>Editing Mode</span>}
            </div>

            {!editing ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20 }}>
                <Detail label="Full Name" value={user.name} />
                <Detail label="Email Address" value={user.email} />
                <Detail
                  label="Date of Birth"
                  value={formatDate(user.date_of_birth || user.dob, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                />
                <Detail label="Gender" value={gender} />
                <Detail label="Phone Number" value={user.phone} />
                <Detail label="Location Address" value={user.address} />

                <div style={{ gridColumn: "1 / -1", paddingTop: 10 }}>
                  <div style={detailLabelStyle}>About / Biography</div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--ink-mid)",
                      lineHeight: 1.6,
                      background: "var(--ivory)",
                      padding: 12,
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {user.bio || "No biography provided yet. Click 'Edit Profile' to add something about yourself."}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={formGridStyle}>
                  <div className="field">
                    <label className="label" htmlFor="profile-name">Full Name</label>
                    <input id="profile-name" type="text" name="name" value={form.name} onChange={onChange} required />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="profile-email">Email Address (Read-only)</label>
                    <input
                      id="profile-email"
                      type="email"
                      name="email"
                      value={form.email}
                      readOnly
                      style={{ background: "var(--ivory)", cursor: "not-allowed" }}
                    />
                  </div>
                </div>

                <div style={formGridStyle}>
                  <div className="field">
                    <label className="label" htmlFor="profile-dob">Date of Birth</label>
                    <input
                      id="profile-dob"
                      type="date"
                      name="dob"
                      value={form.dob ? String(form.dob).slice(0, 10) : ""}
                      onChange={onChange}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="profile-gender">Gender</label>
                    <select id="profile-gender" name="gender" value={form.gender} onChange={onChange}>
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div style={formGridStyle}>
                  <div className="field">
                    <label className="label" htmlFor="profile-phone">Phone Number</label>
                    <input id="profile-phone" type="tel" name="phone" value={form.phone} onChange={onChange} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="profile-address">Location Address</label>
                    <input id="profile-address" type="text" name="address" value={form.address} onChange={onChange} placeholder="City, Country" />
                  </div>
                </div>

                <div className="field">
                  <label className="label" htmlFor="profile-bio">About / Biography</label>
                  <textarea
                    id="profile-bio"
                    name="bio"
                    value={form.bio}
                    onChange={onChange}
                    rows={4}
                    placeholder="Tell us about yourself, your research interests, or background..."
                  />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 100 }}>
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={cancelEditing} disabled={loading}>
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
