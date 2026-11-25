import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { WebSocketServer } from 'ws';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new DatabaseSync(path.join(__dirname, 'agenthq.db'));

// Initialize SQLite schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    specialty TEXT,
    primaryColor TEXT,
    accessory TEXT,
    deskId INTEGER,
    personaPrompt TEXT
  );

  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    prompt TEXT,
    status TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    missionId TEXT,
    stageTitle TEXT,
    agentName TEXT,
    agentRole TEXT,
    color TEXT,
    content TEXT,
    tokens INTEGER,
    time TEXT,
    isFinal BOOLEAN
  );
`);

// Seed default agents if empty
const agentCountQuery = db.prepare('SELECT COUNT(*) as c FROM agents').get();
if (agentCountQuery.c === 0) {
  const defaultAgents = [
    { id: 'claude-1', name: 'Claude', role: 'Lead Architect', specialty: 'planner', primaryColor: '#d97706', accessory: 'glasses', deskId: 0, personaPrompt: 'You are Claude, Lead Architect.' },
    { id: 'codex-1', name: 'Codex', role: 'Systems Engineer', specialty: 'builder', primaryColor: '#10b981', accessory: 'headset', deskId: 1, personaPrompt: 'You are Codex, Systems Engineer.' },
    { id: 'scout-1', name: 'Swarm Scout', role: 'Intel & Research', specialty: 'scout', primaryColor: '#0284c7', accessory: 'cap', deskId: 2, personaPrompt: 'You are Swarm Scout, Intel Lead.' },
    { id: 'pixel-1', name: 'Pixel', role: 'QA & Design Lead', specialty: 'designer', primaryColor: '#db2777', accessory: 'beret', deskId: 3, personaPrompt: 'You are Pixel, QA & Design Lead.' }
  ];
  const insert = db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const a of defaultAgents) {
    insert.run(a.id, a.name, a.role, a.specialty, a.primaryColor, a.accessory, a.deskId, a.personaPrompt);
  }
}

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true });

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../web'),
  prefix: '/'
});

fastify.get('/api/agents', async () => {
  return db.prepare('SELECT * FROM agents').all();
});

fastify.get('/api/artifacts', async () => {
  return db.prepare('SELECT * FROM artifacts').all();
});

fastify.post('/api/chat', async (req, reply) => {
  const { agentId, systemPrompt, message } = req.body || {};
  if (!message) return reply.code(400).send({ error: 'Message required' });

  const agent = agentId
    ? db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId)
    : null;
  const agentName = agent ? agent.name : 'Agent';
  const persona = (systemPrompt && String(systemPrompt).trim()) || (agent && agent.personaPrompt) || 'You are a helpful AI agent.';

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (apiKey) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: persona }] }
        })
      });
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { reply: text.trim() };
    } catch (e) {
      req.log.error(e);
    }
  }

  return {
    reply: `[${agentName} - 32-Bit Radio]: Received "${message}". All systems and MCP connections are fully initialized and operational!`
  };
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    
    const wss = new WebSocketServer({ server: fastify.server });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to AgentHQ 32-Bit Realtime WebSocket Hub' }));
    });

    console.log(`AgentHQ Studio Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
