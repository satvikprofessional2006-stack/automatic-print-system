"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Printer, Lock, User, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const allowedDomain = "rishihood.edu.in";

  // Initialize Google Identity Services if client ID is set
  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;

    const initializeGis = () => {
      const google = (window as any).google;
      if (!google || !google.accounts || !google.accounts.id) return;

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential && isMounted) {
              setGoogleLoading(true);
              setError("");
              const res = await loginWithGoogle(response.credential);
              if (!res.success) {
                setError(res.error || "Google Admin sign-in failed.");
              }
              setGoogleLoading(false);
            }
          },
          hosted_domain: allowedDomain,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            width: "320",
            logo_alignment: "left",
          });
        }
      } catch (err) {
        console.error("GIS initialization error:", err);
      }
    };

    if ((window as any).google?.accounts?.id) {
      initializeGis();
    } else {
      const existingScript = document.getElementById("google-gsi-client");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-client";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initializeGis;
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [clientId, loginWithGoogle]);

  const handleQuickGoogleAdmin = async (email = "satvik.25110@csds.rishihood.edu.in") => {
    setGoogleLoading(true);
    setError("");
    const res = await loginWithGoogle(undefined, email);
    if (!res.success) {
      setError(res.error || "Admin Google sign-in failed.");
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setError("");
    setIsLoading(true);

    // Small artificial delay so it feels like a real auth check
    await new Promise((r) => setTimeout(r, 400));

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error ?? "Login failed.");
    }
    setIsLoading(false);
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-background p-3 sm:p-4 lg:p-6 font-sans overflow-hidden relative">
      {/* Theme toggle — top right */}
      <div className="absolute top-6 right-6 z-30">
        <ThemeToggle />
      </div>

      {/* ── Left panel — brand art ── */}
      <div className="relative w-full lg:w-[44%] h-56 sm:h-72 lg:h-full rounded-[28px] overflow-hidden flex flex-col justify-between p-7 sm:p-10 text-white shrink-0 select-none shadow-lg">
        {/* Background image */}
        <img
          src="/RU-BG.png"
          alt="Rishihood University"
          className="absolute inset-0 w-full h-full object-cover blur-[2px] brightness-[0.60] scale-[1.03]"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/90 z-0" />

        {/* Top: Logo + name */}
        <a href="/" className="relative z-10 flex items-center gap-3.5 hover:opacity-80 transition-opacity cursor-pointer">
          <img
            src="/Rishihood_University_idxo_lfgcw_2.png"
            alt="RU Logo"
            className="h-10 w-10 object-contain drop-shadow-md"
          />
          <div>
            <p className="text-base font-bold tracking-tight leading-none text-white drop-shadow-md">
              Rishihood University
            </p>
            <p className="text-[11px] font-semibold text-white/80 tracking-widest uppercase mt-1">
              Print Portal
            </p>
          </div>
        </a>

        {/* Bottom: headline */}
        <div className="relative z-10 mt-auto">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
            <Printer className="h-3.5 w-3.5 text-white/80" />
            <span className="text-[11px] font-semibold text-white/90 tracking-wide">
              University Printer Management
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
            Print smarter,
            <br />
            not harder.
          </h2>
          <p className="text-xs sm:text-sm text-white/75 mt-3 tracking-wide max-w-sm">
            Centralized print queue management for all Rishihood University printers.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="w-full lg:w-[56%] flex flex-col justify-center px-6 sm:px-10 lg:px-20 pt-6 sm:pt-8 lg:pt-0 pb-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="max-w-sm mx-auto w-full space-y-6"
        >
          {/* Heading */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              <ShieldCheck className="h-3 w-3" />
              <span>Admin Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sign in with your university Google account or master credentials.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </motion.div>
          )}

          {/* 1. Google Sign-In */}
          <div className="space-y-2">
            {clientId ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
                <span className="text-[10px] text-muted-foreground">Admin access verified via Google</span>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickGoogleAdmin()}
                disabled={googleLoading || isLoading}
                className="w-full h-11 text-xs font-semibold rounded-xl bg-card hover:bg-muted/60 border-border/70 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{googleLoading ? "Verifying Google Admin..." : "Sign in with Admin Google"}</span>
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex py-0.5 items-center">
            <div className="flex-grow border-t border-border/60"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Or with master password
            </span>
            <div className="flex-grow border-t border-border/60"></div>
          </div>

          {/* Master Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80 block">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="pl-10 h-10 text-xs bg-muted/40 border-border/60 focus-visible:ring-primary/50 rounded-xl"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80 block">
                Master Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter master password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pl-10 pr-11 h-10 text-xs bg-muted/40 border-border/60 focus-visible:ring-primary/50 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || googleLoading}
              className="w-full h-10 text-xs font-semibold rounded-xl mt-1"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in with Password"
              )}
            </Button>
          </form>

          {/* Footer hint */}
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Authorized admin accounts: @csds.rishihood.edu.in or master key.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
