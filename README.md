# ORBIT: Your Personal AI Action Agent

> **Target Track:** Amazon Developer Hackathon — Alexa+ Track  
> **Protocol Standard:** Model Context Protocol (MCP 2025-11-25+) over Streamable HTTP Transport  
> **Hardware Requirement:** 0 physical devices needed (100% Web Console Simulator + Self-Hosted MCP Server)  
> **Core Architecture:** React/Vite + Node.js Agent Orchestrator + SQLite State Engine  

---

## 🌟 Executive Summary

**ORBIT** is an autonomous, context-aware personal AI action agent that transforms complex, multi-intent natural language instructions into structured, validated, and verifiable real-world workflows.

Unlike conversational chat assistants that output recommendations leaving users to manually enter data into separate calendar, task, and grocery apps, ORBIT:
1. **Understands & Resolves Dependencies:** Extracts multiple tasks, temporal constraints ("tomorrow"), and conflict zones.
2. **Retrieves Real-Time Context:** Queries calendar blocks, pending tasks, inventory, and saved preferences via real **Model Context Protocol (MCP)** read tools.
3. **Formulates Structured Plans:** Generates ordered operations with collision avoidance.
4. **Enforces Human-in-the-Loop Safety:** Binds each consequential write operation to a cryptographic SHA-256 action hash. Unapproved writes are strictly blocked with `HTTP 403 / ERR_APPROVAL_REQUIRED`.
5. **Executes over Streamable HTTP MCP:** Discovers tools dynamically and invokes them via JSON-RPC 2.0.
6. **Authoritative Read-Back Verification:** Queries SQLite directly post-execution to verify persistence within 20ms before claiming success.
7. **Remembers Explicit Preferences:** Persists user-confirmed habits (e.g. 50-minute study blocks) across sessions and app reboots.

---

## 🔄 Core Operational Loop

```mermaid
graph LR
    A[UNDERSTAND] --> B[RETRIEVE]
    B --> C[PLAN]
    C --> D[VALIDATE]
    D --> E[APPROVE]
    E --> F[EXECUTE]
    F --> G[VERIFY]
    G --> H[REMEMBER]

    style A fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff
    style B fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff
    style C fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff
    style D fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff
    style E fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff
    style F fill:#1e293b,stroke:#818cf8,stroke-width:2px,color:#fff
    style G fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff
    style H fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff
```

> **Truthful Execution Guarantee:** A tool call is never marked successful merely because an LLM claims it succeeded. All writes are committed through strict MCP tool invocations and asserted via database read-backs.

---

## 🏛️ System Architecture

```
                                  +---------------------------------------+
                                  |   ORBIT Web Console (Port :5173)     |
                                  | React + Vite + SSE Live Inspector     |
                                  +-------------------+-------------------+
                                                      |
                                           REST API & | SSE Stream
                                                      v
                                  +---------------------------------------+
                                  |   API Orchestrator (Port :3001)      |
                                  | - Multi-Step Planner                  |
                                  | - Cryptographic Action Hash Gate      |
                                  | - Read-Back Verification Engine       |
                                  +---------+-------------------+---------+
                                            |                   |
                        JSON-RPC 2.0 Stream |                   | Direct Read-Back
                                            v                   v Assertion
+-------------------------------------------+-----+    +---------------------------+
|      ORBIT MCP Server (Port :3002)              |    |      SQLite Database      |
|  - Transport: Streamable HTTP (/mcp/message)    |--->| - tasks                   |
|  - SSE Activity Feed (/mcp/events)              |    | - schedule_blocks         |
|  - 8 Tools with Runtime Zod Schemas             |    | - shopping_items          |
+-------------------------------------------------+    | - preferences, logs       |
                                                       +---------------------------+
```

---

## 🛠️ MCP Tool Catalogue (8 Core Tools)

| Tool Name | Type | Protocol Behavior |
| :--- | :---: | :--- |
| `get_schedule` | **Read** | Returns calendar blocks for date range, source, and timezone. |
| `list_tasks` | **Read** | Fetches active/completed tasks filtered by status, priority, and due dates. |
| `create_task` | **Write** | Creates task with title, priority, due date, and mandatory idempotency key. |
| `add_schedule_block`| **Write** | Allocates calendar block after asserting zero collision with commitments. |
| `get_shopping_list` | **Read** | Returns current active items and quantities. |
| `add_shopping_items`| **Write** | Appends validated items while deduplicating against active inventory. |
| `get_preferences` | **Read** | Returns explicit, user-confirmed constraints and habits. |
| `save_preference` | **Write** | Persists confirmed preferences; blocks speculative inferences. |

---

## 🛡️ Security, Safety & Governance Architecture

