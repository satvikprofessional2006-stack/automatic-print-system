"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const [phase, setPhase] = useState<"loading" | "exit">("loading");
  const hasTriggeredZoom = useRef(false);
  const hasCompleted = useRef(false);

  // Finish and dismiss immediately
  const handleSkip = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    if (!hasTriggeredZoom.current) {
      hasTriggeredZoom.current = true;
      onZoomStart?.();
    }
    setPhase("exit");
    setTimeout(() => {
      onComplete();
    }, 250);
  }, [onZoomStart, onComplete]);

  // Keyboard shortcut: Esc / Space / Enter to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  // Hardware-timed progression sequence
  useEffect(() => {
    // Trigger portal reveal slightly before intro fades out
    const zoomTimer = setTimeout(() => {
      if (!hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        onZoomStart?.();
      }
      setPhase("exit");
    }, 1450);

    // Complete and unmount cleanly
    const finishTimer = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, 1850);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(finishTimer);
    };
  }, [onZoomStart, onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" ? (
        <motion.div
          key="intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          onClick={handleSkip}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030611] text-foreground select-none cursor-pointer overflow-hidden"
        >
          {/* Ambient Lighting / Brand Aura */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Soft crimson/rose ambient blur */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full bg-gradient-to-tr from-rose-600/20 via-rose-500/10 to-transparent blur-[110px] pointer-events-none" />
            {/* Subtle radial dot grid */}
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
          </div>


          {/* Center Brand Container */}
          <div className="relative z-10 flex flex-col items-center text-center px-4">
            {/* Glassmorphic Logo Shield */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center mb-6"
            >
              {/* Outer soft glowing halo */}
              <div className="absolute inset-0 -m-3 rounded-3xl bg-rose-500/15 blur-xl pointer-events-none" />

              {/* Card Container */}
              <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/15 shadow-2xl shadow-black/60 backdrop-blur-md">
                <img
                  src="/Rishihood_University_idxo_lfgcw_2.png"
                  alt="Rishihood University"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md select-none pointer-events-none"
                />

                {/* Micro top-edge reflection */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              </div>
            </motion.div>

            {/* Pure Brand Name */}
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="text-sm sm:text-base font-bold tracking-[0.26em] text-white uppercase drop-shadow-xs mb-6"
            >
              Rishihood University
            </motion.h1>

            {/* 100% GPU-Accelerated Hardware Progress Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="w-48 sm:w-56 h-[2px] bg-white/[0.08] rounded-full overflow-hidden relative"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 1.35,
                  delay: 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="h-full w-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300 rounded-full origin-left shadow-[0_0_10px_rgba(244,63,94,0.7)] will-change-transform"
              />
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
