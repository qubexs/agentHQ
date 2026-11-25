import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'agenthq.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');

// ---------------------------------------------------------------------------
// Migrations — each runs once, in order, tracked with PRAGMA user_version.
// Never edit a shipped migration; append a new one.
// ---------------------------------------------------------------------------
const hasColumn = (table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

const migrations = [
  // v1 — base schema (also upgrades databases created by the original server.js)
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, specialty TEXT,
        primaryColor TEXT, accessory TEXT, deskId INTEGER, personaPrompt TEXT
      );
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY, prompt TEXT, status TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, missionId TEXT, stageTitle TEXT, agentName TEXT,
        agentRole TEXT, color TEXT, content TEXT, tokens INTEGER, time TEXT, isFinal BOOLEAN
      );
    `);
  },
  // v2 — full agent profile, mission lifecycle, FK + indexes, chat log, settings
  () => {
    const add = (t, c, def) => { if (!hasColumn(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
    add('agents', 'specialtyLabel', 'TEXT');
    add('agents', 'specialtyPrompt', 'TEXT');
    add('agents', 'secondaryColor', 'TEXT');
    add('agents', 'skinColor', 'TEXT');
    add('agents', 'hairColor', 'TEXT');
    add('agents', 'monitorColor', 'TEXT');
    add('agents', 'floorId', "TEXT DEFAULT 'main'");
    add('agents', 'createdAt', 'DATETIME');
    add('agents', 'updatedAt', 'DATETIME');
    add('missions', 'floorId', "TEXT DEFAULT 'main'");
    add('missions', 'totalTokens', 'INTEGER DEFAULT 0');
    add('missions', 'finishedAt', 'DATETIME');
    add('artifacts', 'stageIndex', 'INTEGER DEFAULT 0');
    add('artifacts', 'createdAt', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','agent')),
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_mission ON artifacts(missionId, stageIndex);
      CREATE INDEX IF NOT EXISTS idx_missions_created ON missions(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agentId, id);
      UPDATE agents SET createdAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL;
      UPDATE artifacts SET createdAt = CURRENT_TIMESTAMP WHERE createdAt IS NULL;
    `);
    // Orphan artifacts from the old schema have no mission; keep them under a legacy mission.
    const orphans = db.prepare('SELECT COUNT(*) c FROM artifacts WHERE missionId IS NULL OR missionId NOT IN (SELECT id FROM missions)').get().c;
    if (orphans) {
      db.prepare("INSERT OR IGNORE INTO missions (id, prompt, status) VALUES ('legacy', 'Imported from earlier version', 'complete')").run();
      db.prepare("UPDATE artifacts SET missionId = 'legacy' WHERE missionId IS NULL OR missionId NOT IN (SELECT id FROM missions)").run();
    }
  }
];

