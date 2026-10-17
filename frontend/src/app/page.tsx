"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PrintFlow } from "@/components/print/PrintFlow";
import { PrinterIntroAnimation } from "@/components/intro/PrinterIntroAnimation";

export default function Page() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [isZoomingIn, setIsZoomingIn] = useState(false);

  useEffect(() => {
    // Check if intro has already been shown to this user
    // "No repetition" rule: once shown, it stores in localStorage and never repeats
    // Clean up old persistent localStorage key so existing mobile devices aren't permanently locked out of intro
    try {
      localStorage.removeItem("ru_portal_intro_shown");
    } catch {}

    const urlParams = new URLSearchParams(window.location.search);
    const forceIntro = urlParams.get("intro") === "true";
    const forceSkip = urlParams.get("intro") === "false";
    const hasSeenIntro = typeof window !== "undefined" ? sessionStorage.getItem("ru_portal_intro_shown") : null;

    if (!forceSkip && (forceIntro || !hasSeenIntro)) {
      setShowIntro(true);
      setIsZoomingIn(false);
    } else {
      setShowIntro(false);
      setIsZoomingIn(true);
    }
  }, []);

  const handleZoomStart = useCallback(() => {
    setIsZoomingIn(true);
  }, []);

  const handleComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  // During SSR / first hydration tick, render dark background so PrintFlow never flashes before intro
  if (showIntro === null) {
    return <div className="w-full min-h-screen bg-[#01030B]" />;
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-background">
      {/* 
        Main Page Container:
        As the pixels fly towards the user, this container smoothly zooms from small (scale 0.72)
        to full screen (scale 1.0), perfectly matching the forward momentum of the pixels with zero gap!
      */}
      <motion.div
        className="w-full min-h-screen"
        initial={showIntro ? { scale: 0.96, opacity: 0 } : false}
        animate={
          isZoomingIn
            ? { scale: 1, opacity: 1 }
            : { scale: 0.96, opacity: 0 }
        }
        transition={{
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <PrintFlow />
      </motion.div>

      {/* Intro Canvas Overlay */}
      {showIntro && (
        <PrinterIntroAnimation
          onZoomStart={handleZoomStart}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
