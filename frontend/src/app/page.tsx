"use client";

import React, { useState, useEffect } from "react";
import { PrintFlow } from "@/components/print/PrintFlow";
import { PrinterIntroAnimation } from "@/components/intro/PrinterIntroAnimation";

export default function Page() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if intro has already been played in this browser session
    // You can test it by clearing sessionStorage or passing ?intro=true in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const forceIntro = urlParams.get("intro") === "true";
    const hasSeenIntro = sessionStorage.getItem("ru_intro_seen");

    if (forceIntro || !hasSeenIntro) {
      setShowIntro(true);
    } else {
      setShowIntro(false);
    }
  }, []);

  // During SSR / first hydration tick, render PrintFlow directly or hold
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
