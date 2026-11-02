// ============================================================================
// AI Workflow Builder & LLM Integration Adapter
// Decomposes, polishes ("lapida"), and separates the user's natural language
// request into specialized configurations for Input, AI Brain, Skills,
// Repeater, and Output blocks.
// ============================================================================

import { NODE_TYPE_DESCRIPTIONS, getNodeTypeDescription } from './nodeTypes';
import { tidyUpWorkflowNodes, snapToGrid } from './geometry';
import { getActiveGeminiApiKey } from './agentDatabase';
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

export const LLM_WORKFLOW_SYSTEM_PROMPT = `
Você é um Engenheiro de Prompt e Arquiteto de Agentes Visuais de IA Sênior.
Sua missão é transformar o pedido breve do usuário em um workflow visual estruturado ("workflowName", "explanation", "nodes", "connections"), LAPIDANDO E SEPARANDO cada responsabilidade para o bloco correto.

REGRAS DE OURO DE SEPARAÇÃO E LAPIDAÇÃO DE PROMPT (OBRIGATÓRIO):
1. NUNCA copie o prompt bruto do usuário inteiro para dentro dos blocos!
2. SEPARE E LAPIDE o pedido em responsabilidades distintas:
   - No Bloco de ENTRADA ("ai.inputPdf", "ai.inputSheets" ou "ai.inputText"):
     • Coloque APENAS a definição de qual documento/dado entra e o que deve ser lido na origem (parâmetro "userPrompt" focado apenas na coleta/leitura dos dados de entrada).
   - No Bloco CÉREBRO IA ("@n8n/n8n-nodes-langchain.agent"):
     • Use EXATAMENTE 1 único bloco "@n8n/n8n-nodes-langchain.agent" no fluxo.
     • Reescreva e lapide o objetivo geral do agente em um "systemMessage" profissional, detalhado e estruturado em etapas (Contexto, Metodologia de Raciocínio, Critérios de Qualidade), definindo um "agentRole" especialista e "negativeInstructions" claras.
   - No Bloco de SKILL ("ai.customSkill" ou "ai.skillSlideTranscriber"):
     • Extraia SOMENTE a habilidade técnica específica (ex: extração de cláusulas, síntese executiva, classificação de riscos, estruturação de tópicos, cálculo de métricas).
     • NUNCA coloque o pedido inteiro do agente dentro de "skillInstructions"! Descreva APENAS a técnica passo a passo daquela habilidade específica, preenchendo "skillName", "skillInstructions", "skillNegativeRules", "exampleInput" e "exampleOutput".
   - No Bloco REPETIDOR ("ai.repeater", apenas se o usuário mencionar prazos, rotina, monitoramento ou repetição):
     • Coloque apenas a frequência, horário e regra de prazo.
   - No Bloco de SAÍDA ("ai.outputReport", "ai.outputDashboard" ou "ai.outputText"):
     • Coloque apenas o formato final e o título do documento entregue.

BLOCOS DISPONÍVEIS NO CATÁLOGO:
1. "ai.inputPdf" (Arquivo / Documento - Entrada Azul):
   - Saída: "main"
   - Parâmetros: { documentFormat: "PDF (.pdf)" | "Word / Google Docs (.docx)" | "Apresentação / Slides (.pptx)" | "Qualquer Documento", sourceTitle: string, fileUrl: string, userPrompt: string }
2. "ai.inputSheets" (Planilha / Dados - Entrada Azul):
   - Saída: "main"
   - Parâmetros: { sourceTitle: string, fileUrl: string, userPrompt: string }
3. "ai.inputText" (Texto / Comando - Entrada Azul):
   - Saída: "main"
   - Parâmetros: { sourceTitle: string, userPrompt: string }
4. "ai.repeater" (Repetidor - Círculo Roxo de Prazos e Repetições):
   - Saída: "main"
   - Parâmetros: { repeatInterval: "Diariamente (Todo dia)" | "Semanalmente" | "A cada 1 hora", executionSchedule: string, deadlineRule: string, maxExecutions: 10, cycleInstructions: string }
5. "@n8n/n8n-nodes-langchain.agent" (Inteligência Artificial (IA) - Cérebro Coral):
   - Entradas: "main", "ai_tool"
   - Saída: "main"
   - Parâmetros: { agentRole: string, systemMessage: string, toneOfVoice: "Executivo e Direto" | "Didático e Explicativo" | "Técnico e Analítico", negativeInstructions: string }
6. "ai.customSkill" (Skill Personalizada - Bloco Âmbar):
   - Saída suplementar: "ai_tool" (conecta na porta "ai_tool" do bloco "@n8n/n8n-nodes-langchain.agent")
   - Parâmetros: { skillName: string, skillInstructions: string, skillNegativeRules: string, exampleInput: string, exampleOutput: string }
7. "ai.skillSlideTranscriber" (Skill: Transcrever Slides - Bloco Âmbar):
   - Saída suplementar: "ai_tool" (conecta na porta "ai_tool" do bloco "@n8n/n8n-nodes-langchain.agent")
   - Parâmetros: { summaryStyle: "Resumo Executivo em Tópicos" | "Lista de Tarefas (Action Items)", includeSpeakerNotes: true }
8. "ai.mcpGoogleSlides" (Google Slides MCP - Bloco Azul Claro):
   - Saída suplementar: "ai_tool" (conecta na porta "ai_tool" do bloco "@n8n/n8n-nodes-langchain.agent")
   - Parâmetros: { action: "read_presentation" | "get_slide_notes", presentationId: string, mcpServerUri: "mcp://google-workspace/slides" }
9. "ai.outputReport" (Relatório Formatado - Saída Verde):
   - Entrada: "main"
   - Parâmetros: { documentTitle: string, outputType: "Relatório Formatado em Markdown" | "Documento PDF Executivo", includeTimestamp: true }
10. "ai.outputDashboard" (Dashboard Visual - Saída Verde):
    - Entrada: "main"
    - Parâmetros: { documentTitle: string, outputType: "Dashboard Executivo de Indicadores" }
11. "ai.outputText" (Resposta em Texto - Saída Verde):
    - Entrada: "main"
    - Parâmetros: { documentTitle: string, outputType: "Texto Direto no Chat" }

REGRAS DE CONEXÃO:
- Blocos de Entrada ("ai.inputPdf", "ai.inputSheets", "ai.inputText", "ai.repeater") conectam no bloco "@n8n/n8n-nodes-langchain.agent" via tipo "main".
- O bloco "@n8n/n8n-nodes-langchain.agent" conecta no bloco de Saída ("ai.outputReport", "ai.outputDashboard" ou "ai.outputText") via tipo "main".
- Blocos de Skills ("ai.customSkill", "ai.skillSlideTranscriber") e Conectores MCP ("ai.mcpGoogleSlides") são a ORIGEM (source) da conexão e apontam para o nome do bloco "@n8n/n8n-nodes-langchain.agent" usando o tipo "ai_tool".

Responda APENAS com um objeto JSON válido contendo: { "workflowName": string, "explanation": string, "nodes": [...], "connections": {...} }.
`.trim();

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

