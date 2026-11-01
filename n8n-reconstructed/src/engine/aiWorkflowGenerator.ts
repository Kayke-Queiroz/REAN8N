// ============================================================================
// AI Workflow Builder & LLM Integration Adapter
// Allows non-technical users to assemble, connect, and modify visual agent
// blocks on the canvas via natural language prompts (Gemini / OpenAI / Local).
// ============================================================================

import { NODE_TYPE_DESCRIPTIONS, getNodeTypeDescription } from './nodeTypes';
import { tidyUpWorkflowNodes, snapToGrid } from './geometry';
import {
  IConnections,
  INode,
  IWorkflowData,
  NodeConnectionType,
} from './types';

export interface LLMProviderConfig {
  provider: 'auto' | 'gemini' | 'openai' | 'local-semantic';
  apiKey?: string;
  model?: string;
  endpointUrl?: string;
}

export interface AIWorkflowGenerationResult {
  workflow: IWorkflowData;
  explanation: string;
  badgeText: string;
  source: 'llm-api' | 'semantic-builder';
}

/**
 * System Prompt ready to be sent to Gemini / OpenAI / Claude so the LLM outputs
 * valid JSON matching our n8n-reconstructed engine (`INode[]` + `IConnections`).
 */
export const LLM_WORKFLOW_SYSTEM_PROMPT = `
Você é um Arquiteto de Workflows Visuais de IA para usuários não-técnicos.
Sua tarefa é converter o pedido do usuário em um JSON de workflow contendo "workflowName", "explanation", "nodes" e "connections".

BLOCOS DISPONÍVEIS NO CATÁLOGO:
1. "ai.promptInput" (Pedido / Entrada - Pílula Violeta):
   - Saída: "main"
   - Parâmetros: { requestTitle: string, userPrompt: string, presentationId: string, language: "pt-BR" }
2. "@n8n/n8n-nodes-langchain.agent" (AI Agent - Card Coral Largo):
   - Entradas: "main", "ai_languageModel", "ai_memory", "ai_tool"
   - Saída: "main"
   - Parâmetros: { agentRole: string, promptType: "define", text: "={{$json.userPrompt}}", systemMessage: string }
3. "ai.modelGateway" (Gateway de Modelos - Cápsula Verde):
   - Saída suplementar: "ai_languageModel" (conecta na porta "ai_languageModel" do AI Agent)
   - Parâmetros: { model: "google/gemini-2.5-flash" | "google/gemini-2.5-pro" | "openai/gpt-4o" | "anthropic/claude-3.7-sonnet" | "deepseek/deepseek-r1" | "meta/llama-3.3-70b", fallbackModel: "openai/gpt-4o-mini", temperature: 0.2 }
4. "ai.skillSlideTranscriber" (Skill: Transcrever Slides - Hexágono Âmbar):
   - Saída suplementar: "ai_tool" (conecta na porta "ai_tool" do AI Agent)
   - Parâmetros: { outputFormat: "Markdown Estruturado" | "Resumo Executivo" | "Roteiro Falado", includeSpeakerNotes: true }
5. "ai.mcpGoogleSlides" (Google Slides MCP - Escudo Azul):
   - Saída suplementar: "ai_tool" (conecta na porta "ai_tool" do AI Agent)
   - Parâmetros: { action: "read_presentation" | "get_slide_notes" | "append_summary_slide", mcpServerUri: "mcp://google-workspace/slides-v1" }
6. "ai.responseOutput" (Entrega / Resposta - Card Verde):
   - Entrada: "main"
   - Parâmetros: { channel: "Documento & Chat" | "Exportar Markdown" | "Enviar Docs", documentTitle: string }
7. "@n8n/n8n-nodes-langchain.memoryBufferWindow" (Simple Memory):
   - Saída suplementar: "ai_memory" (conecta na porta "ai_memory" do AI Agent)
8. "@n8n/n8n-nodes-langchain.toolCalculator" (Calculator):
   - Saída suplementar: "ai_tool"

REGRAS DE CONEXÃO DO N8N:
- Blocos do fluxo principal ("ai.promptInput" -> "@n8n/n8n-nodes-langchain.agent" -> "ai.responseOutput") conectam via tipo "main".
- Sub-blocos ("ai.modelGateway", "ai.skillSlideTranscriber", "ai.mcpGoogleSlides") são a ORIGEM (source) da conexão e apontam para o nome do nó "@n8n/n8n-nodes-langchain.agent" usando seus respectivos tipos ("ai_languageModel", "ai_memory" ou "ai_tool").

EXEMPLO EXATO DE FORMATO JSON ESPERADO:
{
  "workflowName": "Agente IA: Transcrever Slides",
  "explanation": "Montei o fluxo conectando seu pedido ao Agente IA com Gemini 2.5 Flash, a Skill de Transcrever Slides e o Google Slides MCP.",
  "nodes": [
    {
      "name": "Pedido: Transcrever Slides",
      "type": "ai.promptInput",
      "parameters": {
        "requestTitle": "Transcrever Slides",
        "userPrompt": "Transcreva os slides da apresentação em tópicos",
        "presentationId": "https://docs.google.com/presentation/d/1A2B3C-SlideDeck-Q4",
        "language": "pt-BR"
      }
    },
    {
      "name": "Agente Transcritor IA",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "parameters": {
        "agentRole": "Orquestrador de Slides & Síntese",
        "promptType": "define",
        "text": "={{$json.userPrompt}}",
        "systemMessage": "Use o Google Slides MCP e a Skill de Transcrição para estruturar os slides."
      }
    },
    {
      "name": "Gateway de Modelos",
      "type": "ai.modelGateway",
      "parameters": {
        "model": "google/gemini-2.5-flash",
        "fallbackModel": "openai/gpt-4o-mini",
        "temperature": 0.2
      }
    },
    {
      "name": "Skill: Transcrever Slides",
      "type": "ai.skillSlideTranscriber",
      "parameters": {
        "outputFormat": "Markdown Estruturado",
        "includeSpeakerNotes": true
      }
    },
    {
      "name": "Google Slides MCP",
      "type": "ai.mcpGoogleSlides",
      "parameters": {
        "action": "read_presentation",
        "mcpServerUri": "mcp://google-workspace/slides-v1"
      }
    },
    {
      "name": "Entrega: Resumo Pronto",
      "type": "ai.responseOutput",
      "parameters": {
        "channel": "Documento & Chat",
        "documentTitle": "Transcrição: ={{$json.requestTitle}}"
      }
    }
  ],
  "connections": {
    "Pedido: Transcrever Slides": {
      "main": [[{ "node": "Agente Transcritor IA", "type": "main", "index": 0 }]]
    },
    "Gateway de Modelos": {
      "ai_languageModel": [[{ "node": "Agente Transcritor IA", "type": "ai_languageModel", "index": 0 }]]
    },
    "Skill: Transcrever Slides": {
      "ai_tool": [[{ "node": "Agente Transcritor IA", "type": "ai_tool", "index": 0 }]]
    },
    "Google Slides MCP": {
      "ai_tool": [[{ "node": "Agente Transcritor IA", "type": "ai_tool", "index": 0 }]]
    },
    "Agente Transcritor IA": {
      "main": [[{ "node": "Entrega: Resumo Pronto", "type": "main", "index": 0 }]]
    }
  }
}

Responda APENAS com um objeto JSON válido seguindo exatamente essa estrutura.
`.trim();

