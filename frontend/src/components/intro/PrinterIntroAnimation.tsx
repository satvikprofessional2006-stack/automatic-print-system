"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

interface NeonParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  streakColor: string;
  alpha: number;
  active: boolean;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Keep callback references stable to prevent any re-render from restarting the animation
  const onZoomStartRef = useRef(onZoomStart);
  const onCompleteRef = useRef(onComplete);
  const hasTriggeredZoom = useRef(false);
  const hasTriggeredFinish = useRef(false);

  useEffect(() => {
    onZoomStartRef.current = onZoomStart;
    onCompleteRef.current = onComplete;
  }, [onZoomStart, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let startTime: number | null = null;
    let audioPlayed = false;

    // Rich Vibrant Neon Palette
    const NEON_CYAN = "#00F5FF";
    const NEON_BLUE = "#38BDF8";
    const NEON_MAGENTA = "#FF0055"; // Rishihood primary red in neon
    const NEON_PINK = "#FF2A6D";
    const NEON_GOLD = "#FFB800";
    const NEON_WHITE = "#FFFFFF";

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

    // Subtle synthesizer Web Audio sound effects
    const playAudio = () => {
      if (audioPlayed) return;
      audioPlayed = true;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const actx = new AudioCtx();
        if (actx.state === "suspended") actx.resume();

        const now = actx.currentTime;
        // Warm sci-fi charge hum
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 1.2);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(now);
        osc.stop(now + 1.2);

        // Pixel shatter burst at 1.4s
        setTimeout(() => {
          try {
            const shNow = actx.currentTime;
            const bufferSize = Math.floor(actx.sampleRate * 0.35);
            const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = actx.createBufferSource();
            noise.buffer = buffer;
            const filter = actx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(2200, shNow);
            filter.Q.setValueAtTime(3.5, shNow);
            const nGain = actx.createGain();
            nGain.gain.setValueAtTime(0.08, shNow);
            nGain.gain.exponentialRampToValueAtTime(0.001, shNow + 0.35);
            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(actx.destination);
            noise.start(shNow);
          } catch {}
        }, 1350);
      } catch {}
    };

    playAudio();

    // Generate high-efficiency, stunning neon particle matrix
    const particles: NeonParticle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleStep = isMobile ? 6 : 5; // Optimal density: ~550 particles for locked 60fps!

    const offW = 300;
    const offH = 240;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = offW;
    offCanvas.height = offH;
    const offCtx = offCanvas.getContext("2d");

    if (offCtx) {
      offCtx.clearRect(0, 0, offW, offH);
      const cx = offW / 2;
      const cy = offH / 2;

      // Top paper feeder
      offCtx.fillStyle = NEON_CYAN;
      offCtx.beginPath();
      offCtx.roundRect(cx - 50, cy - 80, 100, 45, [6, 6, 0, 0]);
      offCtx.fill();

      // Paper neon data traces
      offCtx.fillStyle = NEON_WHITE;
      offCtx.fillRect(cx - 36, cy - 68, 72, 3);
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.fillRect(cx - 36, cy - 58, 55, 3);
      offCtx.fillStyle = NEON_CYAN;
      offCtx.fillRect(cx - 36, cy - 48, 64, 3);

      // Printer Chassis
      offCtx.fillStyle = "#0B1533";
      offCtx.beginPath();
      offCtx.roundRect(cx - 90, cy - 36, 180, 80, 12);
      offCtx.fill();

      // Glowing Neon border
      offCtx.strokeStyle = NEON_CYAN;
      offCtx.lineWidth = 3;
      offCtx.beginPath();
      offCtx.roundRect(cx - 90, cy - 36, 180, 80, 12);
      offCtx.stroke();

      // Front Slot
      offCtx.fillStyle = "#020714";
      offCtx.fillRect(cx - 75, cy + 4, 150, 12);

      // Neon LED Screen
      offCtx.fillStyle = NEON_BLUE;
      offCtx.beginPath();
      offCtx.roundRect(cx - 75, cy - 24, 60, 18, 4);
      offCtx.fill();
      offCtx.fillStyle = NEON_WHITE;
      offCtx.fillRect(cx - 68, cy - 18, 30, 3);
      offCtx.fillRect(cx - 68, cy - 12, 20, 2);

      // Status indicator lights
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.beginPath();
      offCtx.arc(cx + 45, cy - 15, 4.5, 0, Math.PI * 2);
      offCtx.fill();

      offCtx.fillStyle = "#10B981";
      offCtx.beginPath();
      offCtx.arc(cx + 62, cy - 15, 4.5, 0, Math.PI * 2);
      offCtx.fill();

      // Output paper tray
      offCtx.fillStyle = NEON_WHITE;
      offCtx.beginPath();
      offCtx.roundRect(cx - 60, cy + 10, 120, 48, [0, 0, 6, 6]);
      offCtx.fill();

      // Printed vibrant holographic lines
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.fillRect(cx - 48, cy + 22, 96, 3.5);
      offCtx.fillStyle = NEON_CYAN;
      offCtx.fillRect(cx - 48, cy + 32, 70, 3);
      offCtx.fillStyle = NEON_GOLD;
      offCtx.fillRect(cx - 48, cy + 42, 80, 3);

      // Rishihood University Gold Seal
      offCtx.fillStyle = NEON_GOLD;
      offCtx.beginPath();
      offCtx.arc(cx + 40, cy + 32, 7, 0, Math.PI * 2);
      offCtx.fill();

      // Typography
      offCtx.fillStyle = NEON_WHITE;
      offCtx.font = "bold 17px -apple-system, sans-serif";
      offCtx.textAlign = "center";
      offCtx.fillText("RU PRINT PORTAL", cx, cy + 92);

      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.font = "700 11px -apple-system, sans-serif";
      offCtx.fillText("RISHIHOOD UNIVERSITY", cx, cy + 110);

      const imgData = offCtx.getImageData(0, 0, offW, offH);
      const data = imgData.data;

      const scaleMultiplier = isMobile ? 1.6 : 2.0;
      const initialZ = 340;

      for (let y = 0; y < offH; y += particleStep) {
        for (let x = 0; x < offW; x += particleStep) {
          const index = (y * offW + x) * 4;
          const a = data[index + 3];

          if (a > 30) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const relX = (x - cx) * scaleMultiplier;
            const relY = (y - cy) * scaleMultiplier;

            const angle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.4;
            const speed = Math.random() * 4 + 2.5;

            let streak = NEON_CYAN;
            if (r > 190 && g < 100) streak = NEON_MAGENTA;
            else if (r > 190 && g > 140 && b < 100) streak = NEON_GOLD;
            else if (r > 200 && g > 200 && b > 200) streak = NEON_WHITE;

            particles.push({
              x: relX,
              y: relY,
              z: initialZ,
              vx: Math.cos(angle) * speed * 2.0,
              vy: Math.sin(angle) * speed * 2.0,
              // Smooth forward velocity towards screen
              vz: -(Math.random() * 14 + 18),
              size: particleStep * 0.9,
              color: `rgb(${r}, ${g}, ${b})`,
              streakColor: streak,
              alpha: a / 255,
              active: true,
            });
          }
        }
      }
    }

    // Single deterministic timeline:
    // 0.0s - 1.4s: Materialize & scan (runs ONCE!)
    // 1.4s: Disintegration starts & triggers main page zoom
    // 1.4s - 2.5s: Pixels accelerate forward towards camera (buttery 60fps, zero lag!)
    // 2.0s - 2.5s: Background fades out seamlessly
    // 2.6s: Complete!
    const T_EXPLODE = 1.4;
    const T_FADE_START = 2.0;
    const T_FINISH = 2.6;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Deep space background with neon radial glow
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, "#08132B");
      bgGrad.addColorStop(0.4, "#03081A");
      bgGrad.addColorStop(1, "#01030B");

      let bgAlpha = 1;
      if (elapsed > T_FADE_START) {
        bgAlpha = Math.max(0, 1 - (elapsed - T_FADE_START) / (T_FINISH - T_FADE_START));
      }

      if (bgAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Perspective grid lines
        ctx.strokeStyle = "rgba(0, 245, 255, 0.08)";
        ctx.lineWidth = 1;
        const horizon = centerY + 130;
        for (let i = -12; i <= 12; i++) {
          ctx.beginPath();
          ctx.moveTo(centerX + i * 40, horizon);
          ctx.lineTo(centerX + i * 220, height);
          ctx.stroke();
        }
        ctx.restore();
      }

      const fov = 340;

      // ── PHASE 1: PRINTER MATERIALIZES & SCANS (0.0s - 1.4s) ──
      if (elapsed < T_EXPLODE) {
        const appearProgress = Math.min(elapsed / 0.55, 1);
        const floatY = Math.sin(elapsed * 4) * 4;

        // Ambient neon aura
        const auraGrad = ctx.createRadialGradient(
          centerX,
          centerY + floatY,
          20,
          centerX,
          centerY + floatY,
          200
        );
        auraGrad.addColorStop(0, `rgba(0, 245, 255, ${0.4 * appearProgress})`);
        auraGrad.addColorStop(0.5, `rgba(255, 0, 85, ${0.2 * appearProgress})`);
        auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.save();
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY + floatY, 220, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Render intact particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const scale = fov / (fov + p.z);
          const px = centerX + p.x * scale;
          const py = centerY + (p.y + floatY) * scale;
          const pSize = Math.max(p.size * scale, 1.4);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * appearProgress;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);
        }

        // Single smooth vertical laser scan beam (sweeps down strictly ONCE from top to bottom)
        if (elapsed > 0.25 && elapsed < T_EXPLODE) {
          const scanProgress = Math.min((elapsed - 0.25) / (T_EXPLODE - 0.35), 1.0);
          const beamY = centerY - 130 + scanProgress * 260;

          const beamGrad = ctx.createLinearGradient(centerX - 180, beamY, centerX + 180, beamY);
          beamGrad.addColorStop(0, "rgba(0, 245, 255, 0)");
          beamGrad.addColorStop(0.5, "rgba(0, 245, 255, 0.95)");
          beamGrad.addColorStop(1, "rgba(0, 245, 255, 0)");

          ctx.save();
          ctx.fillStyle = beamGrad;
          ctx.fillRect(centerX - 180, beamY - 2, 360, 4);
          ctx.fillStyle = NEON_WHITE;
          ctx.fillRect(centerX - 80, beamY - 1, 160, 2);
          ctx.restore();
        }
      }
      // ── PHASE 2: BREAKS INTO PIXELS & FLIES TOWARDS US (1.4s - 2.6s) ──
      // Ultra-optimized with hardware Additive Blending: NO lagging!
      else if (elapsed >= T_EXPLODE && elapsed < T_FINISH) {
        // Trigger main page zoom in once
        if (!hasTriggeredZoom.current) {
          hasTriggeredZoom.current = true;
          if (onZoomStartRef.current) {
            onZoomStartRef.current();
          }
        }

        const explodeTime = elapsed - T_EXPLODE;

        // Enable high-performance native Additive Blending (Instant neon glow with zero lag!)
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const fadeFactor = elapsed > T_FADE_START ? Math.max(0, 1 - (elapsed - T_FADE_START) / (T_FINISH - T_FADE_START)) : 1;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;

          // Smooth exponential forward acceleration
          const accel = 1 + explodeTime * 3.4;
          p.z += p.vz * accel;
          p.x += p.vx * accel * 0.75;
          p.y += p.vy * accel * 0.75;

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

          // Fast streak calculation
          const prevDepth = Math.max(fov + (p.z - p.vz * 1.6), 8);
          const prevScale = fov / prevDepth;
          const prevPx = centerX + p.x * prevScale;
          const prevPy = centerY + p.y * prevScale;

          const depthOpacity = Math.min(1, depth / 130);
          ctx.globalAlpha = p.alpha * depthOpacity * fadeFactor;

          // Motion streak trail (neon laser line towards viewer)
          if (scale > 1.2) {
            ctx.strokeStyle = p.streakColor;
            ctx.lineWidth = Math.min(pSize * 0.8, 10);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          // Central bright neon pixel
          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          // Brilliant white hot-core for pixels zooming close
          if (scale > 2.2) {
            ctx.fillStyle = NEON_WHITE;
            ctx.fillRect(px - pSize / 4, py - pSize / 4, pSize / 2, pSize / 2);
          }
        }

        ctx.restore();
      }
      // ── PHASE 3: FINISH ──
      else {
        if (!hasTriggeredFinish.current) {
          hasTriggeredFinish.current = true;
          try {
            localStorage.setItem("ru_portal_intro_shown", "true");
          } catch {}
          setIsDone(true);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }
        return;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []); // Empty dependency array: NEVER restarts mid-animation!

  if (isDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden"
      >
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
      </motion.div>
    </AnimatePresence>
  );
}
