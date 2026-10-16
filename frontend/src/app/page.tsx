"use client";

import React, { useState, useEffect } from "react";
import { PrintFlow } from "@/components/print/PrintFlow";
import { PrinterIntroAnimation } from "@/components/intro/PrinterIntroAnimation";

export default function Page() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if intro has already been shown to this user
    // "No repetition" rule: once shown, it stores in localStorage and never repeats
    // URL param `?intro=true` can be used to preview it anytime
    const urlParams = new URLSearchParams(window.location.search);
    const forceIntro = urlParams.get("intro") === "true";
    const hasSeenIntro = localStorage.getItem("ru_portal_intro_shown");

    if (forceIntro || !hasSeenIntro) {
      setShowIntro(true);
    } else {
      setShowIntro(false);
    }
  }, []);

  // During SSR / first hydration tick, render PrintFlow directly
  if (showIntro === null) {
    return <PrintFlow />;
  }

  return (
    <>
      {showIntro && (
        <PrinterIntroAnimation
          onComplete={() => {
            setShowIntro(false);
          }}
        />
      )}
      <PrintFlow />
    </>
  );
}
