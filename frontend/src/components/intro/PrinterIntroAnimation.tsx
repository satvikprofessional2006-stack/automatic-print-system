"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer } from "lucide-react";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  active: boolean;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [cardVisible, setCardVisible] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const hasTriggeredZoom = useRef(false);

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem("ru_portal_intro_shown", "true");
    } catch {
      // ignore
    }
    setIsDone(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let startTime: number | null = null;

    const isDark = document.documentElement.classList.contains("dark");
    const bgColor = isDark ? "#1F1F1F" : "#FFEDD2";
    const primaryRed = "#CC0033";
    const white = "#FFFFFF";
    const cardBgColor = isDark ? "#2A2A2A" : "#FFFFFF";
    const slateDark = isDark ? "#151515" : "#1E293B";

    const updateDimensions = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    // Timeline constants
    const T_BREAK = 1.2;       // When card dissolves into pixels
    const T_ZOOM = 1.35;      // When main page starts zooming in
    const T_FADE = 2.2;       // When canvas background starts fading to reveal site
    const T_FINISH = 2.8;     // Total animation end

    // Build particle matrix from card dimensions
    const spawnParticles = () => {
      const isMobile = window.innerWidth < 768;
      const cardW = isMobile ? 270 : 330;
      const cardH = isMobile ? 180 : 210;
      const step = isMobile ? 5 : 4;
      const numX = Math.floor(cardW / step);
      const numY = Math.floor(cardH / step);

      particles = [];

      for (let iy = 0; iy < numY; iy++) {
        for (let ix = 0; ix < numX; ix++) {
          const localX = (ix - numX / 2) * step;
          const localY = (iy - numY / 2) * step;

          let pColor = cardBgColor;

          // Top red accent bar
          if (iy < 3) {
            pColor = primaryRed;
          }
          // Center printer area
          else if (iy >= 7 && iy <= 19 && ix >= numX * 0.25 && ix <= numX * 0.75) {
            if (iy <= 11 && ix >= numX * 0.38 && ix <= numX * 0.62) {
              pColor = white;
            } else if (iy >= 15 && ix >= numX * 0.35 && ix <= numX * 0.65) {
              pColor = iy === 16 ? primaryRed : white;
            } else {
              pColor = slateDark;
            }
          }
          // Typography region
          else if (iy > 25 && iy < 35 && Math.random() < 0.65) {
            pColor = primaryRed;
          }

          const angle = Math.atan2(localY, localX) + (Math.random() - 0.5) * 0.4;
          const speed = Math.random() * 3.5 + 2.0;

          particles.push({
            x: localX,
            y: localY,
            z: 0,
            vx: Math.cos(angle) * speed * 1.6,
            vy: Math.sin(angle) * speed * 1.6,
            // Forward velocity towards camera
            vz: -(Math.random() * 7 + 8),
            size: step * (Math.random() * 0.4 + 0.8),
            color: pColor,
            alpha: 1,
            active: true,
          });
        }
      }
    };

    spawnParticles();

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Background fade out near end
      let bgAlpha = 1;
      if (elapsed > T_FADE) {
        bgAlpha = Math.max(0, 1 - (elapsed - T_FADE) / (T_FINISH - T_FADE));
      }

      if (bgAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // Hide DOM card right when particles take over
      if (elapsed >= T_BREAK && cardVisible) {
        setCardVisible(false);
      }

      // Trigger main page small-to-large zoom
      if (elapsed >= T_ZOOM && !hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        if (onZoomStart) {
          onZoomStart();
        }
      }

      // PIXELS BREAK & RUSH FORWARD TOWARDS SCREEN
      if (elapsed >= T_BREAK && elapsed < T_FINISH) {
        const explodeTime = elapsed - T_BREAK;
        const fov = 320;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;

          // Smooth quadratic forward acceleration
          const accel = 1 + Math.pow(explodeTime, 1.8) * 2.2;
          p.z += p.vz * accel;
          p.x += p.vx * accel * 0.7;
          p.y += p.vy * accel * 0.7;

          // Passes behind camera
          if (p.z <= -fov + 10) {
            p.active = false;
            continue;
          }

          // 3D Perspective Projection
          const depth = Math.max(fov + p.z, 6);
          const scale = fov / depth;
          const px = centerX + p.x * scale;
          const py = centerY + p.y * scale;

          const pSize = Math.max(p.size * scale, 2);

          // Warp streak calculation
          const prevDepth = Math.max(fov + (p.z - p.vz * 1.6), 8);
          const prevScale = fov / prevDepth;
          const prevPx = centerX + p.x * prevScale;
          const prevPy = centerY + p.y * prevScale;

          const depthOpacity = Math.min(1, depth / 130);
          const fadeFactor = elapsed > T_FADE ? Math.max(0, 1 - (elapsed - T_FADE) / (T_FINISH - T_FADE)) : 1;

          ctx.save();
          ctx.globalAlpha = depthOpacity * fadeFactor;

          if (scale > 1.15) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.min(pSize * 0.75, 8);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          ctx.restore();
        }
      }

      if (elapsed >= T_FINISH) {
        handleFinish();
        return;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [handleFinish, onZoomStart, cardVisible]);

  if (isDone) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none select-none flex items-center justify-center overflow-hidden">
      {/* 3D Pixel Disintegration Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* 
        Crisp DOM Card:
        Perfect 1:1 match with RU Print Portal design tokens (Tailwind, Poppins, Rishihood Red).
        Floats gently for 1.2s, then dissolves right as the canvas particles explode!
      */}
      <AnimatePresence>
        {cardVisible && (
          <motion.div
            ref={cardRef}
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: [0, -5, 0],
            }}
            exit={{ scale: 1.08, opacity: 0 }}
            transition={{
              duration: 0.5,
              y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
            }}
            className="relative z-10 w-[270px] sm:w-[330px] p-6 rounded-2xl bg-card text-card-foreground border border-border/80 shadow-2xl flex flex-col items-center text-center"
          >
            {/* Top Rishihood Red Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#CC0033] rounded-t-2xl" />

            {/* Printer Graphic */}
            <div className="relative mt-2 mb-4 flex items-center justify-center">
              {/* Paper feed sheet */}
              <div className="absolute -top-3 w-16 h-8 bg-background border border-border/70 rounded-t-md flex flex-col items-center pt-1 gap-0.5">
                <div className="w-10 h-0.5 bg-[#CC0033]" />
                <div className="w-8 h-0.5 bg-muted-foreground/40" />
              </div>

              {/* Printer Body */}
              <div className="relative z-10 w-24 h-14 rounded-lg bg-slate-900 dark:bg-zinc-900 border border-slate-700/60 shadow-md flex flex-col items-center justify-between p-1.5">
                <div className="w-full flex items-center justify-between px-1">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#CC0033] animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {/* Output slot */}
                <div className="w-20 h-2 bg-black/60 rounded-xs" />

                {/* Printed paper output */}
                <div className="w-16 h-3 bg-white rounded-b-xs shadow-xs flex items-center justify-center">
                  <div className="w-10 h-0.5 bg-[#CC0033]" />
                </div>
              </div>
            </div>

            {/* Typography */}
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              RU Print Portal
            </h2>
            <p className="text-xs font-semibold text-[#CC0033] mt-0.5">
              Rishihood University
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
