"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  role: "admin" | "operator";
  password?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (credential?: string, demoEmail?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = "ruprint_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Standard username & password login for admin
  const login = useCallback(async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (username.trim().toLowerCase() !== "admin") {
        return { success: false, error: "Invalid username." };
      }

      const res = await fetch("/api/admin/jobs", {
        headers: { Authorization: `Bearer ${password}` },
      });

      if (!res.ok) {
        return { success: false, error: "Invalid password." };
      }

      const loggedInUser: User = {
        id: "1",
        name: username || "Admin",
        role: "admin",
        password,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: "Connection error." };
    }
  }, []);

  // Google OAuth login for admin (verifies domain & admin privileges)
  const loginWithGoogle = useCallback(async (
    credential?: string,
    demoEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/google/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential,
          demoEmail,
          roleRequired: "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Admin verification failed." };
      }

      const loggedInUser: User = {
        id: "admin-" + data.user.email,
        name: data.user.name || "Admin",
        email: data.user.email,
        picture: data.user.picture,
        role: "admin",
        password: data.adminToken || "ruprint2026",
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: "Connection error with authentication server." };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
