import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_WORKFLOWS } from '../src/engine/sampleWorkflows';
import { NODE_TYPE_DESCRIPTIONS } from '../src/engine/nodeTypes';
import { Workflow } from '../src/engine/workflow';
import { WorkflowExecute } from '../src/engine/workflowExecute';
import { IWorkflowData } from '../src/engine/types';
import {
  buildSemanticWorkflowFromPrompt,
  LLM_WORKFLOW_SYSTEM_PROMPT,
} from '../src/engine/aiWorkflowGenerator';
import {
  CompiledAgentRecord,
  compileAgentFromWorkflow,
  DEFAULT_GEMINI_API_KEY,
} from '../src/engine/agentDatabase';
import { tidyUpWorkflowNodes } from '../src/engine/geometry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, 'db');
const DB_FILE = path.join(DB_DIR, 'agents.json');

interface ServerDatabaseFile {
  schemaVersion: string;
  updatedAt: string;
  workflows: IWorkflowData[];
  compiledAgents: Record<string, CompiledAgentRecord>;
}

function readServerDb(): ServerDatabaseFile {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          schemaVersion: parsed.schemaVersion || '1.0.0',
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          workflows: Array.isArray(parsed.workflows)
            ? parsed.workflows
            : structuredClone(SAMPLE_WORKFLOWS),
          compiledAgents: parsed.compiledAgents || {},
        };
      }
    }
  } catch (err) {
    console.warn('[DB] Failed to read agents.json, initializing fresh DB:', err);
  }

  const initial: ServerDatabaseFile = {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    workflows: structuredClone(SAMPLE_WORKFLOWS),
    compiledAgents: {},
  };
  writeServerDb(initial);
  return initial;
}

function writeServerDb(db: ServerDatabaseFile): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to write agents.json:', err);
  }
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  const db = readServerDb();
  res.json({
    status: 'ok',
    reconstructedFrom: 'n8n@1.118.1',
    llmIntegrationReady: true,
    databaseFile: DB_FILE,
    registeredAgentsCount: Object.keys(db.compiledAgents).length,
  });
});

app.get('/api/node-types', (_req, res) => {
  res.json(Object.values(NODE_TYPE_DESCRIPTIONS));
});

app.get('/api/workflows', (_req, res) => {
  const db = readServerDb();
  res.json(db.workflows);
});

// Get all compiled agents stored in database
app.get('/api/agents', (_req, res) => {
  const db = readServerDb();
  res.json({
    schemaVersion: db.schemaVersion,
    updatedAt: db.updatedAt,
    agents: db.compiledAgents,
  });
});

// Get a single compiled agent by ID
app.get('/api/agents/:id', (req, res) => {
  const db = readServerDb();
  const agent = db.compiledAgents[req.params.id];
  if (!agent) {
    res.status(404).json({ status: 'not_found', message: 'Agente ainda não criado.' });
    return;
  }
  res.json(agent);
});

// Register / update a compiled agent when user clicks "Criar Agente"
app.post('/api/agents', (req, res) => {
  try {
    const record = req.body as CompiledAgentRecord;
    if (!record || !record.id) {
      res.status(400).json({ status: 'error', message: 'Invalid agent payload' });
      return;
    }

    const db = readServerDb();
    db.compiledAgents[record.id] = record;

    if (record.workflowSnapshot) {
      const idx = db.workflows.findIndex((w) => w.id === record.id);
      if (idx >= 0) {
        db.workflows[idx] = record.workflowSnapshot;
      } else {
        db.workflows.unshift(record.workflowSnapshot);
      }
    }

    writeServerDb(db);
    res.json({ status: 'saved', agent: record });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err?.message || String(err) });
  }
});

app.post('/api/ai/generate-workflow', async (req, res) => {
  try {
    const { prompt, currentWorkflow, apiKey } = req.body as {
      prompt: string;
      currentWorkflow: IWorkflowData;
      apiKey?: string;
    };

    const resolvedKey =
      apiKey || process.env.GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;
    if (resolvedKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        resolvedKey,
      )}`;
      const llmRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: LLM_WORKFLOW_SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: `Pedido: "${prompt}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (llmRes.ok) {
        const data: any = await llmRes.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.nodes) && parsed.connections) {
            const aligned = tidyUpWorkflowNodes(
              parsed.nodes,
              parsed.connections,
            );
            res.json({
              workflow: {
                id: currentWorkflow?.id || `wf-gemini-${Date.now()}`,
                name: parsed.workflowName || currentWorkflow?.name || 'Agente Gerado por IA',
                active: true,
                settings: {
                  executionOrder: 'v1',
                  timezone: 'America/Sao_Paulo',
                },
                pinData: {},
                nodes: aligned,
                connections: parsed.connections,
              },
              explanation:
                parsed.explanation ||
                `Montei ${aligned.length} blocos conectados automaticamente via Gemini!`,
              badgeText: `Gemini (${aligned.length} blocos)`,
              source: 'llm-api',
            });
            return;
          }
        }
      }
    }

    const fallback = buildSemanticWorkflowFromPrompt(
      prompt || 'Transcrever slides',
      currentWorkflow || SAMPLE_WORKFLOWS[0],
    );
    res.json(fallback);
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || String(err),
    });
  }
});

app.post('/api/workflows/execute', async (req, res) => {
  try {
    const { workflowData, destinationNode } = req.body as {
      workflowData: IWorkflowData;
      destinationNode?: string;
    };
    const wf = new Workflow(workflowData);
    const executor = new WorkflowExecute();
    const result = await executor.run(
      wf,
      undefined,
      destinationNode,
      workflowData.pinData,
    );

    // Also compile and persist the agent in server/db/agents.json
    const compiled = compileAgentFromWorkflow(
      workflowData,
      result.resultData.runData,
    );
    const db = readServerDb();
    db.compiledAgents[compiled.id] = compiled;
    writeServerDb(db);

    res.json({ status: executor.status, result, compiledAgent: compiled });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || String(err),
    });
  }
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`[n8n-reconstructed API] Listening on http://localhost:${PORT}`);
});
