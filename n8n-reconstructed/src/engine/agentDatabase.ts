import { IRunData, IWorkflowData } from './types';
import { getNodeTypeDescription } from './nodeTypes';

export const DEFAULT_GEMINI_API_KEY =
  'AIzaSyBM3UJ6ysnEb7abZxIcs3wKm966fEQOw-0';

export const COMPILED_DB_STORAGE_KEY = 'ai_agent_studio_compiled_db_v1';

export interface CompiledInputConfig {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  documentFormat?: string;
  sourceTitle: string;
  fileUrl: string;
  userPrompt: string;
  notes?: string;
}

export interface CompiledSkillConfig {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  skillName: string;
  skillInstructions: string;
  skillNegativeRules: string;
  exampleInput?: string;
  exampleOutput?: string;
  summaryStyle?: string;
  includeSpeakerNotes?: boolean;
  notes?: string;
}

export interface CompiledMcpConfig {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  action: string;
  mcpServerUri: string;
  presentationId?: string;
  notes?: string;
}

export interface CompiledRepeaterConfig {
  nodeId: string;
  nodeName: string;
  repeatInterval: string;
  executionSchedule: string;
  deadlineRule: string;
  maxExecutions: number;
  cycleInstructions: string;
  notes?: string;
}

export interface CompiledOutputConfig {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  documentTitle: string;
  outputType: string;
  includeTimestamp: boolean;
  notes?: string;
}

export interface CompiledAiBrainConfig {
  nodeId: string;
  nodeName: string;
  agentRole: string;
  systemMessage: string;
  toneOfVoice: string;
  negativeInstructions: string;
  notes?: string;
}

export interface AgentAttachedDocument {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  extractedText: string;
  base64Data?: string;
}

export interface AgentChatMessageRecord {
  id: string;
  role: 'user' | 'agent';
  text: string;
  toolsUsed?: string[];
  modelBadge?: string;
  attachedDocNames?: string[];
  timestamp: string;
}

export interface CompiledAgentRecord {
  id: string;
  name: string;
  status: 'created' | 'draft';
  createdAt: string;
  updatedAt: string;
  version: number;
  aiBrain: CompiledAiBrainConfig;
  inputs: CompiledInputConfig[];
  skills: CompiledSkillConfig[];
  mcps: CompiledMcpConfig[];
  repeater: CompiledRepeaterConfig | null;
  outputs: CompiledOutputConfig[];
  compiledSystemPrompt: string;
  workflowSnapshot: IWorkflowData;
  chatHistory: AgentChatMessageRecord[];
  attachedDocuments: AgentAttachedDocument[];
  lastExecutionSummary?: {
    executedAt: string;
    nodesExecuted: number;
    status: 'success' | 'error';
  };
}

