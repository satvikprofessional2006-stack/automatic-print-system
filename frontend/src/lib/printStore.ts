// ─── Print Job Types ──────────────────────────────────────────────────────────

export type UserType = "student" | "other";
export type JobStatus = "pending_payment" | "paid" | "printing" | "completed" | "failed";

export interface PrintFile {
  name: string;
  size: number;
  type: string;
  file: File;
}

export interface PrintJob {
  id: string;           
  userType: UserType;
  name: string;
  enrollmentNo?: string; 
  files: PrintFile[];
  totalPages: number;   
  amount: number;       
  upiRef?: string;      
  status: JobStatus;
  createdAt: string;    
  updatedAt: string;
}

// ₹1 per page, minimum ₹5
export function calcAmount(pages: number): number {
  if (!pages || pages <= 0) return 5;
  return Math.max(pages, 5);
}
