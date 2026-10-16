"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertCircle, Sparkles, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { StudentAuth } from "@/lib/printStore";
import { Button } from "@/components/ui/button";

interface Props {
  onSuccess: (student: StudentAuth) => void;
}

export function GoogleAuthStep({ onSuccess }: Props) {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testEmail, setTestEmail] = useState<string>("satvik.25110@csds.rishihood.edu.in");
  const [testName, setTestName] = useState<string>("Satvik Kesarwani");
  const [showDemoForm, setShowDemoForm] = useState<boolean>(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const allowedDomain = "rishihood.edu.in";

  // Handle server-side verification of Google Token
  const handleVerifyCredential = async (credential: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      // Check for previously saved enrollment ID for this email
      const savedEnrollment = typeof window !== "undefined"
        ? localStorage.getItem(`ru_enrollment_${data.user.email}`) || data.user.shortRoll || ""
        : "";

      const student: StudentAuth = {
        name: data.user.name,
        email: data.user.email,
        picture: data.user.picture,
        department: data.user.department,
        enrollmentNo: savedEnrollment,
      };

      // Save student session in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("ru_student_session", JSON.stringify(student));
      }

      onSuccess(student);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct verification for test / demo mode
  const handleDemoSignIn = async (emailToTest: string, nameToTest: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoEmail: emailToTest,
          demoName: nameToTest,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      const savedEnrollment = typeof window !== "undefined"
        ? localStorage.getItem(`ru_enrollment_${data.user.email}`) || data.user.shortRoll || ""
        : "";

      const student: StudentAuth = {
        name: data.user.name,
        email: data.user.email,
        picture: data.user.picture,
        department: data.user.department,
        enrollmentNo: savedEnrollment,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("ru_student_session", JSON.stringify(student));
      }

      onSuccess(student);
    } catch (err: any) {
      setError(err.message || "Sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load Google Identity Services script if Client ID is configured
  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;

    const initializeGis = () => {
      const google = (window as any).google;
      if (!google || !google.accounts || !google.accounts.id) return;

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential && isMounted) {
              handleVerifyCredential(response.credential);
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
            width: "300",
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
  }, [clientId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20 mb-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Official University Portal</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Sign In to Print
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Please sign in with your official Rishihood University Google account to access campus printers.
        </p>
      </div>

      {/* Main Login Card */}
      <div className="p-6 rounded-2xl bg-card/80 border border-border/70 shadow-sm flex flex-col items-center gap-5">
        {/* Error message banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="w-full p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Official Google Button Render Target */}
        {clientId ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
            <p className="text-[11px] text-muted-foreground/80 text-center">
              Sign in popup will verify your Rishihood Google account.
            </p>
          </div>
        ) : (
          /* Notice & Quick Sign In when Client ID is not yet entered */
          <div className="w-full flex flex-col items-center gap-4">
            <Button
              size="lg"
              onClick={() => handleDemoSignIn(testEmail, testName)}
              disabled={isLoading}
              className="w-full max-w-sm h-12 rounded-xl text-xs sm:text-sm font-bold bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 shadow-xs flex items-center justify-center gap-3 transition-all cursor-pointer dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
            >
              {/* Google G logo SVG */}
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading ? "Signing in…" : "Sign in with Google"}</span>
            </Button>

            {/* Test info & Account Switcher */}
            <div className="w-full pt-3 border-t border-border/50 text-center">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Active Account:</span>
                <button
                  type="button"
                  onClick={() => setShowDemoForm(!showDemoForm)}
                  className="text-primary hover:underline font-semibold"
                >
                  {showDemoForm ? "Hide" : "Switch Account / Test Domain Lock"}
                </button>
              </div>
              <p className="text-xs font-mono font-medium text-foreground mt-1">
                {testEmail}
              </p>
            </div>

            {showDemoForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-3 text-left"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Test Email (try @gmail.com to see it blocked!)
                  </label>
                  <input
                    type="text"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="e.g. satvik.25110@csds.rishihood.edu.in"
                    className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="Satvik Kesarwani"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-primary"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDemoSignIn(testEmail, testName)}
                  className="w-full h-8 text-xs font-bold"
                >
                  Apply &amp; Sign In
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
