'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf' && selectedFile.type !== 'image/jpeg') {
        setError('Only PDF and JPEG files are supported.');
        setFile(null);
      } else {
        setError('');
        setFile(selectedFile);
      }
    }
  };

  const handlePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('copies', copies.toString());

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      router.push(`/status/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>PRINT YOUR DOCUMENT</h1>
      <p className="subtitle">Upload your PDF to send it to the campus printer.</p>

      <div className="card">
        <form onSubmit={handlePrint}>
          <div className="form-group">
            <label>1. Select PDF File</label>
            <input 
              type="file" 
              accept=".pdf,.jpg,.jpeg" 
              onChange={handleFileChange}
              required
            />
          </div>

          <div className="form-group">
            <label>2. Number of Copies</label>
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

          <button type="submit" className="btn-primary" disabled={loading || !file}>
            {loading ? 'UPLOADING...' : 'PRINT NOW'}
          </button>
        </form>
      </div>
    </main>
  );
}
