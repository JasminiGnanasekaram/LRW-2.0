import axios from "axios";

// Dev  -> "/api"  (vite.config.js proxy forwards to http://localhost:8000)
// Prod -> VITE_API_BASE from .env
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 180000, // OCR / audio transcription can be slow
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lrw_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ALWAYS returns a plain string.
// FastAPI 422 returns detail as an ARRAY of objects; rendering that in JSX
// crashes React with "Objects are not valid as a React child".
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (!err.isAxiosError) return err.message || fallback;
  if (err.code === "ECONNABORTED") return "The request timed out. Please try again.";
  if (!err.response) return "Cannot reach the server. Make sure the backend is running on port 8000.";

  const data = err.response.data;
  const detail = data?.detail ?? data?.message ?? data?.error;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const joined = detail
      .map((e) => {
        if (typeof e === "string") return e;
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : "";
        return field ? `${field}: ${e?.msg}` : e?.msg;
      })
      .filter(Boolean)
      .join(" • ");
    if (joined) return joined;
  }

  if (detail && typeof detail === "object") return detail.msg || detail.message || JSON.stringify(detail);
  return `${err.response.status} ${err.response.statusText || ""}`.trim() || fallback;
}

const AUTH_PATHS = [
  "/auth/login", "/auth/register", "/auth/verify-email",
  "/auth/resend-verification", "/auth/forgot-password", "/auth/reset-password",
];

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const url = err.config?.url || "";
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem("lrw_token");
      localStorage.removeItem("lrw_user");
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/* ================================ Auth ================================ */

export async function register(name, email, password, role = "guest") {
  const payload = {
    name: (name || "").trim(),
    email: (email || "").trim().toLowerCase(),
    password,
    role,
  };
  if (!payload.name) throw new Error("Please enter your full name.");
  if (!payload.email) throw new Error("Please enter your email address.");
  if (!payload.password) throw new Error("Please enter a password.");

  const { data } = await api.post("/auth/register", payload);
  return data;
}

export async function verifyEmail(token) {
  const { data } = await api.post("/auth/verify-email", null, { params: { token } });
  return data;
}

export async function resendVerification(email) {
  const { data } = await api.post("/auth/resend-verification", null, {
    params: { email: (email || "").trim().toLowerCase() },
  });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await api.post("/auth/forgot-password", {
    email: (email || "").trim().toLowerCase(),
  });
  return data;
}

export async function resetPassword(token, new_password) {
  const { data } = await api.post("/auth/reset-password", { token, new_password });
  return data;
}

export async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", (email || "").trim().toLowerCase());
  form.append("password", password);

  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!data?.access_token) throw new Error("Login response did not include a token.");
  localStorage.setItem("lrw_token", data.access_token);
  localStorage.setItem("lrw_user", JSON.stringify(data.user || {}));
  return data;
}

export async function logout() {
  try { await api.post("/auth/logout"); } catch { /* clear locally regardless */ }
  localStorage.removeItem("lrw_token");
  localStorage.removeItem("lrw_user");
}

export function currentUser() {
  const u = localStorage.getItem("lrw_user");
  if (!u) return null;
  try {
    return JSON.parse(u);
  } catch {
    localStorage.removeItem("lrw_user");
    localStorage.removeItem("lrw_token");
    return null;
  }
}

/* ============================= Documents ============================== */

// Empty strings are the #1 cause of a 422 "Upload failed".
// publication_date: "" cannot be parsed as a date.
function cleanMetadata(metadata = {}) {
  const out = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const v = typeof value === "string" ? value.trim() : value;
    if (v === "") return;
    out[key] = v;
  });
  return out;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadDocument({ file, fileType, url, metadata }) {
  if (fileType === "url") {
    if (!url || !url.trim()) throw new Error("Please enter a URL.");
  } else {
    if (!file) throw new Error("Please choose a file before uploading.");
    if (file.size === 0) throw new Error("That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`);
    }
  }

  const form = new FormData();
  form.append("file_type", fileType);
  if (fileType === "url") form.append("url", url.trim());
  else form.append("file", file, file.name);
  form.append("metadata", JSON.stringify(cleanMetadata(metadata)));

  // Let the browser set the multipart boundary — do not hand-write the header.
  const { data } = await api.post("/documents/upload", form);
  return data;
}

export async function listDocuments() {
  const { data } = await api.get("/documents/");
  return data;
}

export async function getDocument(id) {
  const { data } = await api.get(`/documents/${id}`);
  return data;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
}

function triggerBlobDownload(blobData, filename) {
  const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

async function downloadExport(path, filename) {
  const token = localStorage.getItem("lrw_token");
  const requestUrl = new URL(path, window.location.origin);
  requestUrl.searchParams.set("t", Date.now().toString());

  const response = await fetch(requestUrl.toString(), {
    headers: token
      ? { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" }
      : { "Cache-Control": "no-cache" },
    cache: "no-store",
  });

  if (!response.ok) {
    let msg = `Download failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") msg = body.detail;
    } catch { /* body was not JSON */ }
    throw new Error(msg);
  }

  triggerBlobDownload(await response.blob(), filename);
}

export async function exportDocument(id, format = "json", filename = "document") {
  const ext = format === "csv" ? "csv" : "json";
  await downloadExport(`${API_BASE}/documents/${id}/export?format=${format}`, `${filename}.${ext}`);
}

export async function exportAll(format = "csv") {
  const ext = format === "csv" ? "csv" : "json";
  await downloadExport(`${API_BASE}/documents/export/all?format=${format}`, `lrw_documents.${ext}`);
}

/* =============================== Search =============================== */

export async function searchDocuments(params) {
  const { data } = await api.get("/search/", { params });
  return data;
}

/* =============================== Admin ================================ */

export async function adminStats() {
  const { data } = await api.get("/admin/stats");
  return data;
}
export async function adminListUsers() {
  const { data } = await api.get("/admin/users");
  return data;
}
export async function adminUpdateUser(id, patch) {
  const { data } = await api.patch(`/admin/users/${id}`, patch);
  return data;
}
export async function adminDeleteUser(id) {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data;
}
export async function adminActivity() {
  const { data } = await api.get("/admin/activity");
  return data;
}

/* ================================ Jobs ================================ */

export async function getJob(id) {
  const { data } = await api.get(`/jobs/${id}`);
  return data;
}


export async function updateMetadata(id, metadata) {
  const { data } = await api.patch(`/documents/${id}/metadata`, metadata);
  return data;
}