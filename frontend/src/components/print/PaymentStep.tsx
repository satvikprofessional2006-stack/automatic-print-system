"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PrintJob, parsePageRange, BW_RATE, COLOR_RATE, BW_A3_RATE, COLOR_A3_RATE } from "@/lib/printStore";
import {
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertCircle,
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

  // Pre-load Razorpay checkout SDK
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Upload files to backend and register print job
  const uploadAndFinalize = async (paymentId?: string) => {
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

            // Once verified, send print files to server
            await uploadAndFinalize(response.razorpay_payment_id);
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
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Payment</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review your order and proceed to pay.
        </p>
      </div>

      {/* ── Clean Unified Order & Total Card ── */}
      <div className="rounded-2xl bg-card border border-border/60 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Order Summary
          </span>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
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

            const details: string[] = [];
            details.push(isColor ? "Colour" : "B&W");
            details.push(paperSize);
            details.push(isDoubleSided ? "Double-sided" : "Single-sided");
            if (copies > 1) {
              details.push(`${copies} copies`);
            }
            details.push(`${effectivePages} ${effectivePages === 1 ? "page" : "pages"}`);

            return (
              <div
                key={f.name + idx}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs font-semibold text-foreground truncate" title={f.name}>
                      {f.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 pl-5.5">
                    {details.join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-semibold text-foreground">
                    ₹{subtotal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clean Total Row */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground">Total Due</span>
            <p className="text-[11px] text-muted-foreground/70 font-mono">
              Job #{job.id}
            </p>
          </div>
          <span className="text-2xl font-bold font-mono text-foreground tracking-tight">
            ₹{job.amount}
          </span>
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
            className="space-y-3"
          >
            {/* Primary Payment Button */}
            <Button
              type="button"
              disabled={payState === "creating_order"}
              onClick={handlePayNow}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {payState === "creating_order" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                <span>Pay ₹{job.amount}</span>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={payState === "creating_order"}
              className="text-xs text-muted-foreground hover:text-foreground w-full h-9 rounded-xl cursor-pointer"
            >
              Back to Preview
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
                Your files are now printing on the physical printer.
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