interface PolishedPromptParts {
  workflowName: string;
  inputSourceTitle: string;
  inputInstruction: string;
  aiRole: string;
  aiSystemPrompt: string;
  aiTone: string;
  aiNegativeRules: string;
  skillName: string;
  skillInstructions: string;
  skillNegativeRules: string;
  skillExampleInput: string;
  skillExampleOutput: string;
  outputTitle: string;
}

/**
 * Separates and polishes ("lapida") the user's raw prompt into distinct,
 * specialized fields for Input, AI Brain, Skill, and Output blocks, so
 * it never just copies the raw prompt across blocks.
 */
function decomposeAndPolishUserPrompt(rawPrompt: string): PolishedPromptParts {
  const lower = rawPrompt.toLowerCase();

  // Extract explicit skill clause if the user wrote "skill de/para/que..." or "habilidade de/para..."
  const skillRegex =
    /(?:com\s+)?(?:uma\s+)?(?:skill|habilidade|ferramenta)\s+(?:personalizada\s+)?(?:de|para|que|capaz\s+de)\s+([^,.]+?)(?=\s+e\s+(?:gere|faça|entregue|crie|saída|saida|relat)|[,.]|$)/i;
  const skillMatch = rawPrompt.match(skillRegex);
  const extractedSkillFocus = skillMatch?.[1]?.trim() || '';

  // Domain detection
  const isContractOrLegal =
    lower.includes('contrato') ||
    lower.includes('jurídic') ||
    lower.includes('cláusula') ||
    lower.includes('multa');
  const isFinancialOrSheets =
    lower.includes('planilha') ||
    lower.includes('financeir') ||
    lower.includes('custo') ||
    lower.includes('receita') ||
    lower.includes('indicador');
  const isSlides =
    lower.includes('slide') || lower.includes('apresenta');

  if (isContractOrLegal) {
    return {
      workflowName: 'Agente Analista de Contratos & Documentos',
      inputSourceTitle: 'Contratos e Documentos (PDF / Word)',
      inputInstruction:
        'Ler integralmente as seções, cláusulas, prazos de vigência e obrigações contidas nos documentos anexados.',
      aiRole: 'Especialista em Análise Contratual & Riscos',
      aiSystemPrompt:
        'Você é um especialista sênior em leitura e auditoria de documentos. Sua função é coordenar a revisão minuciosa do material recebido na entrada, acionar a Skill técnica de análise para mapear pontos críticos e organizar um parecer executivo claro, objetivo e fundamentado.',
      aiTone: 'Executivo e Direto',
      aiNegativeRules:
        'Não invente cláusulas inexistentes, não omita prazos ou multas explícitas no documento e nunca faça suposições sem base no texto lido.',
      skillName: extractedSkillFocus
        ? `Skill: ${extractedSkillFocus.charAt(0).toUpperCase() + extractedSkillFocus.slice(1)}`
        : 'Auditoria de Cláusulas & Riscos',
      skillInstructions: extractedSkillFocus
        ? `Executar exclusivamente a técnica de ${extractedSkillFocus}: localizar trechos relevantes no texto bruto, classificar o impacto de cada ponto encontrado e estruturar recomendações práticas.`
        : 'Identificar e extrair obrigações das partes, prazos de vencimento, penalidades/multas e cláusulas de rescisão, classificando o grau de atenção (Baixo, Médio, Alto).',
      skillNegativeRules:
        'Não resumir de forma genérica; citar sempre a seção ou trecho correspondente do documento.',
      skillExampleInput:
        'Cláusula 8.2: O atraso na entrega implicará multa de 10% sobre o valor total, com prazo máximo de regularização de 5 dias úteis.',
      skillExampleOutput:
        '• [Risco Alto - Penalidade]: Multa de 10% por atraso (Prazo de cura: 5 dias úteis). Recomendação: Validar cronograma antes da assinatura.',
      outputTitle: 'Parecer Executivo de Análise Documental',
    };
  }

  if (isFinancialOrSheets) {
    return {
      workflowName: 'Agente Analista de Dados & Indicadores',
      inputSourceTitle: 'Base de Dados / Planilha Operacional',
      inputInstruction:
        'Extrair linhas, colunas, séries históricas e indicadores numéricos da planilha ou documento fornecido.',
      aiRole: 'Analista Sênior de Inteligência de Dados & BI',
      aiSystemPrompt:
        'Você é um analista especialista em interpretação de dados e métricas de negócio. Receba os dados estruturados da entrada, aplique a Skill de consolidação analítica para identificar variações, gargalos e oportunidades, e apresente conclusões acionáveis.',
      aiTone: 'Técnico e Analítico',
      aiNegativeRules:
        'Não arredonde valores críticos indevidamente e nunca invente números que não constem na fonte de entrada.',
      skillName: extractedSkillFocus
        ? `Skill: ${extractedSkillFocus.charAt(0).toUpperCase() + extractedSkillFocus.slice(1)}`
        : 'Consolidação de Métricas & Tendências',
      skillInstructions: extractedSkillFocus
        ? `Aplicar técnica especializada para ${extractedSkillFocus}: cruzar os indicadores recebidos, destacar desvios relevantes e sintetizar os principais insights.`
        : 'Agrupar os dados por categoria, calcular variações percentuais, destacar os 3 maiores ofensores/destaques e apontar ações corretivas.',
      skillNegativeRules:
        'Não entregar tabelas brutas sem interpretação analítica do que os números significam.',
      skillExampleInput:
        'Receita Q3: R$ 120k | Receita Q4: R$ 156k | Custo Operacional: +18%',
      skillExampleOutput:
        '• Crescimento de +30% na receita no Q4, porém com aumento de 18% no custo. Ação: Otimizar margem operacional.',
      outputTitle: 'Relatório Analítico de Indicadores',
    };
  }

  if (isSlides) {
    return {
      workflowName: 'Agente Transcritor & Sintetizador de Slides',
      inputSourceTitle: 'Apresentação de Slides (Google Slides / PPTX)',
      inputInstruction:
        'Capturar o texto de cada slide em sequência lógica, incluindo títulos, tópicos visuais e notas do apresentador.',
      aiRole: 'Especialista em Comunicação Executiva & Síntese',
      aiSystemPrompt:
        'Você é um especialista em transformar apresentações extensas em sínteses executivas de alto impacto. Utilize os conectores e skills de transcrição para organizar os slides por tema, preservando todas as métricas, decisões e próximos passos.',
      aiTone: 'Executivo e Direto',
      aiNegativeRules:
        'Não misture tópicos de slides diferentes sem indicar a estrutura original e não ignore metas numéricas.',
      skillName: 'Skill: Transcrever Slides',
      skillInstructions:
        'Ler slide a slide, converter tópicos visuais em resumo estruturado e extrair lista de tarefas (Action Items) com responsáveis e prazos.',
      skillNegativeRules: 'Não omitir números ou conclusões finais da apresentação.',
      skillExampleInput: 'Slide 4: Meta de expansão LATAM +25% até novembro.',
      skillExampleOutput:
        '• [Slide 4 - Expansão LATAM]: Meta estabelecida de +25% até novembro.',
      outputTitle: 'Síntese Executiva da Apresentação',
    };
  }

  // Default: Document Reader & Report Generator (e.g. "lê docs e faça relatórios")
  return {
    workflowName: 'Agente Leitor de Documentos & Gerador de Relatórios',
    inputSourceTitle: 'Documentos de Entrada (PDF, Word, Docs, TXT)',
    inputInstruction:
      'Receber e extrair o conteúdo textual completo dos documentos anexados, identificando estrutura de tópicos, dados principais, argumentos e conclusões.',
    aiRole: 'Especialista em Leitura Crítica & Relatórios Executivos',
    aiSystemPrompt:
      'Você é um analista especialista em leitura profunda de documentos e elaboração de relatórios estruturados.\n' +
      '1. Leia atentamente todo o conteúdo extraído pelo bloco de Entrada.\n' +
      '2. Acione sua Skill especializada para filtrar informações essenciais, dados técnicos e pontos de ação.\n' +
      '3. Elabore um relatório final claro, bem formatado em seções lógicas, pronto para tomada de decisão.',
    aiTone: 'Executivo e Direto',
    aiNegativeRules:
      'Não copie trechos longos sem sintetizar, não invente fatos fora do documento fornecido e evite linguagem vaga ou redundante.',
    skillName: extractedSkillFocus
      ? `Skill: ${extractedSkillFocus.charAt(0).toUpperCase() + extractedSkillFocus.slice(1)}`
      : 'Extração Estruturada & Síntese Técnica',
    skillInstructions: extractedSkillFocus
      ? `Executar de forma focada a habilidade de ${extractedSkillFocus}: examinar o documento lido, extrair apenas os elementos pertinentes a essa tarefa e devolvê-los classificados e prontos para o relatório.`
      : 'Mapear as ideias centrais de cada seção do documento, extrair dados quantitativos/fatos-chave, identificar problemas ou oportunidades mencionadas e listar recomendações práticas em tópicos.',
    skillNegativeRules:
      'Não misturar opiniões externas com os fatos extraídos do documento; manter fidelidade técnica aos dados originais.',
    skillExampleInput:
      'Documento de 12 páginas sobre o projeto de implantação do novo sistema com cronograma e gargalos de integração.',
    skillExampleOutput:
      '1. Resumo Executivo: Projeto em fase de homologação (80% concluído).\n2. Pontos Críticos: Gargalo na API de faturamento.\n3. Próximos Passos: Concluir testes integrados até sexta-feira.',
    outputTitle: 'Relatório Executivo Consolidado',
  };
}

