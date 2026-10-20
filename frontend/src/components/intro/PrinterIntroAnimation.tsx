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
    const tBloom = setTimeout(() => setPhase("blooming"), 700);
    const tZoom = setTimeout(() => {
      if (!hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        onZoomStart?.();
      }
      setPhase("exit");
    }, 1300);
    const tFinish = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, 1600);
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
          key="intro-overlay"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
          }}
          onClick={handleSkip}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000] select-none cursor-pointer overflow-hidden"
        >
          {/* Ambient crimson glow — blooms with shield */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={
                phase === "blooming"
                  ? { scale: 1.2, opacity: 0.22 }
                  : { scale: 0.6, opacity: 0 }
              }
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-[480px] h-[480px] rounded-full bg-[#CC0033] blur-[100px] transform-gpu"
            />
          </div>

          {/* Brand stage */}
          <div className="relative z-10 flex flex-col items-center gap-5">

            {/* Emblem area */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52">

              {/* Shield — blooms after stroke completes */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={
                  phase === "blooming"
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.88 }
                }
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <img
                  src="/Rishihood_University_idxo_lfgcw_2.png"
                  alt="Rishihood University"
                  className="w-full h-full object-contain drop-shadow-[0_12px_36px_rgba(204,0,51,0.5)] pointer-events-none"
                />
              </motion.div>

              {/* Bloom ring */}
              {phase === "blooming" && (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0.5 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-full border border-[#CC0033]/40 pointer-events-none"
                />
              )}

              {/*
                SVG Kinetic Pen Draw
                ONE continuous stroke tracing the Rishihood cursive 'r':
                  - Pen starts at the bottom tail (111, 230)
                  - Rises up through the body
                  - Sweeps right into the top arch/hat (229, 78)
                  - Comes back left to the hook shoulder (83, 114)
                  - Narrows back right into the body
                  - Descends the full tail to (111, 245)
                
                Key: single M command = one continuous path = correct pathLength animation
              */}
              <svg
                viewBox="50 60 155 200"
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  opacity: phase === "blooming" ? 0 : 1,
                  transition: "opacity 0.2s ease",
                }}
              >
                <defs>
                  <linearGradient id="inkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <stop offset="60%" stopColor="#FFD0DA" stopOpacity="1" />
                    <stop offset="100%" stopColor="#FF6B8A" stopOpacity="0.9" />
                  </linearGradient>
                  <filter id="inkGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/*
                  Single continuous pen stroke.
                  Tracing the 'r' skeleton from pixel analysis:
                  start at tail → rise through body → right arch top → left hook → body → tail
                */}
                <motion.path
                  d={`
                    M 111 245
                    C 108 225  102 200  108 168
                    C 112 148  124 132  143 126
                    C 158 121  172 114  185 107
                    C 210 94   227 80   229 78
                    C 220 70   196 67   172 74
                    C 148 81   128 101  118 119
                    C 110 132  109 148  113 162
                    C 118 178  128 196  118 213
                    C 113 225  107 235  111 245
                  `}
                  fill="none"
                  stroke="url(#inkGrad)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#inkGlow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: {
                      duration: 0.65,
                      ease: [0.22, 1, 0.36, 1],
                    },
                    opacity: { duration: 0.08 },
                  }}
                />
              </svg>
            </div>

            {/* University name — appears after bloom */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={
                phase === "blooming"
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
              }
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-[11px] sm:text-xs font-semibold tracking-[0.28em] text-white/85 uppercase"
            >
              Rishihood University
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
