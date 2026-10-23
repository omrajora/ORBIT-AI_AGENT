import React, { useState } from 'react';
import {
  Activity,
  Calendar,
  CheckSquare,
  ShoppingBag,
  Sliders,
  Trash2,
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function InspectorPanel({
  mcpEvents = [],
  stateData = {},
  onDeletePreference,
  onRefreshState
}) {
  const [activeTab, setActiveTab] = useState('mcp');

  const { schedule = [], tasks = [], shopping = [], preferences = [] } = stateData;

  return (
    <div className="inspector-panel">
      {/* Tab Navigation */}
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'mcp' ? 'active' : ''}`}
          onClick={() => setActiveTab('mcp')}
        >
          <Activity size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          <span>MCP Stream ({mcpEvents.length})</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          <span>Schedule ({schedule.length})</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          <span>Tasks ({tasks.length})</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'shopping' ? 'active' : ''}`}
          onClick={() => setActiveTab('shopping')}
        >
          <ShoppingBag size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          <span>Cart ({shopping.length})</span>
        </button>
        <button
          className={`panel-tab ${activeTab === 'prefs' ? 'active' : ''}`}
          onClick={() => setActiveTab('prefs')}
        >
          <Sliders size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          <span>Memory ({preferences.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content">
        {/* TAB 1: Live MCP Event Stream */}
        {activeTab === 'mcp' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                JSON-RPC 2.0 PROTOCOL STREAM
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                PORT 3002
              </span>
            </div>

            {mcpEvents.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 10px', fontSize: '0.8rem' }}>
                <Radio size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                Listening to MCP server event stream...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mcpEvents.map((evt, i) => (
                  <div key={i} className="log-entry">
                    <div className="log-entry-meta">
                      <span className="log-entry-tool">
                        {evt.type === 'tool_success' ? '✓ ' : evt.type === 'tool_failure' ? '✗ ' : '⇄ '}
                        {evt.data?.tool || evt.data?.method || evt.type}
                      </span>
                      <span>
                        {evt.data?.duration_ms ? `${evt.data.duration_ms}ms` : ''}
                      </span>
                    </div>

                    <div className="log-entry-payload">
                      {JSON.stringify(evt.data, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SQLite Schedule Blocks */}
        {activeTab === 'schedule' && (
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              PERSISTENT CALENDAR ENTRIES (SQLITE)
            </div>
            {schedule.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                No schedule blocks recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {schedule.map((block) => {
                  const start = new Date(block.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const end = new Date(block.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isOrbitAdded = block.source?.includes('orbit');

                  return (
                    <div
                      key={block.id}
                      className="state-item"
                      style={{
                        borderLeft: `3px solid ${isOrbitAdded ? 'var(--accent-cyan)' : 'var(--text-muted)'}`
                      }}
                    >
                      <div className="state-item-header">
                        <span className="state-item-title">{block.title}</span>
                        {isOrbitAdded && (
                          <span style={{ fontSize: '0.65rem', background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)', padding: '1px 6px', borderRadius: '4px' }}>
                            ORBIT VERIFIED
                          </span>
                        )}
                      </div>
                      <div className="state-item-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} />
                        <span>{start} - {end}</span>
                        <span>•</span>
                        <span>Source: {block.source}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Tasks */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              ACTIVE & COMPLETED TASKS (SQLITE)
            </div>
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                No tasks found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.map((task) => (
                  <div key={task.id} className="state-item">
                    <div className="state-item-header">
                      <span className="state-item-title">{task.title}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: task.priority === 'high' ? 'var(--color-danger)' : 'var(--text-secondary)'
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.details && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {task.details}
                      </div>
                    )}
                    <div className="state-item-meta">
                      Status: <strong>{task.status}</strong> • ID: <code>{task.id}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Shopping Items */}
        {activeTab === 'shopping' && (
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              PERSISTENT GROCERY INVENTORY (SQLITE)
            </div>
            {shopping.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                Shopping list is empty.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {shopping.map((item) => (
                  <div key={item.id} className="state-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="state-item-title">{item.name}</div>
                      <div className="state-item-meta">Quantity: {item.quantity} {item.unit}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                      IN CART
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Preferences */}
        {activeTab === 'prefs' && (
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              EXPLICIT USER PREFERENCES & HABITS
            </div>
            {preferences.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.8rem' }}>
                No preferences stored.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {preferences.map((pref) => (
                  <div key={pref.id} className="state-item">
                    <div className="state-item-header">
                      <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {pref.key}
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '2px 6px', color: 'var(--color-danger)' }}
                        onClick={() => onDeletePreference(pref.id)}
                        title="Delete preference"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      {pref.value}
                    </div>
                    <div className="state-item-meta">
                      Confirmed: {pref.user_confirmed ? 'Yes' : 'No'} • Source: {pref.source}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
