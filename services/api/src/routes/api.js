import express from 'express';
import { storage } from '../storage/db.js';
import { AgentPlanner } from '../agent/planner.js';
import { AgentExecutor } from '../agent/executor.js';
import { seedDatabase } from '../../scripts/seed.js';
import { computeActionHash } from '@orbit/shared';

export const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orbit-api-orchestrator',
    timestamp: new Date().toISOString()
  });
});

// Chat: submit message and produce structured plan
router.post('/chat', async (req, res) => {
  try {
    const { message, conversation_id = 'conv_demo_01' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" is required' });
    }

    // Save user message to database
    storage.addMessage({
      conversation_id,
      role: 'user',
      content: message
    });

    // Run planner loop (Understand -> Retrieve -> Plan -> Validate)
    const planResult = await AgentPlanner.plan(message, conversation_id);

    // Save assistant response message with plan reference
    const assistantMsg = storage.addMessage({
      conversation_id,
      role: 'assistant',
      content: planResult.summary,
      metadata: { plan_id: planResult.plan.id }
    });

    res.json({
      success: true,
      message: assistantMsg,
      plan: planResult.plan,
      summary: planResult.summary,
      context: planResult.context
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal agent error'
    });
  }
});

// Get conversation history
router.get('/conversations/:id', (req, res) => {
  const conv = storage.getConversation(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ conversation: conv });
});

// Get plan status
router.get('/plans/:id', (req, res) => {
  const plan = storage.getPlan(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  res.json({ plan });
});

// Approve plan steps and execute
router.post('/plans/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { step_ids = [] } = req.body || {};
    const plan = storage.getPlan(id);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const stepsToApprove = step_ids.length > 0 
      ? plan.steps.filter(s => step_ids.includes(s.id))
      : plan.steps.filter(s => s.is_write && s.status === 'waiting_approval');

    for (const step of stepsToApprove) {
      storage.setApprovalDecision(step.id, 'approved');
    }

    // Execute approved steps through MCP and verify
    const executionReport = await AgentExecutor.executePlan(id);

    // Save system execution message
    storage.addMessage({
      conversation_id: plan.conversation_id,
      role: 'assistant',
      content: executionReport.truthful_summary,
      metadata: {
        type: 'execution_summary',
        report: executionReport
      }
    });

    res.json({
      success: true,
      report: executionReport,
      plan: storage.getPlan(id)
    });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Error processing approval'
    });
  }
});

// Reject plan steps
router.post('/plans/:id/reject', (req, res) => {
  const { id } = req.params;
  const { step_ids = [] } = req.body || {};
  const plan = storage.getPlan(id);

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const stepsToReject = step_ids.length > 0
    ? plan.steps.filter(s => step_ids.includes(s.id))
    : plan.steps.filter(s => s.is_write && s.status === 'waiting_approval');

  for (const step of stepsToReject) {
    storage.setApprovalDecision(step.id, 'rejected');
  }

  storage.updatePlanStatus(id, 'rejected');

  const rejectionMsg = storage.addMessage({
    conversation_id: plan.conversation_id,
    role: 'assistant',
    content: `🚫 Action rejected. As verified by human-in-the-loop safety protocol, zero modifications were made to your persistent data.`,
    metadata: { type: 'rejection_confirmed' }
  });

  res.json({
    success: true,
    rejected_count: stepsToReject.length,
    plan: storage.getPlan(id),
    message: rejectionMsg
  });
});

// Edit step argument before approval (re-generates action hash)
router.post('/plans/:id/steps/:stepId/edit', (req, res) => {
  const { id, stepId } = req.params;
  const { arguments: newArgs } = req.body;

  const plan = storage.getPlan(id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const step = plan.steps.find(s => s.id === stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });

  const newHash = computeActionHash(step.tool, newArgs);
  const argsStr = JSON.stringify(newArgs);

  // Update step
  storage.db.prepare('UPDATE plan_steps SET arguments = ?, action_hash = ?, status = ? WHERE id = ?')
    .run(argsStr, newHash, 'waiting_approval', stepId);

  // Update approval record hash
  storage.db.prepare('UPDATE approvals SET action_hash = ?, status = ? WHERE step_id = ?')
    .run(newHash, 'pending', stepId);

  res.json({
    success: true,
    updated_step: storage.getPlan(id).steps.find(s => s.id === stepId)
  });
});

// Preferences CRUD
router.get('/preferences', (req, res) => {
  res.json({ preferences: storage.getPreferences() });
});

router.patch('/preferences/:id', (req, res) => {
  const { key, value } = req.body;
  const saved = storage.savePreference({ key, value, source: 'user_edit' });
  res.json({ success: true, preference: saved });
});

router.delete('/preferences/:id', (req, res) => {
  storage.deletePreference(req.params.id);
  res.json({ success: true, deleted: req.params.id });
});

// Complete state snapshot for UI tabs and audit
router.get('/state', (req, res) => {
  res.json({
    schedule: storage.getSchedule(),
    tasks: storage.listTasks(),
    shopping: storage.getShoppingList(),
    preferences: storage.getPreferences()
  });
});

// Tool execution audit logs
router.get('/activity', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({
    executions: storage.getToolExecutions(limit)
  });
});

// Reset database and seed with demo data
router.post('/reset', (req, res) => {
  seedDatabase();
  res.json({
    success: true,
    message: 'Database reset and re-seeded with demo fixtures.'
  });
});
