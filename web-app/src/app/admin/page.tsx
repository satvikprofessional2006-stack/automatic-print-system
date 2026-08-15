'use client';

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const processGroups = (rawJobs: any[]) => {
    const processedJobs = [];
    let currentGroup: any[] = [];
    
    for (let i = 0; i < rawJobs.length; i++) {
      const job = rawJobs[i];
      currentGroup.push(job);
      
      const nextJob = rawJobs[i+1];
      if (nextJob) {
        const timeDiff = Math.abs(new Date(job.createdAt + 'Z').getTime() - new Date(nextJob.createdAt + 'Z').getTime());
        if (timeDiff > 5000) {
          // End of group
          if (currentGroup.length > 1) {
            processedJobs.push({ isGroup: true, id: currentGroup[0].id + '_group', jobs: currentGroup });
          } else {
            processedJobs.push(currentGroup[0]);
          }
          currentGroup = [];
        }
      } else {
        // Last job
        if (currentGroup.length > 1) {
          processedJobs.push({ isGroup: true, id: currentGroup[0].id + '_group', jobs: currentGroup });
        } else {
          processedJobs.push(currentGroup[0]);
        }
      }
    }
    return processedJobs;
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setJobs(processGroups(data.jobs));
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

  const cancelBatch = async (batchJobs: any[]) => {
    if (!confirm(`Are you sure you want to cancel all ${batchJobs.length} jobs in this batch?`)) return;
    for (const job of batchJobs) {
      if (job.status === 'queued' || job.status === 'printing') {
        try {
          await fetch(`/api/admin/jobs/${job.id}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${password}` }
          });
        } catch (e) {}
      }
    }
    fetchJobs();
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusBadge = (status: string) => {
    return (
      <span style={{
        padding: '4px 8px', 
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        background: status === 'queued' ? '#e3f2fd' : 
                    status === 'printing' ? '#fff3e0' :
                    status === 'completed' ? '#e8f5e9' : '#ffebee',
        color: status === 'queued' ? '#1976d2' : 
               status === 'printing' ? '#f57c00' :
               status === 'completed' ? '#388e3c' : '#d32f2f'
      }}>
        {status}
      </span>
    );
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

  // Calculate true serial numbers dynamically so they represent individual files, or treat groups as a single serial
  let currentSerial = jobs.reduce((acc, item) => acc + (item.isGroup ? item.jobs.length : 1), 0);

  return (
    <main style={{ maxWidth: '96%', padding: '40px 2%' }}>
      <h1>Admin Dashboard</h1>
      <button onClick={fetchJobs} style={{ marginBottom: '24px', background: 'white', color: 'var(--text)', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>Refresh Data</button>
      
      <div className="card" style={{ overflowX: 'auto', padding: '0' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ padding: '16px 24px' }}>S.No.</th>
              <th>Date</th>
              <th>Filename</th>
              <th>Copies</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((item) => {
              if (item.isGroup) {
                const groupSerialStart = currentSerial;
                currentSerial -= item.jobs.length;
                
                const isExpanded = expandedGroups[item.id];
                const activeJobs = item.jobs.filter((j: any) => j.status === 'queued' || j.status === 'printing');
                
                return (
                  <React.Fragment key={item.id}>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', cursor: 'pointer' }} onClick={() => toggleGroup(item.id)}>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{groupSerialStart}-{currentSerial + 1}</td>
                      <td style={{ padding: '16px 8px' }}>{new Date(item.jobs[0].createdAt + 'Z').toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg style={{width:'16px', height:'16px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          📁 Batch Upload ({item.jobs.length} files)
                        </div>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{item.jobs.reduce((sum: number, j: any) => sum + j.copies, 0)} Total</td>
                      <td>
                        {activeJobs.length > 0 ? getStatusBadge('printing') : getStatusBadge('completed')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activeJobs.length > 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); cancelBatch(item.jobs); }}
                              style={{ background: 'var(--error)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Cancel Batch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {isExpanded && item.jobs.map((job: any, idx: number) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                        <td style={{ padding: '16px 24px', color: '#64748b' }}>↳ {groupSerialStart - idx}</td>
                        <td style={{ padding: '16px 8px', color: '#64748b' }}>{new Date(job.createdAt + 'Z').toLocaleString()}</td>
                        <td style={{ paddingLeft: '32px' }}>{job.filename}</td>
                        <td>{job.copies}</td>
                        <td>{getStatusBadge(job.status)}</td>
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
                  </React.Fragment>
                );
              } else {
                const serial = currentSerial;
                currentSerial -= 1;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{serial}</td>
                    <td style={{ padding: '16px 8px' }}>{new Date(item.createdAt + 'Z').toLocaleString()}</td>
                    <td>{item.filename}</td>
                    <td>{item.copies}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(item.status === 'queued' || item.status === 'printing') && (
                          <button 
                            onClick={() => cancelJob(item.id)}
                            style={{ background: 'var(--error)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === 'failed' && (
                          <button 
                            onClick={() => retryJob(item.id)}
                            style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p style={{ textAlign: 'center', margin: '30px 0', color: '#64748b' }}>No jobs found.</p>}
      </div>
    </main>
  );
}
