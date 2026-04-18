import { createContext, useContext, useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setOrg(data.organization);
    } catch {
      setUser(false);
      setOrg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    loadMe();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("access_token", data.access_token);
      setUser(data.user);
      await loadMe();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      localStorage.setItem("access_token", data.access_token);
      setUser(data.user);
      await loadMe();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* noop */ }
    localStorage.removeItem("access_token");
    setUser(false);
    setOrg(null);
  };

  return (
    <AuthContext.Provider value={{ user, org, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