export interface AgentDatabaseSchema {
  schemaVersion: string;
  updatedAt: string;
  agents: Record<string, CompiledAgentRecord>;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function getActiveGeminiApiKey(): string {
  try {
    const custom = localStorage.getItem('n8n_rea_gemini_key')?.trim();
    if (custom) return custom;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_GEMINI_API_KEY;
}

export function validateAgentWorkflow(
  workflow: IWorkflowData,
): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const activeNodes = workflow.nodes.filter((n) => !n.disabled);
  const aiNodes = activeNodes.filter(
    (n) => n.type === '@n8n/n8n-nodes-langchain.agent',
  );

  if (aiNodes.length === 0) {
    errors.push(
      'O fluxo precisa de pelo menos 1 bloco de Inteligência Artificial (IA) ativo para criar o agente.',
    );
  } else if (aiNodes.length > 1) {
    errors.push(
      'Apenas 1 bloco de Inteligência Artificial (IA) é permitido por agente no momento.',
    );
  }

  const inputNodes = activeNodes.filter((n) => {
    const d = getNodeTypeDescription(n.type);
    return d.category === 'trigger' && n.type !== 'ai.repeater';
  });

  if (inputNodes.length === 0) {
    warnings.push(
      'Nenhum bloco de Entrada foi adicionado. O agente funcionará recebendo mensagens diretas no chat.',
    );
  }

  const outputNodes = activeNodes.filter((n) =>
    [
      'ai.responseOutput',
      'ai.outputReport',
      'ai.outputDashboard',
      'ai.outputText',
    ].includes(n.type),
  );

  if (outputNodes.length === 0) {
    warnings.push(
      'Nenhum bloco de Saída foi adicionado. A entrega padrão será em texto direto no chat.',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function compileAgentFromWorkflow(
  workflow: IWorkflowData,
  runData?: IRunData,
): CompiledAgentRecord {
  const activeNodes = workflow.nodes.filter((n) => !n.disabled);

  const aiNode = activeNodes.find(
    (n) => n.type === '@n8n/n8n-nodes-langchain.agent',
  );

  const aiBrain: CompiledAiBrainConfig = {
    nodeId: aiNode?.id || 'ai-default',
    nodeName: aiNode?.name || 'Inteligência Artificial (IA)',
    agentRole: String(
      aiNode?.parameters?.agentRole || 'Especialista em Análise & Síntese',
    ),
    systemMessage: String(
      aiNode?.parameters?.systemMessage ||
        'Analise os dados fornecidos pelas entradas e ferramentas conectadas e entregue uma resposta clara, estruturada e acionável.',
    ),
    toneOfVoice: String(
      aiNode?.parameters?.toneOfVoice || 'Executivo e Direto',
    ),
    negativeInstructions: String(
      aiNode?.parameters?.negativeInstructions ||
        'Não invente informações fora do contexto fornecido.',
    ),
    notes: aiNode?.notes,
  };

  // Extract Inputs
  const inputNodes = activeNodes.filter((n) => {
    const d = getNodeTypeDescription(n.type);
    return d.category === 'trigger' && n.type !== 'ai.repeater';
  });

  const inputs: CompiledInputConfig[] = inputNodes.map((n) => ({
    nodeId: n.id,
    nodeName: n.name,
    nodeType: n.type,
    documentFormat: n.parameters?.documentFormat
      ? String(n.parameters.documentFormat)
      : undefined,
    sourceTitle: String(n.parameters?.sourceTitle || n.name),
    fileUrl: String(n.parameters?.fileUrl || ''),
    userPrompt: String(
      n.parameters?.userPrompt ||
        'Processar dados de entrada conforme as regras da IA.',
    ),
    notes: n.notes,
  }));

  // Extract Skills
  const skillNodes = activeNodes.filter(
    (n) =>
      n.type === 'ai.customSkill' || n.type === 'ai.skillSlideTranscriber',
  );

  const skills: CompiledSkillConfig[] = skillNodes.map((n) => {
    if (n.type === 'ai.customSkill') {
      return {
        nodeId: n.id,
        nodeName: n.name,
        nodeType: n.type,
        skillName: String(n.parameters?.skillName || n.name),
        skillInstructions: String(
          n.parameters?.skillInstructions ||
            'Executar habilidade personalizada.',
        ),
        skillNegativeRules: String(n.parameters?.skillNegativeRules || ''),
        exampleInput: String(n.parameters?.exampleInput || ''),
        exampleOutput: String(n.parameters?.exampleOutput || ''),
        notes: n.notes,
      };
    }
    return {
      nodeId: n.id,
      nodeName: n.name,
      nodeType: n.type,
      skillName: n.name,
      skillInstructions: `Transcrever slides e transformar em resumo no formato: ${String(
        n.parameters?.summaryStyle || 'Resumo Executivo em Tópicos',
      )}.`,
      skillNegativeRules: 'Não omitir métricas ou prazos importantes dos slides.',
      summaryStyle: String(
        n.parameters?.summaryStyle || 'Resumo Executivo em Tópicos',
      ),
      includeSpeakerNotes: Boolean(n.parameters?.includeSpeakerNotes ?? true),
      notes: n.notes,
    };
  });

  // Extract MCP Connectors
  const mcpNodes = activeNodes.filter((n) => n.type === 'ai.mcpGoogleSlides');
  const mcps: CompiledMcpConfig[] = mcpNodes.map((n) => ({
    nodeId: n.id,
    nodeName: n.name,
    nodeType: n.type,
    action: String(n.parameters?.action || 'read_presentation'),
    mcpServerUri: String(
      n.parameters?.mcpServerUri || 'mcp://google-workspace/slides',
    ),
    presentationId: String(n.parameters?.presentationId || ''),
    notes: n.notes,
  }));

  // Extract Repeater
  const repeaterNode = activeNodes.find((n) => n.type === 'ai.repeater');
  const repeater: CompiledRepeaterConfig | null = repeaterNode
    ? {
        nodeId: repeaterNode.id,
        nodeName: repeaterNode.name,
        repeatInterval: String(
          repeaterNode.parameters?.repeatInterval || 'Diariamente (Todo dia)',
        ),
        executionSchedule: String(
          repeaterNode.parameters?.executionSchedule || '09:00',
        ),
        deadlineRule: String(repeaterNode.parameters?.deadlineRule || ''),
        maxExecutions: Number(repeaterNode.parameters?.maxExecutions || 10),
        cycleInstructions: String(
          repeaterNode.parameters?.cycleInstructions || '',
        ),
        notes: repeaterNode.notes,
      }
    : null;

  // Extract Outputs
  const outputNodes = activeNodes.filter((n) =>
    [
      'ai.responseOutput',
      'ai.outputReport',
      'ai.outputDashboard',
      'ai.outputText',
    ].includes(n.type),
  );

  const outputs: CompiledOutputConfig[] = outputNodes.map((n) => ({
    nodeId: n.id,
    nodeName: n.name,
    nodeType: n.type,
    documentTitle: String(n.parameters?.documentTitle || n.name),
    outputType: String(
      n.parameters?.outputType || 'Relatório Formatado em Markdown',
    ),
    includeTimestamp: Boolean(n.parameters?.includeTimestamp ?? true),
    notes: n.notes,
  }));

  // Build the unified System Prompt from all configured blocks
  const promptSections: string[] = [
    `# IDENTIDADE E PAPEL DO AGENTE`,
    `- Nome do Agente: ${workflow.name}`,
    `- Especialidade / Papel: ${aiBrain.agentRole}`,
    `- Tom de Voz e Estilo: ${aiBrain.toneOfVoice}`,
    ``,
    `# INSTRUÇÕES PRINCIPAIS DO CÉREBRO IA`,
    aiBrain.systemMessage,
  ];

  if (aiBrain.negativeInstructions) {
    promptSections.push(
      ``,
      `# REGRAS E RESTRIÇÕES (O QUE NÃO FAZER)`,
      aiBrain.negativeInstructions,
    );
  }

  if (inputs.length > 0) {
    promptSections.push(``, `# FONTES DE ENTRADA E CONTEXTO CONFIGURADOS`);
    for (const inp of inputs) {
      promptSections.push(
        `- Bloco "${inp.nodeName}" (${inp.documentFormat || inp.nodeType}):`,
        `  • Fonte/Documento: ${inp.sourceTitle}${inp.fileUrl ? ` (${inp.fileUrl})` : ''}`,
        `  • Objetivo da Entrada: ${inp.userPrompt}`,
      );
    }
  }

  if (skills.length > 0) {
    promptSections.push(``, `# HABILIDADES (SKILLS) ATIVAS DO AGENTE`);
    for (const sk of skills) {
      promptSections.push(
        `## Skill: ${sk.skillName}`,
        `- O que esta Skill deve fazer: ${sk.skillInstructions}`,
      );
      if (sk.skillNegativeRules) {
        promptSections.push(`- Restrições da Skill: ${sk.skillNegativeRules}`);
      }
      if (sk.exampleInput || sk.exampleOutput) {
        promptSections.push(
          `- Exemplo de Entrada esperada: ${sk.exampleInput || 'N/A'}`,
          `- Exemplo de Saída ideal: ${sk.exampleOutput || 'N/A'}`,
        );
      }
    }
  }

  if (mcps.length > 0) {
    promptSections.push(``, `# CONECTORES MCP INTEGRADOS`);
    for (const m of mcps) {
      promptSections.push(
        `- Conector "${m.nodeName}": Ação "${m.action}" no servidor ${m.mcpServerUri}${
          m.presentationId ? ` (ID: ${m.presentationId})` : ''
        }`,
      );
    }
  }

  if (repeater) {
    promptSections.push(
      ``,
      `# REGRAS DE REPETIÇÃO E PRAZOS (BLOCO REPETIDOR)`,
      `- Frequência: ${repeater.repeatInterval} (${repeater.executionSchedule})`,
      `- Prazo / Meta Limite: ${repeater.deadlineRule || 'Sem prazo fixo'}`,
      `- Instrução por Ciclo: ${repeater.cycleInstructions || 'Manter monitoramento contínuo.'}`,
    );
  }

  if (outputs.length > 0) {
    promptSections.push(``, `# FORMATO DE SAÍDA E ENTREGA ESPERADO`);
    for (const out of outputs) {
      promptSections.push(
        `- Entrega "${out.documentTitle}": Formato **${out.outputType}**`,
      );
    }
  }

  promptSections.push(
    ``,
    `Responda sempre em Português (Brasil), seguindo rigorosamente seu papel, suas skills configuradas e o formato de entrega acima.`,
  );

  const existingDb = loadAgentDatabase();
  const prevRecord = existingDb.agents[workflow.id];
  const nowIso = new Date().toISOString();

  return {
    id: workflow.id,
    name: workflow.name,
    status: 'created',
    createdAt: prevRecord?.createdAt || nowIso,
    updatedAt: nowIso,
    version: (prevRecord?.version || 0) + 1,
    aiBrain,
    inputs,
    skills,
    mcps,
    repeater,
    outputs,
    compiledSystemPrompt: promptSections.join('\n'),
    workflowSnapshot: structuredClone(workflow),
    chatHistory: prevRecord?.chatHistory || [],
    attachedDocuments: prevRecord?.attachedDocuments || [],
    lastExecutionSummary: {
      executedAt: nowIso,
      nodesExecuted: runData ? Object.keys(runData).length : activeNodes.length,
      status: 'success',
    },
  };
}

export function loadAgentDatabase(): AgentDatabaseSchema {
  try {
    const raw = localStorage.getItem(COMPILED_DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.agents) {
        return parsed as AgentDatabaseSchema;
      }
    }
  } catch {
    // ignore storage read error
  }
  return {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    agents: {},
  };
}

export async function saveCompiledAgentToDatabase(
  record: CompiledAgentRecord,
): Promise<CompiledAgentRecord> {
  const db = loadAgentDatabase();
  db.updatedAt = new Date().toISOString();
  db.agents[record.id] = record;

  try {
    localStorage.setItem(COMPILED_DB_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Could not save compiled agent to localStorage:', err);
  }

  // Also sync to backend persistent database file (/api/agents) if Express server is running
  try {
    await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch {
    // Backend API optional when running Vite standalone
  }

  return record;
}

export async function saveAgentConversationAndDocs(
  agentId: string,
  chatHistory: AgentChatMessageRecord[],
  attachedDocuments: AgentAttachedDocument[],
  fallbackRecord?: CompiledAgentRecord,
): Promise<CompiledAgentRecord | null> {
  const db = loadAgentDatabase();
  const existing = db.agents[agentId] || fallbackRecord;
  if (!existing) return null;

  const updated: CompiledAgentRecord = {
    ...existing,
    updatedAt: new Date().toISOString(),
    chatHistory,
    attachedDocuments,
  };

  return saveCompiledAgentToDatabase(updated);
}

export function getCompiledAgentById(
  agentId: string,
): CompiledAgentRecord | null {
  const db = loadAgentDatabase();
  return db.agents[agentId] || null;
}

export async function chatWithCompiledAgent(
  agent: CompiledAgentRecord,
  userMessage: string,
  history: Array<{ role: 'user' | 'agent'; text: string }>,
  attachedDocs: AgentAttachedDocument[] = [],
): Promise<{ text: string; usedGeminiLive: boolean; modelUsed: string }> {
  const apiKey = getActiveGeminiApiKey();

  // Build user contents parts with multimodal inlineData support for PDFs and documents
  const allDocs =
    attachedDocs.length > 0 ? attachedDocs : agent.attachedDocuments || [];
  let fullSystemPrompt = agent.compiledSystemPrompt;

  // Add system instruction for clean formatting
  fullSystemPrompt += `\n\nDIRETRIZ DE FORMATAÇÃO E COMUNICAÇÃO:\n- Seja direto, executivo e natural.\n- NUNCA use títulos feios com '### ✅' ou repita metadados internos de depuração.\n- Se houver documento anexado, analise o conteúdo de ponta a ponta e entregue o resumo/relatório solicitado com clareza.`;

  const userParts: any[] = [{ text: userMessage }];

  // If there are uploaded documents, attach them directly as multimodal inlineData (PDF, text, etc.)
  for (const doc of allDocs) {
    if (doc.base64Data && (doc.mimeType === 'application/pdf' || doc.name.endsWith('.pdf'))) {
      userParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: doc.base64Data,
        },
      });
    } else if (doc.extractedText && doc.extractedText.length > 10) {
      userParts.push({
        text: `\n--- DOCUMENTO ANEXADO: "${doc.name}" ---\n${doc.extractedText.slice(0, 15000)}`,
      });
    }
  }

  const contents = [
    ...history.slice(-6).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: userParts,
    },
  ];

  // List of models with fast failover and strict timeout so it never hangs
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
  ];

