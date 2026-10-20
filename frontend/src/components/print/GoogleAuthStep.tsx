"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { StudentAuth } from "@/lib/printStore";
import { Button } from "@/components/ui/button";

interface Props {
  onSuccess: (student: StudentAuth) => void;
}

export function GoogleAuthStep({ onSuccess }: Props) {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testEmail] = useState<string>("satvik.k25110@csds.rishihood.edu.in");
  const [testName] = useState<string>("Satvik Kesarwani");
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

      // Check for previously saved enrollment ID for this email (only from localStorage)
      const savedEnrollment = typeof window !== "undefined"
        ? localStorage.getItem(`ru_enrollment_${data.user.email}`) || ""
        : "";

      const userType: "student" | "faculty" = data.user.userType || (/\d/.test(data.user.email.split('@')[0]) ? "student" : "faculty");
      const isAdmin = Boolean(data.user.isAdmin);
      const student: StudentAuth = {
        name: data.user.name,
        email: data.user.email,
        picture: data.user.picture,
        department: data.user.department,
        enrollmentNo: userType === "faculty" ? "FACULTY" : savedEnrollment,
        userType,
        isAdmin,
      };

      // If user is recognized as admin, also sync admin session & route to admin console
      if (isAdmin && typeof window !== "undefined") {
        const adminSession = {
          id: "admin-" + data.user.email,
          name: data.user.name || "Admin",
          email: data.user.email,
          picture: data.user.picture,
          role: "admin",
          password: data.adminToken || "ruprint2026",
        };
        localStorage.setItem("ruprint_session", JSON.stringify(adminSession));
        localStorage.setItem("ru_student_session", JSON.stringify(student));
        // Redirect directly to the secret admin portal!
        window.location.href = "/ruprint-ops";
        return;
      }

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
        ? localStorage.getItem(`ru_enrollment_${data.user.email}`) || ""
        : "";

      const userType: "student" | "faculty" = data.user.userType || (/\d/.test(data.user.email.split('@')[0]) ? "student" : "faculty");
      const isAdmin = Boolean(data.user.isAdmin);
      const student: StudentAuth = {
        name: data.user.name,
        email: data.user.email,
        picture: data.user.picture,
        department: data.user.department,
        enrollmentNo: userType === "faculty" ? "FACULTY" : savedEnrollment,
        userType,
        isAdmin,
      };

      if (isAdmin && typeof window !== "undefined") {
        const adminSession = {
          id: "admin-" + data.user.email,
          name: data.user.name || "Admin",
          email: data.user.email,
          picture: data.user.picture,
          role: "admin",
          password: data.adminToken || "ruprint2026",
        };
        localStorage.setItem("ruprint_session", JSON.stringify(adminSession));
        localStorage.setItem("ru_student_session", JSON.stringify(student));
        window.location.href = "/ruprint-ops";
        return;
      }

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
    <div className="py-4 sm:py-6 flex flex-col items-center justify-center space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Sign In to Print
        </h2>
      </div>

      {/* Error message banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="w-full max-w-sm p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Button */}
      {clientId ? (
        <div className="flex justify-center w-full min-h-[44px]">
          <div ref={googleBtnRef} className="flex justify-center" />
        </div>
      ) : (
        /* Notice & Quick Sign In when Client ID is not yet entered */
        <div className="w-full flex justify-center">
          <Button
            size="lg"
            onClick={() => handleDemoSignIn(testEmail, testName)}
            disabled={isLoading}
            className="w-full max-w-sm h-12 rounded-xl text-xs sm:text-sm font-semibold bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-100 hover:shadow-sm transition-all cursor-pointer dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
        </div>
      )}
    </div>
  );
}
