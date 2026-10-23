import assert from 'node:assert';
import { db, storage, initSchema } from '../services/api/src/storage/db.js';
import { seedDatabase, getTomorrowDateStr } from '../services/api/scripts/seed.js';
import { executeTool } from '../services/mcp-server/src/tools/index.js';
import { TOOL_DEFINITIONS } from '../services/mcp-server/src/schemas/toolSchemas.js';
import { ApprovalGatekeeper } from '../services/api/src/approvals/gatekeeper.js';
import { ReadBackVerifier } from '../services/api/src/agent/verifier.js';
import { AgentPlanner } from '../services/api/src/agent/planner.js';
import { AgentExecutor } from '../services/api/src/agent/executor.js';
import { mcpClient } from '../services/api/src/agent/mcpClient.js';
import { startMcpServer } from '../services/mcp-server/src/index.js';
import { computeActionHash } from '@orbit/shared';

async function runTestSuite() {
  console.log('🧪 ========================================================');
  console.log('🧪 STARTING ORBIT ACCEPTANCE TEST SUITE (PHASES 1, 2, 3)');
  console.log('🧪 ========================================================\n');

  // Connect to existing MCP server or start one on port 3002
  let server = null;
  try {
    const health = await fetch('http://localhost:3002/health').catch(() => null);
    if (!health || !health.ok) {
      server = await startMcpServer(3002);
    } else {
      console.log('📡 Connected to active MCP Server at http://localhost:3002');
    }
  } catch {
    server = await startMcpServer(3002);
  }

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // 1. Database & Seed verification
  test('Phase 2: Database schema initializes and tables exist', () => {
    initSchema();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    assert(tables.includes('tasks'), 'Missing tasks table');
    assert(tables.includes('schedule_blocks'), 'Missing schedule_blocks table');
    assert(tables.includes('shopping_items'), 'Missing shopping_items table');
    assert(tables.includes('preferences'), 'Missing preferences table');
    assert(tables.includes('plans'), 'Missing plans table');
    assert(tables.includes('approvals'), 'Missing approvals table');
  });

  test('Phase 2: Seed script populates demo fixtures cleanly', () => {
    seedDatabase();
    const tasks = storage.listTasks();
    const schedule = storage.getSchedule();
    const shopping = storage.getShoppingList();
    const prefs = storage.getPreferences();

    assert(tasks.length >= 2, 'Expected seeded tasks');
    assert(schedule.length >= 2, 'Expected seeded schedule blocks');
    assert(shopping.length >= 2, 'Expected seeded shopping items');
    assert(prefs.length >= 2, 'Expected seeded preferences');
  });

  // 2. MCP Tool catalogue and execution
  test('Phase 1: MCP Tool definitions contain all 8 required tools with valid schemas', () => {
    assert.strictEqual(TOOL_DEFINITIONS.length, 8, 'Must have exactly 8 tools');
    const toolNames = TOOL_DEFINITIONS.map(t => t.name);
    assert(toolNames.includes('get_schedule'));
    assert(toolNames.includes('list_tasks'));
    assert(toolNames.includes('create_task'));
    assert(toolNames.includes('add_schedule_block'));
    assert(toolNames.includes('get_shopping_list'));
    assert(toolNames.includes('add_shopping_items'));
    assert(toolNames.includes('get_preferences'));
    assert(toolNames.includes('save_preference'));
  });

  await testAsync('Phase 1: Read tools execute and return structured data', async () => {
    const res = await executeTool('get_schedule', {});
    assert.strictEqual(res.success, true);
    assert(Array.isArray(res.data.schedule));
    assert(res.data.schedule.length >= 2);
  });

  // 3. Conflict Detection
  await testAsync('Phase 2: Schedule conflict detection blocks overlapping commitments', async () => {
    const tomorrowStr = getTomorrowDateStr();
    // Morning class is at 09:00 - 10:30. Let's try to add a block at 09:30 - 10:00:
    const conflictResult = await executeTool('add_schedule_block', {
      title: 'Conflicting Study Group',
      start_at: `${tomorrowStr}T09:30:00Z`,
      end_at: `${tomorrowStr}T10:00:00Z`
    });

    assert.strictEqual(conflictResult.success, false);
    assert.strictEqual(conflictResult.error.code, 'ERR_CONFLICT');
  });

  // 4. Approval Gatekeeper & Tamper Protection
  test('Phase 3: Gatekeeper strictly blocks unapproved consequential writes', () => {
    assert.throws(() => {
      ApprovalGatekeeper.verifyAuthorization({
        toolName: 'create_task',
        args: { title: 'Unauthorized Secret Task' }
        // No stepId provided -> must fail
      });
    }, /Action Authorization Denied/);
  });

  // 5. End-to-end Flagship Workflow Planner
  let createdPlan = null;
  await testAsync('Phase 3: Planner generates structured plan for flagship request', async () => {
    const prompt = 'Plan tomorrow. I have classes in the morning, need two hours for my ML project, and need groceries before dinner.';
    const planResult = await AgentPlanner.plan(prompt);

    assert.strictEqual(planResult.success, true);
    assert(planResult.plan.steps.length >= 3);
    createdPlan = planResult.plan;

    // Check that write steps have action hashes and are waiting approval
    for (const step of createdPlan.steps) {
      if (step.is_write) {
        assert.strictEqual(step.status, 'waiting_approval');
        assert(step.action_hash && step.action_hash.length === 64, 'Must have SHA-256 action hash');
      }
    }
  });

  // 6. Cryptographic Tamper Protection
  test('Phase 3: Tampering with step arguments invalidates approval token', () => {
    const writeStep = createdPlan.steps.find(s => s.is_write);
    assert(writeStep, 'Plan must have a write step');

    // Approve the step
    storage.setApprovalDecision(writeStep.id, 'approved');

    // Now attempt to verify authorization with tampered payload
    const tamperedArgs = { title: 'Hacked Malicious Title' };
    assert.throws(() => {
      ApprovalGatekeeper.verifyAuthorization({
        toolName: writeStep.tool,
        args: tamperedArgs,
        stepId: writeStep.id
      });
    }, /Tamper Protection Triggered/);
  });

  // Reset decision and re-approve properly for execution test
  await testAsync('Phase 3: Execution and Read-Back verification completes truthfully', async () => {
    // Re-seed to clean slate
    seedDatabase();

    // Re-generate fresh plan
    const prompt = 'Plan tomorrow. I have classes in the morning, need two hours for my ML project, and need groceries before dinner.';
    const planResult = await AgentPlanner.plan(prompt);
    const plan = planResult.plan;

    // Approve all steps
    for (const step of plan.steps) {
      if (step.is_write) {
        storage.setApprovalDecision(step.id, 'approved');
      }
    }

    // Execute plan
    const execReport = await AgentExecutor.executePlan(plan.id);
    if (execReport.failed?.length > 0) {
      console.log('DEBUG EXEC REPORT FAILED:', JSON.stringify(execReport.failed, null, 2));
    }
    assert.strictEqual(execReport.plan_status, 'completed');
    assert(execReport.succeeded.length >= 3);
    assert.strictEqual(execReport.failed.length, 0);

    // Read-back assertion against database
    const finalSchedule = storage.getSchedule();
    const mlBlock = finalSchedule.find(s => s.title.includes('ML Project'));
    assert(mlBlock, 'ML project block must exist in persistent SQLite');

    const finalShopping = storage.getShoppingList();
    const avocados = finalShopping.find(s => s.name.toLowerCase().includes('avocado'));
    assert(avocados, 'Avocados must exist in persistent SQLite');
  });

  // 7. Rejection test
  await testAsync('Phase 3: Rejection stops action and produces zero database writes', async () => {
    const rejectPrompt = 'Reject a proposed task and prove that it was not created.';
    const planResult = await AgentPlanner.plan(rejectPrompt);
    const plan = planResult.plan;

    // Explicitly reject the step
    const step = plan.steps[0];
    storage.setApprovalDecision(step.id, 'rejected');

    // Execute plan
    const execReport = await AgentExecutor.executePlan(plan.id);
    assert.strictEqual(execReport.rejected.length, 1);
    assert.strictEqual(execReport.succeeded.length, 0);

    // Verify database has no record created
    const tasks = storage.listTasks();
    const testTask = tasks.find(t => t.title.includes('Sample Task for Rejection Testing'));
    assert(!testTask, 'Rejected task must NOT exist in SQLite database');
  });

  if (server) {
    server.close();
  }
  console.log('\n========================================================');
  console.log(`🎉 ALL ${passed}/${total} ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
