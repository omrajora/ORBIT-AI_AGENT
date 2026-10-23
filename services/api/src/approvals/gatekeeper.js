import { computeActionHash, WRITE_TOOLS } from '@orbit/shared';
import { storage, db } from '../storage/db.js';

export class ApprovalGatekeeper {
  /**
   * Evaluates whether a tool call is permitted to execute.
   * Read-only tools execute without approval.
   * Write tools require an active, non-expired approval with matching cryptographic hash.
   */
  static verifyAuthorization({ toolName, args, stepId = null }) {
    // Read operations do not mutate state; they are authorized automatically
    if (!WRITE_TOOLS.has(toolName)) {
      return { authorized: true, reason: 'Read operation' };
    }

    if (!stepId) {
      const error = new Error(`Action Authorization Denied: Consequential write tool '${toolName}' requires prior explicit approval.`);
      error.code = 'ERR_APPROVAL_REQUIRED';
      error.statusCode = 403;
      throw error;
    }

    const step = db.prepare('SELECT * FROM plan_steps WHERE id = ?').get(stepId);
    if (!step) {
      const error = new Error(`Approval Verification Failed: Plan step '${stepId}' does not exist.`);
      error.code = 'ERR_STEP_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    const approval = storage.getApprovalByStepId(stepId);
    if (!approval) {
      const error = new Error(`Action Authorization Denied: No approval record exists for step '${stepId}'.`);
      error.code = 'ERR_APPROVAL_REQUIRED';
      error.statusCode = 403;
      throw error;
    }

    if (approval.status === 'rejected') {
      const error = new Error(`Action Authorization Denied: Step '${stepId}' was explicitly REJECTED by user.`);
      error.code = 'ERR_APPROVAL_REJECTED';
      error.statusCode = 403;
      throw error;
    }

    if (approval.status !== 'approved') {
      const error = new Error(`Action Authorization Denied: Step '${stepId}' is currently '${approval.status}'. Approval is required before execution.`);
      error.code = 'ERR_APPROVAL_REQUIRED';
      error.statusCode = 403;
      throw error;
    }

    // Check expiration TTL
    const now = new Date();
    const expiresAt = new Date(approval.expires_at);
    if (now > expiresAt) {
      // Invalidate expired approval
      db.prepare("UPDATE approvals SET status = 'expired' WHERE id = ?").run(approval.id);
      db.prepare("UPDATE plan_steps SET status = 'waiting_approval' WHERE id = ?").run(stepId);
      const error = new Error(`Approval Expired: Approval token for step '${stepId}' expired at ${approval.expires_at}. Fresh review required.`);
      error.code = 'ERR_APPROVAL_EXPIRED';
      error.statusCode = 403;
      throw error;
    }

    // Cryptographic Action Hash verification: sha256(canonicalPayload)
    const expectedHash = computeActionHash(toolName, args);
    if (approval.action_hash !== expectedHash) {
      // Argument mutation detected! Invalidate approval immediately
      db.prepare("UPDATE approvals SET status = 'invalidated' WHERE id = ?").run(approval.id);
      db.prepare("UPDATE plan_steps SET status = 'waiting_approval' WHERE id = ?").run(stepId);
      const error = new Error(`Tamper Protection Triggered: Action payload for step '${stepId}' was modified after approval. Expected hash ${approval.action_hash.slice(0, 10)}... got ${expectedHash.slice(0, 10)}... Approval invalidated.`);
      error.code = 'ERR_PAYLOAD_TAMPERED';
      error.statusCode = 403;
      throw error;
    }

    return { authorized: true, approvalId: approval.id, actionHash: expectedHash };
  }
}
