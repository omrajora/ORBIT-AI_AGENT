import crypto from 'node:crypto';

/**
 * Standard tool catalog for ORBIT
 */
export const TOOL_NAMES = {
  GET_SCHEDULE: 'get_schedule',
  LIST_TASKS: 'list_tasks',
  CREATE_TASK: 'create_task',
  ADD_SCHEDULE_BLOCK: 'add_schedule_block',
  GET_SHOPPING_LIST: 'get_shopping_list',
  ADD_SHOPPING_ITEMS: 'add_shopping_items',
  GET_PREFERENCES: 'get_preferences',
  SAVE_PREFERENCE: 'save_preference'
};

export const WRITE_TOOLS = new Set([
  TOOL_NAMES.CREATE_TASK,
  TOOL_NAMES.ADD_SCHEDULE_BLOCK,
  TOOL_NAMES.ADD_SHOPPING_ITEMS,
  TOOL_NAMES.SAVE_PREFERENCE
]);

export const READ_TOOLS = new Set([
  TOOL_NAMES.GET_SCHEDULE,
  TOOL_NAMES.LIST_TASKS,
  TOOL_NAMES.GET_SHOPPING_LIST,
  TOOL_NAMES.GET_PREFERENCES
]);

export function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

/**
 * Computes a deterministic SHA-256 hash of tool call arguments
 * to cryptographically bind approvals to the exact payload.
 */
export function computeActionHash(toolName, args) {
  const canonical = JSON.stringify({
    tool: toolName,
    args: canonicalize(args || {})
  });

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Tool status and plan step statuses
 */
export const STEP_STATUS = {
  PLANNED: 'planned',
  WAITING_APPROVAL: 'waiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

export const ERROR_CODES = {
  VALIDATION: 'ERR_VALIDATION',
  CONFLICT: 'ERR_CONFLICT',
  APPROVAL_REQUIRED: 'ERR_APPROVAL_REQUIRED',
  APPROVAL_INVALID: 'ERR_APPROVAL_INVALID',
  TOOL_UNAVAILABLE: 'ERR_TOOL_UNAVAILABLE',
  PROVIDER_FAILURE: 'ERR_PROVIDER_FAILURE',
  PERSISTENCE: 'ERR_PERSISTENCE',
  VERIFICATION: 'ERR_VERIFICATION'
};
