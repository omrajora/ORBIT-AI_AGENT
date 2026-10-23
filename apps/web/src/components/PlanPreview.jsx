import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  AlertTriangle,
  Play
} from 'lucide-react';

export function PlanPreview({ plan, onApproveAll, onRejectAll, onApproveStep, onRejectStep, isExecuting }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  if (!plan || !plan.steps || plan.steps.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Layers size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          No Active Plan Staged
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Type a request or select a demo prompt to inspect dependencies, generate a structured plan, and gate actions behind approval.
        </p>
      </div>
    );
  }

  const toggleExpand = (stepId) => {
    setExpandedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const pendingWritesCount = plan.steps.filter(s => s.is_write && s.status === 'waiting_approval').length;
  const isApproved = plan.status === 'approved' || plan.status === 'completed';

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Structured Multi-Step Plan ({plan.steps.length} Operations)</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Plan ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{plan.id}</code> • Status: <span className={`status-badge ${plan.status}`}>{plan.status}</span>
          </div>
        </div>

        {/* Global Controls */}
        {pendingWritesCount > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-success"
              onClick={onApproveAll}
              disabled={isExecuting}
            >
              <CheckCircle size={15} />
              <span>Approve All ({pendingWritesCount})</span>
            </button>
            <button
              className="btn btn-danger"
              onClick={onRejectAll}
              disabled={isExecuting}
            >
              <XCircle size={15} />
              <span>Reject Plan</span>
            </button>
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          marginBottom: '16px',
          fontSize: '0.78rem',
          color: 'var(--accent-cyan)'
        }}
      >
        <Fingerprint size={16} />
        <span>
          <strong>Cryptographic Safety Active:</strong> Each write payload is bound to an immutable SHA-256 action hash. Modification immediately invalidates approval.
        </span>
      </div>

      {/* Steps Timeline */}
      <div className="steps-list">
        {plan.steps.map((step, idx) => {
          const isExpanded = expandedSteps[step.id];
          let parsedArgs = {};
          try {
            parsedArgs = typeof step.arguments === 'string' ? JSON.parse(step.arguments) : step.arguments;
          } catch {
            parsedArgs = step.arguments;
          }

          return (
            <div key={step.id} className={`step-card ${step.status}`}>
              <div className="step-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    #{step.step_order || idx + 1}
                  </span>
                  <span className="step-tool">{step.tool}</span>
                  {step.is_write ? (
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                      [MUTATION WRITE]
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      [READ OPERATION]
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-badge ${step.status}`}>
                    {step.status.replace('_', ' ')}
                  </span>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                    onClick={() => toggleExpand(step.id)}
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              <div className="step-desc">
                {step.description}
              </div>

              {/* Conflict Warnings */}
              {step.warnings && step.warnings.length > 0 && (
                <div style={{ color: 'var(--color-warning)', fontSize: '0.75rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>{step.warnings.join('; ')}</span>
                </div>
              )}

              {/* Action Hash */}
              {step.action_hash && (
                <div className="hash-token">
                  <Fingerprint size={12} />
                  <span>SHA-256 Token: <code>{step.action_hash.slice(0, 16)}...{step.action_hash.slice(-8)}</code></span>
                </div>
              )}

              {/* Collapsible Arguments */}
              {isExpanded && (
                <pre className="step-payload">
                  {JSON.stringify(parsedArgs, null, 2)}
                </pre>
              )}

              {/* Individual Step Action Controls */}
              {step.is_write && step.status === 'waiting_approval' && (
                <div className="step-controls">
                  <button
                    className="btn btn-success"
                    style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                    onClick={() => onApproveStep(step.id)}
                    disabled={isExecuting}
                  >
                    <CheckCircle size={13} />
                    <span>Approve Step</span>
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                    onClick={() => onRejectStep(step.id)}
                    disabled={isExecuting}
                  >
                    <XCircle size={13} />
                    <span>Reject Step</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
