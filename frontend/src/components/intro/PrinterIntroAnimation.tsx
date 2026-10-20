"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const [phase, setPhase] = useState<"drawing" | "blooming" | "exit">("drawing");
  const hasTriggeredZoom = useRef(false);
  const hasCompleted = useRef(false);

  const handleSkip = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    if (!hasTriggeredZoom.current) {
      hasTriggeredZoom.current = true;
      onZoomStart?.();
    }
    setPhase("exit");
    setTimeout(() => { onComplete(); }, 240);
  }, [onZoomStart, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") handleSkip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  useEffect(() => {
    // 0.62s: Pen stroke finishes → shield blooms in
    const tBloom = setTimeout(() => setPhase("blooming"), 620);
    // 1.20s: Begin live portal handoff
    const tZoom = setTimeout(() => {
      if (!hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        onZoomStart?.();
      }
      setPhase("exit");
    }, 1200);
    // 1.50s: Unmount
    const tFinish = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, 1500);
    return () => {
      clearTimeout(tBloom);
      clearTimeout(tZoom);
      clearTimeout(tFinish);
    };
  }, [onZoomStart, onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" ? (
        <motion.div
          key="kinetic-ribbon-overlay"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
          }}
          onClick={handleSkip}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000] select-none cursor-pointer overflow-hidden"
        >
          {/* Deep cinematic crimson ambient glow, blooms with the shield */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={
                phase === "blooming"
                  ? { scale: [1, 1.3, 1.1], opacity: [0.18, 0.28, 0.15] }
                  : { scale: 0.7, opacity: 0 }
              }
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="w-[500px] h-[500px] rounded-full bg-[#CC0033] blur-[110px] transform-gpu"
            />
          </div>

          {/* Brand Identity Stage */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Emblem + Drawing Canvas */}
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-5">

              {/* Shield emblem — blooms underneath as the pen finishes */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={
                  phase === "blooming"
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.9 }
                }
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <img
                  src="/Rishihood_University_idxo_lfgcw_2.png"
                  alt="Rishihood University"
                  className="w-full h-full object-contain drop-shadow-[0_16px_40px_rgba(204,0,51,0.45)] select-none pointer-events-none"
                />
              </motion.div>

              {/* Bloom ring ripple */}
              {phase === "blooming" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.6 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-full border border-[#CC0033]/30 pointer-events-none"
                />
              )}

              {/*
                ═══════════════════════════════════════════════════════
                SVG Kinetic Pen Draw — traces the EXACT skeleton of
                the Rishihood cursive 'r' calligraphy letter.

                Skeleton path derived from pixel analysis of the logo:
                  • Upstroke: pen starts bottom-center (~111,245)
                  • Rises through the stem (wide arc left then right)
                  • Loops into the hat apex at ~(229,72)
                  • Sweeps back left ~(80,108)
                  • Narrows back to stem center ~(143,130)
                  • Descends in a graceful curve to the tip (111,245)
                ═══════════════════════════════════════════════════════
              */}
              <svg
                viewBox="25 1 205 253"
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  opacity: phase === "blooming" ? 0 : 1,
                  transition: "opacity 0.25s ease",
                }}
              >
                <defs>
                  <linearGradient id="penGlow" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF6B8A" />
                    <stop offset="40%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#FFE4E9" />
                  </linearGradient>
                  <filter id="penBloom" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/*
                  STROKE 1 — The main body:
                  Starts at bottom tip, rises through stem, arcs into the wide hat,
                  sweeps left to the hook, curves back in to the body,
                  then glides back down the tail.

                  Key skeleton waypoints (from pixel analysis):
                    bottom tip:     (111, 245)
                    lower stem:     (107, 216) → (116, 192)
                    mid stem:       (126, 168) → (134, 150)
                    upper stem:     (143, 130) → (124, 126)
                    left hook:      (83, 120)  → (81, 114)
                    body top:       (85, 108)  → (161, 96)
                    hat sweep:      (178, 72)  → (229, 78)
                    hat right apex: (229, 78)  back around
                    hook return:    (172, 114) → (124, 126)
                    re-enters stem: (143, 132) continuing down
                */}
                <motion.path
                  d="
                    M 111 245
                    C 107 230  101 218  95 216
                    C 88 213   87 205  93 204
                    C 100 202  110 210 114 222
                    C 116 232  118 240 111 245

                    M 111 245
                    C 105 228  98 200  107 168
                    C 114 145  124 132 143 126
                    C 155 122  172 114 183 108
                    C 210 94   227 80  229 78
                    C 218 72   192 68  170 74
                    C 145 81   130 102 120 118
                    C 110 132  109 148 114 162
                    C 120 178  128 192 118 210
                    C 113 220  107 230 111 245
                  "
                  fill="none"
                  stroke="url(#penGlow)"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#penBloom)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: {
                      duration: 0.58,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    opacity: { duration: 0.1 },
                  }}
                />

                {/* Ink dot — where the pen lifts off, a glowing terminus */}
                <motion.circle
                  cx="111"
                  cy="245"
                  r="4.5"
                  fill="white"
                  filter="url(#penBloom)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0.8], scale: [0, 1.4, 1] }}
                  transition={{ duration: 0.25, delay: 0.52 }}
                />
              </svg>
            </div>

            {/* Brand name — appears only after bloom */}
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={
                phase === "blooming"
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 6 }
              }
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-sm sm:text-base font-bold tracking-[0.24em] text-white uppercase antialiased"
            >
              Rishihood University
            </motion.h1>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
