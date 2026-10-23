import React from 'react';
import { Orbit, Database, Radio, RotateCcw, ShieldCheck } from 'lucide-react';

export function Header({ mcpStatus, dbStatus, onReset, isResetting }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Orbit size={20} />
        </div>
        <div>
          <div className="brand-name">
            ORBIT
            <span className="badge-tag">Alexa+ Track</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Personal AI Action Agent • MCP over Streamable HTTP
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: mcpStatus === 'online' ? 'var(--color-success)' : 'var(--color-danger)',
              background: mcpStatus === 'online' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              padding: '4px 10px',
              borderRadius: '999px',
              border: `1px solid ${mcpStatus === 'online' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}
          >
            <Radio size={12} className={mcpStatus === 'online' ? 'pulse-icon' : ''} />
            <span>MCP Stream: {mcpStatus === 'online' ? 'Active (:3002)' : 'Connecting...'}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Database size={12} />
            <span>SQLite Engine: {dbStatus}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: 'var(--accent-cyan)',
              background: 'var(--accent-cyan-bg)',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(56,189,248,0.3)'
            }}
          >
            <ShieldCheck size={12} />
            <span>Cryptographic Gatekeeper</span>
          </div>
        </div>

        {/* Demo Reset Button */}
        <button
          className="btn btn-outline"
          onClick={onReset}
          disabled={isResetting}
          title="Reset database and restore demo fixtures"
        >
          <RotateCcw size={14} className={isResetting ? 'spin' : ''} />
          <span>{isResetting ? 'Resetting...' : 'Reset Demo Fixtures'}</span>
        </button>
      </div>
    </header>
  );
}