/**
 * Generates the system prompt dynamically enriched with all blocks registered in `NODE_TYPE_DESCRIPTIONS`.
 */
export function getDynamicWorkflowSystemPrompt(): string {
  const catalogSummary = Object.values(NODE_TYPE_DESCRIPTIONS)
    .filter((d) => !d.isSticky)
    .map(
      (d) =>
        `- "${d.name}" (${d.displayName} [${d.badgeLabel || d.category}]): inputs=${JSON.stringify(
          d.inputs.map((i) => i.type),
        )}, outputs=${JSON.stringify(d.outputs.map((o) => o.type))}`,
    )
    .join('\n');

  return `${LLM_WORKFLOW_SYSTEM_PROMPT}\n\nCATÁLOGO COMPLETO REGISTRADO NO MOTOR:\n${catalogSummary}`;
}

/**
 * Helper to wire two nodes in `IConnections`
 */
function addConnection(
  connections: IConnections,
  sourceNode: string,
  targetNode: string,
  type: NodeConnectionType,
  sourceOutputIndex = 0,
  targetInputIndex = 0,
) {
  connections[sourceNode] ??= {};
  connections[sourceNode][type] ??= [];
  const branches = connections[sourceNode][type]!;
  while (branches.length <= sourceOutputIndex) {
    branches.push([]);
  }
  branches[sourceOutputIndex] ??= [];
  const exists = branches[sourceOutputIndex]!.some(
    (c) =>
      c.node === targetNode &&
      c.type === type &&
      c.index === targetInputIndex,
  );
  if (!exists) {
    branches[sourceOutputIndex]!.push({
      node: targetNode,
      type,
      index: targetInputIndex,
    });
  }
}

/**
 * Detects which LLM model string was requested in natural language
 */
