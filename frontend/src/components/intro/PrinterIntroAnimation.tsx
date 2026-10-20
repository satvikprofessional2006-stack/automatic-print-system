"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const [phase, setPhase] = useState<"enter" | "exit">("enter");
  const hasTriggeredZoom = useRef(false);
  const hasCompleted = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Instant dismissal — tap or keyboard
  const handleSkip = useCallback(() => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    if (!hasTriggeredZoom.current) {
      hasTriggeredZoom.current = true;
      onZoomStart?.();
    }
    setPhase("exit");
    setTimeout(onComplete, 300);
  }, [onZoomStart, onComplete]);

  // Keyboard accessibility
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") handleSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSkip]);

  // If user prefers reduced motion — skip immediately after one frame
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const t = setTimeout(handleSkip, 0);
    return () => clearTimeout(t);
  }, [prefersReducedMotion, handleSkip]);

  // Cinematic timeline
  // 0        –  250ms  : emblem emerges (scale + opacity enter)
  // 250      –  850ms  : specular sweep  (delay 0.25s in animation props)
  // 500      –  950ms  : wordmark fades in (delay 0.5s)
  // 950      – 1200ms  : hold — composition lands quietly
  // 1200     – 1500ms  : forward scale exit + portal reveal
  useEffect(() => {
    // 1200ms: begin portal reveal + exit
    const tZoom = setTimeout(() => {
      if (!hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        onZoomStart?.();
      }
      setPhase("exit");
    }, 1200);

    // 1500ms: clean unmount after exit animation
    const tFinish = setTimeout(() => {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, 1500);

    return () => {
      clearTimeout(tZoom);
      clearTimeout(tFinish);
    };
  }, [onZoomStart, onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          key="ru-brand-ident"
          role="presentation"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          }}
          onClick={handleSkip}
          style={{ willChange: "opacity, transform" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none cursor-pointer overflow-hidden"
        >
          {/* ── Crimson ambient depth glow ── */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              className="rounded-full transform-gpu"
              style={{
                width: 480,
                height: 480,
                background:
                  "radial-gradient(circle, rgba(204,0,51,0.13) 0%, rgba(204,0,51,0.04) 55%, transparent 75%)",
                filter: "blur(48px)",
              }}
            />
          </div>

          {/* ── Brand composition ── */}
          <div className="relative z-10 flex flex-col items-center gap-7 px-6">

            {/* Shield emblem — emerges 0–250ms */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: "opacity, transform" }}
              className="relative"
            >
              {/*
                Clip container: overflow-hidden keeps the specular sweep
                from spilling outside the emblem bounds.
              */}
              <div className="relative overflow-hidden" style={{ borderRadius: 14 }}>
                <img
                  src="/Rishihood_University_idxo_lfgcw_2.png"
                  alt="Rishihood University"
                  draggable={false}
                  className="block select-none pointer-events-none"
                  style={{
                    width: "clamp(80px, 14vw, 112px)",
                    height: "clamp(80px, 14vw, 112px)",
                    objectFit: "contain",
                    filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.85))",
                  }}
                />

                {/*
                  Specular sheen: a narrow angled highlight strip sweeps
                  left-to-right across the shield surface (250–850ms).
                  mix-blend-overlay gives it proper metallic surface quality —
                  it brightens the orange/crimson areas and white "r" differently,
                  reading as genuine reflected light rather than a flat tint.
                */}
                <motion.div
                  aria-hidden="true"
                  initial={{ x: "-110%" }}
                  animate={{ x: "210%" }}
                  transition={{
                    duration: 0.62,
                    delay: 0.25,
                    ease: [0.4, 0, 0.25, 1],
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "55%",
                    pointerEvents: "none",
                    willChange: "transform",
                    background:
                      "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)",
                    mixBlendMode: "overlay",
                    transform: "skewX(-14deg)",
                  }}
                />
              </div>
            </motion.div>

            {/* Wordmark — fades in 500–950ms */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                willChange: "opacity, transform",
                fontFamily: "inherit",
                fontSize: "clamp(10px, 1.5vw, 13px)",
                fontWeight: 600,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                lineHeight: 1,
                color: "white",
              }}
              aria-label="Rishihood University"
            >
              Rishihood University
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
