import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { TOOL_DEFINITIONS } from './schemas/toolSchemas.js';
import { executeTool } from './tools/index.js';

dotenv.config();

const app = express();
const PORT = process.env.MCP_PORT || 3002;

app.use(cors());
app.use(express.json());

// List of connected SSE clients
const sseClients = new Set();

function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'orbit-mcp-server',
    version: '1.0.0',
    protocol: 'mcp-2025-11-25',
    transport: 'streamable-http',
    tools_registered: TOOL_DEFINITIONS.length
  });
});

// Direct tools inspection endpoint
app.get('/mcp/tools', (req, res) => {
  res.json({
    tools: TOOL_DEFINITIONS
  });
});

// SSE endpoint for streaming logs and async events
app.get('/mcp/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), message: 'Connected to ORBIT MCP Event Stream' })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

/**
 * Streamable HTTP JSON-RPC 2.0 message handler
 * Implements MCP protocol standard
 */
app.post(['/mcp/message', '/mcp'], async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
    });
  }

  const clientRequestId = id || `mcp_req_${Date.now()}`;

  // Log incoming JSON-RPC event
  broadcastEvent('mcp_request', {
    requestId: clientRequestId,
    method,
    params,
    timestamp: new Date().toISOString()
  });

  try {
    switch (method) {
      case 'initialize': {
        const result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false
            },
            logging: {}
          },
          serverInfo: {
            name: 'orbit-mcp-server',
            version: '1.0.0'
          }
        };

        broadcastEvent('mcp_response', {
          requestId: clientRequestId,
          method,
          result,
          timestamp: new Date().toISOString()
        });

        return res.json({
          jsonrpc: '2.0',
          id,
          result
        });
      }

      case 'notifications/initialized': {
        // Notification - no return value strictly required, return ok
        return res.json({ jsonrpc: '2.0', id, result: {} });
      }

      case 'tools/list': {
        const result = {
          tools: TOOL_DEFINITIONS.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        };

        broadcastEvent('mcp_response', {
          requestId: clientRequestId,
          method,
          toolsCount: result.tools.length,
          timestamp: new Date().toISOString()
        });

        return res.json({
          jsonrpc: '2.0',
          id,
          result
        });
      }

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        if (!name) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: tool "name" is required' }
          });
        }

        const execution = await executeTool(name, toolArgs || {}, clientRequestId);

        if (!execution.success) {
          broadcastEvent('tool_failure', {
            requestId: clientRequestId,
            tool: name,
            error: execution.error,
            duration_ms: execution.duration_ms,
            timestamp: new Date().toISOString()
          });

          return res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: execution.error?.message || 'Tool execution failed',
              data: execution.error
            }
          });
        }

        broadcastEvent('tool_success', {
          requestId: clientRequestId,
          tool: name,
          duration_ms: execution.duration_ms,
          timestamp: new Date().toISOString()
        });

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(execution.data)
              }
            ],
            isError: false,
            metadata: {
              duration_ms: execution.duration_ms,
              request_id: clientRequestId
            }
          }
        });
      }

      case 'ping': {
        return res.json({ jsonrpc: '2.0', id, result: {} });
      }

      default: {
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
      }
    }
  } catch (err) {
    console.error('MCP Server Error:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err.message || 'Internal error' }
    });
  }
});

export { app };

export function startMcpServer(port = PORT) {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`🚀 ORBIT MCP Server running on Streamable HTTP at http://localhost:${port}`);
      console.log(`📡 Registered 8 tools with Zod validation over /mcp/message`);
      console.log(`📊 SSE Live Event Stream available at http://localhost:${port}/mcp/events`);
      resolve(server);
    });
  });
}

// Automatically start if executed directly
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.includes('mcp-server')) {
  startMcpServer(PORT);
}
