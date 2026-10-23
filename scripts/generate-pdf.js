import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.resolve(rootDir, 'ORBIT_Project_Guide_And_Getting_Started.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 36, bottom: 36, left: 40, right: 40 },
  info: {
    Title: 'ORBIT Project Guide & Getting Started Manual',
    Author: 'ORBIT Team',
    Subject: 'Alexa+ Hackathon Action Agent Documentation',
    Keywords: 'ORBIT, MCP, Model Context Protocol, Alexa+, AI Agent, Getting Started'
  }
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Color Palette
const COLORS = {
  primary: '#0369a1',     // Deep Sky Blue
  accent: '#0284c7',      // Bright Cyan/Blue
  dark: '#0f172a',        // Slate 900
  body: '#334155',        // Slate 700
  muted: '#64748b',       // Slate 500
  lightBg: '#f8fafc',     // Slate 50
  cardBorder: '#cbd5e1',  // Slate 300
  success: '#059669',     // Emerald
  warning: '#d97706',     // Amber
  codeBg: '#f1f5f9'
};

function drawHeader(title) {
  doc.fontSize(8).fillColor(COLORS.muted).text('ORBIT | PROJECT GUIDE & GETTING STARTED', 45, 25);
  doc.moveTo(45, 36).lineTo(550, 36).strokeColor(COLORS.cardBorder).lineWidth(0.5).stroke();
}

function drawSectionHeading(num, text) {
  doc.moveDown(0.8);
  const currentY = doc.y;
  doc.rect(45, currentY, 4, 18).fill(COLORS.primary);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.dark)
     .text(`${num}. ${text}`, 56, currentY + 2);
  doc.moveDown(0.5);
}

function drawSubHeading(text) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.accent).text(text);
  doc.moveDown(0.2);
}

function drawParagraph(text) {
  doc.fontSize(9.5).font('Helvetica').fillColor(COLORS.body).lineGap(2).text(text);
  doc.moveDown(0.4);
}

function drawCallout(title, body, color = COLORS.primary) {
  doc.moveDown(0.4);
  const startY = doc.y;
  const padding = 10;
  doc.fontSize(9).font('Helvetica');
  const textHeight = doc.heightOfString(body, { width: 485 });
  const totalHeight = textHeight + 28;

  doc.rect(45, startY, 505, totalHeight).fillAndStroke('#f0f9ff', color);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(color).text(title, 55, startY + 8);
  doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.body).text(body, 55, startY + 22, { width: 485, lineGap: 2 });
  doc.y = startY + totalHeight + 12;
}

function drawCodeBlock(code) {
  const lines = code.split('\n');
  const height = lines.length * 12 + 10;
  const startY = doc.y;
  doc.rect(45, startY, 505, height).fillAndStroke(COLORS.codeBg, COLORS.cardBorder);
  doc.fontSize(8.5).font('Courier').fillColor('#0f172a');
  doc.text(code, 55, startY + 6, { width: 485, lineGap: 2 });
  doc.y = startY + height + 6;
}

// ==========================================
// PAGE 1: TITLE & EXECUTIVE SUMMARY
// ==========================================
drawHeader();

// Title Block
doc.moveDown(1.5);
doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.dark).text('ORBIT: Your Personal AI Action Agent', { align: 'left' });
doc.fontSize(12).font('Helvetica').fillColor(COLORS.accent).text('Product Overview, Architecture & Getting Started Guide', { align: 'left' });
doc.moveDown(0.2);
doc.fontSize(9).font('Helvetica-Oblique').fillColor(COLORS.muted).text('Target Track: Amazon Developer Hackathon — Alexa+ Track | Protocol: MCP over Streamable HTTP');

doc.moveDown(0.8);
doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor(COLORS.accent).lineWidth(1.5).stroke();
doc.moveDown(0.8);

drawSectionHeading('1', 'What the Actual Project Does');
drawParagraph('ORBIT is an autonomous, context-aware personal AI action agent that transforms compound, multi-intent natural language requests into structured, validated, and verifiable real-world workflows.');

drawParagraph('Traditional conversational assistants often provide great suggestions, but they leave the execution to the user across disconnected applications (calendar apps, to-do lists, and grocery portals). Worse, typical agentic wrappers suffer from "hallucinated success"—claiming an action took place when an API timed out or failed silently.');

drawCallout(
  'The ORBIT Truthful Execution Guarantee',
  'A tool execution is never marked successful simply because an LLM claims success. All state changes are committed through strict Model Context Protocol (MCP) tools and verified via authoritative read-backs directly from SQLite storage within 20 milliseconds.',
  COLORS.success
);

