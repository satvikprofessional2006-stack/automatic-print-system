"use client";

import React, { useEffect, useRef } from "react";

interface PrinterIntroProps {
  onZoomStart?: () => void;
  onComplete: () => void;
}

interface PixelParticle {
  relX: number;
  relY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  rot: number;
  vRot: number;
  color: string;
  size: number;
  sparkleOffset: number;
}

export function PrinterIntroAnimation({ onZoomStart, onComplete }: PrinterIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);



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

    let animId: number;
    let particles: PixelParticle[] = [];
    let isImageLoaded = false;
    let logoImg: HTMLImageElement | null = null;
    let logoWidth = 160;
    let logoHeight = 160;

    // Load logo image & sample pixel data
    const img = new Image();
    img.src = "/Rishihood_University_idxo_lfgcw_2.png";
    img.onload = () => {
      logoImg = img;
      const sampleSize = 135;
      const offCanvas = document.createElement("canvas");
      offCanvas.width = sampleSize;
      offCanvas.height = sampleSize;
      const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const imgData = offCtx.getImageData(0, 0, sampleSize, sampleSize).data;

      // Density step
      const step = 2.4;
      const newParticles: PixelParticle[] = [];

      for (let y = 0; y < sampleSize; y += step) {
        for (let x = 0; x < sampleSize; x += step) {
          const pixelX = Math.floor(x);
          const pixelY = Math.floor(y);
          const idx = (pixelY * sampleSize + pixelX) * 4;
          const a = imgData[idx + 3];

          // Only non-transparent pixels
          if (a > 35) {
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];

            const relX = (pixelX - sampleSize / 2) * 1.35;
            const relY = (pixelY - sampleSize / 2) * 1.35;

            const dist = Math.hypot(relX, relY);
            const angle = Math.atan2(relY, relX) + (Math.random() - 0.5) * 0.45;

            // Velocity: balanced explosion radiating outwards
            const speed = 4.2 + Math.random() * 6.5 + (dist / (sampleSize / 2)) * 5.5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            newParticles.push({
              relX,
              relY,
              x: 0,
              y: 0,
              vx,
              vy,
              z: 1,
              vz: 0.012 + Math.random() * 0.028, // flying forward towards viewer
              rot: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 0.12,
              color: `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`,
              size: Math.max(2.4, step * 1.08),
              sparkleOffset: Math.random() * 10,
            });
          }
        }
      }

      particles = newParticles;
      isImageLoaded = true;
    };

    // Responsive Canvas Resizing
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      const isMobile = window.innerWidth < 640;
      logoWidth = isMobile ? 140 : 175;
      logoHeight = isMobile ? 140 : 175;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Easing functions
    const easeOutBack = (x: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    const easeInQuad = (x: number): number => x * x;

    const startTime = performance.now();


    // Animation Loop
    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2 - 25;

      ctx.clearRect(0, 0, width, height);



      // ─────────────────────────────────────────────────────────────
      // STAGE 1: Pop-up from back & Hover Showcase (0.0s to 1.55s)
      // ─────────────────────────────────────────────────────────────
      if (elapsed < 1.55) {
        let scale = 1.0;
        let alpha = 1.0;

        if (elapsed < 1.05) {
          // Zoom-in from back with elastic ease
          const t = Math.min(1, elapsed / 0.95);
          scale = 0.08 + 0.92 * easeOutBack(t);
          alpha = Math.min(1, t * 1.6);
        } else {
          // Subtle breathing hover before shatter
          const hoverT = (elapsed - 1.05) / 0.5;
          scale = 1.0 + Math.sin(hoverT * Math.PI) * 0.035;
          alpha = 1.0;
        }

        // Radiant halo in background
        const haloGrad = ctx.createRadialGradient(centerX, centerY, 15, centerX, centerY, logoWidth * 1.35 * scale);
        haloGrad.addColorStop(0, "rgba(225, 29, 72, 0.32)");
        haloGrad.addColorStop(0.5, "rgba(225, 29, 72, 0.10)");
        haloGrad.addColorStop(1, "rgba(225, 29, 72, 0)");
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoWidth * 1.35 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        if (logoImg && isImageLoaded) {
          ctx.drawImage(logoImg, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
        }

        ctx.restore();

        // Elegant Typography below logo
        if (elapsed > 0.45) {
          const textT = Math.min(1, (elapsed - 0.45) / 0.5);
          ctx.save();
          ctx.globalAlpha = textT;
          ctx.textAlign = "center";

          // Title
          ctx.font = "bold 15px sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.letterSpacing = "3px";
          ctx.fillText("RISHIHOOD UNIVERSITY", centerX, centerY + logoHeight / 2 + 36);

          // Subtitle
          ctx.font = "600 11px sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
          ctx.letterSpacing = "2px";
          ctx.fillText("CAMPUS PRINT PORTAL", centerX, centerY + logoHeight / 2 + 54);

          ctx.restore();
        }
      }

      // ─────────────────────────────────────────────────────────────
      // STAGE 2: Pixel Shatter & Seamless First Page Reveal (1.55s - 3.25s)
      // ─────────────────────────────────────────────────────────────
      else {


        const shatterTime = elapsed - 1.55;

        // Shockwave expansion wave (1.55s - 2.05s)
        if (shatterTime < 0.5) {
          const waveRadius = shatterTime * Math.max(width, height) * 0.85;
          const waveAlpha = Math.max(0, 1 - shatterTime / 0.5) * 0.5;
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(225, 29, 72, ${waveAlpha})`;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        // ── SEAMLESS CROSS-FADE REVEAL ──
        // At shatterTime >= 0.45 (t ~ 2.0s), start smoothly revealing the first page
        // The dark backdrop fades to transparent over 750ms while particles continue flying OVER the first page!
        if (shatterTime >= 0.45 && !hasTriggeredZoom.current) {
          hasTriggeredZoom.current = true;
          onZoomStartRef.current?.();
          if (bgRef.current) {
            bgRef.current.style.opacity = "0";
          }
        }

        // Physics multiplier (accelerates outward blast naturally)
        const accel = 1 + easeInQuad(Math.min(1, shatterTime * 1.15)) * 4.0;

        // Render each pixel particle
        ctx.save();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // 3D position projection
          p.z = Math.max(0.18, p.z - p.vz * accel);
          const depthScale = 1 / p.z;

          p.x = centerX + (p.relX + p.vx * shatterTime * 24 * accel) * depthScale;
          p.y = centerY + (p.relY + p.vy * shatterTime * 24 * accel) * depthScale;
          p.rot += p.vRot;

          // Dissipate smoothly as particles leave screen boundaries
          const distFromCenter = Math.hypot(p.x - centerX, p.y - centerY);
          const maxDist = Math.max(width, height) * 1.1;
          const particleAlpha = Math.max(0, Math.min(1, 1 - (distFromCenter / maxDist) * 0.85));

          if (particleAlpha > 0.01) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = particleAlpha;
            ctx.fillStyle = p.color;

            // Render crisp, glowing square pixel
            const pixelDim = p.size * depthScale;
            ctx.fillRect(-pixelDim / 2, -pixelDim / 2, pixelDim, pixelDim);
            ctx.restore();
          }
        }
        ctx.restore();

        // ─────────────────────────────────────────────────────────────
        // STAGE 3: Completion (at ~3.25s)
        // ─────────────────────────────────────────────────────────────
        if (shatterTime >= 1.7 && !hasTriggeredFinish.current) {
          hasTriggeredFinish.current = true;
          onCompleteRef.current?.();
          return;
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center select-none pointer-events-auto cursor-default"
    >
      {/* 
        Independent dark backdrop overlay:
        Transitions to opacity-0 smoothly over 750ms so the first page emerges 
        UNDERNEATH the flying pixels with ZERO abrupt cut or jump!
      */}
      <div
        ref={bgRef}
        className="absolute inset-0 bg-[#030611] transition-opacity duration-750 ease-out pointer-events-none"
      />

      {/* 
        Canvas renders particles directly over the backdrop and into the emerging first page
      */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none"
      />
    </div>
  );
}
