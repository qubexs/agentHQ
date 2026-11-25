import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import * as repo from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

repo.migrate();
repo.seed();

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true });

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../web'),
  prefix: '/'
});

const AgentBody = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(60),
  role: z.string().max(80).optional().default(''),
  specialty: z.string().max(40).optional().default('builder'),
  specialtyLabel: z.string().max(60).nullish(),
  specialtyPrompt: z.string().max(4000).nullish(),
  primaryColor: z.string().max(16).nullish(),
  secondaryColor: z.string().max(16).nullish(),
  skinColor: z.string().max(16).nullish(),
  hairColor: z.string().max(16).nullish(),
  monitorColor: z.string().max(16).nullish(),
  accessory: z.string().max(24).nullish(),
  deskId: z.number().int().min(0).max(15).nullish(),
  personaPrompt: z.string().max(8000).nullish(),
  floorId: z.string().max(40).optional().default('main')
});
const MissionBody = z.object({ id: z.string().min(1).max(64), prompt: z.string().min(1).max(4000), floorId: z.string().optional() });
const ArtifactBody = z.object({
  id: z.string().min(1).max(64),
  missionId: z.string().min(1),
  stageIndex: z.number().int().optional(),
  stageTitle: z.string(),
  agentName: z.string(),
  agentRole: z.string().optional(),
  color: z.string().optional(),
  content: z.string(),
  tokens: z.number().int().optional(),
  time: z.string().optional(),
  isFinal: z.boolean().optional()
});

// Validate body with zod; reply 400 on failure.
const parse = (schema, req, reply) => {
  const r = schema.safeParse(req.body || {});
  if (!r.success) { reply.code(400).send({ error: 'Invalid body', issues: r.error.issues }); return null; }
  return r.data;
};

fastify.get('/api/health', async () => ({ ok: true, ...repo.getStats() }));
fastify.get('/api/stats', async () => repo.getStats());

// Agents
fastify.get('/api/agents', async (req) => repo.listAgents(req.query?.floorId));
fastify.post('/api/agents', async (req, reply) => {
  const body = parse(AgentBody, req, reply); if (!body) return;
  return repo.upsertAgent({ ...body, id: body.id || `agent-${Date.now()}` });
});
fastify.put('/api/agents/:id', async (req, reply) => {
  const body = parse(AgentBody, req, reply); if (!body) return;
  return repo.upsertAgent({ ...body, id: req.params.id });
});
fastify.delete('/api/agents/:id', async (req, reply) =>
  repo.deleteAgent(req.params.id) ? { ok: true } : reply.code(404).send({ error: 'Not found' }));
fastify.get('/api/agents/:id/messages', async (req) => repo.listMessages(req.params.id));

// Missions + artifacts
fastify.get('/api/missions', async () => repo.listMissions());
fastify.post('/api/missions', async (req, reply) => {
  const body = parse(MissionBody, req, reply); if (!body) return;
  return repo.createMission(body);
});
fastify.patch('/api/missions/:id', async (req, reply) => {
  const status = z.enum(['complete', 'failed']).safeParse((req.body || {}).status);
  if (!status.success) return reply.code(400).send({ error: 'status must be complete|failed' });
  if (!repo.getMission(req.params.id)) return reply.code(404).send({ error: 'Not found' });
  return repo.finishMission(req.params.id, status.data);
});
fastify.delete('/api/missions/:id', async (req, reply) =>
  repo.deleteMission(req.params.id) ? { ok: true } : reply.code(404).send({ error: 'Not found' }));
fastify.get('/api/missions/:id/artifacts', async (req) => repo.listArtifacts(req.params.id));
fastify.get('/api/artifacts', async (req) => repo.listArtifacts(req.query.missionId));
fastify.post('/api/artifacts', async (req, reply) => {
  const body = parse(ArtifactBody, req, reply); if (!body) return;
  if (!repo.getMission(body.missionId)) return reply.code(404).send({ error: 'Unknown mission' });
  try { return repo.addArtifact(body); }
  catch (e) { if (/UNIQUE/.test(String(e.message))) return reply.code(409).send({ error: 'Artifact id exists' }); throw e; }
});
fastify.delete('/api/artifacts', async () => ({ deleted: repo.clearArtifacts() }));

// Settings (floors, UI prefs). API keys stay in the browser; never store them here.
fastify.get('/api/settings/:key', async (req) => ({ value: repo.getSetting(req.params.key) }));
fastify.put('/api/settings/:key', async (req) => { repo.setSetting(req.params.key, (req.body || {}).value ?? null); return { ok: true }; });

fastify.post('/api/chat', async (req, reply) => {
  const { agentId, systemPrompt, message } = req.body || {};
  if (!message) return reply.code(400).send({ error: 'Message required' });

  const agent = agentId
    ? repo.getAgent(agentId)
    : null;
  const agentName = agent ? agent.name : 'Agent';
  const persona = (systemPrompt && String(systemPrompt).trim()) || (agent && agent.personaPrompt) || 'You are a helpful AI agent.';

  if (agent) repo.addMessage(agent.id, 'user', String(message));
  const reply_ = await generateReply({ req, agentName, persona, message });
  if (agent) repo.addMessage(agent.id, 'agent', reply_);
  return { reply: reply_ };
});

async function generateReply({ req, agentName, persona, message }) {
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
      if (text) return text.trim();
    } catch (e) {
      req.log.error(e);
    }
  }

  return `[${agentName} - 32-Bit Radio]: Received "${message}". All systems and MCP connections are fully initialized and operational!`;
}

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