drawSubHeading('The 8-Stage Core Operational Loop');
drawParagraph('Every user request passes through a deterministic, observable lifecycle:');

const loopSteps = [
  '1. UNDERSTAND: Decomposes natural language into intent, temporal bounds, and constraints.',
  '2. RETRIEVE: Queries calendar, pending tasks, inventory, and preferences via MCP read tools.',
  '3. PLAN: Resolves dependencies and schedules conflict-free operations.',
  '4. VALIDATE: Performs server-side conflict detection and argument validation.',
  '5. APPROVE: Gates all write actions behind cryptographic SHA-256 approval tokens.',
  '6. EXECUTE: Invokes approved tools over real Streamable HTTP JSON-RPC 2.0.',
  '7. VERIFY: Asserts database state directly with read-back queries before reporting status.',
  '8. REMEMBER: Persists explicit user habits and confirmed preferences across sessions.'
];

loopSteps.forEach(step => {
  doc.fontSize(8.8).font('Helvetica').fillColor(COLORS.body).text(`  •  ${step}`);
});

doc.moveDown(0.8);
drawSubHeading('The 8 MCP Tools in the Catalogue');
drawParagraph('Domain capabilities are decoupled into an official MCP server with strict runtime Zod schemas:');

const tools = [
  ['get_schedule', 'Read', 'Returns calendar blocks for date range, source, and timezone.'],
  ['list_tasks', 'Read', 'Fetches active/completed tasks filtered by status and priority.'],
  ['create_task', 'Write', 'Creates task with title, priority, due date, and mandatory idempotency key.'],
  ['add_schedule_block', 'Write', 'Allocates calendar block after validating against existing conflicts.'],
  ['get_shopping_list', 'Read', 'Retrieves current active grocery/shopping list items and quantities.'],
  ['add_shopping_items', 'Write', 'Appends validated grocery items while deduplicating active inventory.'],
  ['get_preferences', 'Read', 'Retrieves explicit, user-confirmed constraints, habits, and preferences.'],
  ['save_preference', 'Write', 'Persists user-confirmed preferences; explicitly blocks speculative inferences.']
];

tools.forEach(([name, type, desc]) => {
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(type === 'Write' ? COLORS.warning : COLORS.accent).text(`[${type}] ${name}: `, { continued: true });
  doc.font('Helvetica').fillColor(COLORS.body).text(desc);
});

// ==========================================
// PAGE 2: ARCHITECTURE & SAFETY
// ==========================================
doc.addPage();
drawHeader();

drawSectionHeading('2', 'Architecture & Security Governance');
drawParagraph('ORBIT requires zero physical hardware. The entire solution operates locally or in the cloud using modern web standards, satisfying the Alexa+ software track:');

drawSubHeading('System Topology');
drawParagraph('• Web Console (:5173): React + Vite dashboard displaying chat, plan previews, and live SSE logs.\n• API Orchestrator (:3001): Node.js engine running the planner, gatekeeper, and verifier.\n• MCP Server (:3002): Self-hosted Streamable HTTP JSON-RPC 2.0 endpoint with Server-Sent Events.\n• SQLite State Engine: Embedded, synchronous, zero-dependency persistence via Node.js native DatabaseSync.');

drawSubHeading('Core Safety & Governance Controls');

const safetyPoints = [
  ['Cryptographic Action Hash Binding', 'Every proposed write computes sha256(canonicalPayload). Approval is bound to this exact hash. Any payload modification immediately invalidates approval (ERR_PAYLOAD_TAMPERED).'],
  ['Approval Gatekeeper', 'Any write tool execution attempted without prior human approval is blocked with HTTP 403 / ERR_APPROVAL_REQUIRED. Zero database records are created.'],
  ['Server-Side Conflict Avoidance', 'Calendar blocks that overlap with existing commitments (e.g. classes or meetings) are caught by collision algorithms (ERR_CONFLICT).'],
  ['Credential Hygiene', 'API keys and credentials live exclusively in server .env; zero secrets are ever emitted to client bundles, DOM, or logs.']
];

safetyPoints.forEach(([title, desc]) => {
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.dark).text(`• ${title}: `, { continued: true });
  doc.font('Helvetica').fillColor(COLORS.body).text(desc);
  doc.moveDown(0.2);
});