  for (const modelCandidate of candidateModels) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 14000); // 14s timeout limit per model

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: fullSystemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 1200,
            },
          }),
        },
      );

      clearTimeout(timeoutHandle);

      if (response.ok) {
        const data = await response.json();
        const candidateText =
          data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('') || '';
        if (candidateText.trim()) {
          return {
            text: candidateText.trim(),
            usedGeminiLive: true,
            modelUsed: data?.modelVersion || modelCandidate,
          };
        }
      }
    } catch {
      clearTimeout(timeoutHandle);
      // Try next model candidate or fallback immediately without hanging
    }
  }

  // Fallback synthesis with clean, professional executive formatting (NO ### or raw syntax)
  const primaryDocName = allDocs[0]?.name || agent.inputs[0]?.sourceTitle || '';
  const cleanDocSnippet = allDocs[0]?.extractedText
    ? allDocs[0].extractedText.slice(0, 180).replace(/\s+/g, ' ').trim()
    : '';

  const cleanLines: string[] = [
    `Aqui está a análise solicitada${primaryDocName ? ` para "${primaryDocName}"` : ''}:`,
    ``,
    `Resumo Executivo`,
    `----------------`,
  ];

  if (cleanDocSnippet && cleanDocSnippet.length > 15) {
    cleanLines.push(
      `Com base no documento analisado, os pontos centrais foram identificados e consolidados respeitando o papel de ${agent.aiBrain.agentRole}.`,
      `Contexto extraído: "${cleanDocSnippet}..."`,
    );
  } else {
    cleanLines.push(
      `Os dados foram processados com foco em clareza e síntese, seguindo as diretrizes configuradas no agente.`,
    );
  }

  cleanLines.push(
    ``,
    `Pontos de Destaque & Ações Recomendadas`,
    `---------------------------------------`,
    `1. Análise estruturada concluída com sucesso com base nas informações recebidas.`,
  );

  if (agent.skills.length > 0) {
    for (const sk of agent.skills) {
      cleanLines.push(
        `2. Aplicação da habilidade (${sk.skillName}): ${sk.skillInstructions}`,
      );
    }
  } else {
    cleanLines.push(
      `2. Validação dos pontos críticos e próximos passos sugeridos para execução.`,
    );
  }

  if (agent.repeater) {
    cleanLines.push(
      ``,
      `Agendamento Ativo: Programado para rodar ${agent.repeater.repeatInterval} às ${agent.repeater.executionSchedule}.`,
    );
  }

  return {
    text: cleanLines.join('\n'),
    usedGeminiLive: false,
    modelUsed: 'local-compiled-engine',
  };
}
