"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleAuthStep } from "@/components/print/GoogleAuthStep";
import { DetailsForm } from "@/components/print/DetailsForm";
import { PrintOptions } from "@/components/print/PrintOptions";
import { PreviewStep } from "@/components/print/PreviewStep";
import { PaymentStep } from "@/components/print/PaymentStep";
import { PrintSuccess } from "@/components/print/PrintSuccess";
import { StudentTasksDrawer, StudentTaskItem } from "@/components/print/StudentTasksDrawer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserType, PrintFile, PrintJob, StudentAuth, calcFilesAmount } from "@/lib/printStore";
import { Printer, ChevronRight, ArrowLeft, LogOut, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "auth" | "details" | "options" | "preview" | "payment" | "success";

const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Upload & Info" },
  { id: "options", label: "Settings" },
  { id: "preview", label: "Preview" },
  { id: "payment", label: "Payment" },
  { id: "success", label: "Printing" },
];

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
    scale: 0.98,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    scale: 0.98,
  }),
};

export function PrintFlow() {
  const [step, setStep] = useState<Step>("auth");
  const [dir, setDir] = useState(1);

  const [studentAuth, setStudentAuth] = useState<StudentAuth | null>(null);
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftEnrollment, setDraftEnrollment] = useState("");
  const [draftFiles, setDraftFiles] = useState<PrintFile[]>([]);

  // Today's student tasks state & drawer
  const [tasks, setTasks] = useState<StudentTaskItem[]>([]);
  const [isTasksDrawerOpen, setIsTasksDrawerOpen] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchMyTasks = async (nameOverride?: string, emailOverride?: string) => {
    const targetName = nameOverride || studentAuth?.name || draftName;
    const targetEmail = emailOverride || studentAuth?.email;
    if (!targetName && !targetEmail) return;
    try {
      setLoadingTasks(true);
      const params = new URLSearchParams();
      if (targetName) params.set("userName", targetName);
      if (targetEmail) params.set("email", targetEmail);
      const res = await fetch(`/api/student/my-jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch student tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Restore authenticated student session & active print job on initial page load
  useEffect(() => {
    try {
      // 1. Check if there is an active recent print job (within last 12 hours)
      const savedJobStr = localStorage.getItem("ru_active_job");
      let restoredJob: PrintJob | null = null;
      if (savedJobStr) {
        try {
          const parsed = JSON.parse(savedJobStr);
          const createdAt = new Date(parsed.createdAt || "").getTime();
          // Keep active job for up to 12 hours so student can close site, walk to library, and see step 6
          if (!isNaN(createdAt) && Date.now() - createdAt < 12 * 60 * 60 * 1000) {
            restoredJob = parsed;
          } else {
            localStorage.removeItem("ru_active_job");
          }
        } catch {}
      }

      // 2. Restore authenticated student session
      const savedSession = localStorage.getItem("ru_student_session");
      if (savedSession) {
        const student: StudentAuth = JSON.parse(savedSession);
        if (student?.email) {
          setStudentAuth(student);
          setDraftName(student.name || "");
          const savedEnrollment = localStorage.getItem(`ru_enrollment_${student.email}`) || "";
          setDraftEnrollment(savedEnrollment.trim().length >= 8 ? savedEnrollment.trim() : "");
          fetchMyTasks(student.name, student.email);
          
          if (restoredJob) {
            setActiveJob(restoredJob);
            setStep("success");
            return;
          }

          setStep("details");
          return;
        }
      }

      if (restoredJob) {
        setActiveJob(restoredJob);
        setStep("success");
      }
    } catch (e) {
      console.error("Session restore error:", e);
    }
  }, []);

  const go = (next: Step, direction: number) => {
    setDir(direction);
    setStep(next);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleAuthSuccess = (student: StudentAuth) => {
    setStudentAuth(student);
    setDraftName(student.name);
    const savedEnrollment = localStorage.getItem(`ru_enrollment_${student.email}`) || "";
    setDraftEnrollment(savedEnrollment.trim().length >= 8 ? savedEnrollment.trim() : "");
    fetchMyTasks(student.name, student.email);
    go("details", 1);
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem("ru_student_session");
    } catch {}
    setStudentAuth(null);
    setDraftName("");
    setDraftEnrollment("");
    setDraftFiles([]);
    go("auth", -1);
  };

  const handleDetailsNext = (data: {
    name: string;
    email?: string;
    enrollmentNo?: string;
    userType?: UserType;
    files: PrintFile[];
    totalPages: number;
    amount: number;
  }) => {
    const job: PrintJob = {
      id: Math.random().toString(36).slice(2, 10).toUpperCase(),
      userType: data.userType || (studentAuth?.userType || "student"),
      name: data.name,
      email: data.email || studentAuth?.email,
      enrollmentNo: data.enrollmentNo,
      files: data.files,
      totalPages: data.totalPages,
      amount: data.amount,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setActiveJob(job);
    go("options", 1);
  };

  const handleOptionsUpdateFiles = (newFiles: PrintFile[]) => {
    if (activeJob) {
      const { totalPages, totalAmount } = calcFilesAmount(newFiles);
      setActiveJob({
        ...activeJob,
        files: newFiles,
        totalPages,
        amount: totalAmount,
      });
    }
  };

  const handleOptionsNext = () => {
    go("preview", 1);
  };

  const handlePreviewNext = () => {
    go("payment", 1);
  };

  const handlePaid = (job: PrintJob) => {
    setActiveJob(job);
    try {
      localStorage.setItem("ru_active_job", JSON.stringify(job));
    } catch {}
    fetchMyTasks(job.name || studentAuth?.name, studentAuth?.email || job.email);
    go("success", 1);
  };

  const handleReset = () => {
    try {
      localStorage.removeItem("ru_active_job");
    } catch {}
    setActiveJob(null);
    setDraftFiles([]);
    // Returning users start directly at details since they remain signed in
    if (studentAuth) {
      go("details", -1);
    } else {
      go("auth", -1);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-background flex flex-col font-sans">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 flex items-center justify-between bg-[#FFE5CD] dark:bg-card border-b border-border/60 px-4 sm:px-8 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-4">
          {step !== "auth" && (
            <button 
              onClick={() => {
                if (step === "details") go("auth", -1);
                else if (step === "options") go("details", -1);
                else if (step === "preview") go("options", -1);
                else if (step === "payment") go("preview", -1);
                else if (step === "success") go(studentAuth ? "details" : "auth", -1);
              }}
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1 sm:mr-0 cursor-pointer"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-foreground/80" />
            </button>
          )}
          
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/Rishihood_University_idxo_lfgcw_2.png"
              alt="RU"
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
            />
            <div>
              <p className="text-xs sm:text-sm font-bold leading-tight text-foreground">RU Print Portal</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 leading-tight">
                Rishihood University
              </p>
            </div>
          </div>
        </div>

        {/* Right side: My Tasks button, user pill & theme toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {studentAuth && (
            <button
              type="button"
              onClick={() => {
                fetchMyTasks();
                setIsTasksDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-card/80 hover:bg-card border border-border/80 text-xs font-semibold text-foreground shadow-2xs hover:border-primary/50 transition-all cursor-pointer"
              title="View Today's Print Tasks"
            >
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">My Tasks</span>
              <span className="sm:hidden">Tasks</span>
              {tasks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {tasks.length}
                </span>
              )}
            </button>
          )}

          {studentAuth && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-card/70 border border-border/60 text-xs shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground truncate max-w-[140px]">
                {studentAuth.name.split(" ")[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground text-[10px] ml-1 p-0.5 cursor-pointer"
                title="Sign out"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex items-start justify-center px-3 sm:px-4 pt-2 sm:pt-4 pb-28 sm:pb-12">
        <div className="w-full max-w-lg">

          {/* Step progress bar (shown during active printing flow) */}
          {step !== "auth" && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                {STEPS.map((s, i) => {
                  const isActive = s.id === step;
                  const isDone = i < stepIndex;
                  return (
                    <React.Fragment key={s.id}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300",
                            isActive
                              ? "bg-primary border-primary text-primary-foreground scale-110 shadow-xs"
                              : isDone
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-muted/50 border-border/50 text-muted-foreground"
                          )}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-medium hidden sm:block transition-colors",
                            isActive ? "text-primary font-semibold" : "text-muted-foreground"
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={cn(
                            "flex-1 h-0.5 mx-1 rounded-full transition-all duration-500",
                            i < stepIndex ? "bg-primary" : "bg-border/50"
                          )}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-sm overflow-hidden mb-6">
            <div className="p-4 sm:p-5">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={step}
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
                >
                  {step === "auth" && (
                    <GoogleAuthStep onSuccess={handleAuthSuccess} />
                  )}
                  {step === "details" && (
                    <DetailsForm
                      studentAuth={studentAuth}
                      name={draftName}
                      onNameChange={setDraftName}
                      enrollmentNo={draftEnrollment}
                      onEnrollmentChange={setDraftEnrollment}
                      files={draftFiles}
                      onFilesChange={setDraftFiles}
                      onBack={() => go("auth", -1)}
                      onSignOut={handleSignOut}
                      onNext={handleDetailsNext}
                    />
                  )}
                  {step === "options" && activeJob && (
                    <PrintOptions
                      files={activeJob.files}
                      onUpdateFiles={handleOptionsUpdateFiles}
                      onBack={() => go("details", -1)}
                      onNext={handleOptionsNext}
                    />
                  )}
                  {step === "preview" && activeJob && (
                    <PreviewStep
                      files={activeJob.files}
                      onUpdateFiles={handleOptionsUpdateFiles}
                      onBack={() => go("options", -1)}
                      onNext={handlePreviewNext}
                    />
                  )}
                  {step === "payment" && activeJob && (
                    <PaymentStep
                      job={activeJob}
                      onPaid={handlePaid}
                      onBack={() => go("preview", -1)}
                    />
                  )}
                  {step === "success" && activeJob && (
                    <PrintSuccess
                      job={activeJob}
                      onReset={handleReset}
                      onOpenTasks={() => {
                        fetchMyTasks();
                        setIsTasksDrawerOpen(true);
                      }}
                      todayTasksCount={tasks.length}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-muted-foreground/60">
            Official Rishihood University Direct Print System
          </p>

        </div>
      </div>

      {/* Student's Today's Tasks Drawer */}
      <StudentTasksDrawer
        isOpen={isTasksDrawerOpen}
        onClose={() => setIsTasksDrawerOpen(false)}
        tasks={tasks}
        loading={loadingTasks}
        onRefresh={() => fetchMyTasks()}
        studentName={studentAuth?.name}
      />
    </div>
  );
}
