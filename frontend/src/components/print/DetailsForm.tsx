"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/print/FileUpload";
import { UserType, PrintFile, calcAmount } from "@/lib/printStore";
import { ArrowRight, ArrowLeft, GraduationCap, User2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userType: UserType;
  name: string;
  onNameChange: (val: string) => void;
  enrollmentNo: string;
  onEnrollmentChange: (val: string) => void;
  files: PrintFile[];
  onFilesChange: (files: PrintFile[]) => void;
  onBack: () => void;
  onNext: (data: {
    name: string;
    enrollmentNo?: string;
    files: PrintFile[];
    totalPages: number;
    amount: number;
  }) => void;
}

export function DetailsForm({ 
  userType, 
  name, onNameChange, 
  enrollmentNo, onEnrollmentChange, 
  files, onFilesChange, 
  onBack, onNext 
}: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computedTotalPages = files.reduce(
    (sum, f) => sum + (f.settings?.pages || 1) * (f.settings?.copies || 1),
    0
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required.";
    if (userType === "student" && !enrollmentNo.trim())
      e.enrollmentNo = "Enrollment number is required.";
    if (files.length === 0) e.files = "Please upload at least one file.";
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    onNext({
      name: name.trim(),
      enrollmentNo: userType === "student" ? enrollmentNo.trim() : undefined,
      files,
      totalPages: computedTotalPages,
      amount: calcAmount(computedTotalPages),
    });
  };

  const Icon = userType === "student" ? GraduationCap : User2;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <div className="inline-flex items-center gap-2 mb-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
          <Icon className="h-3.5 w-3.5" />
          {userType === "student" ? "Student" : "Other"}
        </div>
        <h2 className="text-xl font-bold tracking-tight">Your details &amp; files</h2>
      </div>

      <div className="space-y-2">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80">Full Name *</label>
            <Input
              placeholder="e.g. Arjun Sharma"
              value={name}
              onChange={(e) => {
                onNameChange(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
              }}
              className={cn("bg-background border-border/60", errors.name && "border-destructive focus-visible:ring-destructive")}
            />
            {errors.name && <p className="text-xs text-destructive mt-1.5 px-1">{errors.name}</p>}
          </div>

          {userType === "student" && (
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                Enrollment Number <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. 2503210042"
                value={enrollmentNo}
                onChange={(e) => {
                  onEnrollmentChange(e.target.value);
                  if (errors.enrollmentNo) setErrors(prev => ({ ...prev, enrollmentNo: "" }));
                }}
                className={cn("bg-background border-border/60", errors.enrollmentNo && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.enrollmentNo && <p className="text-xs text-destructive mt-1.5 px-1">{errors.enrollmentNo}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-foreground/80 mb-2">
              Upload Files <span className="text-destructive">*</span>
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

          {files.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground/80">Total Pages</p>
                  <p className="text-[11px] text-muted-foreground">{computedTotalPages} pages across all copies</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground/80">Estimated Cost</p>
                  <p className="font-bold text-primary">₹{calcAmount(computedTotalPages)}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-right mt-1.5 px-1">(₹1 per page, min ₹5)</p>
            </div>
          )}
        </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 rounded-xl text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={handleNext}
          className="gap-2 rounded-xl text-sm flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