export function buildSemanticWorkflowFromPrompt(
  userPrompt: string,
  currentWorkflow: IWorkflowData,
): AIWorkflowGenerationResult {
  const lower = userPrompt.toLowerCase();
  const polished = decomposeAndPolishUserPrompt(userPrompt);

  const nodes: INode[] = [];
  const connections: IConnections = {};

  const isSheet = lower.includes('planilha') || lower.includes('sheet');
  const inputName = isSheet ? 'Planilha / Dados' : 'Arquivo / Documento';
  const agentName = 'Inteligência Artificial (IA)';
  const outputName = lower.includes('dashboard')
    ? 'Dashboard Visual'
    : lower.includes('texto')
      ? 'Resposta em Texto'
      : 'Relatório Formatado';

  // 1. Bloco de Entrada (Apenas instruções de leitura/ingestão da fonte)
  nodes.push({
    id: `node-input-${Date.now()}`,
    name: inputName,
    type: isSheet ? 'ai.inputSheets' : 'ai.inputPdf',
    typeVersion: 1,
    position: [160, 240],
    parameters: {
      documentFormat: lower.includes('doc')
        ? 'Word / Google Docs (.docx)'
        : lower.includes('slide')
          ? 'Apresentação / Slides (.pptx)'
          : 'Qualquer Documento',
      sourceTitle: polished.inputSourceTitle,
      userPrompt: polished.inputInstruction,
      fileUrl: '',
    },
  });

  // 2. Bloco Central de IA (Prompt lapidado, papel especialista e restrições claras)
  nodes.push({
    id: `node-agent-${Date.now() + 1}`,
    name: agentName,
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 1.7,
    position: [496, 224],
    parameters: {
      agentRole: polished.aiRole,
      systemMessage: polished.aiSystemPrompt,
      toneOfVoice: polished.aiTone,
      negativeInstructions: polished.aiNegativeRules,
    },
  });

  addConnection(connections, inputName, agentName, 'main', 0, 0);

  // Se o pedido mencionar prazo, repetição ou monitoramento, adiciona o Repetidor circular
  if (
    lower.includes('repet') ||
    lower.includes('prazo') ||
    lower.includes('todo dia') ||
    lower.includes('diariamente') ||
    lower.includes('semanal')
  ) {
    const repName = 'Repetidor';
    nodes.push({
      id: `node-repeater-${Date.now() + 10}`,
      name: repName,
      type: 'ai.repeater',
      typeVersion: 1,
      position: [160, 380],
      parameters: {
        repeatInterval: lower.includes('semanal')
          ? 'Semanalmente'
          : 'Diariamente (Todo dia)',
        executionSchedule: 'Todo dia às 09:00',
        deadlineRule: 'Monitoramento ativo até conclusão das entregas',
        maxExecutions: 10,
        cycleInstructions:
          'Verificar novos documentos na entrada e atualizar o relatório consolidado.',
      },
    });
    addConnection(connections, repName, agentName, 'main', 0, 0);
  }

  // 3. Ferramentas (Apenas a habilidade específica vai para o bloco de Skill!)
  const isSlideOnlySkill =
    (lower.includes('slide') || lower.includes('apresenta')) &&
    !lower.includes('skill') &&
    !lower.includes('personalizad');

  const skillNodeName = isSlideOnlySkill
    ? 'Skill: Transcrever Slides'
    : 'Skill Personalizada';

  nodes.push({
    id: `node-skill-${Date.now() + 2}`,
    name: skillNodeName,
    type: isSlideOnlySkill ? 'ai.skillSlideTranscriber' : 'ai.customSkill',
    typeVersion: 1,
    position: [384, 432],
    parameters: isSlideOnlySkill
      ? {
          summaryStyle: 'Resumo Executivo em Tópicos',
          includeSpeakerNotes: true,
        }
      : {
          skillName: polished.skillName,
          skillInstructions: polished.skillInstructions,
          skillNegativeRules: polished.skillNegativeRules,
          exampleInput: polished.skillExampleInput,
          exampleOutput: polished.skillExampleOutput,
        },
  });

  addConnection(connections, skillNodeName, agentName, 'ai_tool', 0, 0);

  if (
    lower.includes('slide') ||
    lower.includes('google') ||
    lower.includes('apresenta')
  ) {
    const mcpName = 'Google Slides MCP';
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
    addConnection(connections, mcpName, agentName, 'ai_tool', 0, 0);
  }

  // 4. Bloco de Saída (Apenas especificações do formato final de entrega)
  nodes.push({
    id: `node-output-${Date.now() + 4}`,
    name: outputName,
    type: lower.includes('dashboard')
      ? 'ai.outputDashboard'
      : lower.includes('texto')
        ? 'ai.outputText'
        : 'ai.outputReport',
    typeVersion: 1,
    position: [864, 240],
    parameters: {
      outputType: lower.includes('dashboard')
        ? 'Dashboard Executivo de Indicadores'
        : lower.includes('texto')
          ? 'Texto Direto no Chat'
          : 'Relatório Formatado em Markdown',
      documentTitle: polished.outputTitle,
      includeTimestamp: true,
    },
  });

  addConnection(connections, agentName, outputName, 'main', 0, 0);

  const alignedNodes = tidyUpWorkflowNodes(nodes, connections);

  const builtWorkflow: IWorkflowData = {
    id: currentWorkflow.id || `wf-ai-generated-${Date.now()}`,
    name: polished.workflowName,
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
    explanation:
      `Lapidei seu pedido e separei cada função no bloco adequado:\n` +
      `- **${inputName}**: configurado apenas para leitura e extração dos documentos.\n` +
      `- **${agentName}**: prompt refinado como *${polished.aiRole}*.\n` +
      `- **${skillNodeName}**: configurado exclusivamente com a técnica **${polished.skillName}**.\n` +
      `- **${outputName}**: estruturado para entregar **${polished.outputTitle}**.\n\n` +
      `Clique em qualquer bloco para revisar os textos no painel direito ou clique em **Criar Agente**!`,
    badgeText: `Prompt Lapidado (${alignedNodes.length} blocos)`,
    source: 'semantic-builder',
  };
}