function detectRequestedModel(lowerPrompt: string): string {
  if (lowerPrompt.includes('claude') || lowerPrompt.includes('sonnet') || lowerPrompt.includes('anthropic')) {
    return 'anthropic/claude-3.7-sonnet';
  }
  if (lowerPrompt.includes('gpt-4o') || lowerPrompt.includes('openai') || lowerPrompt.includes('gpt')) {
    return 'openai/gpt-4o';
  }
  if (lowerPrompt.includes('deepseek')) {
    return 'deepseek/deepseek-r1';
  }
  if (lowerPrompt.includes('llama') || lowerPrompt.includes('meta')) {
    return 'meta/llama-3.3-70b';
  }
  if (lowerPrompt.includes('gemini pro') || lowerPrompt.includes('2.5 pro')) {
    return 'google/gemini-2.5-pro';
  }
  return 'google/gemini-2.5-flash';
}

/**
 * Local Semantic Workflow Builder:
 * Assembles or modifies a complete visual workflow from a natural language request
 * without requiring an external API key (and serves as fallback when offline).
 */
export function buildSemanticWorkflowFromPrompt(
  userPrompt: string,
  currentWorkflow: IWorkflowData,
): AIWorkflowGenerationResult {
  const lower = userPrompt.toLowerCase();
  const chosenModel = detectRequestedModel(lower);

  // Case 1: User asks to switch/change the LLM model in the existing Gateway block
  if (
    (lower.includes('troque') ||
      lower.includes('mudar') ||
      lower.includes('mude') ||
      lower.includes('alterar') ||
      lower.includes('usar o modelo')) &&
    (lower.includes('modelo') ||
      lower.includes('gateway') ||
      lower.includes('gemini') ||
      lower.includes('gpt') ||
      lower.includes('claude') ||
      lower.includes('deepseek') ||
      lower.includes('llama'))
  ) {
    const updatedNodes = currentWorkflow.nodes.map((n) => {
      if (
        n.type === 'ai.modelGateway' ||
        n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi'
      ) {
        return {
          ...n,
          parameters: {
            ...n.parameters,
            model: chosenModel,
          },
        };
      }
      return n;
    });

    return {
      workflow: {
        ...currentWorkflow,
        nodes: updatedNodes,
      },
      explanation: `Atualizei o bloco **Gateway de Modelos** no canvas para usar \`${chosenModel}\`!`,
      badgeText: `Modelo → ${chosenModel.split('/').pop()}`,
      source: 'semantic-builder',
    };
  }

  // Build an intuitive visual AI Agent workflow tailored to the non-technical request
  const nodes: INode[] = [];
  const connections: IConnections = {};

  const inputName = 'Entrada de Dados';
  const agentName = 'Inteligência Artificial (IA)';
  const outputName = 'Saída / Entrega';

  // 1. Bloco de Entrada (PDF, Texto, Docs ou Planilha)
  nodes.push({
    id: `node-input-${Date.now()}`,
    name: inputName,
    type: 'ai.promptInput',
    typeVersion: 1,
    position: [160, 240],
    parameters: {
      inputType: lower.includes('pdf')
        ? 'Documento PDF'
        : lower.includes('planilha') || lower.includes('sheet')
          ? 'Planilha'
          : lower.includes('doc')
            ? 'Google Docs'
            : 'Documento PDF',
      sourceTitle: 'Apresentação Comercial Q4',
      userPrompt:
        userPrompt.length > 10
          ? userPrompt
          : 'Transcreva todo o conteúdo em tópicos e aponte ações necessárias.',
      fileUrl: 'https://docs.google.com/presentation/d/1A2B3C-SlideDeck-Q4',
    },
  });

  // 2. Bloco Central de IA (Cérebro do Agente)
  nodes.push({
    id: `node-agent-${Date.now() + 1}`,
    name: agentName,
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 1.7,
    position: [496, 224],
    parameters: {
      agentRole: 'Especialista em Análise & Síntese',
      systemMessage:
        'Você é um assistente inteligente. Analise a entrada, consulte as ferramentas (Google Slides MCP) e estruture a resposta de forma clara e visual.',
      text: '={{$json.userPrompt}}',
    },
  });

  // Liga Entrada na IA
  addConnection(connections, inputName, agentName, 'main', 0, 0);

  // 3. Ferramentas (Skills e MCPs)
  const skillName = 'Skill: Transcrever Slides';
  const mcpName = 'Google Slides MCP';

  nodes.push({
    id: `node-skill-${Date.now() + 2}`,
    name: skillName,
    type: 'ai.skillSlideTranscriber',
    typeVersion: 1,
    position: [384, 432],
    parameters: {
      outputFormat: lower.includes('action') || lower.includes('tarefa')
        ? 'Action Items'
        : 'Resumo Executivo',
      includeSpeakerNotes: true,
    },
  });

  nodes.push({
    id: `node-mcp-${Date.now() + 3}`,
    name: mcpName,
    type: 'ai.mcpGoogleSlides',
    typeVersion: 1,
    position: [608, 432],
    parameters: {
      action: 'read_presentation',
      mcpServerUri: 'mcp://google-workspace/slides',
    },
  });

  // Liga Skill e MCP direto na IA via porta ai_tool (losango)
  addConnection(connections, skillName, agentName, 'ai_tool', 0, 0);
  addConnection(connections, mcpName, agentName, 'ai_tool', 0, 0);

  // 4. Bloco de Saída (Relatório, Dashboard ou Texto)
  nodes.push({
    id: `node-output-${Date.now() + 4}`,
    name: outputName,
    type: 'ai.responseOutput',
    typeVersion: 1,
    position: [864, 240],
    parameters: {
      outputType: lower.includes('dashboard')
        ? 'Dashboard'
        : lower.includes('texto')
          ? 'Texto'
          : 'Relatório Formatado',
      documentTitle: 'Síntese Executiva',
    },
  });

  // Liga IA na Saída
  addConnection(connections, agentName, outputName, 'main', 0, 0);

  const alignedNodes = tidyUpWorkflowNodes(nodes, connections);

  const builtWorkflow: IWorkflowData = {
    id: `wf-ai-generated-${Date.now()}`,
    name: `Agente Inteligente: Síntese de Slides`,
    active: true,
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Sao_Paulo',
    },
    pinData: {},
    nodes: alignedNodes,
    connections,
  };

  return {
    workflow: builtWorkflow,
    explanation: `Montei o fluxo do seu agente: **${inputName}** ➔ **${agentName}** (conectado à **${skillName}** e **${mcpName}**) ➔ **${outputName}**. Você pode clicar em qualquer bloco para ver as opções ou em **Criar Agente** para rodar!`,
    badgeText: `Agente Montado (${alignedNodes.length} blocos)`,
    source: 'semantic-builder',
  };
}

