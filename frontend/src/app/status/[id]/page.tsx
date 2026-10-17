'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function StatusPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) throw new Error('Job not found');
        const data = await res.json();
        setJob(data);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchStatus();
    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (error) {
    return (
      <main>
        <div className="card status-container">
          <div className="status-icon" style={{color: 'var(--error)'}}>❌</div>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main>
        <div className="card status-container">
          <h2>Loading status...</h2>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="card status-container">
        {(job.status === 'paid' || job.status === 'pending_payment') && (
          <>
            <div className="status-icon">🎟️</div>
            <h2>Order Ready at Counter</h2>
            <div className="queue-position" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
              Payment Verified!
            </div>
            <p style={{ marginTop: '12px' }}>
              Show your <strong>Task ID ({job.taskDisplayId || job.orderId || job.id})</strong> to the operator at the print counter to release and collect your prints.
            </p>
          </>
        )}

        {job.status === 'queued' && (
          <>
            <div className="status-icon">⏳</div>
            <h2>Job Submitted!</h2>
            <div className="queue-position">
              You are #{job.position} in the print queue.
            </div>
            <p>Please wait, your document will be printed soon.</p>
          </>
        )}
        
        {job.status === 'printing' && (
          <>
            <div className="status-icon">🖨️</div>
            <h2>Printing Now...</h2>
            <p>Your document is currently being printed.</p>
          </>
        )}
        
        {job.status === 'completed' && (
          <>
            <div className="status-icon">✅</div>
            <h2>Print Completed!</h2>
            <p>Please collect your document from the printer.</p>
          </>
        )}
        
        {job.status === 'failed' && (
          <>
            <div className="status-icon" style={{color: 'var(--error)'}}>❌</div>
            <h2>Print Failed</h2>
            <p>There was an error communicating with the printer.</p>
          </>
        )}
        
        {job.status === 'cancelled' && (
          <>
            <div className="status-icon" style={{color: 'var(--error)'}}>🛑</div>
            <h2>Job Cancelled</h2>
            <p>This print job was cancelled by an administrator.</p>
            <div className="queue-position" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', marginTop: '12px' }}>
              ✓ Full Refund Initiated
            </div>
            <p style={{ fontSize: '13px', color: '#555', marginTop: '8px', lineHeight: '1.5' }}>
              A 100% refund has been initiated to your original payment method via Razorpay. It typically reflects in your UPI / bank account within 2–4 hours (instant for UPI).
            </p>
          </>
        )}

        {['completed', 'failed', 'cancelled'].includes(job.status) && (
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => window.location.href = '/'}
              className="btn-primary"
            >
              Print Another Document
            </button>
          </div>
        )}

        <div style={{ marginTop: '30px', textAlign: 'left', fontSize: '14px', color: '#666' }}>
          <p><strong>Order / Task ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{job.taskDisplayId || job.orderId || job.id}</span></p>
          <p><strong>File:</strong> {job.filename}</p>
          <p><strong>Copies:</strong> {job.copies}</p>
        </div>
      </div>
    </main>
  );
}
