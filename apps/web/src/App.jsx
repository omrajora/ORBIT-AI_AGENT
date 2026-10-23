import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.jsx';
import { ChatPanel } from './components/ChatPanel.jsx';
import { PlanPreview } from './components/PlanPreview.jsx';
import { VerificationPanel } from './components/VerificationPanel.jsx';
import { InspectorPanel } from './components/InspectorPanel.jsx';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [executionReport, setExecutionReport] = useState(null);
  const [stateData, setStateData] = useState({ schedule: [], tasks: [], shopping: [], preferences: [] });
  const [mcpEvents, setMcpEvents] = useState([]);
  const [mcpStatus, setMcpStatus] = useState('connecting');
  const [dbStatus, setDbStatus] = useState('Connected');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load initial conversation and persistent state
  const loadInitialData = async () => {
    try {
      const [convRes, stateRes] = await Promise.all([
        fetch('/api/conversations/conv_demo_01'),
        fetch('/api/state')
      ]);

      if (convRes.ok) {
        const data = await convRes.json();
        if (data.conversation?.messages) {
          setMessages(data.conversation.messages);
        }
      }

      if (stateRes.ok) {
        const data = await stateRes.json();
        setStateData(data);
      }
    } catch (err) {
      console.warn('Initial data load notice:', err.message);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Connect to Server-Sent Events (SSE) stream from MCP Server
    let es;
    try {
      es = new EventSource('/mcp/events');
      es.onopen = () => {
        setMcpStatus('online');
      };

      const handleEvent = (type) => (e) => {
        try {
          const parsed = JSON.parse(e.data);
          setMcpEvents(prev => [{ type, data: parsed, timestamp: new Date().toISOString() }, ...prev.slice(0, 49)]);
        } catch {
          // ignore parsing error
        }
      };

      es.addEventListener('connected', handleEvent('connected'));
      es.addEventListener('mcp_request', handleEvent('mcp_request'));
      es.addEventListener('mcp_response', handleEvent('mcp_response'));
      es.addEventListener('tool_success', handleEvent('tool_success'));
      es.addEventListener('tool_failure', handleEvent('tool_failure'));

      es.onerror = () => {
        setMcpStatus('offline');
      };
    } catch {
      setMcpStatus('offline');
    }

    return () => {
      es?.close();
    };
  }, []);

  // Send message
  const handleSendMessage = async (text) => {
    setIsLoading(true);
    setExecutionReport(null);

    // Optimistically add user message
    const tempUserMsg = { id: `msg_${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: 'conv_demo_01' })
      });

      const data = await res.json();
      if (data.success) {
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
        if (data.plan) {
          setActivePlan(data.plan);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Error processing request: ${data.error}`,
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Connection failure: Could not reach agent orchestrator (${err.message})`,
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
      // Refresh state
      const stateRes = await fetch('/api/state');
      if (stateRes.ok) setStateData(await stateRes.json());
    }
  };

  // Approve all waiting steps
  const handleApproveAll = async () => {
    if (!activePlan) return;
    setIsExecuting(true);

    try {
      const res = await fetch(`/api/plans/${activePlan.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (data.success) {
        setExecutionReport(data.report);
        setActivePlan(data.plan);

        // Fetch refreshed messages & state
        const [convRes, stateRes] = await Promise.all([
          fetch('/api/conversations/conv_demo_01'),
          fetch('/api/state')
        ]);
        if (convRes.ok) {
          const convData = await convRes.json();
          setMessages(convData.conversation.messages);
        }
        if (stateRes.ok) {
          setStateData(await stateRes.json());
        }
      }
    } catch (err) {
      console.error('Approval execution failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Approve single step
  const handleApproveStep = async (stepId) => {
    if (!activePlan) return;
    setIsExecuting(true);

    try {
      const res = await fetch(`/api/plans/${activePlan.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: [stepId] })
      });

      const data = await res.json();
      if (data.success) {
        setExecutionReport(data.report);
        setActivePlan(data.plan);

        const stateRes = await fetch('/api/state');
        if (stateRes.ok) setStateData(await stateRes.json());
      }
    } catch (err) {
      console.error('Step approval failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Reject all
  const handleRejectAll = async () => {
    if (!activePlan) return;
    setIsExecuting(true);

    try {
      const res = await fetch(`/api/plans/${activePlan.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (data.success) {
        setActivePlan(data.plan);
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Reject single step
  const handleRejectStep = async (stepId) => {
    if (!activePlan) return;
    setIsExecuting(true);

    try {
      const res = await fetch(`/api/plans/${activePlan.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_ids: [stepId] })
      });

      const data = await res.json();
      if (data.success) {
        setActivePlan(data.plan);
      }
    } catch (err) {
      console.error('Step rejection failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Delete preference
  const handleDeletePreference = async (prefId) => {
    try {
      await fetch(`/api/preferences/${prefId}`, { method: 'DELETE' });
      const stateRes = await fetch('/api/state');
      if (stateRes.ok) setStateData(await stateRes.json());
    } catch (err) {
      console.error('Failed to delete preference:', err);
    }
  };

  // Reset demo fixtures
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      setActivePlan(null);
      setExecutionReport(null);
      await loadInitialData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        mcpStatus={mcpStatus}
        dbStatus={dbStatus}
        onReset={handleReset}
        isResetting={isResetting}
      />

      <main className="main-layout">
        {/* Left: Chat & Prompts */}
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />

        {/* Center: Structured Plan Preview & Read-Back Verification */}
        <div className="orchestrator-panel">
          <PlanPreview
            plan={activePlan}
            onApproveAll={handleApproveAll}
            onRejectAll={handleRejectAll}
            onApproveStep={handleApproveStep}
            onRejectStep={handleRejectStep}
            isExecuting={isExecuting}
          />

          <VerificationPanel executionReport={executionReport} />
        </div>

        {/* Right: Live MCP Inspector & State Engine */}
        <InspectorPanel
          mcpEvents={mcpEvents}
          stateData={stateData}
          onDeletePreference={handleDeletePreference}
          onRefreshState={loadInitialData}
        />
      </main>
    </div>
  );
}
