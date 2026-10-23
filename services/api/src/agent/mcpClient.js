import dotenv from 'dotenv';
dotenv.config();

const MCP_URL = process.env.VITE_MCP_URL || `http://localhost:${process.env.MCP_PORT || 3002}`;

/**
 * Standard HTTP MCP Client interacting with the Streamable HTTP MCP Server
 */
export class McpClient {
  constructor(baseUrl = MCP_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.toolsCache = null;
  }

  /**
   * Send a JSON-RPC 2.0 message to the MCP Server
   */
  async sendRpc(method, params = {}) {
    const requestId = `client_rpc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const url = `${this.baseUrl}/mcp/message`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`MCP Server HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        const err = new Error(data.error.message || 'MCP Error');
        err.code = data.error.code;
        err.data = data.error.data;
        throw err;
      }

      return data.result;
    } catch (err) {
      if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        const error = new Error(`MCP Server connection failed at ${url}. Ensure MCP server is running.`);
        error.code = 'ERR_TOOL_UNAVAILABLE';
        throw error;
      }
      throw err;
    }
  }

  /**
   * Perform protocol handshake
   */
  async initialize() {
    return this.sendRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'orbit-agent-orchestrator',
        version: '1.0.0'
      }
    });
  }

  /**
   * Discover registered tools and their schemas from the server
   */
  async listTools() {
    const result = await this.sendRpc('tools/list');
    this.toolsCache = result.tools || [];
    return this.toolsCache;
  }

  /**
   * Execute a tool through the MCP protocol
   */
  async callTool(name, toolArguments = {}) {
    const startTime = Date.now();
    try {
      const response = await this.sendRpc('tools/call', {
        name,
        arguments: toolArguments
      });

      const durationMs = Date.now() - startTime;
      let parsedContent = null;

      if (response?.content && Array.isArray(response.content)) {
        const textChunk = response.content.find(c => c.type === 'text');
        if (textChunk) {
          try {
            parsedContent = JSON.parse(textChunk.text);
          } catch {
            parsedContent = textChunk.text;
          }
        }
      }

      return {
        success: true,
        tool: name,
        data: parsedContent,
        raw: response,
        duration_ms: durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        tool: name,
        error: {
          code: err.code || 'ERR_TOOL_CALL',
          message: err.message,
          data: err.data || null
        },
        duration_ms: durationMs
      };
    }
  }
}

export const mcpClient = new McpClient();