/**
 * Generates or updates a workflow from natural language.
 * First attempts the backend `/api/ai/generate-workflow` (or direct API key if provided),
 * and seamlessly falls back to `buildSemanticWorkflowFromPrompt`.
 */
export async function generateWorkflowFromPrompt(
  userPrompt: string,
  currentWorkflow: IWorkflowData,
  config?: LLMProviderConfig,
): Promise<AIWorkflowGenerationResult> {
  // 1. If user provided a Gemini API key directly in the UI config
  if (config?.apiKey && config.provider === 'gemini') {
    try {
      const modelName = config.model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        config.apiKey,
      )}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: getDynamicWorkflowSystemPrompt() }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Pedido do usuário: "${userPrompt}"\nRetorne o JSON do workflow.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed.nodes) && parsed.connections) {
          const normalizedNodes: INode[] = parsed.nodes.map(
            (n: any, idx: number) => {
              const desc = getNodeTypeDescription(n.type);
              return {
                id: n.id || `node-llm-${Date.now()}-${idx}`,
                name: n.name || desc.displayName,
                type: desc.name,
                typeVersion: desc.version,
                position: Array.isArray(n.position)
                  ? [snapToGrid(n.position[0]), snapToGrid(n.position[1])]
                  : [160 + idx * 240, 224],
                parameters: { ... n.parameters },
              };
            },
          );
          const aligned = tidyUpWorkflowNodes(
            normalizedNodes,
            parsed.connections,
          );
          return {
            workflow: {
              id: `wf-gemini-${Date.now()}`,
              name: parsed.workflowName || 'Agente Gerado via Gemini',
              active: true,
              settings: { executionOrder: 'v1', timezone: 'America/Sao_Paulo' },
              pinData: {},
              nodes: aligned,
              connections: parsed.connections,
            },
            explanation:
              parsed.explanation ||
              `Fluxo gerado via Gemini (${modelName}) com ${aligned.length} blocos conectados!`,
            badgeText: `Gerado via Gemini (${aligned.length} blocos)`,
            source: 'llm-api',
          };
        }
      }
    } catch (err) {
      console.warn('Fallback para construtor semântico local:', err);
    }
  }

  // 2. Try backend endpoint `/api/ai/generate-workflow` if running with Express server
  try {
    const res = await fetch('/api/ai/generate-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        currentWorkflow,
        apiKey: config?.apiKey,
        provider: config?.provider,
      }),
    });
    if (res.ok) {
      const payload = (await res.json()) as AIWorkflowGenerationResult;
      if (payload?.workflow?.nodes?.length) {
        return payload;
      }
    }
  } catch {
    // Express backend is optional when running pure Vite frontend
  }

  // 3. Fast, deterministic Semantic Workflow Builder fallback
  return buildSemanticWorkflowFromPrompt(userPrompt, currentWorkflow);
}

