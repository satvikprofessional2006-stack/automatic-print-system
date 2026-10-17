"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

interface NeonParticle {
  // Initial printer relative coords
  x: number;
  y: number;
  z: number;
  // Outward explosion trajectory
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  spinDir: number;
  size: number;
  color: string;
  streakColor: string;
  alpha: number;
  // Scatter peak position at reversal
  scatterX: number;
  scatterY: number;
  scatterZ: number;
  hasRecordedScatter: boolean;
  // Destination target on the first page UI
  targetX: number;
  targetY: number;
  targetColor: string;
  // Frame-by-frame streak tracking
  lastX: number;
  lastY: number;
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

    // Rich vibrant Neon Color Palette
    const NEON_CYAN = "#00F5FF";
    const NEON_BLUE = "#38BDF8";
    const NEON_MAGENTA = "#FF0055"; // Rishihood primary red in neon
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

    // Audio synthesizer sfx using Web Audio API
    const playSfx = (type: "charge" | "shatter" | "suction" | "lock") => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const actx = new AudioCtx();
        if (actx.state === "suspended") actx.resume();
        const now = actx.currentTime;

        if (type === "charge") {
          // Subtle sci-fi energy charge hum
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 1.25);
          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.06, now + 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.start(now);
          osc.stop(now + 1.25);
        } else if (type === "shatter") {
          // Pixel burst sound
          const bufferSize = Math.floor(actx.sampleRate * 0.35);
          const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const noise = actx.createBufferSource();
          noise.buffer = buffer;
          const filter = actx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(2400, now);
          filter.Q.setValueAtTime(4, now);
          const gain = actx.createGain();
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(actx.destination);
          noise.start(now);
        } else if (type === "suction") {
          // Magnetic gravitational suction whoosh as particles pull back in
          const osc = actx.createOscillator();
          const filter = actx.createBiquadFilter();
          const gain = actx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(95, now);
          osc.frequency.exponentialRampToValueAtTime(450, now + 0.68);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(240, now);
          filter.frequency.exponentialRampToValueAtTime(2100, now + 0.68);
          filter.Q.setValueAtTime(3.8, now);

          gain.gain.setValueAtTime(0.01, now);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.45);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(actx.destination);
          osc.start(now);
          osc.stop(now + 0.68);
        } else if (type === "lock") {
          // Shimmering harmonic crystallization chime (C6, E6, G6, C7)
          const freqs = [1046.5, 1318.5, 1567.98, 2093.0];
          freqs.forEach((freq, idx) => {
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + idx * 0.025);
            gain.gain.setValueAtTime(0.045 / (idx + 1), now + idx * 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.025 + 0.6);
            osc.connect(gain);
            gain.connect(actx.destination);
            osc.start(now + idx * 0.025);
            osc.stop(now + idx * 0.025 + 0.6);
          });
        }
      } catch {}
    };

    if (!audioPlayed) {
      audioPlayed = true;
      setTimeout(() => playSfx("charge"), 100);
    }

    // Build the holographic vector printer particle matrix
    const particles: NeonParticle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleStep = isMobile ? 5 : 4; // ~550 particles: locked 60fps & razor-sharp definition

    const offW = 320;
    const offH = 260;
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

      // Neon LED Screen
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

      const imgData = offCtx.getImageData(0, 0, offW, offH);
      const data = imgData.data;

      const scaleMultiplier = isMobile ? 1.6 : 2.0;
      const initialZ = 340;

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

            const angle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.45;
            const speed = Math.random() * 4 + 3.0;

            let streak = NEON_CYAN;
            if (r > 190 && g < 100) streak = NEON_MAGENTA;
            else if (r > 190 && g > 140 && b < 100) streak = NEON_GOLD;
            else if (r > 200 && g > 200 && b > 200) streak = NEON_WHITE;

            particles.push({
              x: relX,
              y: relY,
              z: initialZ,
              vx: Math.cos(angle) * speed * 2.2,
              vy: Math.sin(angle) * speed * 2.2,
              vz: -(Math.random() * 10 + 14),
              angle,
              spinDir: Math.random() > 0.5 ? 1 : -1,
              size: particleStep * 0.9,
              color: `rgb(${r}, ${g}, ${b})`,
              streakColor: streak,
              alpha: a / 255,
              scatterX: 0,
              scatterY: 0,
              scatterZ: 0,
              hasRecordedScatter: false,
              targetX: 0,
              targetY: 0,
              targetColor: NEON_CYAN,
              lastX: 0,
              lastY: 0,
              active: true,
            });
          }
        }
      }
    }

    // Function to calculate exact destination targets for the First Page UI
    const assignTargets = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const cardW = Math.min(width * 0.92, 480);
      const cardH = 340;
      const cardX = centerX - cardW / 2;
      const cardY = centerY - cardH / 2 + 25;

      const headerY = cardY - 78;
      const stepperY = cardY - 32;
      const btnW = Math.min(cardW - 60, 360);
      const btnH = 46;
      const btnX = centerX - btnW / 2;
      const btnY = cardY + 204;

      const n = particles.length;
      const perim = 2 * (cardW + cardH);

      for (let i = 0; i < n; i++) {
        const p = particles[i];
        // 1. Card perimeter border (40% of particles)
        if (i < Math.floor(n * 0.40)) {
          const t = i / (Math.floor(n * 0.40) - 1);
          const dist = t * perim;
          let tx = cardX;
          let ty = cardY;
          if (dist < cardW) {
            tx = cardX + dist;
            ty = cardY;
          } else if (dist < cardW + cardH) {
            tx = cardX + cardW;
            ty = cardY + (dist - cardW);
          } else if (dist < 2 * cardW + cardH) {
            tx = cardX + cardW - (dist - (cardW + cardH));
            ty = cardY + cardH;
          } else {
            tx = cardX;
            ty = cardY + cardH - (dist - (2 * cardW + cardH));
          }
          p.targetX = tx;
          p.targetY = ty;
          p.targetColor = i % 2 === 0 ? NEON_CYAN : NEON_BLUE;
        }
        // 2. Top Header and Logo line (12% of particles)
        else if (i < Math.floor(n * 0.52)) {
          const t = (i - Math.floor(n * 0.40)) / (Math.floor(n * 0.52) - Math.floor(n * 0.40));
          p.targetX = centerX - 140 + t * 280;
          p.targetY = headerY;
          p.targetColor = NEON_WHITE;
        }
        // 3. Stepper indicator dots (12% of particles)
        else if (i < Math.floor(n * 0.64)) {
          const t = (i - Math.floor(n * 0.52)) / (Math.floor(n * 0.64) - Math.floor(n * 0.52));
          p.targetX = cardX + 24 + t * (cardW - 48);
          p.targetY = stepperY;
          p.targetColor = NEON_MAGENTA;
        }
        // 4. Center Sign-In Button outline (20% of particles)
        else if (i < Math.floor(n * 0.84)) {
          const btnIndex = i - Math.floor(n * 0.64);
          const btnTotal = Math.floor(n * 0.84) - Math.floor(n * 0.64);
          const t = btnIndex / (btnTotal - 1);
          const btnPerim = 2 * (btnW + btnH);
          const dist = t * btnPerim;
          let bx = btnX;
          let by = btnY;
          if (dist < btnW) {
            bx = btnX + dist;
            by = btnY;
          } else if (dist < btnW + btnH) {
            bx = btnX + btnW;
            by = btnY + (dist - btnW);
          } else if (dist < 2 * btnW + btnH) {
            bx = btnX + btnW - (dist - (btnW + btnH));
            by = btnY + btnH;
          } else {
            bx = btnX;
            by = btnY + btnH - (dist - (2 * btnW + btnH));
          }
          p.targetX = bx;
          p.targetY = by;
          p.targetColor = NEON_GOLD;
        }
        // 5. Card interior badge & text data lines (16% of particles)
        else {
          const intIndex = i - Math.floor(n * 0.84);
          const intTotal = n - Math.floor(n * 0.84);
          const row = intIndex % 4;
          const colT = Math.floor(intIndex / 4) / Math.max(1, Math.floor(intTotal / 4));
          p.targetX = cardX + 40 + colT * (cardW - 80);
          p.targetY = cardY + 54 + row * 34;
          p.targetColor = row === 0 ? NEON_MAGENTA : row === 1 ? NEON_WHITE : NEON_CYAN;
        }
      }
    };

    assignTargets(window.innerWidth, window.innerHeight);

    // Exact Choreography Timeline:
    // 0.0s - 1.25s: Printer materializes & laser sweeps down ONCE across the printer
    // 1.25s - 1.5s: Energy charge ring contracts into center
    // 1.5s: Explosion burst outward! Sound: 'shatter'
    // 1.5s - 2.05s: Particles explode outward towards the screen edges
    // 2.05s: Reverse gravitational suction begins! Sound: 'suction'
    // 2.05s - 2.75s: Pixels stream and curve back in from the periphery towards their targets
    // 2.75s: Particles lock into place forming the first page! Sound: 'lock' chime
    // 2.75s - 3.15s: Assembled canvas card dissolves into live interactive page underneath
    // 3.15s: Complete!
    const T_CHARGE = 1.25;
    const T_EXPLODE = 1.5;
    const T_SUCTION = 2.05;
    const T_ASSEMBLE = 2.75;
    const T_FADE_START = 2.85;
    const T_FINISH = 3.15;

    let shatterPlayed = false;
    let suctionPlayed = false;
    let lockPlayed = false;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Deep space neon radial glow
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

      let bgAlpha = 1;
      if (elapsed > T_FADE_START) {
        bgAlpha = Math.max(0, 1 - (elapsed - T_FADE_START) / (T_FINISH - T_FADE_START));
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

      const fov = 340;

      // ── PHASE 1: PRINTER MATERIALIZATION & SCAN (0.0s - 1.5s) ──
      // First part exactly identical, playing strictly ONCE!
      if (elapsed < T_EXPLODE) {
        const appearProgress = Math.min(elapsed / 0.65, 1);
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

        // Render intact particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const scale = fov / (fov + p.z);
          const px = centerX + p.x * scale;
          const py = centerY + (p.y + floatY) * scale;
          const pSize = Math.max(p.size * scale, 1.4);

          p.lastX = px;
          p.lastY = py;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * appearProgress;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);
        }

        // Horizontal Neon Laser Scanner Beam:
        // Sweeps strictly ONCE from top to bottom (from 0.25s to 1.25s) with NO modulo wrapping!
        if (elapsed > 0.25 && elapsed <= T_CHARGE) {
          const scanProgress = Math.min(Math.max((elapsed - 0.25) / (T_CHARGE - 0.25), 0), 1.0);
          const beamY = centerY - 140 + scanProgress * 280;

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

        // Energy charge-up ring before exploding (1.25s - 1.5s)
        if (elapsed > T_CHARGE) {
          const chargeProgress = Math.min((elapsed - T_CHARGE) / (T_EXPLODE - T_CHARGE), 1.0);
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

        // ── Ultra-crisp vector typography under the printer (crystal-clear readability) ──
        ctx.save();
        ctx.globalAlpha = appearProgress;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textY = centerY + (floatY + 82);

        // "RU PRINT PORTAL" - Sharp, glowing white heading
        ctx.font = "800 22px 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        try {
          ctx.letterSpacing = "2.5px";
        } catch {}
        ctx.shadowColor = "rgba(0, 245, 255, 0.85)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = NEON_WHITE;
        ctx.fillText("RU PRINT PORTAL", centerX, textY);

        // "RISHIHOOD UNIVERSITY" - Elegant neon subtitle
        ctx.font = "700 11px 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        try {
          ctx.letterSpacing = "3px";
        } catch {}
        ctx.shadowColor = "rgba(255, 0, 85, 0.9)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = NEON_MAGENTA;
        ctx.fillText("RISHIHOOD UNIVERSITY", centerX, textY + 22);

        ctx.restore();
      }
      // ── PHASE 2A: BURST OUTWARD INTO PIXELS (1.5s - 2.05s) ──
      else if (elapsed >= T_EXPLODE && elapsed < T_SUCTION) {
        if (!shatterPlayed) {
          shatterPlayed = true;
          playSfx("shatter");
        }

        const explodeTime = elapsed - T_EXPLODE;

        // Typography dissolves forward
        if (explodeTime < 0.35) {
          const textFade = Math.max(0, 1 - explodeTime / 0.35);
          const textY = centerY + 82 + explodeTime * 35;
          ctx.save();
          ctx.globalAlpha = textFade;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "800 22px 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.shadowColor = "rgba(0, 245, 255, 0.85)";
          ctx.shadowBlur = 12 * textFade;
          ctx.fillStyle = NEON_WHITE;
          ctx.fillText("RU PRINT PORTAL", centerX, textY);
          ctx.font = "700 11px 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.shadowColor = "rgba(255, 0, 85, 0.9)";
          ctx.shadowBlur = 10 * textFade;
          ctx.fillStyle = NEON_MAGENTA;
          ctx.fillText("RISHIHOOD UNIVERSITY", centerX, textY + 22);
          ctx.restore();
        }

        // Hardware Additive Blending (zero lag!)
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const accel = 1 + explodeTime * 2.8;
          const curZ = p.z + p.vz * accel * 1.5;
          const depth = Math.max(fov + curZ, 8);
          const scale = fov / depth;

          const px = centerX + (p.x + p.vx * accel * 22) * scale;
          const py = centerY + (p.y + p.vy * accel * 22) * scale;
          const pSize = Math.max(p.size * scale, 2.2);

          // Motion streak trail
          if (scale > 1.15 && p.lastX !== 0) {
            ctx.strokeStyle = p.streakColor;
            ctx.lineWidth = Math.min(pSize * 0.8, 8);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.lastX, p.lastY);
            ctx.lineTo(px, py);
            ctx.stroke();
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(px - pSize / 2, py - pSize / 2, pSize, pSize);

          p.lastX = px;
          p.lastY = py;
          p.scatterX = px;
          p.scatterY = py;
          p.scatterZ = curZ;
        }

        ctx.restore();
      }
      // ── PHASE 2B: REVERSE SUCTION & REASSEMBLY OF FIRST PAGE (2.05s - 2.75s) ──
      // The pixels fly back inward from the edges and build the first page!
      else if (elapsed >= T_SUCTION && elapsed < T_ASSEMBLE) {
        if (!suctionPlayed) {
          suctionPlayed = true;
          playSfx("suction");
        }

        // Lock in scatter peak coordinates upon reversal
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!p.hasRecordedScatter) {
            p.hasRecordedScatter = true;
            if (p.scatterX === 0) p.scatterX = p.lastX;
            if (p.scatterY === 0) p.scatterY = p.lastY;
          }
        }

        const suctionTime = elapsed - T_SUCTION;
        const reProgress = Math.min(suctionTime / (T_ASSEMBLE - T_SUCTION), 1.0);

        // Smooth cubic Hermite deceleration into exact targets
        const ease = reProgress * reProgress * (3 - 2 * reProgress);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Dynamic magnetic swirl that converges smoothly to 0 at arrival
          const swirl = (1 - ease) * Math.sin(reProgress * Math.PI) * 45 * p.spinDir;
          const curX = p.scatterX + (p.targetX - p.scatterX) * ease - swirl * Math.sin(p.angle);
          const curY = p.scatterY + (p.targetY - p.scatterY) * ease + swirl * Math.cos(p.angle);

          const pSize = 3.5 * (1 - ease * 0.4);

          // Reverse neon comet trail streaming inward
          if (p.lastX !== 0) {
            ctx.strokeStyle = p.targetColor;
            ctx.lineWidth = Math.min(pSize * 0.9, 6);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.lastX, p.lastY);
            ctx.lineTo(curX, curY);
            ctx.stroke();
          }

          // Sparkling central pixel
          ctx.fillStyle = p.targetColor;
          ctx.fillRect(curX - pSize / 2, curY - pSize / 2, pSize, pSize);

          // White-hot core for convergence energy
          ctx.fillStyle = NEON_WHITE;
          ctx.fillRect(curX - pSize / 4, curY - pSize / 4, pSize / 2, pSize / 2);

          p.lastX = curX;
          p.lastY = curY;
        }

        ctx.restore();
      }
      // ── PHASE 2C: ASSEMBLED CARD LOCK & DISSOLVE INTO LIVE PAGE (2.75s - 3.15s) ──
      else if (elapsed >= T_ASSEMBLE && elapsed < T_FINISH) {
        if (!lockPlayed) {
          lockPlayed = true;
          playSfx("lock");
          // Trigger live DOM page to seamlessly reveal directly under assembled particles
          if (!hasTriggeredZoom.current) {
            hasTriggeredZoom.current = true;
            if (onZoomStartRef.current) {
              onZoomStartRef.current();
            }
          }
        }

        const dissolveProgress = Math.min((elapsed - T_ASSEMBLE) / (T_FINISH - T_ASSEMBLE), 1.0);
        const cardAlpha = Math.max(0, 1 - dissolveProgress);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = cardAlpha;

        // Render locked particles at exact target locations
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.fillStyle = p.targetColor;
          ctx.fillRect(p.targetX - 1.5, p.targetY - 1.5, 3, 3);
        }

        // Radiant neon lock perimeter trace around the newly built card
        const cardW = Math.min(width * 0.92, 480);
        const cardH = 340;
        const cardX = centerX - cardW / 2;
        const cardY = centerY - cardH / 2 + 25;

        ctx.strokeStyle = NEON_CYAN;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = NEON_CYAN;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.stroke();

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
