"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/print/FileUpload";
import { UserType, PrintFile, StudentAuth, calcFilesAmount, BW_RATE, COLOR_RATE } from "@/lib/printStore";
import { ArrowRight, ArrowLeft, GraduationCap, CheckCircle2, ShieldCheck, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userType?: UserType;
  studentAuth?: StudentAuth | null;
  name: string;
  onNameChange: (val: string) => void;
  enrollmentNo: string;
  onEnrollmentChange: (val: string) => void;
  files: PrintFile[];
  onFilesChange: (files: PrintFile[]) => void;
  onBack: () => void;
  onSignOut?: () => void;
  onNext: (data: {
    name: string;
    email?: string;
    enrollmentNo?: string;
    files: PrintFile[];
    totalPages: number;
    amount: number;
  }) => void;
}

export function DetailsForm({ 
  userType = "student",
  studentAuth,
  name,
  onNameChange, 
  enrollmentNo,
  onEnrollmentChange, 
  files,
  onFilesChange, 
  onBack,
  onSignOut,
  onNext 
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAutoFilled, setIsAutoFilled] = useState<boolean>(false);

  // Auto-fill and check stored enrollment ID on mount
  useEffect(() => {
    if (studentAuth?.name) {
      onNameChange(studentAuth.name);
    }

    if (studentAuth?.email) {
      try {
        const stored = localStorage.getItem(`ru_enrollment_${studentAuth.email}`);
        // Only consider it saved if it's the full ERP enrollment (not the short 5-digit email alias)
        if (stored && stored.trim().length >= 8) {
          onEnrollmentChange(stored.trim());
          setIsAutoFilled(true);
        } else {
          onEnrollmentChange("");
          setIsAutoFilled(false);
          // Clean up old short alias from storage
          localStorage.removeItem(`ru_enrollment_${studentAuth.email}`);
        }
      } catch {}
    }
  }, [studentAuth]);

  const { bwPages, colorPages, totalPages, bwAmount, colorAmount, totalAmount } = calcFilesAmount(files);

  const validate = () => {
    const validationErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      validationErrors.name = "Full Name is required.";
    }
    
    if (!enrollmentNo.trim()) {
      validationErrors.enrollmentNo = "Enrollment number is required.";
    } else if (enrollmentNo.trim().length < 8) {
      validationErrors.enrollmentNo = "Please enter your full 10-digit ERP enrollment number (e.g. 2502140110).";
    }
    
    if (files.length === 0) {
      validationErrors.files = "Please upload at least one document to print.";
    }
    
    return validationErrors;
  };

  const handleNext = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Save full ERP enrollment number to localStorage linked to student's email
    if (studentAuth?.email && enrollmentNo.trim()) {
      try {
        localStorage.setItem(`ru_enrollment_${studentAuth.email}`, enrollmentNo.trim());
      } catch (e) {
        console.error("Storage error:", e);
      }
    }

    setErrors({});
    onNext({
      name: name.trim(),
      email: studentAuth?.email,
      enrollmentNo: enrollmentNo.trim(),
      files,
      totalPages: totalPages,
      amount: totalAmount,
    });
  };

  return (
    <div className="space-y-4">
      {/* Verified Student Header Banner */}
      {studentAuth ? (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-card border border-border/70 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {studentAuth.picture ? (
              <img
                src={studentAuth.picture}
                alt={studentAuth.name}
                className="h-10 w-10 rounded-full border border-border/60 object-cover shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                {(studentAuth.name || "S")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-bold text-foreground truncate">
                  {studentAuth.name}
                </p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Verified Student
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                {studentAuth.email}
              </p>
            </div>
          </div>

          {onSignOut && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
              title="Switch account"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          )}
        </div>
      ) : (
        <div>
          <div className="inline-flex items-center gap-2 mb-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
            <GraduationCap className="h-3.5 w-3.5" />
            Student Details
          </div>
          <h2 className="text-xl font-bold tracking-tight">Your details &amp; files</h2>
        </div>
      )}

      <div className="space-y-3">
        {/* Name — locked if signed in with Google */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground/80">Full Name *</label>
            {studentAuth && (
              <span className="text-[10px] text-muted-foreground/80 font-medium">
                Verified from Google (locked)
              </span>
            )}
          </div>
          <Input
            placeholder="e.g. Satvik Kesarwani"
            value={name}
            readOnly={!!studentAuth}
            tabIndex={studentAuth ? -1 : 0}
            onChange={(e) => {
              if (!studentAuth) {
                onNameChange(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
              }
            }}
            className={cn(
              "bg-background border-border/60 transition-colors",
              studentAuth && "bg-muted/40 text-foreground/90 cursor-default select-none border-border/40 focus-visible:ring-0",
              errors.name && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {errors.name && <p className="text-xs text-destructive mt-1 px-1">{errors.name}</p>}
        </div>

        {/* Enrollment Number */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground/80">
              Enrollment Number <span className="text-destructive">*</span>
            </label>
            {isAutoFilled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" /> Auto-filled
              </span>
            )}
          </div>
          <Input
            placeholder="e.g. 2502140110"
            value={enrollmentNo}
            autoFocus={!enrollmentNo}
            onChange={(e) => {
              onEnrollmentChange(e.target.value);
              setIsAutoFilled(false);
              if (errors.enrollmentNo) setErrors(prev => ({ ...prev, enrollmentNo: "" }));
            }}
            className={cn(
              "bg-background border-border/60 font-mono text-sm tracking-wide",
              errors.enrollmentNo && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {errors.enrollmentNo ? (
            <p className="text-xs text-destructive mt-1 px-1">{errors.enrollmentNo}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground px-0.5">
              Enter your enrollment ID
            </p>
          )}
        </div>

        {/* File Upload Section */}
        <div>
          <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
            Upload Documents <span className="text-destructive">*</span>
          </label>
          <FileUpload 
            files={files}
            onChange={(newFiles) => {
              onFilesChange(newFiles);
              if (newFiles.length > 0 && errors.files) {
                setErrors(prev => ({ ...prev, files: "" }));
              }
            }}
          />
          {errors.files && <p className="text-xs text-destructive mt-1.5 px-1">{errors.files}</p>}
        </div>

        {/* Price & Pages Summary */}
        {files.length > 0 && (
          <div className="pt-2">
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground/80">Total Pages</p>
                  <p className="text-[11px] text-muted-foreground">
                    {totalPages} page{totalPages !== 1 ? 's' : ''} across all files
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground/80">Estimated Cost</p>
                  <p className="font-bold text-lg text-primary">₹{totalAmount}</p>
                </div>
              </div>

              {/* Breakdown tag pills */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-primary/10 gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  {bwPages > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground/90 font-medium text-[10px] border border-border/50">
                      📄 {bwPages} B&amp;W (₹{bwAmount})
                    </span>
                  )}
                  {colorPages > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium text-[10px] border border-rose-500/20">
                      🎨 {colorPages} Colour (₹{colorAmount})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  (B&amp;W: ₹{BW_RATE}/pg · Colour: ₹{COLOR_RATE}/pg)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-3 pb-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 rounded-xl text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          className="gap-2 rounded-xl text-sm flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-bold"
        >
          Continue to Settings <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
