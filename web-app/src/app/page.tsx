'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.type === 'image/jpeg');
      
      if (validFiles.length !== selectedFiles.length) {
        setError('Some files were ignored. Only PDF and JPEG are supported.');
      } else {
        setError('');
      }
      setFiles(validFiles);
      setSuccess(false);
    }
  };

  const handlePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one file first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload all files concurrently
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('copies', copies.toString());
        return fetch('/api/upload', { method: 'POST', body: formData });
      });

      const responses = await Promise.all(uploadPromises);
      
      for (const res of responses) {
        if (!res.ok) {
          throw new Error('One or more files failed to upload');
        }
      }

      setSuccess(true);
      setFiles([]);
      setCopies(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
              required
            />
            {files.length > 0 && (
              <ul style={{ marginTop: '10px', fontSize: '14px', color: 'var(--foreground)', opacity: 0.8 }}>
                {files.map((f, i) => <li key={i}>{f.name}</li>)}
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
            {loading ? 'UPLOADING...' : `PRINT ${files.length} FILE(S)`}
          </button>
        </form>
      </div>
    </main>
  );
}
