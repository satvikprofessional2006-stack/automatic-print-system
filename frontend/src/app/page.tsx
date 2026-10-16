"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PrintFlow } from "@/components/print/PrintFlow";
import { PrinterIntroAnimation } from "@/components/intro/PrinterIntroAnimation";

export default function Page() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [isZoomingIn, setIsZoomingIn] = useState(false);

  useEffect(() => {
    // Check if intro has already been shown to this user
    // "No repetition" rule: once shown, it stores in localStorage and never repeats
    // URL param `?intro=true` can be used to preview or test it anytime
    const urlParams = new URLSearchParams(window.location.search);
    const forceIntro = urlParams.get("intro") === "true";
    const hasSeenIntro = localStorage.getItem("ru_portal_intro_shown");

    if (forceIntro || !hasSeenIntro) {
      setShowIntro(true);
      setIsZoomingIn(false);
    } else {
      setShowIntro(false);
      setIsZoomingIn(true);
    }
  }, []);

  // During SSR / first hydration tick, render PrintFlow directly
  if (showIntro === null) {
    return <PrintFlow />;
  }

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-background">
      {/* 
        Main Page Container:
        As the pixels fly towards the user, this container smoothly zooms from small (scale 0.68)
        to full screen (scale 1.0), perfectly matching the forward momentum of the pixels with zero gap!
      */}
      <motion.div
        className="w-full min-h-screen"
        initial={showIntro ? { scale: 0.68, opacity: 0, filter: "blur(10px)" } : false}
        animate={
          isZoomingIn
            ? { scale: 1, opacity: 1, filter: "blur(0px)" }
            : { scale: 0.68, opacity: 0, filter: "blur(10px)" }
        }
        transition={{
          duration: 1.3,
          ease: [0.16, 1, 0.3, 1], // Ultra smooth cubic-bezier momentum curve
        }}
      >
        <PrintFlow />
      </motion.div>

      {/* Intro Canvas Overlay */}
      {showIntro && (
        <PrinterIntroAnimation
          onZoomStart={() => {
            // Triggered right as pixels burst and accelerate towards the user!
            setIsZoomingIn(true);
          }}
          onComplete={() => {
            setShowIntro(false);
          }}
        />
      )}
    </div>
  );
}
