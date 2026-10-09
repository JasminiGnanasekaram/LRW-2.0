import axios from "axios";

const API_BASE = "/api";
const TOKEN_KEY = "lrw_token";
const USER_KEY = "lrw_user";
const USER_EVENT = "lrw_user_updated";

export const api = axios.create({ baseURL: API_BASE });

const unwrap = (request) => request.then((response) => response.data);

const notifyUserUpdated = (user) => window.dispatchEvent(new CustomEvent(USER_EVENT, { detail: user }));

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyUserUpdated(null);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const register = (name, email, password, role = "guest") =>
  unwrap(api.post("/auth/register", { name, email, password, role }));

export const verifyEmail = (token) => unwrap(api.post("/auth/verify-email", null, { params: { token } }));

export const resendVerification = (email) =>
  unwrap(api.post("/auth/resend-verification", null, { params: { email } }));

export const forgotPassword = (email) => unwrap(api.post("/auth/forgot-password", { email }));

export const resetPassword = (token, new_password) =>
  unwrap(api.post("/auth/reset-password", { token, new_password }));

export async function login(email, password) {
  const form = new URLSearchParams({ username: email, password });
  const data = await unwrap(api.post("/auth/login", form));
  localStorage.setItem(TOKEN_KEY, data.access_token);
  saveUser(data.user);
  notifyUserUpdated(data.user);
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {

  }
  clearSession();
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
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

export function uploadDocument({ file, fileType, url, metadata }) {
  const form = new FormData();
  form.append("file_type", fileType);
  if (file) form.append("file", file);
  if (url) form.append("url", url);
  if (metadata) form.append("metadata", JSON.stringify(metadata));
  return unwrap(api.post("/documents/upload", form));
}

export const listDocuments = () => unwrap(api.get("/documents/"));
export const getDocument = (id) => unwrap(api.get(`/documents/${id}`));
export const deleteDocument = (id) => unwrap(api.delete(`/documents/${id}`));
export const updateDocumentMetadata = (id, metadata) => unwrap(api.patch(`/documents/${id}/metadata`, metadata));

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function downloadExport(path, format, filename) {
  try {
    const { data } = await api.get(path, {
      params: { format, t: Date.now() },
      responseType: "blob",
    });
    saveBlob(data, `${filename}.${format}`);
  } catch (error) {
    const message = await error.response?.data?.text?.();
    throw new Error(message || error.message || "Download failed");
  }
}

const normalizeFormat = (format) => (format === "csv" ? "csv" : "json");

export const exportDocument = (id, format = "json", filename = "document") =>
  downloadExport(`/documents/${id}/export`, normalizeFormat(format), filename);

export const exportAll = (format = "csv") =>
  downloadExport("/documents/export/all", normalizeFormat(format), "lrw_documents");

export const searchDocuments = (params) => unwrap(api.get("/search/", { params }));

export const adminStats = () => unwrap(api.get("/admin/stats"));
export const adminListUsers = () => unwrap(api.get("/admin/users"));
export const adminUpdateUser = (id, patch) => unwrap(api.patch(`/admin/users/${id}`, patch));
export const adminDeleteUser = (id) => unwrap(api.delete(`/admin/users/${id}`));

export const getJob = (id) => unwrap(api.get(`/jobs/${id}`));