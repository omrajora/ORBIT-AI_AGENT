import { db, initSchema } from '../src/storage/db.js';

export function getTomorrowDateStr() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function seedDatabase() {
  console.log('🔄 Resetting database tables...');
  
  // Clean existing rows
  db.exec(`
    DELETE FROM tool_executions;
    DELETE FROM approvals;
    DELETE FROM plan_steps;
    DELETE FROM plans;
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM preferences;
    DELETE FROM shopping_items;
    DELETE FROM schedule_blocks;
    DELETE FROM tasks;
  `);

  console.log('🌱 Seeding fresh demo data...');
  const tomorrowStr = getTomorrowDateStr();
  const now = new Date().toISOString();

  // 1. Seed Schedule Blocks (Morning classes)
  const insertSchedule = db.prepare(`
    INSERT INTO schedule_blocks (id, title, start_at, end_at, timezone, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
  `);

  insertSchedule.run(
    'block_seed_cs480',
    'CS 480: Distributed Systems Lecture',
    `${tomorrowStr}T09:00:00Z`,
    `${tomorrowStr}T10:30:00Z`,
    'America/New_York',
    'university_calendar',
    now
  );

  insertSchedule.run(
    'block_seed_math310',
    'MATH 310: Linear Algebra Lab',
    `${tomorrowStr}T10:45:00Z`,
    `${tomorrowStr}T12:00:00Z`,
    'America/New_York',
    'university_calendar',
    now
  );

  insertSchedule.run(
    'block_seed_dinner',
    'Dinner with Roommates',
    `${tomorrowStr}T18:30:00Z`,
    `${tomorrowStr}T19:30:00Z`,
    'America/New_York',
    'personal',
    now
  );

  // 2. Seed Pending Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, details, due_at, priority, status, idempotency_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `);

  insertTask.run(
    'task_seed_ml',
    'Finish ML project experiment & ablation analysis',
    'Complete PyTorch training runs and write up evaluation metrics for submission',
    `${tomorrowStr}T23:59:00Z`,
    'high',
    'seed_ml_task',
    now,
    now
  );

  insertTask.run(
    'task_seed_os',
    'Review Operating Systems virtual memory assignment',
    'Work through page replacement algorithms',
    `${tomorrowStr}T17:00:00Z`,
    'medium',
    'seed_os_task',
    now,
    now
  );

  // 3. Seed Shopping Items
  const insertShopping = db.prepare(`
    INSERT INTO shopping_items (id, name, quantity, unit, checked, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);

  insertShopping.run('shop_seed_milk', 'Oat milk', 1, 'carton', now);
  insertShopping.run('shop_seed_banana', 'Bananas', 1, 'bunch', now);
  insertShopping.run('shop_seed_coffee', 'Cold brew concentrate', 1, 'bottle', now);

  // 4. Seed Preferences
  const insertPref = db.prepare(`
    INSERT INTO preferences (id, key, value, source, user_confirmed, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  insertPref.run('pref_study_block', 'study_block_duration', '50 minutes', 'user_explicit', now);
  insertPref.run('pref_focus_time', 'preferred_focus_time', 'afternoon (13:00-16:00)', 'user_explicit', now);
  insertPref.run('pref_errand_time', 'errand_window', 'before 18:00 dinner', 'user_explicit', now);
  insertPref.run('pref_diet', 'dietary_notes', 'dairy-free, high-protein', 'user_explicit', now);

  // 5. Seed Initial Welcome Conversation
  const insertConv = db.prepare('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)');
  insertConv.run('conv_demo_01', 'Alexa+ Agentic Assistant Session', now, now);

  const insertMsg = db.prepare('INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  insertMsg.run(
    'msg_seed_01',
    'conv_demo_01',
    'assistant',
    'Hello! I am ORBIT, your personal AI action agent. I can understand multi-step instructions, inspect your schedule & tasks, propose a validated plan, request your explicit approval for any changes, and execute & verify everything through MCP tools. How can I help you today?',
    JSON.stringify({ type: 'greeting' }),
    now
  );

  console.log('✅ Database seeded successfully with demo fixtures!');
  console.log(`📅 Tomorrow target date: ${tomorrowStr}`);
}

// Execute if run directly
if (process.argv[1]?.endsWith('seed.js')) {
  initSchema();
  seedDatabase();
}
