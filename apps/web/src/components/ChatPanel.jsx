import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertTriangle, XCircle, ShoppingBag, Brain } from 'lucide-react';

const DEMO_PROMPTS = [
  {
    label: '🌟 Flagship Workflow',
    icon: Sparkles,
    prompt: 'Plan tomorrow using my saved preferences, reserve two hours for my ML project, and add missing groceries to my list.'
  },
  {
    label: '⚠️ Schedule Conflict Test',
    icon: AlertTriangle,
    prompt: 'Try to schedule a block that conflicts with an existing event and explain what you do.'
  },
  {
    label: '🚫 Action Rejection Test',
    icon: XCircle,
    prompt: 'Reject a proposed task and prove that it was not created.'
  },
  {
    label: '🛒 Add Groceries',
    icon: ShoppingBag,
    prompt: 'Add these three groceries, but show me the exact changes before saving.'
  },
  {
    label: '🧠 Persist Preference',
    icon: Brain,
    prompt: 'Remember that I prefer focused study blocks of 50 minutes, and show me what you saved.'
  }
];

export function ChatPanel({ messages, onSendMessage, isLoading }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleChipClick = (prompt) => {
    setInput(prompt);
  };

  return (
    <div className="chat-panel">
      {/* Messages Scroll Area */}
      <div className="chat-messages">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id || index}
              className={`message-bubble ${isUser ? 'message-user' : 'message-assistant'}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {isUser ? (
                  <User size={14} style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <Bot size={14} style={{ color: 'var(--accent-cyan)' }} />
                )}
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {isUser ? 'YOU' : 'ORBIT AGENT'}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="message-bubble message-assistant" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={16} className="spin" style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Inspecting schedule, querying MCP read tools & formulating safe plan...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Area with Demo Chips */}
      <div className="composer-area">
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
          Sample Flagship Prompts (Click to test):
        </div>
        <div className="demo-chips">
          {DEMO_PROMPTS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                className="chip"
                onClick={() => handleChipClick(item.prompt)}
              >
                <Icon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                {item.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="composer-form">
          <input
            type="text"
            className="composer-input"
            placeholder="Type a request (e.g., Plan tomorrow...)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!input.trim() || isLoading}
          >
            <Send size={15} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
