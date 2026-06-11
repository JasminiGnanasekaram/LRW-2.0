import axios from "axios";

const API_BASE = "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lrw_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("lrw_token");
      localStorage.removeItem("lrw_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
export async function register(name, email, password, role = "student") {
  const { data } = await api.post("/auth/register", { name, email, password, role });
  return data; // { message, email } — user must verify before logging in
}

export async function verifyEmail(token) {
  const { data } = await api.post("/auth/verify-email", null, { params: { token } });
  return data;
}

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
  return data;
}

export async function logout() {
  try { await api.post("/auth/logout"); } catch {}
  localStorage.removeItem("lrw_token");
  localStorage.removeItem("lrw_user");
}

export function currentUser() {
  const u = localStorage.getItem("lrw_user");
  return u ? JSON.parse(u) : null;
}

// ---- Documents ----
export async function uploadDocument({ file, fileType, url, metadata }) {
  const form = new FormData();
  form.append("file_type", fileType);
  if (file) form.append("file", file);
  if (url) form.append("url", url);
  if (metadata) form.append("metadata", JSON.stringify(metadata));
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

export function exportDocumentURL(id, format = "json") {
  return `${API_BASE}/documents/${id}/export?format=${format}`;
}

export function exportAllURL(format = "csv") {
  return `${API_BASE}/documents/export/all?format=${format}`;
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

// ---- Jobs ----
export async function getJob(id) {
  const { data } = await api.get(`/jobs/${id}`);
  return data;
}
