import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root directory of repo (services/api/src/storage -> services/api/src -> services/api -> services -> root)
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const dbPath = process.env.SQLITE_DB_PATH
  ? (path.isAbsolute(process.env.SQLITE_DB_PATH) ? process.env.SQLITE_DB_PATH : path.resolve(REPO_ROOT, process.env.SQLITE_DB_PATH))
  : path.resolve(REPO_ROOT, 'data/orbit.sqlite');

const resolvedDbDir = path.dirname(dbPath);

if (!fs.existsSync(resolvedDbDir)) {
  fs.mkdirSync(resolvedDbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize all database tables matching PRD section 8.
 */
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      details TEXT,
      due_at TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_blocks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'confirmed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'item',
      checked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      source TEXT DEFAULT 'user_confirmed',
      user_confirmed INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      status TEXT DEFAULT 'proposed',
      summary TEXT,
      created_at TEXT NOT NULL,
      approved_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_steps (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      tool TEXT NOT NULL,
      arguments TEXT NOT NULL,
      description TEXT,
      is_write INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned',
      action_hash TEXT,
      result TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL,
      action_hash TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      decided_at TEXT,
      FOREIGN KEY (step_id) REFERENCES plan_steps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      inputs TEXT,
      status TEXT NOT NULL,
      sanitized_result TEXT,
      execution_ms INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

// Automatically init tables on import
initSchema();

// Helper: Conflict detection for schedule blocks
export function checkScheduleConflict(startAt, endAt, excludeId = null) {
  const query = excludeId
    ? `SELECT * FROM schedule_blocks 
       WHERE id != ? AND NOT (datetime(end_at) <= datetime(?) OR datetime(start_at) >= datetime(?))`
    : `SELECT * FROM schedule_blocks 
       WHERE NOT (datetime(end_at) <= datetime(?) OR datetime(start_at) >= datetime(?))`;

  const stmt = db.prepare(query);
  const conflicts = excludeId 
    ? stmt.all(excludeId, startAt, endAt)
    : stmt.all(startAt, endAt);

  return conflicts;
}

// ----------------- DATA ACCESS METHODS -----------------

export const storage = {
  // SCHEDULE
  getSchedule(startDate, endDate) {
    if (startDate && endDate) {
      return db.prepare(`
        SELECT * FROM schedule_blocks 
        WHERE datetime(start_at) >= datetime(?) AND datetime(start_at) <= datetime(?)
        ORDER BY start_at ASC
      `).all(startDate, endDate);
    }
    return db.prepare('SELECT * FROM schedule_blocks ORDER BY start_at ASC').all();
  },

  addScheduleBlock({ id, title, start_at, end_at, timezone = 'UTC', source = 'orbit' }) {
    if (new Date(start_at) >= new Date(end_at)) {
      throw new Error(`Invalid time range: start_at (${start_at}) must be before end_at (${end_at})`);
    }

    const conflicts = checkScheduleConflict(start_at, end_at);
    if (conflicts.length > 0) {
      const conflictTitles = conflicts.map(c => `"${c.title}" (${c.start_at} - ${c.end_at})`).join(', ');
      const err = new Error(`Schedule conflict detected with: ${conflictTitles}`);
      err.code = 'ERR_CONFLICT';
      err.conflicts = conflicts;
      throw err;
    }

    const blockId = id || `block_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO schedule_blocks (id, title, start_at, end_at, timezone, source, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(blockId, title, start_at, end_at, timezone, source, now);

    return db.prepare('SELECT * FROM schedule_blocks WHERE id = ?').get(blockId);
  },

  // TASKS
  listTasks(status = null) {
    if (status) {
      return db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY due_at ASC').all(status);
    }
    return db.prepare('SELECT * FROM tasks ORDER BY status ASC, due_at ASC').all();
  },

  createTask({ id, title, details = '', due_at = null, priority = 'medium', idempotency_key = null }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Task title is required');
    }

    if (idempotency_key) {
      const existing = db.prepare('SELECT * FROM tasks WHERE idempotency_key = ?').get(idempotency_key);
      if (existing) {
        return { ...existing, is_duplicate: true };
      }
    }

    const taskId = id || `task_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, details, due_at, priority, status, idempotency_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(taskId, title.trim(), details, due_at, priority, idempotency_key, now, now);

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  },

  // SHOPPING LIST
  getShoppingList() {
    return db.prepare('SELECT * FROM shopping_items ORDER BY checked ASC, created_at ASC').all();
  },

  addShoppingItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items must be a non-empty array');
    }

    const added = [];
    const now = new Date().toISOString();

    for (const item of items) {
      const name = typeof item === 'string' ? item.trim() : item.name?.trim();
      if (!name) continue;

      const quantity = typeof item === 'object' && item.quantity ? Number(item.quantity) : 1;
      const unit = typeof item === 'object' && item.unit ? item.unit : 'item';

      const existing = db.prepare('SELECT * FROM shopping_items WHERE lower(name) = lower(?)').get(name);
      if (existing) {
        // Safe update: increase quantity without duplicating
        const newQty = existing.quantity + quantity;
        db.prepare('UPDATE shopping_items SET quantity = ?, checked = 0 WHERE id = ?').run(newQty, existing.id);
        added.push(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(existing.id));
      } else {
        const itemId = `shop_${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO shopping_items (id, name, quantity, unit, checked, created_at)
          VALUES (?, ?, ?, ?, 0, ?)
        `).run(itemId, name, quantity, unit, now);
        added.push(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(itemId));
      }
    }

    return added;
  },

  // PREFERENCES
  getPreferences() {
    return db.prepare('SELECT * FROM preferences ORDER BY updated_at DESC').all();
  },

  savePreference({ key, value, source = 'user_confirmed', user_confirmed = 1 }) {
    if (!key || typeof key !== 'string') {
      throw new Error('Preference key is required');
    }
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM preferences WHERE key = ?').get(key);
    if (existing) {
      db.prepare(`
        UPDATE preferences 
        SET value = ?, source = ?, user_confirmed = ?, updated_at = ?
        WHERE id = ?
      `).run(valStr, source, user_confirmed ? 1 : 0, now, existing.id);
      return db.prepare('SELECT * FROM preferences WHERE id = ?').get(existing.id);
    } else {
      const prefId = `pref_${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO preferences (id, key, value, source, user_confirmed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(prefId, key, valStr, source, user_confirmed ? 1 : 0, now);
      return db.prepare('SELECT * FROM preferences WHERE id = ?').get(prefId);
    }
  },

  deletePreference(id) {
    db.prepare('DELETE FROM preferences WHERE id = ? OR key = ?').run(id, id);
    return { success: true, deleted_id: id };
  },

  // CONVERSATIONS & MESSAGES
  createConversation(title = 'New Assistant Session') {
    const id = `conv_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, title, now, now);
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  },

  getConversation(id) {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conv) return null;
    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id);
    const plans = db.prepare('SELECT * FROM plans WHERE conversation_id = ? ORDER BY created_at DESC').all(id);
    return { ...conv, messages, plans };
  },

  listConversations() {
    return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
  },

  addMessage({ conversation_id, role, content, metadata = null }) {
    const id = `msg_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const metaStr = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, conversation_id, role, content, metaStr, now);

    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversation_id);
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  },

  // PLANS & APPROVALS
  createPlan({ conversation_id, summary, steps }) {
    const planId = `plan_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO plans (id, conversation_id, status, summary, created_at)
      VALUES (?, ?, 'proposed', ?, ?)
    `).run(planId, conversation_id, summary || '', now);

    const createdSteps = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = `step_${crypto.randomUUID().slice(0, 8)}`;
      const argsStr = typeof step.arguments === 'string' ? step.arguments : JSON.stringify(step.arguments || {});
      const isWrite = step.is_write ? 1 : 0;
      const actionHash = step.action_hash || '';

      db.prepare(`
        INSERT INTO plan_steps (id, plan_id, step_order, tool, arguments, description, is_write, status, action_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stepId,
        planId,
        i + 1,
        step.tool,
        argsStr,
        step.description || '',
        isWrite,
        isWrite ? 'waiting_approval' : 'planned',
        actionHash,
        now
      );

      // Create approval record if write step
      if (isWrite) {
        const approvalId = `appr_${crypto.randomUUID().slice(0, 8)}`;
        const expiresAt = new Date(Date.now() + 300 * 1000).toISOString(); // 5 min TTL
        db.prepare(`
          INSERT INTO approvals (id, step_id, action_hash, status, expires_at)
          VALUES (?, ?, ?, 'pending', ?)
        `).run(approvalId, stepId, actionHash, expiresAt);
      }

      createdSteps.push(db.prepare('SELECT * FROM plan_steps WHERE id = ?').get(stepId));
    }

    return {
      ...db.prepare('SELECT * FROM plans WHERE id = ?').get(planId),
      steps: createdSteps
    };
  },

  getPlan(planId) {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return null;
    const steps = db.prepare('SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_order ASC').all(planId);
    const stepsWithApprovals = steps.map(s => {
      const approval = db.prepare('SELECT * FROM approvals WHERE step_id = ?').get(s.id);
      return { ...s, approval };
    });
    return { ...plan, steps: stepsWithApprovals };
  },

  updatePlanStatus(planId, status) {
    db.prepare('UPDATE plans SET status = ? WHERE id = ?').run(status, planId);
    return db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  },

  updateStepStatus(stepId, { status, result = null, request_id = null }) {
    const resultStr = result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null;
    db.prepare(`
      UPDATE plan_steps 
      SET status = ?, result = coalesce(?, result), request_id = coalesce(?, request_id)
      WHERE id = ?
    `).run(status, resultStr, request_id, stepId);
    return db.prepare('SELECT * FROM plan_steps WHERE id = ?').get(stepId);
  },

  getApprovalByStepId(stepId) {
    return db.prepare('SELECT * FROM approvals WHERE step_id = ?').get(stepId);
  },

  setApprovalDecision(stepId, decision) {
    const now = new Date().toISOString();
    db.prepare('UPDATE approvals SET status = ?, decided_at = ? WHERE step_id = ?').run(decision, now, stepId);
    db.prepare('UPDATE plan_steps SET status = ? WHERE id = ?').run(
      decision === 'approved' ? 'approved' : 'rejected',
      stepId
    );
    return db.prepare('SELECT * FROM approvals WHERE step_id = ?').get(stepId);
  },

  // TOOL EXECUTION AUDIT LOGS
  logToolExecution({ request_id, tool, inputs, status, sanitized_result, execution_ms = 0, verified = 0 }) {
    const id = `exec_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const inputStr = inputs ? (typeof inputs === 'string' ? inputs : JSON.stringify(inputs)) : null;
    const resStr = sanitized_result ? (typeof sanitized_result === 'string' ? sanitized_result : JSON.stringify(sanitized_result)) : null;

    db.prepare(`
      INSERT INTO tool_executions (id, request_id, tool, inputs, status, sanitized_result, execution_ms, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, request_id, tool, inputStr, status, resStr, execution_ms, verified ? 1 : 0, now);

    return db.prepare('SELECT * FROM tool_executions WHERE id = ?').get(id);
  },

  getToolExecutions(limit = 50) {
    return db.prepare('SELECT * FROM tool_executions ORDER BY created_at DESC LIMIT ?').all(limit);
  }
};
