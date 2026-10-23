import { storage } from '../../../api/src/storage/db.js';
import {
  GetScheduleSchema,
  ListTasksSchema,
  CreateTaskSchema,
  AddScheduleBlockSchema,
  GetShoppingListSchema,
  AddShoppingItemsSchema,
  GetPreferencesSchema,
  SavePreferenceSchema
} from '../schemas/toolSchemas.js';

export async function executeTool(name, rawArgs = {}, requestId = null) {
  const startTime = Date.now();
  let result;
  let isWrite = false;

  try {
    switch (name) {
      case 'get_schedule': {
        const validated = GetScheduleSchema.parse(rawArgs);
        const schedule = storage.getSchedule(validated.startDate, validated.endDate);
        result = {
          success: true,
          count: schedule.length,
          schedule: schedule
        };
        break;
      }

      case 'list_tasks': {
        const validated = ListTasksSchema.parse(rawArgs);
        const filterStatus = validated.status === 'all' ? null : validated.status;
        let tasks = storage.listTasks(filterStatus);
        if (validated.priority) {
          tasks = tasks.filter(t => t.priority === validated.priority);
        }
        result = {
          success: true,
          count: tasks.length,
          tasks: tasks
        };
        break;
      }

      case 'create_task': {
        isWrite = true;
        const validated = CreateTaskSchema.parse(rawArgs);
        const created = storage.createTask(validated);
        result = {
          success: true,
          record_id: created.id,
          task: created
        };
        break;
      }

      case 'add_schedule_block': {
        isWrite = true;
        const validated = AddScheduleBlockSchema.parse(rawArgs);
        const created = storage.addScheduleBlock(validated);
        result = {
          success: true,
          record_id: created.id,
          block: created
        };
        break;
      }

      case 'get_shopping_list': {
        const validated = GetShoppingListSchema.parse(rawArgs);
        let items = storage.getShoppingList();
        if (!validated.include_checked) {
          items = items.filter(i => !i.checked);
        }
        result = {
          success: true,
          count: items.length,
          items: items
        };
        break;
      }

      case 'add_shopping_items': {
        isWrite = true;
        const validated = AddShoppingItemsSchema.parse(rawArgs);
        const added = storage.addShoppingItems(validated.items);
        result = {
          success: true,
          items_added: added.length,
          items: added
        };
        break;
      }

      case 'get_preferences': {
        GetPreferencesSchema.parse(rawArgs);
        const prefs = storage.getPreferences();
        result = {
          success: true,
          count: prefs.length,
          preferences: prefs
        };
        break;
      }

      case 'save_preference': {
        isWrite = true;
        const validated = SavePreferenceSchema.parse(rawArgs);
        const saved = storage.savePreference(validated);
        result = {
          success: true,
          record_id: saved.id,
          preference: saved
        };
        break;
      }

      default:
        throw new Error(`Unknown tool requested: ${name}`);
    }

    const duration = Date.now() - startTime;
    // Log tool execution for auditability
    if (requestId) {
      storage.logToolExecution({
        request_id: requestId,
        tool: name,
        inputs: rawArgs,
        status: 'success',
        sanitized_result: result,
        execution_ms: duration,
        verified: isWrite ? 0 : 1
      });
    }

    return {
      success: true,
      data: result,
      duration_ms: duration,
      request_id: requestId
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      message: error.message,
      code: error.code || 'ERR_TOOL_EXECUTION',
      conflicts: error.conflicts || null,
      issues: error.issues || null
    };

    if (requestId) {
      storage.logToolExecution({
        request_id: requestId,
        tool: name,
        inputs: rawArgs,
        status: 'error',
        sanitized_result: errorDetails,
        execution_ms: duration,
        verified: 0
      });
    }

    return {
      success: false,
      error: errorDetails,
      duration_ms: duration,
      request_id: requestId
    };
  }
}
