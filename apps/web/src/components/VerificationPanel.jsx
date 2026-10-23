import React from 'react';
import { ShieldCheck, CheckCircle2, AlertOctagon, Database, ArrowRight } from 'lucide-react';

export function VerificationPanel({ executionReport }) {
  if (!executionReport) return null;

  const { succeeded = [], failed = [], rejected = [], truthful_summary, plan_status } = executionReport;

  return (
    <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.04)' }}>
      <div className="card-header">
        <div className="card-title" style={{ color: 'var(--color-success)' }}>
          <ShieldCheck size={20} />
          <span>Authoritative Read-Back Verification Report</span>
        </div>
        <div className="verification-badge">
          <Database size={13} />
          <span>Verified Against SQLite Engine</span>
        </div>
      </div>

      {/* Truthful Summary */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '0.86rem',
          lineHeight: '1.6'
        }}
      >
        {truthful_summary}
      </div>

      {/* Succeeded & Verified Operations */}
      {succeeded.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Verified SQLite State Changes ({succeeded.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {succeeded.map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Tool: <span style={{ color: 'var(--accent-cyan)' }}>{item.tool}</span> • Record ID: {item.record_id || 'persisted'} • Execution: {item.duration_ms}ms
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>ASSERTED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Operations (if any) */}
      {failed.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Halted / Injected Failures ({failed.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {failed.map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '0.84rem', fontWeight: 600 }}>
                  <AlertOctagon size={16} />
                  <span>{item.description}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Error: {item.error} ({item.code})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Operations (if any) */}
      {rejected.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Rejected Actions — Verified Zero Writes ({rejected.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rejected.map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)'
                }}
              >
                🚫 <strong>{item.description}</strong> — <em>{item.reason}</em>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
