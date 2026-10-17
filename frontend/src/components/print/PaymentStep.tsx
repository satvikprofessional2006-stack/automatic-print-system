"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PrintJob, calcFilesAmount, parsePageRange, BW_RATE, COLOR_RATE, BW_A3_RATE, COLOR_A3_RATE } from "@/lib/printStore";
import {
  CheckCircle2,
  Loader2,
  ArrowLeft,
  CreditCard,
  AlertCircle,
  Sparkles,
  FileCheck,
  Edit,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface Props {
  job: PrintJob;
  onBack: () => void;
  onPaid: (job: PrintJob) => void;
}

type PayState = "waiting" | "creating_order" | "verifying" | "success" | "failed";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaymentStep({ job, onBack, onPaid }: Props) {
  const [payState, setPayState] = useState<PayState>("waiting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isGatewayReady, setIsGatewayReady] = useState<boolean | null>(null);

  const { bwPages, colorPages, bwA3Pages, colorA3Pages } = calcFilesAmount(job.files);

  // Pre-load Razorpay checkout SDK
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Upload files to backend and register print job
  const uploadAndFinalize = async (paymentId?: string, utrNo?: string) => {
    setPayState("verifying");
    try {
      const uploadPromises = job.files.map(async (pf) => {
        const formData = new FormData();
        formData.append("file", pf.file);
        formData.append("copies", (pf.settings?.copies || 1).toString());
        formData.append("doubleSided", pf.settings?.doubleSided ? "true" : "false");
        formData.append("color", pf.settings?.color ? "true" : "false");
        formData.append("layout", pf.settings?.layout || "portrait");
        formData.append("paperSize", pf.settings?.paperSize || "A4");
        formData.append("pageRange", pf.settings?.pageRange || "all");
        formData.append("userName", job.name);
        if (paymentId) {
          formData.append("paymentId", paymentId);
        }
        if (utrNo) {
          formData.append("utrNo", utrNo);
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Upload failed");
        }
        return res.json();
      });

      await Promise.all(uploadPromises);

      const updatedJob = { ...job, status: "paid" as const };
      onPaid(updatedJob);
      setPayState("success");
    } catch (err: any) {
      console.error("Upload after payment error:", err);
      setErrorMessage(err?.message || "File upload failed after payment");
      setPayState("failed");
    }
  };

  // Trigger Payment Flow
  const handlePayNow = async () => {
    setPayState("creating_order");
    setErrorMessage("");

    try {
      // 1. Create order on server
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: job.amount,
          jobId: job.id,
          userName: job.name,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to initialize payment");
      }

      const orderData = await orderRes.json();
      setIsGatewayReady(orderData.configured);

      // If Razorpay keys are not yet configured in .env, simulate demo payment
      if (!orderData.configured || !orderData.keyId) {
        console.warn("Razorpay keys not detected. Simulating verified demo payment.");
        // Simulate brief verification
        setPayState("verifying");
        setTimeout(async () => {
          await uploadAndFinalize("demo_payment_" + Date.now());
        }, 1200);
        return;
      }

      // 2. Load script if not yet ready
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout SDK. Check internet connection.");
      }

      // 3. Open official Razorpay Checkout Modal
      const razorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "RU Print Portal",
        description: `Print Job #${job.id} (${job.totalPages} pages)`,
        image: "/Rishihood_University_idxo_lfgcw_2.png",
        order_id: orderData.orderId,
        prefill: {
          name: job.name,
          contact: job.enrollmentNo || "",
        },
        theme: {
          color: "#CC0033", // Rishihood University primary red
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          setPayState("verifying");
          try {
            // Verify signature on server
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                jobId: job.id,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }

            // Once verified, send print files to server with verified Payment ID and bank UTR
            await uploadAndFinalize(
              response.razorpay_payment_id,
              verifyData?.utrNo || response.razorpay_payment_id
            );
          } catch (verifyErr: any) {
            console.error("Verification error:", verifyErr);
            setErrorMessage(verifyErr?.message || "Payment verification failed");
            setPayState("failed");
          }
        },
        modal: {
          ondismiss: function () {
            setPayState("waiting");
          },
        },
      };

      const rzp = new window.Razorpay(razorpayOptions);
      rzp.on("payment.failed", function (response: any) {
        console.error("Razorpay payment failed:", response.error);
        setErrorMessage(response.error?.description || "Payment failed");
        setPayState("failed");
      });

      rzp.open();
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      setErrorMessage(err?.message || "Failed to start payment");
      setPayState("failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Secure Payment</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Review your print settings and complete payment via UPI, Cards, or NetBanking.
        </p>
      </div>

      {/* ── Order Summary Card ── */}
      <div className="rounded-2xl bg-card border border-border/70 p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Order Summary</h3>
            <span className="text-xs text-muted-foreground font-mono">
              ({job.files.length} {job.files.length === 1 ? "file" : "files"})
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            title="Edit document settings"
          >
            <Edit className="h-3 w-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Clean File Items List */}
        <div className="divide-y divide-border/30">
          {job.files.map((f, idx) => {
            const docPages = f.settings?.pages || 1;
            const rangeRes = parsePageRange(f.settings?.pageRange, docPages, f.settings?.pageMode);
            const effectivePages = rangeRes.valid ? rangeRes.count : docPages;
            const copies = f.settings?.copies || 1;
            const isDoubleSided = f.settings?.doubleSided || false;
            const isColor = f.settings?.color || false;
            const paperSize = f.settings?.paperSize || "A4";
            const isA3 = paperSize === "A3";
            const rate = isA3
              ? (isColor ? COLOR_A3_RATE : BW_A3_RATE)
              : (isColor ? COLOR_RATE : BW_RATE);
            const printedSides = effectivePages * copies;
            const subtotal = printedSides * rate;
            const layout = f.settings?.layout || "portrait";
            const orientation = layout.toLowerCase() === "landscape" ? "Landscape" : "Portrait";

            // Simple, clean bullet description
            const details: string[] = [];
            details.push(isColor ? "Colour" : "B&W");
            details.push(paperSize);
            details.push(orientation);
            details.push(isDoubleSided ? "Double-sided" : "Single-sided");
            if (f.settings?.pagesPerSheet && f.settings.pagesPerSheet > 1) {
              details.push(`${f.settings.pagesPerSheet}-up`);
            }
            if (copies > 1) {
              details.push(`${copies} copies`);
            }
            details.push(`${effectivePages} ${effectivePages === 1 ? "page" : "pages"}`);

            return (
              <div
                key={f.name + idx}
                className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-foreground truncate" title={f.name}>
                      {f.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 pl-5.5">
                    {details.join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-foreground">
                    ₹{subtotal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Amount Due Card ── */}
      <div className="rounded-2xl bg-primary/8 border border-primary/25 p-5 flex items-center justify-between shadow-2xs">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Amount Due
          </p>
          <p className="text-4xl font-bold font-mono text-primary mt-1">₹{job.amount}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] text-muted-foreground mr-1">
              Job #{job.id} · {job.files.length} file{job.files.length !== 1 ? "s" : ""}
            </span>
            {bwPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/80 text-foreground/90 font-medium text-[10px] border border-border/60">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span>{bwPages} A4 B&amp;W</span>
              </span>
            )}
            {colorPages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium text-[10px] border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{colorPages} A4 Colour</span>
              </span>
            )}
            {bwA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-[10px] border border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>{bwA3Pages} A3 B&amp;W</span>
              </span>
            )}
            {colorA3Pages > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium text-[10px] border border-purple-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>{colorA3Pages} A3 Colour</span>
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3395FF]/10 border border-[#3395FF]/25">
            <span
              style={{ fontFamily: "'Arial Black', sans-serif", letterSpacing: '-0.03em' }}
              className="text-[13px] font-black text-[#3395FF] leading-none tracking-tight"
            >
              razor<span className="text-[#072654] dark:text-[#60a5fa]">pay</span>
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground font-medium">Secure Payment Gateway</span>
        </div>
      </div>

      {/* ── Payment State Content ── */}
      <AnimatePresence mode="wait">
        {(payState === "waiting" || payState === "creating_order") && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Primary Payment Gateway Button */}
            <Button
              type="button"
              disabled={payState === "creating_order"}
              onClick={handlePayNow}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {payState === "creating_order" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to Gateway…</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Pay ₹{job.amount} with UPI / Cards</span>
                </>
              )}
            </Button>

            {/* Gateway Information Badge */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  GPay • PhonePe • Paytm • Cards • NetBanking
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold tracking-wider">
                Gateway Powered
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={payState === "creating_order"}
              className="gap-2 text-sm w-full rounded-xl cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Preview
            </Button>
          </motion.div>
        )}

        {payState === "verifying" && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-sm text-foreground">Verifying Payment…</p>
              <p className="text-xs text-muted-foreground">
                Confirming transaction receipt and queueing your print job. Please wait.
              </p>
            </div>
          </motion.div>
        )}

        {payState === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div className="p-4 rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-bold text-lg text-foreground">Payment Confirmed!</p>
              <p className="text-xs text-muted-foreground">
                Your payment has been verified. Show your Task ID at the print counter to collect your prints.
              </p>
            </div>
          </motion.div>
        )}

        {payState === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 py-2"
          >
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Payment Incomplete</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {errorMessage || "The transaction could not be completed. No amount was deducted."}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setPayState("waiting");
                setErrorMessage("");
              }}
              className="w-full rounded-xl text-sm h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
            >
              Try Again
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="gap-2 text-sm w-full rounded-xl cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Preview
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
