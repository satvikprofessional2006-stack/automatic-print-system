'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [progresses, setProgresses] = useState<number[]>([]);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [waitingForPrinter, setWaitingForPrinter] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);

  useEffect(() => {
    if (!waitingForPrinter || activeJobIds.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const statuses = await Promise.all(
          activeJobIds.map(id => fetch(`/api/jobs/${id}`).then(res => res.json()))
        );

        // Check if all jobs are marked as printed
        const allPrinted = statuses.every(job => job.status === 'printed');
        
        if (allPrinted) {
          setWaitingForPrinter(false);
          setSuccess(true);
          setActiveJobIds([]);
          
          // Fetch final queue count
          const qRes = await fetch('/api/queue-status');
          if (qRes.ok) {
            const qData = await qRes.json();
            setQueueCount(qData.count);
          }
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [waitingForPrinter, activeJobIds]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.type === 'image/jpeg');
      
      if (validFiles.length !== selectedFiles.length) {
        setError('Some files were ignored. Only PDF and JPEG are supported.');
      } else {
        setError('');
      }
      setFiles(prev => [...prev, ...validFiles]);
      setSuccess(false);
      setProgresses([]);
      setQueueCount(null);
      
      // Clear input so the same file can be selected again if removed
      e.target.value = '';
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handlePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file first.');
      return;
    }

    setLoading(true);
    setError('');
    setProgresses(new Array(files.length).fill(0));

    try {
      // Upload all files concurrently using XMLHttpRequest to track progress
      const uploadPromises = files.map((file, index) => {
        return new Promise<string>((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('copies', copies.toString());

          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload', true);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setProgresses(prev => {
                const newProgresses = [...prev];
                newProgresses[index] = percentComplete;
                return newProgresses;
              });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                resolve(res.id); // Resolve with jobId
              } catch {
                resolve('');
              }
            } else {
              try {
                const res = JSON.parse(xhr.responseText);
                reject(new Error(res.error || 'Upload failed'));
              } catch {
                reject(new Error('Upload failed'));
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(formData);
        });
      });

      const ids = await Promise.all(uploadPromises);
      const validIds = ids.filter(id => id !== '');
      
      if (validIds.length > 0) {
        setActiveJobIds(validIds);
        setWaitingForPrinter(true);
      } else {
        throw new Error('Failed to retrieve job IDs');
      }

      setFiles([]);
      setCopies(1);
      setProgresses([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalProgress = progresses.length > 0 
    ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) 
    : 0;

  if (waitingForPrinter) {
    return (
      <main>
        <h1>Waiting for Printer... 🖨️</h1>
        <p className="subtitle">Your documents are in the queue. Please wait while they physically print.</p>
        
        <div style={{ marginTop: '30px', opacity: 0.8 }}>
          <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--foreground)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main>
        <h1>SUCCESS! 🎉</h1>
        <p className="subtitle">Your documents have been sent to the printer.</p>
        
        {queueCount !== null && (
          <div style={{
            background: 'var(--card-bg)', 
            padding: '15px 20px', 
            borderRadius: '8px',
            border: '1px solid var(--border)',
            margin: '20px auto',
            maxWidth: '300px'
          }}>
            <h2 style={{ fontSize: '18px', marginBottom: '5px' }}>Queue Status</h2>
            <p style={{ opacity: 0.8, margin: 0, fontSize: '14px' }}>
              There {queueCount === 1 ? 'is' : 'are'} currently <strong>{queueCount}</strong> document{queueCount !== 1 ? 's' : ''} in the print queue.
            </p>
          </div>
        )}

        <button onClick={() => setSuccess(false)} className="btn-primary" style={{marginTop: '10px'}}>
          PRINT MORE DOCUMENTS
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>PRINT YOUR DOCUMENT</h1>
      <p className="subtitle">Upload PDFs to send them to the campus printer.</p>

      <div className="card">
        <form onSubmit={handlePrint}>
          <div className="form-group">
            <label>1. Select PDF/JPEG Files</label>
            <input 
              type="file" 
              accept=".pdf,.jpg,.jpeg" 
              multiple
              onChange={handleFileChange}
              disabled={loading}
            />
            {files.length > 0 && (
              <ul style={{ marginTop: '15px', listStyle: 'none', padding: 0 }}>
                {files.map((f, i) => (
                  <li key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--card-bg)',
                    padding: '8px 12px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontSize: '14px'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      {f.name}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => removeFile(i)}
                      style={{
                        background: 'transparent',
                        color: 'var(--error)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        padding: '0 5px'
                      }}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label>2. Number of Copies (per file)</label>
            <div className="copies-control">
              <button 
                type="button" 
                className="copies-btn" 
                onClick={() => setCopies(Math.max(1, copies - 1))}
              >
                -
              </button>
              <div className="copies-display">{copies}</div>
              <button 
                type="button" 
                className="copies-btn" 
                onClick={() => setCopies(Math.min(10, copies + 1))}
              >
                +
              </button>
            </div>
          </div>

          {error && <p style={{ color: 'var(--error)', fontWeight: 'bold' }}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading || files.length === 0}>
            {loading ? `UPLOADING... ${totalProgress}%` : `PRINT ${files.length} FILE(S)`}
          </button>
        </form>
      </div>
    </main>
  );
}
