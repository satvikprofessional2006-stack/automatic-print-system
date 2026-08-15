'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [progresses, setProgresses] = useState<number[]>([]);

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
        return new Promise((resolve, reject) => {
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
              resolve(xhr.responseText);
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

      await Promise.all(uploadPromises);

      setSuccess(true);
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

  if (success) {
    return (
      <main>
        <h1>SUCCESS! 🎉</h1>
        <p className="subtitle">Your documents have been sent to the printer.</p>
        <button onClick={() => setSuccess(false)} className="btn-primary" style={{marginTop: '20px'}}>
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