export function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < migrations.length; v++) {
    db.exec('BEGIN');
    try {
      migrations[v]();
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

// Run `fn` inside a transaction.
export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const AGENT_COLS = [
  'id', 'name', 'role', 'specialty', 'specialtyLabel', 'specialtyPrompt', 'primaryColor',
  'secondaryColor', 'skinColor', 'hairColor', 'monitorColor', 'accessory', 'deskId',
  'personaPrompt', 'floorId'
];

const DEFAULT_AGENTS = [
    // Floor 0: Reception & Security Gate
    { id: 'sentinel-0', name: 'Sentinel', role: 'Perimeter Security', specialty: 'scout', specialtyLabel: 'Gatekeeper & Auth', primaryColor: '#0ea5e9', secondaryColor: '#7dd3fc', skinColor: '#fed7aa', hairColor: '#1e293b', monitorColor: '#38bdf8', accessory: 'visor', deskId: 0, floorId: 'floor0', personaPrompt: 'You are Sentinel, Security Specialist at AgentHQ Reception.' },
    { id: 'concierge-0', name: 'Aegis', role: 'Director Protocol', specialty: 'planner', specialtyLabel: 'Access & Badges', primaryColor: '#f59e0b', secondaryColor: '#fef3c7', skinColor: '#fde68a', hairColor: '#3b2f2f', monitorColor: '#f59e0b', accessory: 'glasses', deskId: 1, floorId: 'floor0', personaPrompt: 'You are Aegis, Access Gateway Officer in AgentHQ Reception.' },

    // Floor 1: Swarm HQ & Core Engineering
    { id: 'claude-1', name: 'Claude', role: 'Lead Architect', specialty: 'planner', specialtyLabel: 'Systems & Specs', primaryColor: '#d97706', secondaryColor: '#fef3c7', skinColor: '#fed7aa', hairColor: '#3b2f2f', monitorColor: '#f59e0b', accessory: 'glasses', deskId: 0, floorId: 'floor1', personaPrompt: 'You are Claude, Lead Architect in AgentHQ.' },
    { id: 'codex-1', name: 'Codex', role: 'Systems Engineer', specialty: 'builder', specialtyLabel: 'Code & Infra', primaryColor: '#10b981', secondaryColor: '#6ee7b7', skinColor: '#fde68a', hairColor: '#0f172a', monitorColor: '#10b981', accessory: 'headset', deskId: 1, floorId: 'floor1', personaPrompt: 'You are Codex, Systems Engineer in AgentHQ.' },
    { id: 'scout-1', name: 'Swarm Scout', role: 'Intel & Research', specialty: 'scout', specialtyLabel: 'Recon & Intel', primaryColor: '#0284c7', secondaryColor: '#bae6fd', skinColor: '#fed7aa', hairColor: '#78350f', monitorColor: '#38bdf8', accessory: 'cap', deskId: 2, floorId: 'floor1', personaPrompt: 'You are Swarm Scout, Intel Lead in AgentHQ.' },
    { id: 'pixel-1', name: 'Pixel', role: 'QA & Design Lead', specialty: 'designer', specialtyLabel: 'QA & Polish', primaryColor: '#db2777', secondaryColor: '#fbcfe8', skinColor: '#fde68a', hairColor: '#831843', monitorColor: '#f472b6', accessory: 'beret', deskId: 3, floorId: 'floor1', personaPrompt: 'You are Pixel, QA & Design Lead in AgentHQ.' },

    // Floor 2: Advanced War Room & MCP Mesh
    { id: 'apex-2', name: 'Apex', role: 'Mesh Commander', specialty: 'planner', specialtyLabel: 'Neural Routing', primaryColor: '#8b5cf6', secondaryColor: '#ddd6fe', skinColor: '#fed7aa', hairColor: '#4c1d95', monitorColor: '#a855f7', accessory: 'crown', deskId: 0, floorId: 'floor2', personaPrompt: 'You are Apex, War Room Commander in AgentHQ Level 2.' },
    { id: 'cipher-2', name: 'Cipher', role: 'Zero-Day Pentester', specialty: 'builder', specialtyLabel: 'Exploit Mitigation', primaryColor: '#ef4444', secondaryColor: '#fecaca', skinColor: '#fde68a', hairColor: '#0f172a', monitorColor: '#f43f5e', accessory: 'headset', deskId: 1, floorId: 'floor2', personaPrompt: 'You are Cipher, Offensive Security Lead in AgentHQ War Room.' },
    { id: 'vortex-2', name: 'Vortex', role: 'Autonomous R&D', specialty: 'scout', specialtyLabel: 'Deep Transformers', primaryColor: '#06b6d4', secondaryColor: '#a5f3fc', skinColor: '#ffedd5', hairColor: '#0e7490', monitorColor: '#22d3ee', accessory: 'monocle', deskId: 2, floorId: 'floor2', personaPrompt: 'You are Vortex, Autonomous AI Researcher in AgentHQ War Room.' },
    { id: 'glitch-2', name: 'Glitch', role: 'Chaos Engineering', specialty: 'designer', specialtyLabel: 'Resilience & Audit', primaryColor: '#ec4899', secondaryColor: '#fce7f3', skinColor: '#e0ac69', hairColor: '#831843', monitorColor: '#f472b6', accessory: 'beret', deskId: 3, floorId: 'floor2', personaPrompt: 'You are Glitch, Resilience Auditor in AgentHQ War Room.' }
];

export function seed() {
  tx(() => {
    // Ensure all default agents exist across floors
    for (const a of DEFAULT_AGENTS) {
      const exists = db.prepare('SELECT id, floorId FROM agents WHERE id = ?').get(a.id);
      if (!exists) {
        upsertAgent(a);
      } else {
        // Update floorId and missing look fields if needed
        db.prepare("UPDATE agents SET floorId = ? WHERE id = ? AND (floorId IS NULL OR floorId = 'main')").run(a.floorId, a.id);
        const fill = ['specialtyLabel', 'secondaryColor', 'skinColor', 'hairColor', 'monitorColor'];
        for (const c of fill) {
          db.prepare(`UPDATE agents SET ${c} = ? WHERE id = ? AND ${c} IS NULL`).run(a[c], a.id);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------
export function upsertAgent(a) {
  const row = { floorId: 'floor1', ...a };
  const cols = AGENT_COLS;
  db.prepare(
    `INSERT INTO agents (${cols.join(',')}, createdAt, updatedAt)
     VALUES (${cols.map((c) => '@' + c).join(',')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',')}, updatedAt=CURRENT_TIMESTAMP`
  ).run(Object.fromEntries(cols.map((c) => [c, row[c] ?? null])));
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(row.id);
}

export const listAgents = (floorId) =>
  floorId
    ? db.prepare('SELECT * FROM agents WHERE floorId = ? ORDER BY deskId, createdAt').all(floorId)
    : db.prepare('SELECT * FROM agents ORDER BY deskId, createdAt').all();
export const getAgent = (id) => db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
export const deleteAgent = (id) => db.prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0;

export function createMission({ id, prompt, floorId = 'main' }) {
  db.prepare("INSERT INTO missions (id, prompt, status, floorId) VALUES (?, ?, 'running', ?)").run(id, prompt, floorId);
  return getMission(id);
}
export const getMission = (id) => db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
export function finishMission(id, status) {
  const total = db.prepare('SELECT COALESCE(SUM(tokens),0) t FROM artifacts WHERE missionId = ?').get(id).t;
  db.prepare('UPDATE missions SET status = ?, totalTokens = ?, finishedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, total, id);
  return getMission(id);
}
export const listMissions = (limit = 50) =>
  db.prepare(`
    SELECT m.*, (SELECT COUNT(*) FROM artifacts a WHERE a.missionId = m.id) AS artifactCount
    FROM missions m ORDER BY m.createdAt DESC, m.rowid DESC LIMIT ?`).all(limit);

export function addArtifact(a) {
  db.prepare(
    `INSERT INTO artifacts (id, missionId, stageIndex, stageTitle, agentName, agentRole, color, content, tokens, time, isFinal)
     VALUES (@id, @missionId, @stageIndex, @stageTitle, @agentName, @agentRole, @color, @content, @tokens, @time, @isFinal)`
  ).run({ stageIndex: 0, tokens: 0, time: '', ...a, isFinal: a.isFinal ? 1 : 0 });
  return db.prepare('SELECT * FROM artifacts WHERE id = ?').get(a.id);
}
export const listArtifacts = (missionId) =>
  missionId
    ? db.prepare('SELECT * FROM artifacts WHERE missionId = ? ORDER BY stageIndex DESC, createdAt DESC').all(missionId)
    : db.prepare('SELECT * FROM artifacts ORDER BY createdAt DESC, rowid DESC LIMIT 200').all();
export const clearArtifacts = () => db.prepare('DELETE FROM artifacts').run().changes;
export const deleteMission = (id) =>
  tx(() => {
    db.prepare('DELETE FROM artifacts WHERE missionId = ?').run(id);
    return db.prepare('DELETE FROM missions WHERE id = ?').run(id).changes > 0;
  });

export function addMessage(agentId, role, content) {
  db.prepare('INSERT INTO messages (agentId, role, content) VALUES (?, ?, ?)').run(agentId, role, content);
}
export const listMessages = (agentId, limit = 100) =>
  db.prepare('SELECT * FROM (SELECT * FROM messages WHERE agentId = ? ORDER BY id DESC LIMIT ?) ORDER BY id').all(agentId, limit);

export const getSetting = (key) => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : null;
};
export const setSetting = (key, value) =>
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`
  ).run(key, JSON.stringify(value));

export function getStats() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM missions) AS missions,
      (SELECT COUNT(*) FROM missions WHERE status = 'complete') AS shipped,
      (SELECT COALESCE(SUM(tokens),0) FROM artifacts) AS tokens,
      (SELECT COUNT(*) FROM agents) AS agents
  `).get();
}
