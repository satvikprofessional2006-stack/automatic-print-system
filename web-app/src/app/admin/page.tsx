'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setJobs(data.jobs);
      setIsAuthenticated(true);
      setError('');
    } catch (err) {
      setError('Invalid password or connection error');
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      const interval = setInterval(fetchJobs, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, password]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const cancelJob = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      await fetch(`/api/admin/jobs/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      fetchJobs();
    } catch (err) {
      alert('Failed to cancel job');
    }
  };

  const retryJob = async (id: string) => {
    try {
      await fetch(`/api/admin/jobs/${id}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      fetchJobs();
    } catch (err) {
      alert('Failed to retry job');
    }
  };

  if (!isAuthenticated) {
    return (
      <main>
        <h1>Admin Login</h1>
        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box' }}
              />
            </div>
            {error && <p style={{color: 'var(--error)'}}>{error}</p>}
            <button type="submit" className="btn-primary">Login</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '96%', padding: '40px 2%' }}>
      <h1>Admin Dashboard</h1>
      <button onClick={fetchJobs} style={{ marginBottom: '24px', background: 'white', color: 'var(--text)', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>Refresh Data</button>
      
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th>S.No.</th>
              <th>Date</th>
              <th>Filename</th>
              <th>Copies</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => (
              <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 0', fontWeight: 'bold' }}>{jobs.length - index}</td>
                <td style={{ padding: '10px 0' }}>{new Date(job.createdAt + 'Z').toLocaleString()}</td>
                <td>{job.filename}</td>
                <td>{job.copies}</td>
                <td>
                  <span style={{
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    background: job.status === 'queued' ? '#e3f2fd' : 
                                job.status === 'printing' ? '#fff3e0' :
                                job.status === 'completed' ? '#e8f5e9' : '#ffebee'
                  }}>
                    {job.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(job.status === 'queued' || job.status === 'printing') && (
                      <button 
                        onClick={() => cancelJob(job.id)}
                        style={{ background: 'var(--error)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button 
                        onClick={() => retryJob(job.id)}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <p style={{ textAlign: 'center', marginTop: '20px' }}>No jobs found.</p>}
      </div>
    </main>
  );
}
