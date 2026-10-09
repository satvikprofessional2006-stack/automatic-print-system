"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LoginPage } from "@/components/LoginPage";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { StatCards } from "@/components/StatCards";
import { PrintJobsTable } from "@/components/admin/PrintJobsTable";
import { RevenueTab } from "@/components/admin/RevenueTab";
import { Info } from "lucide-react";

function AdminDashboardContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("logs");

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="h-7 w-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex flex-col font-sans">
      <Header />
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 overflow-hidden p-3 md:p-6 min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === "logs" && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                className="h-full flex flex-col gap-6 min-h-0"
              >
                <div className="flex flex-row items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">Print Logs</h2>
                  <div className="relative group flex items-center">
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute top-full mt-2 left-0 w-64 p-2 bg-card border border-border text-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      All print jobs submitted through the portal — live, auto-refreshing every 5 s.
                    </div>
                  </div>
                </div>
                <PrintJobsTable />
              </motion.div>
            )}

            {activeTab === "revenue" && (
              <motion.div
                key="revenue"
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                className="h-full flex flex-col min-h-0"
              >
                <RevenueTab />
              </motion.div>
            )}

            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                className="h-full overflow-y-auto space-y-6"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                  <p className="text-xs text-muted-foreground/80">
                    Summary of print activity across all stations.
                  </p>
                </div>
                <StatCards />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AuthProvider>
      <AdminDashboardContent />
    </AuthProvider>
  );
}
