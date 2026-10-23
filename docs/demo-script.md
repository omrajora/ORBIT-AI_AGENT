# ORBIT 3-Minute Hackathon Demo Script

> **Target Track:** Amazon Developer Hackathon — Alexa+ Track  
> **Target Video Duration:** 3 Minutes  
> **Speaker Role:** Developer / Creator  

---

### [0:00 - 0:20] Hook & Problem Statement
- **Screen:** Show the ORBIT Web Console at `http://localhost:5173`. Point out the header with the active status indicators: `MCP Stream: Active (:3002)`, `SQLite Engine: Connected`, and `Cryptographic Gatekeeper`.
- **Narration:**  
  *"Hi everyone! Meet ORBIT — a context-aware personal AI action agent built for the Alexa+ hackathon track. Conversational chatbots often give great advice, but they leave the tedious execution to the user. Even worse, traditional agents often suffer from the 'hallucinated success' problem: claiming an event was scheduled when it actually failed. ORBIT turns natural-language requests into approved, verifiable workflows powered by the Model Context Protocol."*

---

### [0:20 - 0:50] Compound Multi-Intent Request
- **Screen:** Click the first demo chip:  
  `🌟 Flagship Workflow` — *"Plan tomorrow using my saved preferences, reserve two hours for my ML project, and add missing groceries to my list."*  
  Click **Send**.
- **Narration:**  
  *"Notice this single request contains multiple complex goals: planning tomorrow, inspecting existing calendar commitments, checking user preferences, finding a 2-hour study block without creating conflicts, and updating the grocery list before dinner. Watch ORBIT formulate a structured plan in real time."*

---

### [0:50 - 1:20] Real MCP Tool Discovery & Structured Planning
- **Screen:** Show the structured plan preview in the center column. Point out:
  1. The 13:30 - 15:30 ML block scheduled after morning classes.
  2. The 17:00 grocery errand scheduled before 18:30 dinner.
  3. The grocery items to add.
  4. The milestone task creation.
  5. The cryptographic SHA-256 action hash token on each step card.
- **Narration:**  
  *"ORBIT first invoked read tools through our self-hosted MCP server to inspect tomorrow's schedule. It discovered morning classes from 9 to 12 and dinner at 6:30 PM. Respecting the user's saved afternoon focus preference, it staged a 4-step plan. Crucially: not a single byte of database state has changed yet. All write steps are safely locked in 'waiting approval'."*

---

### [1:20 - 1:45] Human-in-the-Loop Safety & Action Hash
- **Screen:** Expand one of the step cards to show the JSON arguments and the SHA-256 token. Click **Approve All (4)**.
- **Narration:**  
  *"Every write payload is cryptographically bound to an immutable SHA-256 token. If an unauthorized process or altered payload attempts to run, the gatekeeper immediately rejects it with HTTP 403. Let's click 'Approve All' to authorize the agent to execute."*

---

### [1:45 - 2:15] Streamable HTTP Execution & Read-Back Verification
- **Screen:** Watch the real-time MCP stream in the right panel scroll with JSON-RPC 2.0 messages. Then point to the green **Authoritative Read-Back Verification Report**.
- **Narration:**  
  *"Approved actions execute through our Streamable HTTP MCP server over JSON-RPC 2.0. But ORBIT doesn't stop at tool response: our Read-Back Verification engine queries the SQLite database directly within 15 milliseconds, asserting that each new ID and record exists before reporting completion."*

---

### [2:15 - 2:40] Conflict Detection & Rejection Handling
- **Screen:** Click the `⚠️ Schedule Conflict Test` chip and click Send. Show the conflict warning. Then click `🚫 Action Rejection Test`, click Send, and click **Reject Step**.
- **Narration:**  
  *"Let's test safety boundaries. When we ask to schedule a block that clashes with a class, ORBIT's server-side collision algorithm flags a conflict warning. When we test an action and hit 'Reject', ORBIT halts immediately and confirms that zero database records were created."*

---

### [2:40 - 3:00] Conclusion & Alexa+ Alignment
- **Screen:** Show the Schedule and Cart tabs in the Inspector to show persistent records in SQLite.
- **Narration:**  
  *"ORBIT requires zero physical hardware, running entirely in this modern web console simulator. It demonstrates multi-step reasoning, real MCP protocol standards, cryptographic human-in-the-loop safety, and truthful read-back verification. Thank you for watching!"*
