"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  glowColor: string;
  alpha: number;
  active: boolean;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"materializing" | "charging" | "exploding" | "transition" | "done">("materializing");
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

  // High-tech native Web Audio API synthesizer
  const playSfx = useCallback((type: "charge" | "shatter" | "warp") => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      if (type === "charge") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 1.2);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.3);
      } else if (type === "shatter") {
        // High-frequency crystal shatter
        const bufferSize = Math.floor(ctx.sampleRate * 0.45);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(2400, now);
        filter.Q.setValueAtTime(4, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === "warp") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.9);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.95);
      }
    } catch {
      // Audio policies might block, ignore silently
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let startTime: number | null = null;
    let shatterPlayed = false;
    let warpPlayed = false;

    // Rich vibrant Neon Color Palette
    const NEON_CYAN = "#00F5FF";
    const NEON_BLUE = "#38BDF8";
    const NEON_MAGENTA = "#FF0055"; // Rishihood primary red in neon
    const NEON_PINK = "#FF2A6D";
    const NEON_GOLD = "#FFB800";
    const NEON_PURPLE = "#A855F7";
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

    // Initial audio charge
    setTimeout(() => playSfx("charge"), 150);

    // Build the high-tech holographic neon printer matrix
    const particles: NeonParticle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleStep = isMobile ? 4 : 3;

    // Render holographic vector printer to an offscreen canvas
    const offW = 320;
    const offH = 260;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = offW;
    offCanvas.height = offH;
    const offCtx = offCanvas.getContext("2d");

    if (offCtx) {
      offCtx.clearRect(0, 0, offW, offH);

      // Outer holographic shield card
      const cx = offW / 2;
      const cy = offH / 2;

      // Top paper feeder
      offCtx.fillStyle = NEON_CYAN;
      offCtx.beginPath();
      offCtx.roundRect(cx - 55, cy - 85, 110, 48, [8, 8, 0, 0]);
      offCtx.fill();

      // Paper neon data traces
      offCtx.fillStyle = NEON_WHITE;
      offCtx.fillRect(cx - 40, cy - 72, 80, 3.5);
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.fillRect(cx - 40, cy - 62, 60, 3);
      offCtx.fillStyle = NEON_CYAN;
      offCtx.fillRect(cx - 40, cy - 52, 70, 3);

      // Printer Chassis - sleek dark titanium with glowing neon contours
      offCtx.fillStyle = "#0A1128";
      offCtx.beginPath();
      offCtx.roundRect(cx - 95, cy - 40, 190, 84, 14);
      offCtx.fill();

      // Glowing Neon border
      offCtx.strokeStyle = NEON_CYAN;
      offCtx.lineWidth = 3.5;
      offCtx.beginPath();
      offCtx.roundRect(cx - 95, cy - 40, 190, 84, 14);
      offCtx.stroke();

      // Front Laser Scanner Slot
      offCtx.fillStyle = "#000814";
      offCtx.fillRect(cx - 80, cy + 2, 160, 14);

      // Neon LED Matrix / Status Screen
      offCtx.fillStyle = NEON_BLUE;
      offCtx.beginPath();
      offCtx.roundRect(cx - 80, cy - 28, 64, 20, 4);
      offCtx.fill();
      offCtx.fillStyle = NEON_WHITE;
      offCtx.fillRect(cx - 72, cy - 21, 35, 3.5);
      offCtx.fillRect(cx - 72, cy - 14, 22, 2.5);

      // Status indicator lights
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.beginPath();
      offCtx.arc(cx + 45, cy - 18, 5, 0, Math.PI * 2);
      offCtx.fill();

      offCtx.fillStyle = "#10B981"; // Emerald
      offCtx.beginPath();
      offCtx.arc(cx + 65, cy - 18, 5, 0, Math.PI * 2);
      offCtx.fill();

      // Output paper tray
      offCtx.fillStyle = NEON_WHITE;
      offCtx.beginPath();
      offCtx.roundRect(cx - 65, cy + 8, 130, 52, [0, 0, 8, 8]);
      offCtx.fill();

      // Printed vibrant holographic lines
      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.fillRect(cx - 50, cy + 22, 100, 4);
      offCtx.fillStyle = NEON_CYAN;
      offCtx.fillRect(cx - 50, cy + 32, 75, 3.5);
      offCtx.fillStyle = NEON_GOLD;
      offCtx.fillRect(cx - 50, cy + 42, 85, 3.5);

      // Rishihood University Gold Seal
      offCtx.fillStyle = NEON_GOLD;
      offCtx.beginPath();
      offCtx.arc(cx + 42, cy + 32, 8, 0, Math.PI * 2);
      offCtx.fill();

      // Typography at bottom
      offCtx.fillStyle = NEON_WHITE;
      offCtx.font = "bold 18px 'Poppins', -apple-system, sans-serif";
      offCtx.textAlign = "center";
      offCtx.fillText("RU PRINT PORTAL", cx, cy + 96);

      offCtx.fillStyle = NEON_MAGENTA;
      offCtx.font = "700 12px 'Poppins', -apple-system, sans-serif";
      offCtx.fillText("RISHIHOOD UNIVERSITY", cx, cy + 115);

      // Sample pixels
      const imgData = offCtx.getImageData(0, 0, offW, offH);
      const data = imgData.data;

      const scaleMultiplier = isMobile ? 1.6 : 2.1;
      const initialZ = 350;

      for (let y = 0; y < offH; y += particleStep) {
        for (let x = 0; x < offW; x += particleStep) {
          const index = (y * offW + x) * 4;
          const a = data[index + 3];

          if (a > 25) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const relX = (x - cx) * scaleMultiplier;
            const relY = (y - cy) * scaleMultiplier;

            // Explosion kinematics: outward radial burst + strong forward propulsion towards camera
            const angle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.45;
            const speed = Math.random() * 5 + 3.2;

            // Assign vibrant neon color based on source
            let glow = NEON_CYAN;
            if (r > 200 && g < 100) glow = NEON_MAGENTA;
            else if (r > 200 && g > 150 && b < 100) glow = NEON_GOLD;
            else if (r > 220 && g > 220 && b > 220) glow = NEON_WHITE;

            particles.push({
              x: relX,
              y: relY,
              z: initialZ,
              vx: Math.cos(angle) * speed * 2.2,
              vy: Math.sin(angle) * speed * 2.2,
              // vz accelerates forward towards user's eyes (negative Z)
              vz: -(Math.random() * 14 + 18),
              size: (particleStep + 0.5) * (Math.random() * 0.5 + 0.9),
              color: `rgb(${r}, ${g}, ${b})`,
              glowColor: glow,
              alpha: a / 255,
              active: true,
            });
          }
        }
      }
    }

    // Timeline tuning
    // 0.0s - 1.3s: Materialize with glowing neon laser scanline & aura
    // 1.3s - 1.5s: Energy charge-up pulse
    // 1.5s: Breaks into pixels & rushes towards screen / triggers page zoom
    // 1.5s - 2.8s: Warp speed pixel fly-through past camera
    // 2.3s - 2.8s: Background fades smoothly revealing zoomed-in portal
    // 2.9s: Done!
    const T_MATERIALIZE = 1.3;
    const T_EXPLODE = 1.5;
    const T_FADE_START = 2.2;
    const T_END = 2.9;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Deep space background with glowing neon radial aura
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, "#08132B");
      bgGrad.addColorStop(0.4, "#03081A");
      bgGrad.addColorStop(1, "#01030B");

      // Smooth background fade-out near completion
      let bgAlpha = 1;
      if (elapsed > T_FADE_START) {
        bgAlpha = Math.max(0, 1 - (elapsed - T_FADE_START) / (T_END - T_FADE_START));
      }

      if (bgAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Cyberpunk Neon Perspective Floor Grid
        ctx.strokeStyle = "rgba(0, 245, 255, 0.09)";
        ctx.lineWidth = 1;
        const horizon = centerY + 140;
        for (let i = -14; i <= 14; i++) {
          ctx.beginPath();
          ctx.moveTo(centerX + i * 40, horizon);
          ctx.lineTo(centerX + i * 240, height);
          ctx.stroke();
        }
        for (let gy = horizon; gy < height; gy += 24) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(width, gy);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Camera focal length
      const fov = 340;

      // ── PHASE 1: NEON PRINTER MATERIALIZATION & SCANNING (0.0s - 1.5s) ──
      if (elapsed < T_EXPLODE) {
        const appearProgress = Math.min(elapsed / 0.7, 1);
        const floatY = Math.sin(elapsed * 4) * 5;

        // Glowing Neon Ambient Halo behind printer
        const auraGrad = ctx.createRadialGradient(
          centerX,
          centerY + floatY,
          20,
          centerX,
          centerY + floatY,
          240
        );
        auraGrad.addColorStop(0, `rgba(0, 245, 255, ${0.45 * appearProgress})`);
        auraGrad.addColorStop(0.4, `rgba(255, 0, 85, ${0.25 * appearProgress})`);
        auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.save();
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY + floatY, 260, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Render intact neon particle matrix with high-intensity bloom
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

        // Horizontal Neon Laser Scanner Beam passing vertically
        if (elapsed > 0.25) {
          const scanProgress = ((elapsed - 0.25) * 1.4) % 1.0;
          const beamY = centerY - 140 + scanProgress * 280;

          // Glowing laser beam
          const beamGrad = ctx.createLinearGradient(centerX - 200, beamY, centerX + 200, beamY);
          beamGrad.addColorStop(0, "rgba(0, 245, 255, 0)");
          beamGrad.addColorStop(0.5, "rgba(0, 245, 255, 0.95)");
          beamGrad.addColorStop(1, "rgba(0, 245, 255, 0)");

          ctx.save();
          ctx.shadowColor = NEON_CYAN;
          ctx.shadowBlur = 18;
          ctx.fillStyle = beamGrad;
          ctx.fillRect(centerX - 200, beamY - 2.5, 400, 5);

          // Intense white core
          ctx.fillStyle = NEON_WHITE;
          ctx.fillRect(centerX - 100, beamY - 1, 200, 2);
          ctx.restore();
        }

        // Energy charge-up ring before exploding (1.3s - 1.5s)
        if (elapsed > T_MATERIALIZE) {
          const chargeProgress = (elapsed - T_MATERIALIZE) / (T_EXPLODE - T_MATERIALIZE);
          ctx.save();
          ctx.strokeStyle = NEON_MAGENTA;
          ctx.lineWidth = 3;
          ctx.shadowColor = NEON_MAGENTA;
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 150 * (1 - chargeProgress), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      // ── PHASE 2: PRINTER BREAKS INTO NEON PIXELS & FLIES TOWARDS US (1.5s - 2.8s) ──
      else if (elapsed >= T_EXPLODE && elapsed < T_END) {
        if (!shatterPlayed) {
          shatterPlayed = true;
          playSfx("shatter");
        }
        if (elapsed >= T_EXPLODE + 0.25 && !warpPlayed) {
          warpPlayed = true;
          playSfx("warp");
        }

        // Synchronize main page zoom as soon as explosion starts!
        if (!hasTriggeredZoom.current) {
          hasTriggeredZoom.current = true;
          if (onZoomStart) {
            onZoomStart();
          }
        }

        const explodeTime = elapsed - T_EXPLODE;

        // Render all neon pixels bursting forward into 3D towards the user
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;

          // Non-linear forward acceleration towards the screen
          const accel = 1 + Math.pow(explodeTime, 2.0) * 2.8;
          p.z += p.vz * accel;
          p.x += p.vx * accel * 0.75;
          p.y += p.vy * accel * 0.75;

          // Once particle shoots behind camera
          if (p.z <= -fov + 10) {
            p.active = false;
            continue;
          }

          // 3D Perspective Projection:
          // As z approaches -fov, depth becomes tiny, scale explodes towards the screen!
          const depth = Math.max(fov + p.z, 6);
          const scale = fov / depth;
          const px = centerX + p.x * scale;
          const py = centerY + p.y * scale;

          // Pixel size dramatically magnifies as it rushes into user's eyes
          const pSize = Math.max(p.size * scale, 2.5);

          // Calculate previous position to draw hyperdrive motion streaks
          const prevDepth = Math.max(fov + (p.z - p.vz * 1.8), 8);
          const prevScale = fov / prevDepth;
          const prevPx = centerX + p.x * prevScale;
          const prevPy = centerY + p.y * prevScale;

          const depthOpacity = Math.min(1, depth / 140);
          const fadeFactor = elapsed > T_FADE_START ? Math.max(0, 1 - (elapsed - T_FADE_START) / (T_END - T_FADE_START)) : 1;

          ctx.save();
          ctx.globalAlpha = p.alpha * depthOpacity * fadeFactor;

          // High-speed warp streaks pointing towards the user
          if (scale > 1.15) {
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = Math.min(scale * 4, 25);
            ctx.strokeStyle = p.glowColor;
            ctx.lineWidth = Math.min(pSize * 0.8, 12);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          // Bright neon core pixel
          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          // Brilliant white-hot center for particles zooming close to screen
          if (scale > 2.2) {
            ctx.fillStyle = NEON_WHITE;
            ctx.fillRect(px - pSize / 4, py - pSize / 4, pSize / 2, pSize / 2);
          }

          ctx.restore();
        }

        // Radiant warp bloom flash as pixels pass through screen
        if (explodeTime > 0.65) {
          const flashProgress = Math.min((explodeTime - 0.65) / 0.55, 1);
          const flashGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            20,
            centerX,
            centerY,
            Math.max(width, height)
          );
          flashGrad.addColorStop(0, `rgba(0, 245, 255, ${flashProgress * 0.45})`);
          flashGrad.addColorStop(0.5, `rgba(255, 0, 85, ${flashProgress * 0.35})`);
          flashGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.save();
          ctx.fillStyle = flashGrad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
      // ── PHASE 3: Seamless finish and reveal of portal ──
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
  }, [handleFinish, onZoomStart, playSfx]);

  if (isDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden"
      >
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
      </motion.div>
    </AnimatePresence>
  );
}
