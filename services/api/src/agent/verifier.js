import { db } from '../storage/db.js';

export class ReadBackVerifier {
  /**
   * Verifies that a state-changing tool call actually modified persistent storage as claimed.
   * Performs an authoritative query against SQLite.
   */
  static verifyWrite(toolName, args, toolResult) {
    const startTime = Date.now();

    try {
      if (!toolResult || !toolResult.success) {
        return {
          verified: false,
          reason: 'Tool execution did not return success',
          latency_ms: Date.now() - startTime
        };
      }

      const data = toolResult.data || {};

      switch (toolName) {
        case 'create_task': {
          const recordId = data.record_id || data.task?.id;
          if (!recordId) {
            return { verified: false, reason: 'Missing record_id in tool response', latency_ms: Date.now() - startTime };
          }

          const record = db.prepare('SELECT * FROM tasks WHERE id = ?').get(recordId);
          if (!record) {
            return { verified: false, reason: `Read-back assertion failed: Task '${recordId}' not found in SQLite`, latency_ms: Date.now() - startTime };
          }

          // Assert title integrity
          if (args.title && record.title.trim().toLowerCase() !== args.title.trim().toLowerCase()) {
            return {
              verified: false,
              reason: `Integrity mismatch: Expected task title '${args.title}' but found '${record.title}'`,
              latency_ms: Date.now() - startTime
            };
          }

          return {
            verified: true,
            entity: 'tasks',
            record_id: recordId,
            persisted_state: record,
            latency_ms: Date.now() - startTime
          };
        }

        case 'add_schedule_block': {
          const recordId = data.record_id || data.block?.id;
          if (!recordId) {
            return { verified: false, reason: 'Missing record_id in schedule block response', latency_ms: Date.now() - startTime };
          }

          const record = db.prepare('SELECT * FROM schedule_blocks WHERE id = ?').get(recordId);
          if (!record) {
            return { verified: false, reason: `Read-back assertion failed: Schedule block '${recordId}' not found in SQLite`, latency_ms: Date.now() - startTime };
          }

          return {
            verified: true,
            entity: 'schedule_blocks',
            record_id: recordId,
            persisted_state: record,
            latency_ms: Date.now() - startTime
          };
        }

        case 'add_shopping_items': {
          const addedItems = data.items || [];
          if (!Array.isArray(addedItems) || addedItems.length === 0) {
            return { verified: false, reason: 'No items reported created in shopping list', latency_ms: Date.now() - startTime };
          }

          const verifiedItems = [];
          for (const item of addedItems) {
            const row = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(item.id);
            if (!row) {
              return {
                verified: false,
                reason: `Read-back failed: Shopping item '${item.name}' (id: ${item.id}) not found in SQLite`,
                latency_ms: Date.now() - startTime
              };
            }
            verifiedItems.push(row);
          }

          return {
            verified: true,
            entity: 'shopping_items',
            count: verifiedItems.length,
            persisted_state: verifiedItems,
            latency_ms: Date.now() - startTime
          };
        }

        case 'save_preference': {
          const recordId = data.record_id || data.preference?.id;
          const key = args.key;

          const record = recordId
            ? db.prepare('SELECT * FROM preferences WHERE id = ?').get(recordId)
            : db.prepare('SELECT * FROM preferences WHERE key = ?').get(key);

          if (!record) {
            return { verified: false, reason: `Read-back failed: Preference '${key}' not found in SQLite`, latency_ms: Date.now() - startTime };
          }

          return {
            verified: true,
            entity: 'preferences',
            record_id: record.id,
            persisted_state: record,
            latency_ms: Date.now() - startTime
          };
        }

        default:
          return {
            verified: true,
            reason: 'Read-only tool or no write assertion needed',
            latency_ms: Date.now() - startTime
          };
      }
    } catch (err) {
      return {
        verified: false,
        reason: `Read-back verification error: ${err.message}`,
        latency_ms: Date.now() - startTime
      };
    }
  }
}
