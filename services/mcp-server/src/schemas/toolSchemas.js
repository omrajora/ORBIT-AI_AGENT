import { z } from 'zod';

export const GetScheduleSchema = z.object({
  startDate: z.string().optional().describe('Start date/time in ISO format'),
  endDate: z.string().optional().describe('End date/time in ISO format'),
  timezone: z.string().optional().default('UTC').describe('User timezone')
});

export const ListTasksSchema = z.object({
  status: z.enum(['all', 'pending', 'completed']).optional().default('pending').describe('Task status filter'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority filter')
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').describe('Task title'),
  details: z.string().optional().default('').describe('Detailed notes or description'),
  due_at: z.string().optional().describe('Due date/time in ISO format'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium').describe('Priority level'),
  idempotency_key: z.string().optional().describe('Unique client-provided key to prevent duplicate creation')
});

export const AddScheduleBlockSchema = z.object({
  title: z.string().min(1, 'Schedule block title is required').describe('Title of the event or activity'),
  start_at: z.string().min(1, 'start_at ISO timestamp is required').describe('Start timestamp in ISO 8601 format'),
  end_at: z.string().min(1, 'end_at ISO timestamp is required').describe('End timestamp in ISO 8601 format'),
  timezone: z.string().optional().default('America/New_York').describe('Timezone identifier'),
  source: z.string().optional().default('orbit').describe('Origin of the block')
});

export const GetShoppingListSchema = z.object({
  include_checked: z.boolean().optional().default(false).describe('Whether to include checked/purchased items')
});

export const AddShoppingItemsSchema = z.object({
  items: z.array(
    z.union([
      z.string().min(1),
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive().optional().default(1),
        unit: z.string().optional().default('item')
      })
    ])
  ).min(1, 'At least one shopping item must be specified').describe('List of grocery or shopping items to add')
});

export const GetPreferencesSchema = z.object({
  category: z.string().optional().describe('Optional category filter')
});

export const SavePreferenceSchema = z.object({
  key: z.string().min(1, 'Preference key is required').describe('Key name for preference'),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.any())]).describe('Value of the preference'),
  source: z.string().optional().default('user_confirmed').describe('Source of confirmation'),
  user_confirmed: z.boolean().optional().default(true).describe('Explicit user confirmation flag')
});

export const TOOL_DEFINITIONS = [
  {
    name: 'get_schedule',
    description: 'Retrieves calendar events and schedule blocks for specified date range, source, and timezone.',
    is_write: false,
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date/time in ISO format' },
        endDate: { type: 'string', description: 'End date/time in ISO format' },
        timezone: { type: 'string', description: 'Timezone identifier (e.g. America/New_York)' }
      }
    }
  },
  {
    name: 'list_tasks',
    description: 'Fetches active and completed tasks filtered by status, priority, and due dates.',
    is_write: false,
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'pending', 'completed'], description: 'Filter tasks by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter tasks by priority' }
      }
    }
  },
  {
    name: 'create_task',
    description: 'Creates a new task with title, priority, due date, and mandatory idempotency key.',
    is_write: true,
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Task title' },
        details: { type: 'string', description: 'Task details or notes' },
        due_at: { type: 'string', description: 'Due date/time in ISO format' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
        idempotency_key: { type: 'string', description: 'Unique idempotency key' }
      }
    }
  },
  {
    name: 'add_schedule_block',
    description: 'Allocates a calendar block after validating against existing commitment conflicts.',
    is_write: true,
    inputSchema: {
      type: 'object',
      required: ['title', 'start_at', 'end_at'],
      properties: {
        title: { type: 'string', description: 'Title of the event or activity' },
        start_at: { type: 'string', description: 'Start timestamp in ISO 8601 format' },
        end_at: { type: 'string', description: 'End timestamp in ISO 8601 format' },
        timezone: { type: 'string', description: 'Timezone identifier' },
        source: { type: 'string', description: 'Origin/source of this entry' }
      }
    }
  },
  {
    name: 'get_shopping_list',
    description: 'Retrieves current active grocery/shopping list items and quantities.',
    is_write: false,
    inputSchema: {
      type: 'object',
      properties: {
        include_checked: { type: 'boolean', description: 'Whether to include checked off items' }
      }
    }
  },
  {
    name: 'add_shopping_items',
    description: 'Appends validated grocery items while deduplicating against active inventory.',
    is_write: true,
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          description: 'Items to add with name, quantity, unit',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string' }
                }
              }
            ]
          }
        }
      }
    }
  },
  {
    name: 'get_preferences',
    description: 'Retrieves explicit, user-confirmed constraints, preferences, and default habits.',
    is_write: false,
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category' }
      }
    }
  },
  {
    name: 'save_preference',
    description: 'Persists user-confirmed preferences; explicitly blocks speculative agent assumptions.',
    is_write: true,
    inputSchema: {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        key: { type: 'string', description: 'Key name of preference' },
        value: { description: 'Value of preference' },
        source: { type: 'string', description: 'Source of confirmation' },
        user_confirmed: { type: 'boolean', description: 'Whether explicitly confirmed by user' }
      }
    }
  }
];
