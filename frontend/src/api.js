import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "lrw_token";
const USER_KEY = "lrw_user";
const USER_EVENT = "lrw_user_updated";

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("lrw_token");
      localStorage.removeItem("lrw_user");
      window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: null }));
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);


async function unwrap(request) {
  const resp = await request;
  return resp.data;
}

function saveUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(USER_EVENT, { detail: user }));
}
// ---- Auth ----

// FIX: default was "student" which backend rejects → changed to "guest"
export async function register(name, email, password, role = "guest") {
  const { data } = await api.post("/auth/register", { name, email, password, role });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await api.post("/auth/verify-email", null, { params: { token } });
  return data;
}

// FIX: use params object instead of string (handles + and special chars in email safely)
export async function resendVerification(email) {
  const { data } = await api.post("/auth/resend-verification", null, { params: { email } });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token, new_password) {
  const { data } = await api.post("/auth/reset-password", { token, new_password });
  return data;
}

export async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem("lrw_token", data.access_token);
  localStorage.setItem("lrw_user", JSON.stringify(data.user));
  window.dispatchEvent(new CustomEvent("lrw_user_updated", { detail: data.user }));
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    // Always clear the local session, including when the server is unavailable.
  }
  clearSession();
}

export function currentUser() {
  const u = localStorage.getItem("lrw_user");
  return u ? JSON.parse(u) : null;
}

export async function updateProfile(patch) {
  const data = await unwrap(api.patch("/auth/me", patch));
  saveUser(data);
  return data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  const data = await unwrap(api.post("/auth/me/avatar", form));
  saveUser(data.user);
  return data.user;
}

export function uploadDocument({ file, fileType, url, metadata, summary, language }) {
  const form = new FormData();
  form.append("file_type", fileType);
  if (file) form.append("file", file);
  if (url) form.append("url", url);
  if (metadata) form.append("metadata", JSON.stringify(metadata));
  if (summary) form.append("summary", summary);
  if (language) form.append("language", language);
  return unwrap(api.post("/documents/upload", form));
}

export async function listDocuments() {
  const { data } = await api.get("/documents/");
  return data;
}

// Save changes made by the user in the Cleaned Text tab.
// payload: { cleaned_text: "...", reanalyze: false }
export const updateDocumentCleanedText = (id, payload) =>
  unwrap(api.patch(`/documents/${id}/cleaned-text`, payload));

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

async function downloadExport(url, filename) {
  const token = localStorage.getItem("lrw_token");
  const requestUrl = new URL(url, window.location.origin);
  requestUrl.searchParams.set("t", Date.now().toString());

  const response = await fetch(requestUrl.toString(), {
    headers: token
      ? { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" }
      : { "Cache-Control": "no-cache" },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Download failed");
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
}

export async function exportDocument(id, format = "json", filename = "document") {
  const ext = format === "csv" ? "csv" : "json";
  await downloadExport(`${API_BASE}/documents/${id}/export?format=${format}`, `${filename}.${ext}`);
}

export async function exportAll(format = "csv") {
  const ext = format === "csv" ? "csv" : "json";
  await downloadExport(`${API_BASE}/documents/export/all?format=${format}`, `lrw_documents.${ext}`);
}

// ---- Search ----
export async function searchDocuments(params) {
  const { data } = await api.get("/search/", { params });
  return data;
}

// ---- Admin ----
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

export const adminStats = () => unwrap(api.get("/admin/stats"));
export const adminListUsers = () => unwrap(api.get("/admin/users"));
export const adminUpdateUser = (id, patch) => unwrap(api.patch(`/admin/users/${id}`, patch));
export const adminDeleteUser = (id) => unwrap(api.delete(`/admin/users/${id}`));
export const adminListDocuments = () => unwrap(api.get("/admin/documents"));
export const adminDeleteDocument = (id) => unwrap(api.delete(`/admin/documents/${id}`));

export const getJob = (id) => unwrap(api.get(`/jobs/${id}`));

export const crawlWebsite = (url, max_pages = 10, document_id = null) =>
  unwrap(api.post("/crawl", { url, max_pages, document_id }));

export const discoverPages = (url, document_id = null) =>
  unwrap(api.get("/crawl/discover", { params: { url, document_id } }));

export const crawlSpecificPage = (payload) =>
  unwrap(api.post("/crawl/specific", payload));