export async function generateWorkflowFromPrompt(
  userPrompt: string,
  currentWorkflow: IWorkflowData,
  config?: LLMProviderConfig,
): Promise<AIWorkflowGenerationResult> {
  const effectiveApiKey = config?.apiKey?.trim() || getActiveGeminiApiKey();
  const polishedFallback = decomposeAndPolishUserPrompt(userPrompt);

  if (
    effectiveApiKey &&
    (config?.provider === 'gemini' ||
      !config?.provider ||
      config?.provider === 'auto')
  ) {
    try {
      const modelName = config?.model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        effectiveApiKey,
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
                  text:
                    `Pedido do usuário: "${userPrompt}"\n\n` +
                    `IMPORTANTE:\n` +
                    `1. NÃO copie a frase do usuário literalmente nos blocos.\n` +
                    `2. Lapide e melhore o "systemMessage" do bloco "@n8n/n8n-nodes-langchain.agent".\n` +
                    `3. No bloco "ai.customSkill", coloque APENAS a instrução técnica da skill específica (em "skillName" e "skillInstructions"), separada do prompt geral do agente.\n` +
                    `4. No bloco de Entrada ("ai.inputPdf"/"ai.inputSheets"), coloque apenas o que deve ser lido na fonte de dados.\n` +
                    `Retorne apenas o JSON válido do workflow.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.25,
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
          // Enforce single AI node constraint
          let seenAiNode = false;
          const filteredRawNodes = parsed.nodes.filter((n: any) => {
            if (n.type === '@n8n/n8n-nodes-langchain.agent') {
              if (seenAiNode) return false;
              seenAiNode = true;
            }
            return true;
          });

          const normalizedNodes: INode[] = filteredRawNodes.map(
            (n: any, idx: number) => {
              const desc = getNodeTypeDescription(n.type);
              const params = { ...n.parameters };

              // Guarantee that if Gemini left any field too short or identical to raw userPrompt, we use the polished separation
              if (desc.name === '@n8n/n8n-nodes-langchain.agent') {
                if (
                  !params.systemMessage ||
                  params.systemMessage.trim().toLowerCase() ===
                    userPrompt.trim().toLowerCase()
                ) {
                  params.systemMessage = polishedFallback.aiSystemPrompt;
                }
                params.agentRole = params.agentRole || polishedFallback.aiRole;
                params.toneOfVoice =
                  params.toneOfVoice || polishedFallback.aiTone;
                params.negativeInstructions =
                  params.negativeInstructions ||
                  polishedFallback.aiNegativeRules;
              }

              if (desc.name === 'ai.customSkill') {
                if (
                  !params.skillInstructions ||
                  params.skillInstructions.trim().toLowerCase() ===
                    userPrompt.trim().toLowerCase()
                ) {
                  params.skillInstructions = polishedFallback.skillInstructions;
                }
                params.skillName =
                  params.skillName || polishedFallback.skillName;
                params.skillNegativeRules =
                  params.skillNegativeRules ||
                  polishedFallback.skillNegativeRules;
                params.exampleInput =
                  params.exampleInput || polishedFallback.skillExampleInput;
                params.exampleOutput =
                  params.exampleOutput || polishedFallback.skillExampleOutput;
              }

              if (
                desc.name === 'ai.inputPdf' ||
                desc.name === 'ai.inputSheets' ||
                desc.name === 'ai.inputText'
              ) {
                if (
                  !params.userPrompt ||
                  params.userPrompt.trim().toLowerCase() ===
                    userPrompt.trim().toLowerCase()
                ) {
                  params.userPrompt = polishedFallback.inputInstruction;
                }
                params.sourceTitle =
                  params.sourceTitle || polishedFallback.inputSourceTitle;
              }

              return {
                id: n.id || `node-llm-${Date.now()}-${idx}`,
                name: n.name || desc.displayName,
                type: desc.name,
                typeVersion: desc.version,
                position: Array.isArray(n.position)
                  ? [snapToGrid(n.position[0]), snapToGrid(n.position[1])]
                  : [160 + idx * 240, 224],
                parameters: params,
              };
            },
          );
          const aligned = tidyUpWorkflowNodes(
            normalizedNodes,
            parsed.connections,
          );
          return {
            workflow: {
              id: currentWorkflow.id || `wf-gemini-${Date.now()}`,
              name:
                parsed.workflowName ||
                polishedFallback.workflowName ||
                currentWorkflow.name,
              active: true,
              settings: { executionOrder: 'v1', timezone: 'America/Sao_Paulo' },
              pinData: {},
              nodes: aligned,
              connections: parsed.connections,
            },
            explanation:
              parsed.explanation ||
              `Fluxo montado e lapidado via Gemini (${modelName}) com responsabilidades separadas em ${aligned.length} blocos!`,
            badgeText: `Prompt Lapidado • Gemini (${aligned.length} blocos)`,
            source: 'llm-api',
          };
        }
      }
    } catch (err) {
      console.warn('Fallback para construtor semântico local:', err);
    }
  }

  return buildSemanticWorkflowFromPrompt(userPrompt, currentWorkflow);
}
