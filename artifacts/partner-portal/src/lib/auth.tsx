import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { PortalUserData, setAuthTokenGetter } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthState {
  token: string | null;
  userdata: PortalUserData | null;
  isAuthenticated: boolean;
  login: (token: string, userdata: PortalUserData) => void;
  updateUserdata: (patch: Partial<PortalUserData>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("pointify_partner_token"));
  const [userdata, setUserdata] = useState<PortalUserData | null>(() => {
    const saved = localStorage.getItem("pointify_partner_userdata");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("pointify_partner_token"));
  }, []);

  const login = (newToken: string, data: PortalUserData) => {
    localStorage.setItem("pointify_partner_token", newToken);
    localStorage.setItem("pointify_partner_userdata", JSON.stringify(data));
    setToken(newToken);
    setUserdata(data);
  };

  const updateUserdata = (patch: Partial<PortalUserData>) => {
    setUserdata((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("pointify_partner_userdata", JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem("pointify_partner_token");
    localStorage.removeItem("pointify_partner_userdata");
    setToken(null);
    setUserdata(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ token, userdata, isAuthenticated: !!token, login, updateUserdata, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
