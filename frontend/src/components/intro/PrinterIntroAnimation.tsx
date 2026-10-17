"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Safe cross-platform roundRect polyfill for iOS Safari, older WebViews, and in-app scanners
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number,
    y: number,
    w: number,
    h: number,
    radii?: number | number[]
  ) {
    let r = 0;
    if (typeof radii === "number") {
      r = radii;
    } else if (Array.isArray(radii) && radii.length > 0) {
      r = radii[0];
    }
    r = Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

interface NeonParticle {
  // Initial printer relative position
  origX: number;
  origY: number;
  z: number;
  angle: number;
  spinDir: number;
  size: number;
  color: string;
  streakColor: string;
  alpha: number;
  // Off-screen scatter destination (completely beyond screen boundaries)
  scatterX: number;
  scatterY: number;
  // First page UI target destination
  targetX: number;
  targetY: number;
  targetColor: string;
  // Frame tracking for streak trails
  lastX: number;
  lastY: number;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Single shared AudioContext & Master Gain Node
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const hasAudioStartedRef = useRef(false);
  const currentElapsedRef = useRef(0);

  // Stable callback references to prevent unmount / restarts
  const onZoomStartRef = useRef(onZoomStart);
  const onCompleteRef = useRef(onComplete);
  const hasTriggeredZoom = useRef(false);
  const hasTriggeredFinish = useRef(false);

  useEffect(() => {
    onZoomStartRef.current = onZoomStart;
    onCompleteRef.current = onComplete;
  }, [onZoomStart, onComplete]);

  // Audio Context Initializer (safe for SSR & user-gestures)
  const getAudioCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        const actx = new AudioCtx();
        const masterGain = actx.createGain();
        masterGain.gain.setValueAtTime(0.50, actx.currentTime); // Cinematic master volume
        masterGain.connect(actx.destination);

        audioCtxRef.current = actx;
        masterGainRef.current = masterGain;
      }
    } catch {}
    return audioCtxRef.current;
  }, []);

  // ── MASTER CONTINUOUS AUDIO ENGINE (From 0.00s to 3.20s) ──
  // Guarantees audio starts from the very first frame (0.00s) and plays continuously to the end without gaps
  const playAudioScore = useCallback((startOffset: number = 0) => {
    try {
      const actx = getAudioCtx();
      const masterGain = masterGainRef.current;
      if (!actx || !masterGain) return;

      if (actx.state === "suspended") {
        actx.resume().catch(() => {});
      }

      if (hasAudioStartedRef.current) return;
      hasAudioStartedRef.current = true;

      const now = actx.currentTime;
      // Precision relative scheduler: clamps past events, aligns future events exactly
      const sched = (targetT: number) => now + Math.max(0, targetT - startOffset);

      // ── LAYER 1: INSTANT POWER-ON CYBER BOOT CHORD & PUNCH (0.00s - 0.85s) ──
      if (startOffset < 0.6) {
        // 1A. Tactile Sub-bass Punch (instant low-end impact right as particles ignite)
        const bootSub = actx.createOscillator();
        const bootGain = actx.createGain();
        bootSub.type = "sine";
        bootSub.frequency.setValueAtTime(180, sched(0));
        bootSub.frequency.exponentialRampToValueAtTime(80, sched(0.22));
        bootGain.gain.setValueAtTime(0.35, sched(0));
        bootGain.gain.exponentialRampToValueAtTime(0.001, sched(0.25));
        bootSub.connect(bootGain);
        bootGain.connect(masterGain);
        bootSub.start(sched(0));
        bootSub.stop(sched(0.25));

        // 1B. Multi-oscillator Cyber Hologram Chord (A minor 9th: 220Hz, 330Hz, 440Hz, 660Hz)
        const chordFreqs = [220, 330, 440, 660];
        chordFreqs.forEach((freq, idx) => {
          const osc = actx.createOscillator();
          const filter = actx.createBiquadFilter();
          const gain = actx.createGain();
          osc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
          osc.frequency.setValueAtTime(freq, sched(0));
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(450, sched(0));
          filter.frequency.exponentialRampToValueAtTime(2400, sched(0.55));
          filter.Q.setValueAtTime(3.0, sched(0));
          gain.gain.setValueAtTime(0.22 / chordFreqs.length, sched(0));
          gain.gain.linearRampToValueAtTime(0.34 / chordFreqs.length, sched(0.22));
          gain.gain.exponentialRampToValueAtTime(0.001, sched(0.85));
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);
          osc.start(sched(0));
          osc.stop(sched(0.85));
        });
      }

      // ── LAYER 2: CONTINUOUS CYBER AMBIENT DRONE & TEXTURE (0.00s - 1.45s) ──
      if (startOffset < 1.45) {
        const droneOsc1 = actx.createOscillator();
        const droneOsc2 = actx.createOscillator();
        const droneFilter = actx.createBiquadFilter();
        const droneGain = actx.createGain();

        droneOsc1.type = "sawtooth";
        droneOsc2.type = "triangle";
        droneOsc1.frequency.setValueAtTime(110, sched(0)); // A2
        droneOsc2.frequency.setValueAtTime(110.8, sched(0)); // Lush chorus detune

        droneFilter.type = "lowpass";
        droneFilter.frequency.setValueAtTime(700, sched(0));
        droneFilter.frequency.linearRampToValueAtTime(1400, sched(1.2));
        droneFilter.frequency.exponentialRampToValueAtTime(2400, sched(1.45));

        droneGain.gain.setValueAtTime(0.22, sched(0));
        droneGain.gain.setValueAtTime(0.25, sched(1.0));
        droneGain.gain.linearRampToValueAtTime(0.42, sched(1.45)); // Swells towards explosion
        droneGain.gain.exponentialRampToValueAtTime(0.001, sched(1.50));

        droneOsc1.connect(droneFilter);
        droneOsc2.connect(droneFilter);
        droneFilter.connect(droneGain);
        droneGain.connect(masterGain);
        droneOsc1.start(sched(0));
        droneOsc2.start(sched(0));
        droneOsc1.stop(sched(1.50));
        droneOsc2.stop(sched(1.50));
      }

      // ── LAYER 3: LASER SCANNER PULSE (0.25s - 1.25s) ──
      if (startOffset < 1.25) {
        const scanOsc = actx.createOscillator();
        const scanFilter = actx.createBiquadFilter();
        const scanGain = actx.createGain();

        scanOsc.type = "sawtooth";
        scanOsc.frequency.setValueAtTime(780, sched(0.25));
        scanOsc.frequency.exponentialRampToValueAtTime(280, sched(1.25));

        scanFilter.type = "bandpass";
        scanFilter.frequency.setValueAtTime(1800, sched(0.25));
        scanFilter.frequency.exponentialRampToValueAtTime(650, sched(1.25));
        scanFilter.Q.setValueAtTime(5.5, sched(0.25));

        scanGain.gain.setValueAtTime(0.001, sched(0));
        scanGain.gain.setValueAtTime(0.26, sched(0.25));
        scanGain.gain.linearRampToValueAtTime(0.28, sched(0.75));
        scanGain.gain.exponentialRampToValueAtTime(0.001, sched(1.25));

        scanOsc.connect(scanFilter);
        scanFilter.connect(scanGain);
        scanGain.connect(masterGain);
        scanOsc.start(sched(0.25));
        scanOsc.stop(sched(1.25));
      }

      // ── LAYER 4: ENERGY CHARGE-UP RISER (1.15s - 1.45s) ──
      if (startOffset < 1.45) {
        const riserOsc1 = actx.createOscillator();
        const riserOsc2 = actx.createOscillator();
        const riserGain = actx.createGain();

        riserOsc1.type = "sawtooth";
        riserOsc2.type = "sine";
        riserOsc1.frequency.setValueAtTime(260, sched(1.15));
        riserOsc1.frequency.exponentialRampToValueAtTime(1380, sched(1.45));
        riserOsc2.frequency.setValueAtTime(520, sched(1.15));
        riserOsc2.frequency.exponentialRampToValueAtTime(2760, sched(1.45));

        riserGain.gain.setValueAtTime(0.001, sched(0));
        riserGain.gain.setValueAtTime(0.12, sched(1.15));
        riserGain.gain.linearRampToValueAtTime(0.40, sched(1.43));
        riserGain.gain.exponentialRampToValueAtTime(0.001, sched(1.46));

        riserOsc1.connect(riserGain);
        riserOsc2.connect(riserGain);
        riserGain.connect(masterGain);
        riserOsc1.start(sched(1.15));
        riserOsc2.start(sched(1.15));
        riserOsc1.stop(sched(1.46));
        riserOsc2.stop(sched(1.46));
      }

      // ── LAYER 5: SHATTER EXPLOSION & DISINTEGRATION BLAST (1.45s - 1.95s) ──
      if (startOffset < 1.95) {
        // 5A. Heavy Sub-bass Shockwave
        const subBoom = actx.createOscillator();
        const subGain = actx.createGain();
        subBoom.type = "sine";
        subBoom.frequency.setValueAtTime(180, sched(1.45));
        subBoom.frequency.exponentialRampToValueAtTime(36, sched(1.95));
        subGain.gain.setValueAtTime(0.001, sched(0));
        subGain.gain.setValueAtTime(0.55, sched(1.45));
        subGain.gain.exponentialRampToValueAtTime(0.001, sched(1.95));
        subBoom.connect(subGain);
        subGain.connect(masterGain);
        subBoom.start(sched(1.45));
        subBoom.stop(sched(1.95));

        // 5B. Mid Punch Clack
        const punchOsc = actx.createOscillator();
        const punchGain = actx.createGain();
        punchOsc.type = "triangle";
        punchOsc.frequency.setValueAtTime(480, sched(1.45));
        punchOsc.frequency.exponentialRampToValueAtTime(120, sched(1.55));
        punchGain.gain.setValueAtTime(0.35, sched(1.45));
        punchGain.gain.exponentialRampToValueAtTime(0.001, sched(1.55));
        punchOsc.connect(punchGain);
        punchGain.connect(masterGain);
        punchOsc.start(sched(1.45));
        punchOsc.stop(sched(1.55));

        // 5C. Digital Particle Glass Shatter Noise Burst
        const bufferSize = Math.floor(actx.sampleRate * 0.50);
        const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noiseSource = actx.createBufferSource();
        noiseSource.buffer = buffer;
        const nFilter = actx.createBiquadFilter();
        nFilter.type = "bandpass";
        nFilter.frequency.setValueAtTime(3600, sched(1.45));
        nFilter.frequency.exponentialRampToValueAtTime(1200, sched(1.95));
        nFilter.Q.setValueAtTime(3.8, sched(1.45));
        const nGain = actx.createGain();
        nGain.gain.setValueAtTime(0.001, sched(0));
        nGain.gain.setValueAtTime(0.42, sched(1.45));
        nGain.gain.exponentialRampToValueAtTime(0.001, sched(1.95));
        noiseSource.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        noiseSource.start(sched(1.45));
      }

      // ── LAYER 6: COSMIC REVERSE GRAVITATIONAL SUCTION WHOOSH (1.95s - 2.65s) ──
      if (startOffset < 2.65) {
        // 6A. Reverse Vacuum Whoosh
        const suctionNoise = actx.createBufferSource();
        const sBufSize = Math.floor(actx.sampleRate * 0.75);
        const sBuf = actx.createBuffer(1, sBufSize, actx.sampleRate);
        const sData = sBuf.getChannelData(0);
        for (let i = 0; i < sBufSize; i++) sData[i] = Math.random() * 2 - 1;
        suctionNoise.buffer = sBuf;
        const sNoiseFilter = actx.createBiquadFilter();
        sNoiseFilter.type = "bandpass";
        sNoiseFilter.frequency.setValueAtTime(260, sched(1.95));
        sNoiseFilter.frequency.exponentialRampToValueAtTime(3200, sched(2.65));
        sNoiseFilter.Q.setValueAtTime(4.2, sched(1.95));
        const sNoiseGain = actx.createGain();
        sNoiseGain.gain.setValueAtTime(0.001, sched(0));
        sNoiseGain.gain.setValueAtTime(0.08, sched(1.95));
        sNoiseGain.gain.linearRampToValueAtTime(0.38, sched(2.55));
        sNoiseGain.gain.exponentialRampToValueAtTime(0.001, sched(2.65));
        suctionNoise.connect(sNoiseFilter);
        sNoiseFilter.connect(sNoiseGain);
        sNoiseGain.connect(masterGain);
        suctionNoise.start(sched(1.95));

        // 6B. Tractor Beam Harmonic Riser
        const suctionOsc1 = actx.createOscillator();
        const suctionOsc2 = actx.createOscillator();
        const suctionGain = actx.createGain();
        suctionOsc1.type = "sawtooth";
        suctionOsc2.type = "sine";
        suctionOsc1.frequency.setValueAtTime(85, sched(1.95));
        suctionOsc1.frequency.exponentialRampToValueAtTime(580, sched(2.65));
        suctionOsc2.frequency.setValueAtTime(170, sched(1.95));
        suctionOsc2.frequency.exponentialRampToValueAtTime(1160, sched(2.65));

        suctionGain.gain.setValueAtTime(0.001, sched(0));
        suctionGain.gain.setValueAtTime(0.10, sched(1.95));
        suctionGain.gain.linearRampToValueAtTime(0.40, sched(2.55));
        suctionGain.gain.exponentialRampToValueAtTime(0.001, sched(2.65));

        suctionOsc1.connect(suctionGain);
        suctionOsc2.connect(suctionGain);
        suctionGain.connect(masterGain);
        suctionOsc1.start(sched(1.95));
        suctionOsc2.start(sched(1.95));
        suctionOsc1.stop(sched(2.65));
        suctionOsc2.stop(sched(2.65));
      }

      // ── LAYER 7: FIRST PAGE CRYSTALLIZATION CHIME CHORD (2.65s - 3.20s) ──
      if (startOffset < 3.10) {
        // 7A. Tactile Lock Snap Impact
        const lockOsc = actx.createOscillator();
        const lockGain = actx.createGain();
        lockOsc.type = "triangle";
        lockOsc.frequency.setValueAtTime(1300, sched(2.65));
        lockOsc.frequency.exponentialRampToValueAtTime(320, sched(2.72));
        lockGain.gain.setValueAtTime(0.28, sched(2.65));
        lockGain.gain.exponentialRampToValueAtTime(0.001, sched(2.72));
        lockOsc.connect(lockGain);
        lockGain.connect(masterGain);
        lockOsc.start(sched(2.65));
        lockOsc.stop(sched(2.72));

        // 7B. Celestial 6-note Crystallization Chime Chord
        const chimes = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51];
        chimes.forEach((freq, idx) => {
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = "sine";
          const noteTime = sched(2.65 + idx * 0.024);
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.001, sched(0));
          gain.gain.setValueAtTime(0.26, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.85);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(noteTime);
          osc.stop(noteTime + 0.85);
        });

        // 7C. Warm Sub-bass Foundation
        const subChord = actx.createOscillator();
        const subChordGain = actx.createGain();
        subChord.type = "sine";
        subChord.frequency.setValueAtTime(130.81, sched(2.65)); // C3
        subChordGain.gain.setValueAtTime(0.001, sched(0));
        subChordGain.gain.setValueAtTime(0.22, sched(2.65));
        subChordGain.gain.exponentialRampToValueAtTime(0.001, sched(3.20));
        subChord.connect(subChordGain);
        subChordGain.connect(masterGain);
        subChord.start(sched(2.65));
        subChord.stop(sched(3.20));
      }
    } catch {}
  }, [getAudioCtx]);

  // Direct passive audio un-suspend handler (un-suspends sound on any gesture without pause or prompt)
  const ensureAudioIsActive = useCallback(() => {
    const actx = getAudioCtx();
    if (actx && actx.state === "suspended") {
      actx.resume().catch(() => {});
    }
    if (!hasAudioStartedRef.current) {
      playAudioScore(currentElapsedRef.current);
    }
  }, [getAudioCtx, playAudioScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let startTime: number | null = null;

    // Vibrant Neon Palette
    const NEON_CYAN = "#00F5FF";
    const NEON_BLUE = "#38BDF8";
    const NEON_MAGENTA = "#FF0055"; // Rishihood red in neon
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

    // Passive unlock events: if browser suspended audio, any touch/move/key resumes it seamlessly
    const unlockEvents = [
      "pointerdown",
      "mousedown",
      "touchstart",
      "keydown",
      "pointermove",
      "click",
      "wheel",
    ];
    unlockEvents.forEach((ev) => window.addEventListener(ev, ensureAudioIsActive, { passive: true }));

    // Start audio engine immediately at 0.0s
    playAudioScore(0);

    // Build the holographic vector printer particle matrix
    const particles: NeonParticle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleStep = isMobile ? 5 : 4; // ~520 particles for locked 60 FPS

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

            // Angle directed outward from center with natural spread
            const angle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.45;

            let streak = NEON_CYAN;
            if (r > 190 && g < 100) streak = NEON_MAGENTA;
            else if (r > 190 && g > 140 && b < 100) streak = NEON_GOLD;
            else if (r > 200 && g > 200 && b > 200) streak = NEON_WHITE;

            particles.push({
              origX: relX,
              origY: relY,
              z: initialZ,
              angle,
              spinDir: Math.random() > 0.5 ? 1 : -1,
              size: particleStep * 0.9,
              color: `rgb(${r}, ${g}, ${b})`,
              streakColor: streak,
              alpha: a / 255,
              scatterX: 0,
              scatterY: 0,
              targetX: 0,
              targetY: 0,
              targetColor: NEON_CYAN,
              lastX: 0,
              lastY: 0,
            });
          }
        }
      }
    }

    // Function to calculate exact destination targets for the First Page UI & offscreen scatter points
    const assignTargetsAndScatter = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      // Exact 1:1 dimensions and coordinates matching the real PrintFlow card
      const cardW = Math.min(width * 0.92, 512);
      const cardH = 340;
      const cardX = centerX - cardW / 2;
      const cardY = Math.max(135, centerY - 210);

      const headerY = cardY - 95;
      const stepperY = cardY - 45;
      const btnW = Math.min(cardW - 48, 440);
      const btnH = 46;
      const btnX = centerX - btnW / 2;
      const btnY = cardY + 185;

      const n = particles.length;
      const perim = 2 * (cardW + cardH);

      // Distance guaranteed to be COMPLETELY OUTSIDE the viewport in any direction
      const baseOutDist = Math.hypot(width, height) * 0.68;

      for (let i = 0; i < n; i++) {
        const p = particles[i];

        // 1. Off-screen scatter destination: 100% OUT of screen
        const outDist = baseOutDist + (i % 60) * 12 + Math.random() * 80;
        p.scatterX = centerX + Math.cos(p.angle) * outDist;
        p.scatterY = centerY + Math.sin(p.angle) * outDist;

        // 2. Direct first page UI target layout
        if (i < Math.floor(n * 0.40)) {
          // Card perimeter border
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
        } else if (i < Math.floor(n * 0.52)) {
          // Top header & logo
          const t = (i - Math.floor(n * 0.40)) / (Math.floor(n * 0.52) - Math.floor(n * 0.40));
          p.targetX = centerX - 140 + t * 280;
          p.targetY = headerY;
          p.targetColor = NEON_WHITE;
        } else if (i < Math.floor(n * 0.64)) {
          // Stepper dots
          const t = (i - Math.floor(n * 0.52)) / (Math.floor(n * 0.64) - Math.floor(n * 0.52));
          p.targetX = cardX + 24 + t * (cardW - 48);
          p.targetY = stepperY;
          p.targetColor = NEON_MAGENTA;
        } else if (i < Math.floor(n * 0.84)) {
          // Center Sign-In button
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
        } else {
          // Interior content scanlines & badge
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

    assignTargetsAndScatter(window.innerWidth, window.innerHeight);

    // Exact Unified Choreography Timeline (starts immediately at frame 0):
    // 0.0s - 1.25s: Printer materializes and laser sweeps down strictly ONCE
    // 1.25s - 1.45s: Energy charge ring contracts into center
    // 1.45s - 1.95s: Explosion burst! Pixels launch completely OUT OF THE SCREEN
    // 1.95s - 2.65s: Cosmic reverse suction! Pixels rush back inward from offscreen & build first page
    // 2.65s - 2.95s: Clean first page lock & reveal
    // 2.95s: Finish!
    const T_CHARGE = 1.25;
    const T_EXPLODE = 1.45;
    const T_SUCTION = 1.95;
    const T_ASSEMBLE = 2.65;
    const T_FINISH = 2.95;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      currentElapsedRef.current = elapsed;

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

      // Seamless background fade as first page is created
      let bgAlpha = 1;
      if (elapsed > 2.2) {
        bgAlpha = Math.max(0, 1 - (elapsed - 2.2) / (T_FINISH - 2.2));
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

      // ── PHASE 1: PRINTER MATERIALIZATION & SCAN (0.0s - 1.45s) ──
      // Pure continuous single sweep with zero stutter or disappearance!
      if (elapsed < T_EXPLODE) {
        // Smooth initial fade-in (0.0s to 0.45s)
        const appearProgress = Math.min(elapsed / 0.45, 1.0);
        const floatY = Math.sin(elapsed * 3.5) * 4;

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
          const px = centerX + p.origX * scale;
          const py = centerY + (p.origY + floatY) * scale;
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

        // Energy charge-up ring before exploding (1.25s - 1.45s)
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
      // ── PHASE 2A: PIXELS GO COMPLETELY OUT OF SCREEN (1.45s - 1.95s) ──
      else if (elapsed >= T_EXPLODE && elapsed < T_SUCTION) {
        const explodeTime = elapsed - T_EXPLODE;
        const explodeProgress = Math.min(explodeTime / (T_SUCTION - T_EXPLODE), 1.0);

        // Quadratic acceleration launching all particles completely past the screen edges
        const launchEase = explodeProgress * explodeProgress;

        // Typography dissolves forward smoothly
        if (explodeTime < 0.25) {
          const textFade = Math.max(0, 1 - explodeTime / 0.25);
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

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const startX = centerX + p.origX * 0.5;
          const startY = centerY + p.origY * 0.5;

          // Interpolate directly from printer position out to off-screen scatter destination
          const curX = startX + (p.scatterX - startX) * launchEase;
          const curY = startY + (p.scatterY - startY) * launchEase;

          const pSize = 3.5 * (1 + launchEase * 1.5);

          if (p.lastX !== 0) {
            ctx.strokeStyle = p.streakColor;
            ctx.lineWidth = Math.min(pSize * 0.9, 10);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.lastX, p.lastY);
            ctx.lineTo(curX, curY);
            ctx.stroke();
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(curX - pSize / 2, curY - pSize / 2, pSize, pSize);

          p.lastX = curX;
          p.lastY = curY;
        }

        ctx.restore();
      }
      // ── PHASE 2B: PIXELS RUSH BACK IN FROM OFF-SCREEN & DIRECTLY CREATE FIRST PAGE (1.95s - 2.65s) ──
      else if (elapsed >= T_SUCTION && elapsed < T_ASSEMBLE) {
        const suctionTime = elapsed - T_SUCTION;
        const reProgress = Math.min(suctionTime / (T_ASSEMBLE - T_SUCTION), 1.0);

        // Smooth cubic ease-out: rushes in fast from off-screen, then gently settles into first page targets
        const ease = 1 - Math.pow(1 - reProgress, 3);

        // Proactively reveal live page underneath as particles near their destinations
        if (reProgress > 0.75 && !hasTriggeredZoom.current) {
          hasTriggeredZoom.current = true;
          if (onZoomStartRef.current) {
            onZoomStartRef.current();
          }
        }

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Dynamic magnetic curvature flying inward from beyond viewport edges
          const arc = Math.sin(reProgress * Math.PI) * 40 * p.spinDir;
          const curX = p.scatterX + (p.targetX - p.scatterX) * ease + arc * Math.cos(p.angle + Math.PI / 2);
          const curY = p.scatterY + (p.targetY - p.scatterY) * ease + arc * Math.sin(p.angle + Math.PI / 2);

          const pSize = 3.5 * (1 - ease * 0.35);

          // Inward glowing comet trail
          if (p.lastX !== 0) {
            ctx.strokeStyle = p.targetColor;
            ctx.lineWidth = Math.min(pSize * 0.9, 7);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.lastX, p.lastY);
            ctx.lineTo(curX, curY);
            ctx.stroke();
          }

          // Sparkling central pixel
          ctx.fillStyle = p.targetColor;
          ctx.fillRect(curX - pSize / 2, curY - pSize / 2, pSize, pSize);

          // White-hot core
          ctx.fillStyle = NEON_WHITE;
          ctx.fillRect(curX - pSize / 4, curY - pSize / 4, pSize / 2, pSize / 2);

          p.lastX = curX;
          p.lastY = curY;
        }

        ctx.restore();
      }
      // ── PHASE 2C: FIRST PAGE CREATION LOCK (2.65s - 2.95s) ──
      else if (elapsed >= T_ASSEMBLE && elapsed < T_FINISH) {
        if (!hasTriggeredZoom.current) {
          hasTriggeredZoom.current = true;
          if (onZoomStartRef.current) {
            onZoomStartRef.current();
          }
        }

        const dissolveProgress = Math.min((elapsed - T_ASSEMBLE) / (T_FINISH - T_ASSEMBLE), 1.0);
        const cardAlpha = Math.max(0, 1 - dissolveProgress);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = cardAlpha;

        // Render locked particles directly forming the first page elements
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.fillStyle = p.targetColor;
          ctx.fillRect(p.targetX - 1.5, p.targetY - 1.5, 3, 3);
        }

        // Radiant neon lock perimeter trace around the newly built card
        const cardW = Math.min(width * 0.92, 512);
        const cardH = 340;
        const cardX = centerX - cardW / 2;
        const cardY = Math.max(135, centerY - 210);

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
            sessionStorage.setItem("ru_portal_intro_shown", "true");
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
      unlockEvents.forEach((ev) => window.removeEventListener(ev, ensureAudioIsActive));
    };
  }, [ensureAudioIsActive, playAudioScore, getAudioCtx]);

  const handleSkip = useCallback(() => {
    if (!hasTriggeredFinish.current) {
      hasTriggeredFinish.current = true;
      try {
        sessionStorage.setItem("ru_portal_intro_shown", "true");
      } catch {}
      setIsDone(true);
      if (onZoomStartRef.current) onZoomStartRef.current();
      if (onCompleteRef.current) onCompleteRef.current();
    }
  }, []);

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
        
        {/* Mobile-friendly skip action */}
        <button
          onClick={handleSkip}
          type="button"
          aria-label="Skip Intro Animation"
          className="pointer-events-auto absolute top-5 right-5 z-[10000] px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase text-white/80 hover:text-white bg-black/40 hover:bg-black/60 active:bg-black/80 backdrop-blur-md border border-white/20 transition-all shadow-lg active:scale-95"
        >
          Skip &rarr;
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
