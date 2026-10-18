"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  // Animation phases:
  // 0: "enter"       - Printer enters screen (0.0s - 0.5s)
  // 1: "printing"    - Paper feeds out with scanline & laser effect (0.5s - 1.4s)
  // 2: "eject_zoom"  - Paper lifts off printer and zooms forward to fill screen (1.4s - 2.2s)
  // 3: "morph"       - Paper morphs into the login card & hands off to live page (2.2s - 2.6s)
  const [phase, setPhase] = useState<"enter" | "printing" | "eject_zoom" | "morph">("enter");
  const [isSkipped, setIsSkipped] = useState(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: "power" | "feed" | "chime" | "whoosh") => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      if (type === "power") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "feed") {
        // High-tech printer mechanical paper feed sound
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          const t = now + i * 0.16;
          osc.frequency.setValueAtTime(280 + i * 40, t);
          osc.frequency.exponentialRampToValueAtTime(190, t + 0.12);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        }
      } else if (type === "chime") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === "whoosh") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {}
  };

  useEffect(() => {
    // 0.0s: Start with printer entry
    playSound("power");

    // 0.45s: Start printing paper
    const t1 = setTimeout(() => {
      setPhase("printing");
      playSound("feed");
    }, 450);

    // 1.35s: Paper ejects and begins zooming towards the screen
    const t2 = setTimeout(() => {
      setPhase("eject_zoom");
      playSound("chime");
    }, 1350);

    // 2.05s: Signal page container to start fading in live UI
    const t3 = setTimeout(() => {
      setPhase("morph");
      playSound("whoosh");
      onZoomStart?.();
    }, 2050);

    // 2.55s: Complete animation and unmount
    const t4 = setTimeout(() => {
      onComplete();
    }, 2550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleSkip = () => {
    setIsSkipped(true);
    onZoomStart?.();
    onComplete();
  };

  if (isSkipped) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090b10] overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-red-500/10 rounded-full blur-[80px]" />
      </div>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-50 text-[11px] font-mono text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-700/50 px-3 py-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer"
      >
        Skip intro &rarr;
      </button>

      {/* Main 3D Stage Container */}
      <div className="relative w-full max-w-lg h-[620px] flex items-center justify-center [perspective:1200px]">
        {/* ── THE PRINTER ── */}
        <motion.div
          initial={{ opacity: 0, y: 120, scale: 0.85 }}
          animate={
            phase === "enter"
              ? { opacity: 1, y: 20, scale: 0.95 }
              : phase === "printing"
              ? { opacity: 1, y: 20, scale: 0.95 }
              : phase === "eject_zoom"
              ? { opacity: 0.25, y: 80, scale: 0.8, filter: "blur(6px)" }
              : { opacity: 0, y: 140, scale: 0.7, filter: "blur(12px)" }
          }
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-[340px] sm:w-[380px] h-[210px] z-10 flex flex-col items-center"
        >
          {/* Printer Rear Paper Feed Stack */}
          <div className="absolute -top-10 w-44 h-12 bg-zinc-800/90 rounded-t-xl border-t border-x border-zinc-700/50 shadow-inner flex flex-col items-center pt-1.5">
            <div className="w-36 h-2 bg-zinc-900 rounded-sm" />
            <div className="w-32 h-1 bg-zinc-700/40 rounded-full mt-1.5" />
          </div>

          {/* Printer Main Top Body */}
          <div className="relative w-full h-[140px] bg-gradient-to-b from-zinc-800 via-zinc-850 to-zinc-900 rounded-2xl border border-zinc-700/60 shadow-2xl flex flex-col items-center justify-between p-3.5 overflow-hidden">
            {/* Top Gloss Edge Highlight */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-400/30 to-transparent" />

            {/* Printer Top Panel Details */}
            <div className="w-full flex items-center justify-between px-2 pt-0.5">
              {/* University Branding on Printer */}
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <span className="text-[10px] font-bold tracking-wider text-zinc-300 font-mono uppercase">
                  RU DIRECT PRINT
                </span>
              </div>

              {/* Status Display LED */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-zinc-700/50">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                />
                <span className="text-[9px] font-mono text-emerald-400 font-semibold tracking-tight">
                  ONLINE
                </span>
              </div>
            </div>

            {/* Paper Output Slot (Where page emerges!) */}
            <div className="relative w-[280px] sm:w-[310px] h-3.5 bg-zinc-950 rounded-full border border-zinc-900 shadow-inner flex items-center justify-center my-auto">
              <div className="w-full h-1 bg-black rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" />
              {/* Laser / roller slit glow */}
              <motion.div
                animate={
                  phase === "printing"
                    ? { opacity: [0.4, 0.9, 0.4] }
                    : { opacity: 0 }
                }
                transition={{ repeat: Infinity, duration: 0.6 }}
                className="absolute inset-0 bg-cyan-400/20 blur-[2px] rounded-full pointer-events-none"
              />
            </div>

            {/* Front Panel Accents */}
            <div className="w-full flex items-center justify-between px-2 text-[8.5px] font-mono text-zinc-500">
              <span>CLOUD SPOOLER v2.4</span>
              <span className="text-zinc-600">HIGH-SPEED DUPLEX</span>
            </div>
          </div>

          {/* Printer Base / Output Tray Lip */}
          <div className="w-[310px] sm:w-[350px] h-10 bg-zinc-900/95 rounded-b-2xl border-b border-x border-zinc-800 shadow-xl flex items-center justify-center">
            <div className="w-48 h-1.5 bg-zinc-950 rounded-full" />
          </div>

          {/* Cast Soft Shadow underneath */}
          <div className="w-[320px] sm:w-[360px] h-6 bg-black/60 blur-lg rounded-full mt-1" />
        </motion.div>

        {/* ── THE PRINTING & EXPANDING PAGE ── */}
        <motion.div
          initial={{
            y: 35,
            scale: 0.48,
            width: 270,
            height: 180,
            opacity: 0,
            rotateX: 28,
            borderRadius: "8px",
          }}
          animate={
            phase === "enter"
              ? {
                  y: 35,
                  scale: 0.48,
                  width: 270,
                  height: 180,
                  opacity: 0,
                  rotateX: 28,
                  borderRadius: "8px",
                }
              : phase === "printing"
              ? {
                  // Paper smoothly rolls UP and OUT of the slot
                  y: -55,
                  scale: 0.72,
                  width: 280,
                  height: 310,
                  opacity: 1,
                  rotateX: 14,
                  borderRadius: "12px",
                }
              : phase === "eject_zoom"
              ? {
                  // Paper lifts off, stands upright, and flies forward towards camera
                  y: 0,
                  scale: 1.0,
                  width: "100%",
                  maxWidth: 480,
                  height: 320,
                  opacity: 1,
                  rotateX: 0,
                  borderRadius: "16px",
                }
              : {
                  // Seamlessly lands exactly where PrintFlow card sits
                  y: 0,
                  scale: 1,
                  width: "100%",
                  maxWidth: 480,
                  height: 320,
                  opacity: 0,
                  rotateX: 0,
                  borderRadius: "16px",
                }
          }
          transition={
            phase === "printing"
              ? { duration: 0.9, ease: [0.25, 1, 0.5, 1] }
              : phase === "eject_zoom"
              ? { duration: 0.75, ease: [0.16, 1, 0.3, 1] }
              : { duration: 0.4, ease: "easeInOut" }
          }
          className="absolute z-20 overflow-hidden bg-card/95 border border-border/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col justify-between p-6 sm:p-8"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Laser Print Scanline Effect while printing */}
          {phase === "printing" && (
            <motion.div
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 0.85, ease: "linear" }}
              className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee,0_0_24px_#06b6d4] z-30 pointer-events-none"
            />
          )}

          {/* Watermark Texture Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Card Top Branding Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex flex-col items-center text-center gap-1.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <img
                src="/Rishihood_University_idxo_lfgcw_2.png"
                alt="RU Logo"
                className="h-8 w-8 object-contain"
              />
              <span className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase">
                Rishihood University
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Sign In to Print
            </h2>
          </motion.div>

          {/* Center: Google Sign-in Mock Button that aligns with live GoogleAuthStep */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="w-full flex justify-center py-2"
          >
            <div className="w-full max-w-sm h-12 rounded-xl bg-white text-zinc-800 border border-zinc-200 shadow-sm flex items-center justify-center gap-3 font-semibold text-xs sm:text-sm">
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
              <span>Sign in with Google</span>
            </div>
          </motion.div>

          {/* Footer of Printed Page */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.3 }}
            className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60 border-t border-border/40 pt-2"
          >
            <span>RU-DIRECT-STATION #01</span>
            <span>READY TO PRINT</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
