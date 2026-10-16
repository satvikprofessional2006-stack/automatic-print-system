"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FastForward } from "lucide-react";

interface PrinterIntroProps {
  onComplete: () => void;
  autoPlayAudio?: boolean;
}

interface PixelParticle {
  // 3D coordinates relative to center
  x: number;
  y: number;
  z: number;
  // Velocity in 3D
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  active: boolean;
}

export function PrinterIntroAnimation({ onComplete, autoPlayAudio = true }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<"appear" | "scanning" | "exploding" | "transition" | "done">("appear");
  const [isSkipped, setIsSkipped] = useState(false);
  const [statusText, setStatusText] = useState("INITIALIZING RU PRINT PORTAL...");

  const handleFinish = useCallback(() => {
    try {
      sessionStorage.setItem("ru_intro_seen", "true");
    } catch {
      // ignore
    }
    onComplete();
  }, [onComplete]);

  // Subtle sci-fi sound effects synthesized natively via Web Audio API
  const playSfx = useCallback((type: "hum" | "shatter" | "warp") => {
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
      if (type === "hum") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.9);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.1);
      } else if (type === "shatter") {
        const bufferSize = Math.floor(ctx.sampleRate * 0.4);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(2000, now);
        filter.Q.setValueAtTime(3, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (type === "warp") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.8);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
      }
    } catch {
      // Autoplay or browser security might silently ignore
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const startTime = performance.now();

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

    // Build the Printer Matrix
    const particles: PixelParticle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleStep = isMobile ? 4 : 3;

    const offWidth = 260;
    const offHeight = 220;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = offWidth;
    offCanvas.height = offHeight;
    const offCtx = offCanvas.getContext("2d");

    if (offCtx) {
      offCtx.clearRect(0, 0, offWidth, offHeight);

      // Top paper entering (white / cyan glow)
      offCtx.fillStyle = "#F0F9FF";
      offCtx.beginPath();
      offCtx.roundRect(70, 10, 120, 52, [8, 8, 0, 0]);
      offCtx.fill();

      // Ruled lines on paper
      offCtx.fillStyle = "#38BDF8";
      offCtx.fillRect(85, 24, 70, 3);
      offCtx.fillRect(85, 33, 90, 3);
      offCtx.fillRect(85, 42, 75, 3);

      // Printer main top shelf / paper feeder slot
      offCtx.fillStyle = "#1E293B";
      offCtx.beginPath();
      offCtx.roundRect(40, 54, 180, 24, 6);
      offCtx.fill();

      // Main Printer Body (cyberpunk gradient chassis)
      const bodyGrad = offCtx.createLinearGradient(30, 70, 230, 160);
      bodyGrad.addColorStop(0, "#0F172A");
      bodyGrad.addColorStop(0.5, "#1E293B");
      bodyGrad.addColorStop(1, "#0A0F1D");
      offCtx.fillStyle = bodyGrad;
      offCtx.beginPath();
      offCtx.roundRect(26, 72, 208, 86, 16);
      offCtx.fill();

      // Front Bevel & metallic edge highlight
      offCtx.strokeStyle = "#38BDF8";
      offCtx.lineWidth = 3;
      offCtx.beginPath();
      offCtx.roundRect(28, 74, 204, 82, 14);
      offCtx.stroke();

      // Glowing LED Screen / Status Bar
      offCtx.fillStyle = "#0284C7";
      offCtx.beginPath();
      offCtx.roundRect(45, 88, 58, 24, 6);
      offCtx.fill();
      offCtx.fillStyle = "#38BDF8";
      offCtx.fillRect(52, 96, 34, 4);
      offCtx.fillRect(52, 103, 22, 3);

      // Status indicator lights (Emerald & Cyan)
      offCtx.fillStyle = "#10B981";
      offCtx.beginPath();
      offCtx.arc(118, 100, 4.5, 0, Math.PI * 2);
      offCtx.fill();

      offCtx.fillStyle = "#00F2FE";
      offCtx.beginPath();
      offCtx.arc(132, 100, 4.5, 0, Math.PI * 2);
      offCtx.fill();

      // Output Tray slot
      offCtx.fillStyle = "#020617";
      offCtx.fillRect(44, 122, 172, 16);

      // Printed document sliding out (bright white with indigo glow)
      offCtx.fillStyle = "#FFFFFF";
      offCtx.beginPath();
      offCtx.roundRect(60, 128, 140, 58, [0, 0, 8, 8]);
      offCtx.fill();

      // Document printed graphics
      offCtx.fillStyle = "#6366F1";
      offCtx.fillRect(75, 142, 110, 4);
      offCtx.fillRect(75, 153, 85, 4);
      offCtx.fillRect(75, 164, 100, 4);

      // Gold Seal on printed certificate
      offCtx.fillStyle = "#F59E0B";
      offCtx.beginPath();
      offCtx.arc(175, 158, 7, 0, Math.PI * 2);
      offCtx.fill();

      // Sample image data to build particle grid
      const imgData = offCtx.getImageData(0, 0, offWidth, offHeight);
      const data = imgData.data;

      const initialZ = 450; // Starting depth

      for (let y = 0; y < offHeight; y += particleStep) {
        for (let x = 0; x < offWidth; x += particleStep) {
          const index = (y * offWidth + x) * 4;
          const a = data[index + 3];

          if (a > 30) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const scaleFactor = isMobile ? 1.6 : 2.2;
            const relX = (x - offWidth / 2) * scaleFactor;
            const relY = (y - offHeight / 2) * scaleFactor;

            // Explosion kinematics: outward + intense forward acceleration towards the user
            const spreadAngle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.5;
            const speed = Math.random() * 5 + 3;

            particles.push({
              x: relX,
              y: relY,
              z: initialZ,
              vx: Math.cos(spreadAngle) * speed * 2.8,
              vy: Math.sin(spreadAngle) * speed * 2.8,
              // vz accelerates forward towards the user's screen
              vz: -(Math.random() * 20 + 22),
              size: (particleStep + 0.5) * (Math.random() * 0.5 + 0.9),
              color: `rgb(${r}, ${g}, ${b})`,
              alpha: a / 255,
              active: true,
            });
          }
        }
      }
    }

    if (autoPlayAudio) {
      setTimeout(() => playSfx("hum"), 120);
    }

    let shatterSoundPlayed = false;
    let warpSoundPlayed = false;

    // Timeline durations
    const T_SCAN = 1.3;
    const T_END = 3.1;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Deep cinematic ambient background
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, "#081126");
      bgGrad.addColorStop(0.5, "#030712");
      bgGrad.addColorStop(1, "#000105");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Cyberpunk perspective grid floor
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
      ctx.lineWidth = 1;
      const gridHorizon = centerY + 140;
      for (let i = -14; i <= 14; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX + i * 45, gridHorizon);
        ctx.lineTo(centerX + i * 260, height);
        ctx.stroke();
      }
      for (let gy = gridHorizon; gy < height; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }
      ctx.restore();

      const fov = 340;

      // PHASE 1 & 2: Printer Materialization and Scan
      if (elapsed < T_SCAN) {
        if (elapsed > 0.3 && phase !== "scanning") {
          setPhase("scanning");
          setStatusText("SCANNING PRINT MATRIX...");
        }

        const floatY = Math.sin(elapsed * 4.5) * 5;
        const introAlpha = Math.min(elapsed / 0.5, 1);

        // Glowing cyan aura behind printer
        const auraGrad = ctx.createRadialGradient(
          centerX,
          centerY + floatY,
          10,
          centerX,
          centerY + floatY,
          200
        );
        auraGrad.addColorStop(0, `rgba(56, 189, 248, ${0.4 * introAlpha})`);
        auraGrad.addColorStop(0.5, `rgba(99, 102, 241, ${0.2 * introAlpha})`);
        auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY + floatY, 210, 0, Math.PI * 2);
        ctx.fill();

        // Render initial intact particle matrix
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const scale = fov / (fov + p.z);
          const px = centerX + p.x * scale;
          const py = centerY + (p.y + floatY) * scale;
          const pSize = Math.max(p.size * scale, 1.2);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * introAlpha;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);
        }

        // Horizontal laser scanner beam
        if (elapsed > 0.25) {
          const scanProgress = (elapsed - 0.25) / (T_SCAN - 0.25);
          const beamY = centerY - 120 + scanProgress * 240;

          const beamGrad = ctx.createLinearGradient(centerX - 180, beamY, centerX + 180, beamY);
          beamGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
          beamGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.95)");
          beamGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

          ctx.fillStyle = beamGrad;
          ctx.fillRect(centerX - 180, beamY - 2, 360, 4);

          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(centerX - 90, beamY - 1, 180, 2);
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
      }
      // PHASE 3: BREAKS INTO PIXELS & ALL PIXELS COME TOWARDS US (WARP TRANSITION)
      else if (elapsed >= T_SCAN && elapsed < T_END) {
        if (!shatterSoundPlayed) {
          shatterSoundPlayed = true;
          if (autoPlayAudio) playSfx("shatter");
        }

        if (elapsed >= T_SCAN + 0.25 && !warpSoundPlayed) {
          warpSoundPlayed = true;
          if (autoPlayAudio) playSfx("warp");
        }

        if (phase !== "exploding") {
          setPhase("exploding");
          setStatusText("WARP DISINTEGRATION · ENTERING RU PORTAL...");
        }

        const explodeTime = elapsed - T_SCAN;

        // Render all pixels bursting into 3D and flying forward towards the user
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.active) continue;

          // Exponential forward acceleration towards the user's eyes
          const accel = 1 + explodeTime * 3.5;
          p.z += p.vz * accel;
          p.x += p.vx * accel * 0.8;
          p.y += p.vy * accel * 0.8;

          // Once particle passes behind camera/eyes
          if (p.z <= -fov + 15) {
            p.active = false;
            continue;
          }

          // 3D Perspective Projection:
          // As z approaches -fov, depth becomes tiny and scale explodes upwards!
          const depth = Math.max(fov + p.z, 6);
          const scale = fov / depth;
          const px = centerX + p.x * scale;
          const py = centerY + p.y * scale;

          const pSize = Math.max(p.size * scale, 2.5);

          // Calculate previous frame position to draw warp motion streak
          const prevDepth = Math.max(fov + (p.z - p.vz * 2.2), 10);
          const prevScale = fov / prevDepth;
          const prevPx = centerX + p.x * prevScale;
          const prevPy = centerY + p.y * prevScale;

          const opacity = Math.min(1, depth / 160);

          ctx.save();
          ctx.globalAlpha = p.alpha * opacity;

          // High-speed warp streaks towards the camera
          if (scale > 1.1) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.min(pSize * 0.85, 12);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          // Glowing pixel core
          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          // Bright white hot-center for particles zooming directly past user
          if (scale > 2.2) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(px - pSize / 4, py - pSize / 4, pSize / 2, pSize / 2);
          }

          ctx.restore();
        }

        // Warp bloom / radiant flash transition as pixels fly past us
        if (explodeTime > 0.75) {
          const flashProgress = Math.min((explodeTime - 0.75) / 0.55, 1);
          const flashGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            20,
            centerX,
            centerY,
            Math.max(width, height)
          );
          flashGrad.addColorStop(0, `rgba(56, 189, 248, ${flashProgress * 0.75})`);
          flashGrad.addColorStop(0.5, `rgba(255, 255, 255, ${flashProgress * 0.95})`);
          flashGrad.addColorStop(1, `rgba(255, 255, 255, ${flashProgress * 0.6})`);
          ctx.fillStyle = flashGrad;
          ctx.fillRect(0, 0, width, height);
        }
      }

      // PHASE 4: Smooth completion & hand-off to main page
      if (elapsed >= T_END) {
        setPhase("done");
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
  }, [handleFinish, autoPlayAudio, playSfx, phase]);

  const handleSkip = () => {
    setIsSkipped(true);
    handleFinish();
  };

  if (isSkipped) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black select-none overflow-hidden"
      >
        {/* Fullscreen 3D Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block w-full h-full cursor-default"
        />

        {/* Top Header: Brand & Skip Button */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 font-mono">
                Rishihood University
              </span>
              <span className="text-[10px] text-slate-400">Autonomous Print System</span>
            </div>
          </div>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-slate-300 hover:text-white text-xs font-medium backdrop-blur-md transition-all shadow-lg"
          >
            <span>Skip Intro</span>
            <FastForward className="w-3.5 h-3.5 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Bottom Status text with glowing cyberpunk style */}
        <div className="relative z-10 pb-12 flex flex-col items-center text-center px-4 pointer-events-none">
          <motion.div
            key={statusText}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <p className="font-mono text-xs sm:text-sm font-semibold tracking-widest text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]">
              {statusText}
            </p>
          </motion.div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">
            Direct Cloud Print • Campus Kiosk Network
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
