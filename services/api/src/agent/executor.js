import { storage, db } from '../storage/db.js';
import { mcpClient } from './mcpClient.js';
import { ApprovalGatekeeper } from '../approvals/gatekeeper.js';
import { ReadBackVerifier } from './verifier.js';

export class AgentExecutor {
  /**
   * Executes approved steps within a plan through the MCP server
   * and enforces read-back verification.
   */
  static async executePlan(planId, options = {}) {
    const plan = storage.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan '${planId}' not found`);
    }

    const steps = plan.steps || [];
    const executionReport = {
      plan_id: planId,
      succeeded: [],
      failed: [],
      rejected: [],
      unapproved_skipped: [],
      verification_results: []
    };

    for (const step of steps) {
      const stepArgs = typeof step.arguments === 'string' ? JSON.parse(step.arguments) : step.arguments;

      // Check if rejected
      if (step.status === 'rejected') {
        executionReport.rejected.push({
          step_id: step.id,
          tool: step.tool,
          description: step.description,
          reason: 'User explicitly rejected this action'
        });
        continue;
      }

      // Check if not approved
      if (step.is_write && step.status !== 'approved') {
        executionReport.unapproved_skipped.push({
          step_id: step.id,
          tool: step.tool,
          description: step.description,
          status: step.status,
          reason: 'Awaiting explicit approval; write was safely blocked'
        });
        continue;
      }

      // Check Gatekeeper authorization & action hash integrity
      try {
        ApprovalGatekeeper.verifyAuthorization({
          toolName: step.tool,
          args: stepArgs,
          stepId: step.id
        });
      } catch (authErr) {
        storage.updateStepStatus(step.id, {
          status: 'failed',
          result: { error: authErr.message, code: authErr.code }
        });
        executionReport.failed.push({
          step_id: step.id,
          tool: step.tool,
          description: step.description,
          error: authErr.message,
          code: authErr.code
        });
        continue;
      }

      // Mark step as running
      storage.updateStepStatus(step.id, { status: 'running' });

      // Execute via MCP Client
      const toolCallResult = await mcpClient.callTool(step.tool, stepArgs);

      if (!toolCallResult.success) {
        storage.updateStepStatus(step.id, {
          status: 'failed',
          result: toolCallResult.error
        });
        executionReport.failed.push({
          step_id: step.id,
          tool: step.tool,
          description: step.description,
          error: toolCallResult.error?.message || 'Tool execution failed',
          code: toolCallResult.error?.code || 'ERR_TOOL_FAILURE'
        });
        continue;
      }

      // Perform Read-Back Verification against persistent SQLite
      const verification = ReadBackVerifier.verifyWrite(step.tool, stepArgs, toolCallResult);
      executionReport.verification_results.push({
        step_id: step.id,
        tool: step.tool,
        verification
      });

      if (!verification.verified) {
        storage.updateStepStatus(step.id, {
          status: 'failed',
          result: {
            mcp_result: toolCallResult.data,
            verification_error: verification.reason
          }
        });
        executionReport.failed.push({
          step_id: step.id,
          tool: step.tool,
          description: step.description,
          error: `Read-back verification failed: ${verification.reason}`,
          code: 'ERR_VERIFICATION_FAILED'
        });
        continue;
      }

      // Success and Verified!
      storage.updateStepStatus(step.id, {
        status: 'succeeded',
        result: {
          data: toolCallResult.data,
          verified: true,
          verification_ms: verification.latency_ms
        }
      });

      executionReport.succeeded.push({
        step_id: step.id,
        tool: step.tool,
        description: step.description,
        record_id: verification.record_id || null,
        duration_ms: toolCallResult.duration_ms,
        verified: true,
        persisted_data: verification.persisted_state
      });
    }

    // Determine aggregate plan status
    let finalPlanStatus = 'completed';
    if (executionReport.failed.length > 0 && executionReport.succeeded.length > 0) {
      finalPlanStatus = 'partially_completed';
    } else if (executionReport.failed.length > 0 && executionReport.succeeded.length === 0) {
      finalPlanStatus = 'failed';
    } else if (executionReport.unapproved_skipped.length > 0 && executionReport.succeeded.length === 0) {
      finalPlanStatus = 'waiting_approval';
    }

    storage.updatePlanStatus(planId, finalPlanStatus);

    // Build truthful completion summary
    const summaryLines = [];
    if (executionReport.succeeded.length > 0) {
      summaryLines.push(`✅ ${executionReport.succeeded.length} action(s) executed and verified in persistent storage.`);
    }
    if (executionReport.failed.length > 0) {
      summaryLines.push(`❌ ${executionReport.failed.length} action(s) halted due to validation/conflicts.`);
    }
    if (executionReport.rejected.length > 0) {
      summaryLines.push(`🚫 ${executionReport.rejected.length} action(s) explicitly rejected by user (zero database writes).`);
    }
    if (executionReport.unapproved_skipped.length > 0) {
      summaryLines.push(`⏳ ${executionReport.unapproved_skipped.length} action(s) held pending user approval.`);
    }

    executionReport.truthful_summary = summaryLines.join(' ');
    executionReport.plan_status = finalPlanStatus;

    return executionReport;
  }
}
