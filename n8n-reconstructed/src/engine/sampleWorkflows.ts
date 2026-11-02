import { IWorkflowData } from './types';

export const SAMPLE_WORKFLOWS: IWorkflowData[] = [
  {
    id: 'wf-slide-transcriber-prototype',
    name: 'Agente Transcritor de Slides',
    active: true,
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Sao_Paulo',
    },
    pinData: {},
    nodes: [
      {
        id: 'node-prompt-input',
        name: 'Entrada de Dados',
        type: 'ai.inputPdf',
        typeVersion: 1,
        position: [160, 240],
        parameters: {
          documentFormat: 'Apresentação / Slides (.pptx)',
          sourceTitle: 'Apresentação Comercial Q4',
          userPrompt:
            'Acesse a apresentação no Google Slides, transcreva todos os slides em tópicos e destaque os pontos de ação.',
          fileUrl:
            'https://docs.google.com/presentation/d/1A2B3C-SlideDeck-Q4',
        },
      },
      {
        id: 'node-agent-slides',
        name: 'Inteligência Artificial (IA)',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.7,
        position: [496, 224],
        parameters: {
          agentRole: 'Especialista em Análise & Síntese',
          systemMessage:
            'Você recebe o documento, utiliza o conector Google Slides MCP para ler os dados e aplica a Skill de Transcrição para entregar um resumo claro.',
          toneOfVoice: 'Executivo e Direto',
          negativeInstructions:
            'Não invente métricas ou dados que não estejam nos slides.',
          text: '={{$json.userPrompt}}',
        },
      },
      {
        id: 'node-skill-slides',
        name: 'Skill: Transcrever Slides',
        type: 'ai.skillSlideTranscriber',
        typeVersion: 1,
        position: [384, 432],
        parameters: {
          summaryStyle: 'Resumo Executivo em Tópicos',
          outputFormat: 'Resumo Executivo',
          includeSpeakerNotes: true,
        },
      },
      {
        id: 'node-mcp-gslides',
        name: 'Google Slides MCP',
        type: 'ai.mcpGoogleSlides',
        typeVersion: 1,
        position: [608, 432],
        parameters: {
          action: 'read_presentation',
          presentationId:
            'https://docs.google.com/presentation/d/1A2B3C-SlideDeck-Q4',
          mcpServerUri: 'mcp://google-workspace/slides',
        },
      },
      {
        id: 'node-response-out',
        name: 'Saída / Entrega',
        type: 'ai.outputReport',
        typeVersion: 1,
        position: [864, 240],
        parameters: {
          outputType: 'Relatório Formatado em Markdown',
          documentTitle: 'Síntese Executiva: Apresentação Q4',
          includeTimestamp: true,
        },
      },
    ],
    connections: {
      'Entrada de Dados': {
        main: [
          [
            {
              node: 'Inteligência Artificial (IA)',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Skill: Transcrever Slides': {
        ai_tool: [
          [
            {
              node: 'Inteligência Artificial (IA)',
              type: 'ai_tool',
              index: 0,
            },
          ],
        ],
      },
      'Google Slides MCP': {
        ai_tool: [
          [
            {
              node: 'Inteligência Artificial (IA)',
              type: 'ai_tool',
              index: 0,
            },
          ],
        ],
      },
      'Inteligência Artificial (IA)': {
        main: [
          [
            {
              node: 'Saída / Entrega',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  },

  {
    id: 'wf-ai-agent-pipeline',
    name: '2. AI Agent & Branching Customer Pipeline (n8n v1.118)',
    active: true,
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Sao_Paulo',
    },
    pinData: {},
    nodes: [
      {
        id: 'node-sticky-1',
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        typeVersion: 1,
        position: [112, 48],
        parameters: {
          content:
            '### Arquitetura Reconstruída (n8n v1.118.1)\n- **Gatilho**: `36px 8px 8px 36px` radius\n- **Standard Nodes**: `96×96px` no grid de `16px`\n- **AI Agent**: `256×96px` com portas suplementares losango (`diamond`) tracejadas (`8,8`)\n- **Sub-nós IA**: `80×80px` circulares',
          color: 5,
          width: 480,
          height: 144,
        },
      },
      {
        id: 'node-trigger-1',
        name: 'When clicking ‘Execute workflow’',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [144, 256],
        parameters: {
          initialPayload: JSON.stringify(
            {
              userId: 1042,
              name: 'Kayke Dev',
              plan: 'enterprise',
              score: 92,
              query: 'Calcule 12 * 450 para o contrato anual Enterprise.',
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'node-http-1',
        name: 'Enrich Customer API',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [368, 256],
        parameters: {
          method: 'GET',
          url: 'https://api.n8n.local/v1/customers/={{$json.userId}}',
          mockResponse: JSON.stringify(
            {
              statusCode: 200,
              region: 'BR-SP',
              accountManager: 'Helena Costa',
              verified: true,
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'node-if-1',
        name: 'Score >= 80?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [592, 256],
        parameters: {
          field: 'score',
          operation: 'largerEqual',
          value: '80',
        },
      },
      {
        id: 'node-agent-1',
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.7,
        position: [848, 176],
        parameters: {
          promptType: 'define',
          text: '={{$json.query}}',
          systemMessage:
            'Você é um agente financeiro integrado ao n8n. Calcule projeções e sintetize os dados do cliente.',
        },
      },
      {
        id: 'node-lm-1',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1,
        position: [784, 368],
        parameters: {
          model: 'gpt-4o',
          temperature: 0.2,
        },
      },
      {
        id: 'node-mem-1',
        name: 'Simple Memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        typeVersion: 1,
        position: [912, 368],
        parameters: {
          contextWindowLength: 5,
          sessionKey: '={{$json.userId}}',
        },
      },
      {
        id: 'node-tool-1',
        name: 'Calculator',
        type: '@n8n/n8n-nodes-langchain.toolCalculator',
        typeVersion: 1,
        position: [1040, 368],
        parameters: {
          precision: 2,
        },
      },
      {
        id: 'node-set-low',
        name: 'Standard Onboarding',
        type: 'n8n-nodes-base.set',
        typeVersion: 3,
        position: [896, 512],
        parameters: {
          mode: 'manual',
          keepOnlySet: false,
          fieldsJson: JSON.stringify(
            {
              queue: 'self-service',
              greeting: 'Bem-vindo, ={{$json.name}}!',
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'node-code-final',
        name: 'Format Audit Payload',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1216, 176],
        parameters: {
          mode: 'runOnceForAllItems',
          jsCode: `return items.map((item, idx) => ({
  json: {
    ...item.json,
    auditId: 'AUD-' + (1000 + idx),
    completedAt: new Date().toISOString(),
    workflowEngine: 'n8n-reconstructed-v1'
  }
}));`,
        },
      },
    ],
    connections: {
      'When clicking ‘Execute workflow’': {
        main: [
          [
            {
              node: 'Enrich Customer API',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Enrich Customer API': {
        main: [
          [
            {
              node: 'Score >= 80?',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Score >= 80?': {
        main: [
          [
            {
              node: 'AI Agent',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'Standard Onboarding',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'OpenAI Chat Model': {
        ai_languageModel: [
          [
            {
              node: 'AI Agent',
              type: 'ai_languageModel',
              index: 0,
            },
          ],
        ],
      },
      'Simple Memory': {
        ai_memory: [
          [
            {
              node: 'AI Agent',
              type: 'ai_memory',
              index: 0,
            },
          ],
        ],
      },
      Calculator: {
        ai_tool: [
          [
            {
              node: 'AI Agent',
              type: 'ai_tool',
              index: 0,
            },
          ],
        ],
      },
      'AI Agent': {
        main: [
          [
            {
              node: 'Format Audit Payload',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  },

  {
    id: 'wf-merge-and-loop',
    name: '2. Multi-Input Merge Synchronization & Loop Routing',
    active: false,
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Sao_Paulo',
    },
    pinData: {},
    nodes: [
      {
        id: 'node-sticky-loop',
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        typeVersion: 1,
        position: [128, 48],
        parameters: {
          content:
            '### Sincronização `waitingExecution` & Loop SmoothStep\nDemonstra o nó **Merge** aguardando duas ramificações paralelas e o roteamento reverso (`sourceX - 20 > targetX`) em 2 segmentos SmoothStep com `EDGE_PADDING_BOTTOM = 130`.',
          color: 4,
          width: 460,
          height: 128,
        },
      },
      {
        id: 'wh-1',
        name: 'Webhook Order',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [160, 272],
        parameters: {
          httpMethod: 'POST',
          path: '/api/v1/order-hook',
          simulatedBody: JSON.stringify(
            {
              orderId: 'ORD-9981',
              customer: 'Empresa Alpha',
              amount: 1480.5,
              plan: 'enterprise',
              score: 95,
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'set-branch-a',
        name: 'Calc Taxes (Branch A)',
        type: 'n8n-nodes-base.set',
        typeVersion: 3,
        position: [432, 176],
        parameters: {
          mode: 'manual',
          keepOnlySet: false,
          fieldsJson: JSON.stringify(
            {
              taxRate: 0.15,
              taxAmount: '={{$json.amount * 0.15}}',
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'http-branch-b',
        name: 'Fetch Warehouse (Branch B)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [432, 368],
        parameters: {
          method: 'GET',
          url: 'https://warehouse.n8n.local/stock/={{$json.orderId}}',
          mockResponse: JSON.stringify(
            {
              warehouse: 'CD-Campinas-02',
              inStock: true,
              dispatchEtaHours: 4,
            },
            null,
            2,
          ),
        },
      },
      {
        id: 'merge-1',
        name: 'Merge Branches',
        type: 'n8n-nodes-base.merge',
        typeVersion: 3,
        position: [720, 272],
        parameters: {
          mode: 'combine',
        },
      },
      {
        id: 'code-loop-1',
        name: 'Verify & Seal Order',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [976, 272],
        parameters: {
          mode: 'runOnceForAllItems',
          jsCode: `return items.map((item) => ({
  json: {
    ...item.json,
    totalWithTax: Number(item.json.amount || 0) + Number(item.json.taxAmount || 0),
    sealed: true
  }
}));`,
        },
      },
    ],
    connections: {
      'Webhook Order': {
        main: [
          [
            {
              node: 'Calc Taxes (Branch A)',
              type: 'main',
              index: 0,
            },
            {
              node: 'Fetch Warehouse (Branch B)',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Calc Taxes (Branch A)': {
        main: [
          [
            {
              node: 'Merge Branches',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Fetch Warehouse (Branch B)': {
        main: [
          [
            {
              node: 'Merge Branches',
              type: 'main',
              index: 1,
            },
          ],
        ],
      },
      'Merge Branches': {
        main: [
          [
            {
              node: 'Verify & Seal Order',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  },
];

