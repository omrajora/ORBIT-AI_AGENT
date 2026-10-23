# Product Feedback & MCP Implementation Notes

## 1. Model Context Protocol (MCP) Evaluation

Implementing the Model Context Protocol (MCP 2025-11-25+ / 2024-11-05 standards) over **Streamable HTTP** provided significant architectural advantages for this project:

- **Decoupled Architecture:** Having tools run as a standalone service communicating via JSON-RPC 2.0 cleanly separated agent reasoning from side-effect execution.
- **Server-Sent Events (SSE):** The `/mcp/events` endpoint provided real-time visibility into tool activity, allowing judges and developers to observe latency, arguments, and protocol handshakes without relying on fake UI simulations.
- **Strict Schema Enforcement:** Pairing MCP tool discovery (`tools/list`) with runtime **Zod** schema validation ensured that models cannot send arbitrary, hallucinated parameter shapes to backend business logic.

## 2. Agentic Safety Insights: Why Read-Back Verification Matters

During development and automated testing, two major failure modes of autonomous agents became apparent:
1. **The "Silent Success" Trap:** Many LLM agents assume an action succeeded simply because the LLM generated a tool call. If the backend fails (e.g. database locked, unique constraint collision, network disconnect), the LLM still reports to the user that everything worked.
2. **The "Tampered Approval" Trap:** If approval is granted based on an English description rather than the exact payload, parameter mutation can lead to dangerous side effects.

### ORBIT's Solution:
- Binding approvals cryptographically to `sha256(canonicalPayload)` solves parameter tampering.
- Read-Back Verification within 20ms of write execution guarantees that ORBIT never claims unverified success.

## 3. Alexa+ Track Alignment & Future Roadmap

- **Voice Interactivity:** The web simulator architecture is ready to integrate Web Speech API or Alexa Voice Service (AVS) streaming inputs for hands-free invocation.
- **External Connectors:** The MCP server can easily be extended with connectors for Google Calendar, Notion, Todoist, and Instacart using the same 8-tool interface.
- **Edge Deployment:** With Node.js native `DatabaseSync` SQLite, the entire stack can run locally on an edge device or microVM with zero external database dependencies.
