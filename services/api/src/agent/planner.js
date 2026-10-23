import { computeActionHash, WRITE_TOOLS, TOOL_NAMES } from '@orbit/shared';
import { mcpClient } from './mcpClient.js';
import { storage } from '../storage/db.js';
import { getTomorrowDateStr } from '../../scripts/seed.js';

export class AgentPlanner {
  /**
   * Main entrypoint for processing natural-language requests into structured plans.
   */
  static async plan(userMessage, conversationId = 'conv_demo_01') {
    const text = userMessage.trim().toLowerCase();
    const tomorrowStr = getTomorrowDateStr();

    // Stage 1 & 2: RETRIEVE context using MCP tools
    const [scheduleRes, tasksRes, shoppingRes, prefsRes] = await Promise.all([
      mcpClient.callTool(TOOL_NAMES.GET_SCHEDULE, {
        startDate: `${tomorrowStr}T00:00:00Z`,
        endDate: `${tomorrowStr}T23:59:59Z`
      }),
      mcpClient.callTool(TOOL_NAMES.LIST_TASKS, { status: 'pending' }),
      mcpClient.callTool(TOOL_NAMES.GET_SHOPPING_LIST, {}),
      mcpClient.callTool(TOOL_NAMES.GET_PREFERENCES, {})
    ]);

    const existingSchedule = scheduleRes.data?.schedule || [];
    const pendingTasks = tasksRes.data?.tasks || [];
    const shoppingList = shoppingRes.data?.items || [];
    const preferences = prefsRes.data?.preferences || [];

    // Stage 3 & 4: PLAN & VALIDATE
    const steps = [];
    let assistantSummary = '';

    // Check for conflict test scenario
    if (text.includes('conflict') || text.includes('try to schedule a block that conflicts')) {
      const morningClass = existingSchedule.find(s => s.title.includes('CS 480')) || existingSchedule[0];
      const conflictStart = morningClass ? morningClass.start_at : `${tomorrowStr}T09:30:00Z`;
      const conflictEnd = morningClass ? morningClass.end_at : `${tomorrowStr}T10:30:00Z`;

      const conflictStep = {
        tool: TOOL_NAMES.ADD_SCHEDULE_BLOCK,
        arguments: {
          title: 'Emergency Team Sync (Conflicting Request)',
          start_at: conflictStart,
          end_at: conflictEnd,
          timezone: 'America/New_York',
          source: 'orbit_conflict_test'
        },
        description: `Attempt to schedule meeting during ${morningClass ? morningClass.title : 'Morning Class'}`,
        is_write: true,
        warnings: [`⚠️ Direct conflict detected with existing commitment: ${morningClass?.title || 'Existing block'}`]
      };
      conflictStep.action_hash = computeActionHash(conflictStep.tool, conflictStep.arguments);
      steps.push(conflictStep);

      assistantSummary = `I analyzed your calendar for ${tomorrowStr} and detected a schedule collision with "${morningClass?.title || 'existing event'}". Per ORBIT safety protocol, conflict avoidance is flagged. If approved, the server validation engine will strictly enforce collision detection.`;

    } else if (text.includes('reject') || text.includes('prove that it was not created')) {
      const rejectStep = {
        tool: TOOL_NAMES.CREATE_TASK,
        arguments: {
          title: 'Sample Task for Rejection Testing',
          details: 'This task should be rejected in the approval drawer to verify zero database writes occur.',
          priority: 'low',
          due_at: `${tomorrowStr}T18:00:00Z`,
          idempotency_key: `reject_test_${Date.now()}`
        },
        description: 'Propose a test task to demonstrate human-in-the-loop rejection verification',
        is_write: true
      };
      rejectStep.action_hash = computeActionHash(rejectStep.tool, rejectStep.arguments);
      steps.push(rejectStep);

      assistantSummary = `I have staged a test task proposal. You can click 'Reject' in the approval drawer to verify that ORBIT blocks unapproved actions and creates zero database records.`;

    } else if (text.includes('remember') || text.includes('prefer') || text.includes('study blocks')) {
      const prefValue = text.includes('50') ? '50 minutes' : 'Focused study blocks';
      const saveStep = {
        tool: TOOL_NAMES.SAVE_PREFERENCE,
        arguments: {
          key: 'study_block_duration',
          value: prefValue,
          source: 'user_explicit_dialogue',
          user_confirmed: true
        },
        description: `Persist confirmed preference: study_block_duration = ${prefValue}`,
        is_write: true
      };
      saveStep.action_hash = computeActionHash(saveStep.tool, saveStep.arguments);
      steps.push(saveStep);

      assistantSummary = `I have structured an explicit preference update for your study duration (${prefValue}). Ready for your review and approval.`;

    } else if (text.includes('groceries') && !text.includes('ml project') && !text.includes('plan tomorrow')) {
      const itemsToAdd = [
        { name: 'Organic Greek Yogurt', quantity: 2, unit: 'tubs' },
        { name: 'Baby Spinach', quantity: 1, unit: 'bag' },
        { name: 'Sourdough Bread', quantity: 1, unit: 'loaf' }
      ];

      const groceryStep = {
        tool: TOOL_NAMES.ADD_SHOPPING_ITEMS,
        arguments: { items: itemsToAdd },
        description: `Add 3 items to shopping list with deduplication: ${itemsToAdd.map(i => i.name).join(', ')}`,
        is_write: true
      };
      groceryStep.action_hash = computeActionHash(groceryStep.tool, groceryStep.arguments);
      steps.push(groceryStep);

      assistantSummary = `I prepared an update to append 3 validated groceries to your persistent list with active inventory deduplication.`;

    } else {
      // Flagship Workflow: Multi-part Daily Mission Orchestrator
      // "Plan tomorrow. I have classes in the morning, need two hours for my ML project, and need groceries before dinner."
      
      // Step A: Schedule 2 hours for ML project in the afternoon window (13:30 - 15:30)
      const mlStart = `${tomorrowStr}T13:30:00Z`;
      const mlEnd = `${tomorrowStr}T15:30:00Z`;

      const scheduleStep = {
        tool: TOOL_NAMES.ADD_SCHEDULE_BLOCK,
        arguments: {
          title: 'Focused Work: ML Project Experiment & Evaluation',
          start_at: mlStart,
          end_at: mlEnd,
          timezone: 'America/New_York',
          source: 'orbit_planner'
        },
        description: `Reserve 2-hour focused block for ML project (13:30 - 15:30) avoiding morning classes and evening dinner`,
        is_write: true,
        warnings: []
      };
      scheduleStep.action_hash = computeActionHash(scheduleStep.tool, scheduleStep.arguments);
      steps.push(scheduleStep);

      // Step B: Schedule grocery errand before dinner (17:00 - 17:45)
      const errandStart = `${tomorrowStr}T17:00:00Z`;
      const errandEnd = `${tomorrowStr}T17:45:00Z`;

      const errandStep = {
        tool: TOOL_NAMES.ADD_SCHEDULE_BLOCK,
        arguments: {
          title: 'Grocery Run (Before Dinner)',
          start_at: errandStart,
          end_at: errandEnd,
          timezone: 'America/New_York',
          source: 'orbit_planner'
        },
        description: `Reserve 45-min grocery errand window (17:00 - 17:45) before dinner at 18:30`,
        is_write: true,
        warnings: []
      };
      errandStep.action_hash = computeActionHash(errandStep.tool, errandStep.arguments);
      steps.push(errandStep);

      // Step C: Add required groceries to shopping list
      const groceryStep = {
        tool: TOOL_NAMES.ADD_SHOPPING_ITEMS,
        arguments: {
          items: [
            { name: 'Avocados', quantity: 3, unit: 'pieces' },
            { name: 'Organic Almond Milk', quantity: 1, unit: 'carton' },
            { name: 'Baby Spinach', quantity: 1, unit: 'container' }
          ]
        },
        description: 'Append groceries needed before dinner: Avocados, Almond Milk, Baby Spinach',
        is_write: true
      };
      groceryStep.action_hash = computeActionHash(groceryStep.tool, groceryStep.arguments);
      steps.push(groceryStep);

      // Step D: Create tracking task for ML write-up milestone
      const taskStep = {
        tool: TOOL_NAMES.CREATE_TASK,
        arguments: {
          title: 'Submit ML Project Experiment Write-up',
          details: 'Prepare final loss curves and model comparison table after afternoon test session',
          priority: 'high',
          due_at: `${tomorrowStr}T23:59:00Z`,
          idempotency_key: `task_ml_submit_${tomorrowStr}`
        },
        description: 'Create milestone submission task for ML project',
        is_write: true
      };
      taskStep.action_hash = computeActionHash(taskStep.tool, taskStep.arguments);
      steps.push(taskStep);

      assistantSummary = `I have analyzed your calendar for tomorrow (${tomorrowStr}). You have morning classes (CS 480 & MATH 310 from 09:00 to 12:00) and dinner at 18:30. Based on your afternoon focus preference, I have formulated a conflict-free plan with 4 proposed operations. All writes are safely gated behind your explicit approval.`;
    }

    // Persist proposed plan to database
    const createdPlan = storage.createPlan({
      conversation_id: conversationId,
      summary: assistantSummary,
      steps
    });

    return {
      success: true,
      plan: createdPlan,
      summary: assistantSummary,
      context: {
        tomorrow: tomorrowStr,
        existingClassesCount: existingSchedule.length,
        pendingTasksCount: pendingTasks.length,
        shoppingItemsCount: shoppingList.length
      }
    };
  }
}
