# AgentHQ: 32-Bit Retro Multi-Agent Swarm Orchestration Studio

![AgentHQ Banner](https://img.shields.io/badge/AgentHQ-32--Bit%20Studio-orange?style=for-the-badge) ![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?style=for-the-badge) ![Fastify](https://img.shields.io/badge/Fastify-Backend-blue?style=for-the-badge) ![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

AgentHQ is a retro-inspired, high-density **32-bit pixel-art multi-agent office studio** that brings AI swarm orchestration to life. Watch your AI specialists (Claude, Codex, Swarm Scout, Pixel, and custom units) sit at animated dual-monitor workstations, drink espresso, swap real-time orb data packets, and collaborate across a 4-stage mission pipeline.

---

## 🌟 Key Features & Upgrades

### 1. 🎨 32-Bit High-Density Pixel Art Office
- **Immersive Environment**: Rich oak hardwood floor planks, stainless-steel refrigerators, detailed espresso machines (LED status indicators, portafilters, steam wands), server racks with animated LED tickers, cable ducts, sun/moon lighting cycles, and window skylines.
- **Dynamic Character Sprites**: Layered shading, outlined silhouettes, detailed faces, hair tones, walk cycles, typing/coffee animations, and floating speech bubbles.

### 2. 👥 Hire & Edit Studio Agents
- **Live 32-Bit Sprite Preview**: A real-time preview canvas inside the modal that dynamically updates as you customize your agent's name, role, swarm stage slot, accessory, hair/skin tone, outfit color, and desk monitor accent.
- **Expanded & Custom Swarm Slots**: Supports core stages (1–4), support specialists (Stage 5 Growth & Launch, Stage 6 Ops & Reliability), and a fully custom stage slot option with custom naming.
- **Agent Inspector & Editor**: Click **`✎ Edit`** on any agent in the canvas HUD or Team Roster tab to instantly update their prompt, role, and appearance without disturbing their desk position.

### 3. 🔑 Level 02 Reception & Floor Gateway
- **Director Authentication**: Secure entry gateway allowing you to sign in with your Studio Director name, security passcode, and select your target floor level (Floor 0: Reception, Floor 1: Swarm HQ, Floor 2: Advanced War Room).
- **Synchronized Telemetry**: Live telemetry box (Team status, Shipped count, Token counters) updates dynamically based on the active floor capacity.

### 4. 🚀 4-Stage Swarm Mission Pipeline
- **Autonomous Multi-Agent Workflow**:
  - **Stage 1 (Scout)**: Gathers domain intelligence and uncovers edge cases (`INTEL.JSON`).
  - **Stage 2 (Planner)**: Designs rigorous system architectures and data schemas.
  - **Stage 3 (Builder)**: Produces production-ready code implementations and configs.
  - **Stage 4 (Designer / QA)**: Audits deliverables for UX polish and synthesizes the launch brief.
- **Walkie-Talkie Direct Drawer**: Chat 1-on-1 with any agent in real-time.
- **Artifact Export**: Compile and export complete Markdown (`.md`) packages of your swarm deliverables with one click.

---

## 🛠️ Tech Stack

- **Frontend**: Single-file responsive 32-bit pixel canvas engine (`apps/web/index.html`) featuring retro audio synthesizer effects (`sfx`), dynamic Y-sorting for depth overlap, and real-time WebSocket bridge.
- **Backend**: High-performance Node.js Fastify API server (`apps/server/server.js`) with built-in SQLite persistence and fallback demo LLM generators.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18 or higher installed on your machine.

### Installation & Running Locally

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/qubexs/agentHQ.git
   cd agentHQ
   ```

2. **Start the Studio Server**:
   ```bash
   cd apps/server
   npm install
   node server.js
   ```

3. **Open in Your Browser**:
   Navigate to:
   ```url
   http://localhost:3000
   ```

4. **Sign In**:
   Enter your **Studio Director** name and passcode at the Reception Gateway, choose your floor level, and enter the studio!

---

## 📦 Project Structure

```text
agentHQ/
├── apps/
│   ├── server/           # Fastify backend, SQLite store, /api/chat bridge
│   └── web/              # 32-bit pixel-art canvas frontend (index.html)
├── docker-compose.yml    # Docker deployment configuration
├── .env.example          # Environment variables template
└── README.md             # Project documentation
```

---

## 🚀 Future Roadmap & Architecture Vision

AgentHQ is engineered to scale from a single-floor retro office into a fully autonomous enterprise multi-agent swarm grid:

1. **Multi-Floor & Dynamic Level Renaming**:
   - Easily expand beyond Level 2 into infinite floors (Level 03: Security & Pentest Vault, Level 04: Production Operations, Level 05: Autonomous R&D Lab).
   - Customize floor titles, security clearances, and director access rules on the fly.

2. **Specialized Agent Tools & Expert Personas**:
   - **Coding Swarm**: Specialized units for Code Generation, Dev/Staging Sandbox Testing, Pentest Vulnerability Auditing, Automated Code Repair, and Zero-Downtime Production Deployment.
   - **Social & Engagement Swarm**: Units dedicated to real-time social replies, community polling, brand sentiment monitoring, and automated community updates.
   - **Research & Intelligence Swarm**: Autonomous web scrapers, academic whitepaper indexers, reference synthesizers, and citation graph builders.

3. **Autonomous Background Docker Runtimes**:
   - Each studio agent can spin up its own isolated background Docker container to execute code, run tests, compile assets, and stream real-time logs back to the main 32-bit office canvas.

Distributed under the MIT License. See `LICENSE` for more information.
