import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // Let the auth context handle redirect
    }
    return Promise.reject(err);
  }
);

export function apiError(e) {
  const d = e?.response?.data?.detail;
  if (!d) return e.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return JSON.stringify(d);
}

export function fmtMoney(n, currency = "USD") {
  const num = Number(n || 0);
  return num.toLocaleString("en-US", { style: "currency", currency });
}

export function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