1. **Cryptographic Action Hash Binding:**  
   Every write operation proposal computes `sha256(canonicalPayload)`. When the user approves, the approval token binds to this exact hash. If any parameter is mutated post-approval, the gatekeeper flags `ERR_PAYLOAD_TAMPERED` and blocks execution.
2. **Approval Gatekeeper:**  
   Write operations attempted without explicit approval are rejected with `HTTP 403 / ERR_APPROVAL_REQUIRED`. Zero database records are created.
3. **Collision Detection:**  
   Attempts to schedule meetings over existing classes or commitments trigger server-side conflict detection (`ERR_CONFLICT`).
4. **Credential Hygiene:**  
   No API keys or sensitive credentials are ever emitted to client bundles or browser logs.

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js** >= v20.0.0 (Node v22.14 LTS tested)
- **npm** >= 9.0.0

### 1. Installation
Clone repository and install dependencies across workspaces:
```bash
npm run setup
```

### 2. Reset & Seed Demo Data
Populate SQLite with reproducible demo fixtures (classes tomorrow, ML task, grocery list, study preferences):
```bash
npm run db:reset
```

### 3. Run Automated Acceptance Tests
Run the 10-point test suite verifying MCP protocol handshake, conflict detection, gatekeeping, tamper protection, and read-back verification:
```bash
npm run test
```

### 4. Start Development Servers
Launches the MCP Server (:3002), API Orchestrator (:3001), and Web Console (:5173) concurrently:
```bash
npm run dev
```
Open your browser to: **[http://localhost:5173](http://localhost:5173)**

---

## 🎬 3-Minute Hackathon Demo Narrative

| Time | Action | What Judges See |
| :--- | :--- | :--- |
| **0:00 - 0:25** | **Introduction** | ORBIT Web Console loads with Alexa+ simulator status, MCP Stream (:3002), and SQLite status. |
| **0:25 - 0:50** | **Flagship Prompt** | Click `🌟 Flagship Workflow` demo chip: *"Plan tomorrow using my saved preferences, reserve two hours for my ML project, and add missing groceries to my list."* |
| **0:50 - 1:20** | **Real MCP Retrieval & Plan** | MCP read tools inspect morning classes (09:00 - 12:00) and dinner (18:30). Plan proposes conflict-free 13:30 ML block, 17:00 grocery errand, and adds groceries. |
| **1:20 - 1:45** | **Gatekeeper & Approval** | Visual step preview displays SHA-256 action hashes. Click **Approve All (4)** to authorize execution. |
| **1:45 - 2:15** | **Execution & Read-Back** | Real-time MCP stream shows JSON-RPC 2.0 calls. **Authoritative Read-Back Verification Report** confirms presence of all records in SQLite within 15ms. |
| **2:15 - 2:40** | **Safety & Rejection Test** | Click `🚫 Action Rejection Test` prompt. Click **Reject Step**. Verify that zero database records are modified. |
| **2:40 - 3:00** | **Conclusion** | Highlight persistent memory, extensible MCP standard over Streamable HTTP, and reliable agentic execution. |

---

## 📁 Repository Structure

```
├── apps/
│   └── web/                   # React + Vite Web Console & Simulator
│       ├── src/
│       │   ├── components/    # Header, ChatPanel, PlanPreview, VerificationPanel, InspectorPanel
│       │   ├── App.jsx        # Master UI Orchestrator & SSE client
│       │   └── index.css      # Charcoal/Navy responsive design system
├── services/
│   ├── api/                   # Orchestrator backend (:3001)
│   │   ├── src/
│   │   │   ├── agent/         # MCP Client, Multi-step Planner, Read-Back Verifier, Executor
│   │   │   ├── approvals/     # Cryptographic Gatekeeper (Action Hash binding)
│   │   │   ├── storage/       # SQLite storage engine (node:sqlite)
│   │   │   └── routes/        # REST endpoints (/api/chat, /api/plans, /api/state)
│   │   └── scripts/
│   │       └── seed.js        # Deterministic seed & demo fixtures
│   └── mcp-server/            # Streamable HTTP MCP Server (:3002)
│       └── src/
│           ├── schemas/       # Zod schemas for all 8 tools
│           ├── tools/         # Tool execution dispatcher
│           └── index.js       # JSON-RPC 2.0 endpoint & SSE stream
├── packages/
│   └── shared/                # Common types, action hash computation, constants
├── tests/
│   ├── test-mcp-and-api.js    # 10-point automated acceptance suite
│   └── run-all-tests.js       # npm run test entrypoint
├── docs/                      # Architecture notes, demo scripts, track alignment
├── .env.example
├── LICENSE                    # MIT License
└── package.json               # Root workspaces configuration
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
