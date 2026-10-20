"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PrintFlow } from "@/components/print/PrintFlow";
import { PrinterIntroAnimation } from "@/components/intro/PrinterIntroAnimation";

export default function Page() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [isZoomingIn, setIsZoomingIn] = useState(false);

  useEffect(() => {
    // Intro plays on every fresh page visit / reload.
    // Skip it only when explicitly opted out via ?intro=false.
    const urlParams = new URLSearchParams(window.location.search);
    const skip = urlParams.get("intro") === "false";

    if (!skip) {
      setShowIntro(true);
      setIsZoomingIn(false);
    } else {
      setShowIntro(false);
      setIsZoomingIn(true);
    }
  }, []);

  // Called slightly before the intro exits — begin portal reveal
  const handleZoomStart = useCallback(() => {
    setIsZoomingIn(true);
  }, []);

  // Called after intro fully unmounts
  const handleComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  // During SSR / initial hydration tick: hold on pure black so the portal
  // never flashes white before the intro overlay mounts.
  if (showIntro === null) {
    return <div className="w-full min-h-screen bg-black" />;
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-background">
      {/*
        Portal is mounted immediately and lives beneath the intro overlay the whole time.
        It starts invisible (opacity 0) and reveals itself when the intro begins its exit.
        A tiny scale-in (0.97 → 1.0) adds depth without any jarring motion.
      */}
      <motion.div
        className="w-full min-h-screen"
        initial={showIntro ? { opacity: 0, scale: 0.97 } : false}
        animate={
          isZoomingIn
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.97 }
        }
        transition={{
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ willChange: "opacity, transform" }}
      >
        <PrintFlow />
      </motion.div>

      {/* Intro overlay — sits on top until its own exit animation finishes */}
      {showIntro && (
        <PrinterIntroAnimation
          onZoomStart={handleZoomStart}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
