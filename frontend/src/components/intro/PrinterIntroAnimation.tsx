"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    const startTime = performance.now();

    // RU Design tokens
    const isDark = document.documentElement.classList.contains("dark");
    const bgColor = isDark ? "#1F1F1F" : "#FFEDD2";
    const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
    const cardBorder = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
    const textColor = isDark ? "#FFEDD2" : "#191919";
    const primaryRed = "#CC0033"; // Official Rishihood Red

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

    // Particle pool for the disintegration
    const particles: Particle[] = [];
    const isMobile = window.innerWidth < 768;
    const cardW = isMobile ? 260 : 330;
    const cardH = isMobile ? 180 : 215;

    // Create particles mapped to the card geometry
    const step = isMobile ? 5 : 4;
    const numX = Math.floor(cardW / step);
    const numY = Math.floor(cardH / step);

    for (let iy = 0; iy < numY; iy++) {
      for (let ix = 0; ix < numX; ix++) {
        const localX = (ix - numX / 2) * step;
        const localY = (iy - numY / 2) * step;

        let pColor = cardBg;

        // Top red accent bar
        if (iy < 3) {
          pColor = primaryRed;
        }
        // Printer body area in center
        else if (iy >= 7 && iy <= 19 && ix >= numX * 0.25 && ix <= numX * 0.75) {
          if (iy <= 11 && ix >= numX * 0.38 && ix <= numX * 0.62) {
            // Paper entering slot
            pColor = isDark ? "#E2E8F0" : "#FFFFFF";
          } else if (iy >= 15 && ix >= numX * 0.35 && ix <= numX * 0.65) {
            // Paper exit tray with red print stripe
            pColor = iy === 16 ? primaryRed : (isDark ? "#F8FAFC" : "#FFFFFF");
          } else {
            // Printer chassis
            pColor = isDark ? "#151515" : "#1E293B";
          }
        }
        // Logo / text region
        else if (iy > 25 && iy < 34 && Math.random() < 0.6) {
          pColor = primaryRed;
        }

        // Moderate outward drift + forward acceleration towards camera
        const angle = Math.atan2(localY, localX) + (Math.random() - 0.5) * 0.4;
        const speed = Math.random() * 3.5 + 2.0;

        particles.push({
          x: localX,
          y: localY,
          z: 0,
          vx: Math.cos(angle) * speed * 1.5,
          vy: Math.sin(angle) * speed * 1.5,
          // Slower, graceful forward speed (negative Z moves towards screen)
          vz: -(Math.random() * 7 + 8),
          size: step * (Math.random() * 0.4 + 0.8),
          color: pColor,
          alpha: 1,
          active: true,
        });
      }
    }

    // Pacing Timeline (Smooth & Cinematic)
    // 0.0s - 1.2s: Printer materializes and hovers cleanly
    // 1.2s - 1.4s: Begins dividing into pixels
    // 1.4s: onZoomStart() -> First page starts scaling from small to large
    // 1.4s - 2.8s: Pixels accelerate forward towards screen, flying past viewer
    // 2.3s - 2.8s: Canvas background smoothly fades to transparent so the zoomed page is revealed
    // 2.9s: Finish & unmount
    const T_APPEAR = 1.2;
    const T_ZOOM_TRIGGER = 1.4;
    const T_FADE_START = 2.2;
    const T_END = 2.9;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Canvas background opacity (fades out near the end to seamlessly reveal the zoomed main page)
      let canvasBgAlpha = 1;
      if (elapsed > T_FADE_START) {
        canvasBgAlpha = Math.max(0, 1 - (elapsed - T_FADE_START) / (T_END - T_FADE_START));
      }

      if (canvasBgAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = canvasBgAlpha;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // Trigger main page zoom right as disintegration starts
      if (elapsed >= T_ZOOM_TRIGGER && !hasTriggeredZoom.current) {
        hasTriggeredZoom.current = true;
        if (onZoomStart) {
          onZoomStart();
        }
      }

      // ── PHASE 1: Crisp Card Materializes & Hovers (0.0s - 1.2s) ──
      if (elapsed < T_APPEAR) {
        const progress = Math.min(elapsed / 0.6, 1);
        // Smooth easing in
        const easeScale = 0.85 + 0.15 * Math.sin(progress * Math.PI * 0.5);
        const floatY = Math.sin(elapsed * 3.5) * 4;

        ctx.save();
        ctx.translate(centerX, centerY + floatY);
        ctx.scale(easeScale, easeScale);
        ctx.globalAlpha = progress;

        // Card Shadow
        ctx.shadowColor = isDark ? "rgba(0,0,0,0.5)" : "rgba(180,100,50,0.12)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 12;

        // Main Card Body
        ctx.fillStyle = cardBg;
        ctx.beginPath();
        ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
        ctx.fill();

        ctx.shadowColor = "transparent";

        // Border
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
        ctx.stroke();

        // Top Rishihood Red Accent Bar
        ctx.fillStyle = primaryRed;
        ctx.beginPath();
        ctx.roundRect(-cardW / 2, -cardH / 2, cardW, 6, [20, 20, 0, 0]);
        ctx.fill();

        // ── Minimalist RU Printer Graphic ──
        const py = -24;

        // Input paper
        ctx.fillStyle = isDark ? "#E2E8F0" : "#F8FAFC";
        ctx.beginPath();
        ctx.roundRect(-36, py - 38, 72, 32, [4, 4, 0, 0]);
        ctx.fill();
        ctx.fillStyle = primaryRed;
        ctx.fillRect(-28, py - 30, 56, 3);
        ctx.fillStyle = isDark ? "#94A3B8" : "#CBD5E1";
        ctx.fillRect(-28, py - 24, 42, 2.5);

        // Printer Chassis
        ctx.fillStyle = isDark ? "#171717" : "#1E293B";
        ctx.beginPath();
        ctx.roundRect(-60, py - 10, 120, 48, 8);
        ctx.fill();

        // Printer slot
        ctx.fillStyle = isDark ? "#080808" : "#0F172A";
        ctx.fillRect(-46, py + 12, 92, 8);

        // Output paper sliding out
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(-38, py + 16, 76, 26, [0, 0, 4, 4]);
        ctx.fill();
        ctx.fillStyle = primaryRed;
        ctx.fillRect(-30, py + 24, 48, 2.5);
        ctx.fillStyle = "#94A3B8";
        ctx.fillRect(-30, py + 30, 34, 2);

        // Status LEDs
        ctx.fillStyle = primaryRed;
        ctx.beginPath();
        ctx.arc(-42, py + 2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        ctx.arc(-32, py + 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // ── Typography ──
        ctx.fillStyle = textColor;
        ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Poppins', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("RU Print Portal", 0, cardH / 2 - 38);

        ctx.fillStyle = primaryRed;
        ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Poppins', sans-serif";
        ctx.fillText("Rishihood University", 0, cardH / 2 - 20);

        ctx.restore();
      }
      // ── PHASE 2: PIXELS DISINTEGRATE & RUSH TOWARDS US (1.2s - 2.8s) ──
      else if (elapsed >= T_APPEAR && elapsed < T_END) {
        const explodeTime = elapsed - T_APPEAR;
        const fov = 320;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;

          // Slower, smooth quadratic forward acceleration
          const accel = 1 + Math.pow(explodeTime, 1.8) * 2.2;
          p.z += p.vz * accel;
          p.x += p.vx * accel * 0.7;
          p.y += p.vy * accel * 0.7;

          // Once particle passes behind camera/eyes
          if (p.z <= -fov + 10) {
            p.active = false;
            continue;
          }

          // 3D Perspective Projection:
          const depth = Math.max(fov + p.z, 6);
          const scale = fov / depth;
          const px = centerX + p.x * scale;
          const py = centerY + p.y * scale;

          const pSize = Math.max(p.size * scale, 2);

          // Warp streak toward camera
          const prevDepth = Math.max(fov + (p.z - p.vz * 1.6), 8);
          const prevScale = fov / prevDepth;
          const prevPx = centerX + p.x * prevScale;
          const prevPy = centerY + p.y * prevScale;

          // Overall particle fade out synchronized with transition
          const depthOpacity = Math.min(1, depth / 120);
          const fadeOutFactor = elapsed > T_FADE_START ? Math.max(0, 1 - (elapsed - T_FADE_START) / (T_END - T_FADE_START)) : 1;

          ctx.save();
          ctx.globalAlpha = depthOpacity * fadeOutFactor;

          // Motion streak trail
          if (scale > 1.15) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.min(pSize * 0.75, 8);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          // Pixel fragment
          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          ctx.restore();
        }
      }
      // ── PHASE 3: Finish & Complete ──
      else {
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
  }, [handleFinish, onZoomStart]);

  if (isDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden"
      >
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
      </motion.div>
    </AnimatePresence>
  );
}
