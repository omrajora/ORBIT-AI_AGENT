import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { router as apiRouter } from './routes/api.js';
import { mcpClient } from './agent/mcpClient.js';
import { initSchema } from './storage/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite schema
initSchema();

// Mount API routes
app.use('/api', apiRouter);

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 ORBIT API Orchestrator running on http://localhost:${PORT}`);
  console.log(`🔌 Endpoints: /api/chat, /api/plans, /api/state, /api/activity, /api/reset`);

  // Attempt initial handshake with MCP server
  setTimeout(async () => {
    try {
      console.log('🔄 Initiating MCP protocol handshake with MCP server...');
      await mcpClient.initialize();
      const tools = await mcpClient.listTools();
      console.log(`✅ MCP Protocol initialized successfully! Discovered ${tools.length} tools:`);
      tools.forEach(t => console.log(`   - ${t.name}`));
    } catch (err) {
      console.warn(`⚠️ MCP server not yet ready: ${err.message}. Will retry on demand.`);
    }
  }, 1000);
});
