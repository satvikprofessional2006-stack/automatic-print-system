'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [userName, setUserName] = useState('');
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [progresses, setProgresses] = useState<number[]>([]);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [waitingForPrinter, setWaitingForPrinter] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!waitingForPrinter || activeJobIds.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const statuses = await Promise.all(
          activeJobIds.map(id => fetch(`/api/jobs/${id}`).then(res => res.json()))
        );

        // Check if all jobs are marked as completed
        const allPrinted = statuses.every(job => job.status === 'completed');
        
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

  const compressImage = async (file: File): Promise<File> => {
    let processFile = file;
    const nameExt = file.name.toLowerCase();
    
    // Convert HEIC to JPEG natively for iOS users
    if (processFile.type === 'image/heic' || processFile.type === 'image/heif' || nameExt.endsWith('.heic') || nameExt.endsWith('.heif')) {
      try {
        // Dynamically import to avoid SSR issues
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: processFile,
          toType: "image/jpeg",
          quality: 0.8
        });
        
        // Handle both single Blob and Blob[] returns
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        processFile = new File([finalBlob], processFile.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
      } catch (e) {
        console.error("HEIC conversion failed", e);
      }
    }

    return new Promise((resolve) => {
      if (!processFile.type.startsWith('image/')) {
        resolve(processFile);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(processFile);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], processFile.name, { type: 'image/jpeg', lastModified: Date.now() });
              resolve(compressedFile);
            } else {
              resolve(processFile);
            }
          }, 'image/jpeg', 0.8);
        };
        img.onerror = () => resolve(processFile);
      };
      reader.onerror = () => resolve(processFile);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(f => {
        const name = f.name.toLowerCase();
        return f.type === 'application/pdf' || 
               f.type.startsWith('image/') ||
               name.endsWith('.pdf') ||
               name.endsWith('.jpg') ||
               name.endsWith('.jpeg') ||
               name.endsWith('.png') ||
               name.endsWith('.heic') ||
               name.endsWith('.heif');
      });
      
      if (validFiles.length !== selectedFiles.length) {
        setError('Some files were ignored. Only PDF and Images are supported.');
      } else {
        setError('');
      }
      
      setLoading(true);
      try {
        const compressedFiles = await Promise.all(validFiles.map(f => compressImage(f)));
        
        // Vercel has a hard 4.5MB limit. If any file is still over 4.4MB, show a clear error.
        const oversized = compressedFiles.find(f => f.size > 4.4 * 1024 * 1024);
        if (oversized) {
          setError(`File "${oversized.name}" is too large (${(oversized.size / 1024 / 1024).toFixed(1)}MB). Max size is 4.4MB.`);
          setLoading(false);
          return;
        }
        
        setFiles(prev => [...prev, ...compressedFiles]);
      } catch (err) {
        console.error("Compression failed", err);
        setFiles(prev => [...prev, ...validFiles]);
      } finally {
        setLoading(false);
      }
      
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
          if (userName.trim()) {
            formData.append('userName', userName.trim());
          }

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
        <div className="status-container">
          <svg className="status-icon waiting" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <h1>Warming Up...</h1>
          <p className="subtitle">Your documents have been sent to the physical printer. Please wait for the paper to come out.</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main>
        <div className="status-container">
          <svg className="status-icon success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h1>Print Complete!</h1>
          <p className="subtitle">Grab your fresh documents from the printer tray.</p>
        </div>
        
        {queueCount !== null && (
          <div className="queue-position">
            <h2 style={{ fontSize: '16px', marginBottom: '8px', textAlign: 'center', margin: 0 }}>Queue Status</h2>
            <p style={{ margin: 0, fontSize: '15px', textAlign: 'center', fontWeight: '500' }}>
              There {queueCount === 1 ? 'is' : 'are'} currently <strong>{queueCount}</strong> document{queueCount !== 1 ? 's' : ''} in the print queue.
            </p>
          </div>
        )}

        <button onClick={() => setSuccess(false)} className="btn-primary" style={{marginTop: '30px'}}>
          <div className="btn-content">
            <svg style={{width:'20px', height:'20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            PRINT MORE
          </div>
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Campus Print Hub</h1>
      <p className="subtitle">Upload PDFs from your phone to print instantly.</p>

      <div className="card">
        <form onSubmit={handlePrint}>
          <div className="form-group">
            <label>1. Your Name (Optional)</label>
            <input 
              type="text" 
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="e.g. John Doe"
              style={{ width: '100%', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', marginBottom: '24px', fontSize: '15px' }}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>2. Select Documents</label>
            <div className="file-dropzone" onClick={() => fileInputRef.current?.click()}>
              <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <div style={{fontWeight: '600', color: '#334155'}}>Tap to Browse Files</div>
              <div style={{fontSize: '13px', color: '#64748b'}}>PDF, JPG supported</div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="application/pdf, image/jpeg, image/png" 
                multiple
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>

            {files.length > 0 && (
              <ul style={{ marginTop: '20px', listStyle: 'none', padding: 0 }}>
                {files.map((f, i) => (
                  <li key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.7)',
                    padding: '12px 16px',
                    marginBottom: '10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', overflow: 'hidden' }}>
                      <svg style={{width:'20px', height:'20px', color:'var(--primary)', flexShrink:0}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      style={{
                        background: '#fee2e2',
                        color: 'var(--error)',
                        border: 'none',
                        cursor: 'pointer',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'transform 0.2s'
                      }}
                      title="Remove file"
                    >
                      <svg style={{width:'14px', height:'14px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group" style={{marginTop: '32px'}}>
            <label>3. Number of Copies</label>
            <div className="copies-control">
              <button 
                type="button" 
                className="copies-btn" 
                onClick={() => setCopies(Math.max(1, copies - 1))}
              >
                <svg style={{width:'20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
              </button>
              <div className="copies-display">{copies}</div>
              <button 
                type="button" 
                className="copies-btn" 
                onClick={() => setCopies(Math.min(10, copies + 1))}
              >
                <svg style={{width:'20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>
          </div>

          {error && <p style={{ color: 'var(--error)', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', margin: '16px 0' }}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading || files.length === 0} style={{marginTop: '24px'}}>
            {loading && <div className="btn-progress-fill" style={{ width: `${totalProgress}%` }} />}
            <div className="btn-content">
              {loading ? (
                <>
                  <svg style={{width:'20px', height:'20px', animation:'spin 1s linear infinite'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  UPLOADING... {totalProgress}%
                </>
              ) : (
                <>
                  <svg style={{width:'20px', height:'20px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  PRINT {files.length} FILE(S)
                </>
              )}
            </div>
          </button>
        </form>
      </div>
    </main>
  );
}