doc.moveDown(0.6);
drawSectionHeading('3', 'How to Start and Run the Project');
drawParagraph('Set up, seed, test, and launch ORBIT using the following terminal commands:');

drawSubHeading('Quickstart Commands');
drawCodeBlock(`npm run setup     # Step 1: Install all workspace dependencies
npm run db:reset  # Step 2: Seed SQLite with clean demo scenario data
npm run test      # Step 3: Run 10-point automated acceptance suite
npm run dev       # Step 4: Start MCP (:3002), API (:3001), Web (:5173)`);

drawCallout(
  'Accessing the Web Console Simulator',
  'Open http://localhost:5173 in your browser. The top status bar will indicate active connections to the Streamable HTTP MCP Server and persistent SQLite state engine. Zero physical hardware required.',
  COLORS.accent
);

// ==========================================
// PAGE 3: DEMO SCENARIOS & REHEARSAL
// ==========================================
doc.addPage();
drawHeader();

drawSectionHeading('4', 'Interactive Demo Scenarios & Rehearsal');
drawParagraph('The Web Console includes 5 pre-configured one-click prompt chips at the bottom of the chat panel:');

const scenarios = [
  {
    title: 'Scenario 1: Flagship 3-Intent Daily Planning [PRIMARY WORKFLOW]',
    prompt: '"Plan tomorrow using my saved preferences, reserve two hours for my ML project, and add missing groceries to my list."',
    behavior: 'ORBIT inspects tomorrow\'s schedule (detects morning classes 9-12 and dinner at 18:30). It consults preferences and schedules the 2-hour ML block at 13:30 (conflict-free), reserves a 17:00 grocery errand, appends missing groceries, and creates a project task. Click "Approve All" to execute and view the green Read-Back Verification Report.'
  },
  {
    title: 'Scenario 2: Schedule Conflict Collision Detection [COLLISION AVOIDANCE]',
    prompt: '"Try to schedule a block that conflicts with an existing event and explain what you do."',
    behavior: 'Attempts to schedule an event during the 9:00 AM class. ORBIT\'s collision algorithm detects the overlap and flags a warning notice (ERR_CONFLICT), demonstrating safe collision avoidance.'
  },
  {
    title: 'Scenario 3: Human-in-the-Loop Rejection Test [ZERO-WRITE SAFETY]',
    prompt: '"Reject a proposed task and prove that it was not created."',
    behavior: 'ORBIT stages a proposal. Clicking the "Reject Step" button stops the action. The database is inspected to verify that zero records were created in SQLite.'
  },
  {
    title: 'Scenario 4: Add Groceries with Deduplication [INVENTORY SYNC]',
    prompt: '"Add these three groceries, but show me the exact changes before saving."',
    behavior: 'Appends validated groceries with item counts and units, automatically deduplicating against active items.'
  },
  {
    title: 'Scenario 5: User Preference & Habit Memory [CROSS-SESSION PERSISTENCE]',
    prompt: '"Remember that I prefer focused study blocks of 50 minutes, and show me what you saved."',
    behavior: 'Persists an explicit confirmed preference to the preferences table, viewable under the Memory tab in the Inspector.'
  }
];

scenarios.forEach(sc => {
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(COLORS.dark).text(sc.title);
  doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(COLORS.accent).text(`Prompt: ${sc.prompt}`);
  doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.body).text(`Behavior: ${sc.behavior}`);
  doc.moveDown(0.4);
});

doc.moveDown(0.4);
drawSectionHeading('5', 'Port & Service Reference Table');

const ports = [
  ['Port 5173', 'ORBIT Web Console', 'Vite / React frontend with real-time SSE listener and dark theme.'],
  ['Port 3001', 'API Orchestrator', 'Express REST backend managing plans, gatekeeping, and read-back assertions.'],
  ['Port 3002', 'MCP Server', 'Streamable HTTP JSON-RPC 2.0 tool server (/mcp/message, /mcp/events).'],
  ['data/orbit.sqlite', 'SQLite State Engine', 'Synchronous persistence for tasks, schedule blocks, groceries, preferences.']
];

ports.forEach(([port, name, desc]) => {
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.primary).text(`${port} — ${name}: `, { continued: true });
  doc.font('Helvetica').fillColor(COLORS.body).text(desc);
});

doc.moveDown(0.8);
doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLORS.muted).text('Generated automatically for ORBIT Hackathon Submission • Repository: github.com/orbit-agent', { align: 'center' });

doc.end();

writeStream.on('finish', () => {
  console.log(`✅ PDF generated successfully at: ${outputPath}`);
});
