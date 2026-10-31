import { INodeTypeDescription } from './types';

export const NODE_TYPE_DESCRIPTIONS: Record<string, INodeTypeDescription> = {
  'n8n-nodes-base.manualTrigger': {
    name: 'n8n-nodes-base.manualTrigger',
    displayName: 'When clicking ‘Execute workflow’',
    subtitle: 'Manual Trigger',
    description: 'Inicia a execução do fluxo manualmente ao clicar em Executar.',
    category: 'trigger',
    version: 1,
    icon: 'MousePointerClick',
    color: '#ff6d5a',
    isTrigger: true,
    inputs: [],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Payload Inicial (JSON)',
        name: 'initialPayload',
        type: 'json',
        default: JSON.stringify(
          {
            userId: 1042,
            name: 'Kayke Dev',
            plan: 'enterprise',
            score: 92,
            query: 'Calcule a receita anual para 12 meses de $450 e resuma o plano.',
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
        description: 'Objeto JSON emitido pelo gatilho manual.',
        rows: 7,
      },
    ],
  },

  'n8n-nodes-base.webhook': {
    name: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    subtitle: '={{$parameter["httpMethod"] + ": " + $parameter["path"]}}',
    description: 'Inicia o workflow quando uma requisição HTTP Webhook é recebida.',
    category: 'trigger',
    version: 2,
    icon: 'Webhook',
    color: '#8855ff',
    isTrigger: true,
    inputs: [],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'HTTP Method',
        name: 'httpMethod',
        type: 'options',
        default: 'POST',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '/api/v1/order-hook',
        placeholder: '/webhook-path',
      },
      {
        displayName: 'Simulated Body (JSON)',
        name: 'simulatedBody',
        type: 'json',
        default: JSON.stringify(
          {
            event: 'order.created',
            orderId: 'ORD-9981',
            customer: 'Empresa Alpha',
            amount: 1480.5,
            currency: 'BRL',
            itemsCount: 3,
          },
          null,
          2,
        ),
        rows: 7,
      },
    ],
  },

  'n8n-nodes-base.scheduleTrigger': {
    name: 'n8n-nodes-base.scheduleTrigger',
    displayName: 'Schedule Trigger',
    subtitle: '={{$parameter["cronExpression"]}}',
    description: 'Dispara o workflow periodicamente segundo uma expressão Cron.',
    category: 'trigger',
    version: 1,
    icon: 'Clock',
    color: '#29a366',
    isTrigger: true,
    inputs: [],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Cron Expression',
        name: 'cronExpression',
        type: 'string',
        default: '0 */6 * * *',
        description: 'Expressão cron padrão de 5 campos.',
      },
    ],
  },

  'n8n-nodes-base.httpRequest': {
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    subtitle: '={{$parameter["method"] + ": " + $parameter["url"]}}',
    description: 'Faz uma requisição HTTP para qualquer API REST ou retorna dados simulados.',
    category: 'core',
    version: 4,
    icon: 'Globe',
    color: '#3b82f6',
    inputs: [{ type: 'main', displayName: 'main' }],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
        ],
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: 'https://api.n8n.local/v1/users/={{$json.userId}}',
      },
      {
        displayName: 'Simulated Response Override (JSON)',
        name: 'mockResponse',
        type: 'json',
        default: JSON.stringify(
          {
            statusCode: 200,
            enriched: true,
            region: 'SA-East (São Paulo)',
            tierMultiplier: 1.25,
          },
          null,
          2,
        ),
        description: 'Mescla estes dados com o item recebido durante a execução.',
        rows: 6,
      },
    ],
  },

  'n8n-nodes-base.set': {
    name: 'n8n-nodes-base.set',
    displayName: 'Edit Fields (Set)',
    subtitle: '={{$parameter["mode"]}}',
    description: 'Adiciona, modifica ou filtra campos nos itens JSON usando expressões n8n.',
    category: 'core',
    version: 3,
    icon: 'PenLine',
    color: '#6366f1',
    inputs: [{ type: 'main', displayName: 'main' }],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        default: 'manual',
        options: [
          { name: 'Manual Mapping', value: 'manual' },
          { name: 'JSON Output', value: 'raw' },
        ],
      },
      {
        displayName: 'Keep Only Set Fields',
        name: 'keepOnlySet',
        type: 'boolean',
        default: false,
      },
      {
        displayName: 'Fields to Set (JSON com suporte a ={{ $json }})',
        name: 'fieldsJson',
        type: 'json',
        default: JSON.stringify(
          {
            processedBy: 'n8n-workflow-engine',
            greeting: 'Olá, ={{$json.name}} (Plano: ={{$json.plan}})',
            adjustedScore: '={{$json.score * 1.1}}',
          },
          null,
          2,
        ),
        rows: 7,
      },
    ],
  },

  'n8n-nodes-base.code': {
    name: 'n8n-nodes-base.code',
    displayName: 'Code',
    subtitle: 'Run Custom JavaScript',
    description: 'Executa código JavaScript customizado para transformar `$input.all()` ou `$json`.',
    category: 'core',
    version: 2,
    icon: 'Code2',
    color: '#f59e0b',
    inputs: [{ type: 'main', displayName: 'main' }],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        default: 'runOnceForAllItems',
        options: [
          { name: 'Run Once for All Items', value: 'runOnceForAllItems' },
          { name: 'Run Once for Each Item', value: 'runOnceForEachItem' },
        ],
      },
      {
        displayName: 'JavaScript Code',
        name: 'jsCode',
        type: 'code',
        default: `// Acesse items via $input.all() ou $json
return items.map((item, idx) => ({
  json: {
    ...item.json,
    itemIndex: idx,
    computedHash: 'h_' + Math.abs(JSON.stringify(item.json).length * 31),
    processedAt: new Date().toISOString()
  }
}));`,
        rows: 10,
      },
    ],
  },

  'n8n-nodes-base.if': {
    name: 'n8n-nodes-base.if',
    displayName: 'If',
    subtitle: '={{$parameter["field"] + " " + $parameter["operation"] + " " + $parameter["value"]}}',
    description: 'Roteia itens para a saída `true` (0) ou `false` (1) com base em uma condição.',
    category: 'flow',
    version: 2,
    icon: 'GitBranch',
    color: '#22c55e',
    inputs: [{ type: 'main', displayName: 'main' }],
    outputs: [
      { type: 'main', displayName: 'true' },
      { type: 'main', displayName: 'false' },
    ],
    properties: [
      {
        displayName: 'Field Path (ex: score ou amount)',
        name: 'field',
        type: 'string',
        default: 'score',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: 'largerEqual',
        options: [
          { name: 'Equals (==)', value: 'equal' },
          { name: 'Not Equals (!=)', value: 'notEqual' },
          { name: 'Greater Than (>)', value: 'larger' },
          { name: 'Greater or Equal (>=)', value: 'largerEqual' },
          { name: 'Less Than (<)', value: 'smaller' },
          { name: 'Contains', value: 'contains' },
        ],
      },
      {
        displayName: 'Comparison Value',
        name: 'value',
        type: 'string',
        default: '80',
      },
    ],
  },

  'n8n-nodes-base.switch': {
    name: 'n8n-nodes-base.switch',
    displayName: 'Switch',
    subtitle: '={{$parameter["propertyName"]}}',
    description: 'Roteia itens entre 3 portas de saída com base no valor de um campo.',
    category: 'flow',
    version: 3,
    icon: 'Split',
    color: '#06b6d4',
    inputs: [{ type: 'main', displayName: 'main' }],
    outputs: [
      { type: 'main', displayName: 'output 0' },
      { type: 'main', displayName: 'output 1' },
      { type: 'main', displayName: 'fallback' },
    ],
    properties: [
      {
        displayName: 'Property Name',
        name: 'propertyName',
        type: 'string',
        default: 'plan',
      },
      {
        displayName: 'Output 0 Value',
        name: 'value0',
        type: 'string',
        default: 'enterprise',
      },
      {
        displayName: 'Output 1 Value',
        name: 'value1',
        type: 'string',
        default: 'pro',
      },
    ],
  },

  'n8n-nodes-base.merge': {
    name: 'n8n-nodes-base.merge',
    displayName: 'Merge',
    subtitle: '={{$parameter["mode"]}}',
    description: 'Sincroniza e combina dados de 2 entradas distintas (usa waitingExecution no motor).',
    category: 'flow',
    version: 3,
    icon: 'GitMerge',
    color: '#ec4899',
    inputs: [
      { type: 'main', displayName: 'Input 1' },
      { type: 'main', displayName: 'Input 2' },
    ],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        default: 'append',
        options: [
          { name: 'Append (Concatenar itens)', value: 'append' },
          { name: 'Combine by Position (Mesclar objetos)', value: 'combine' },
          { name: 'Choose Branch 1', value: 'chooseBranch1' },
        ],
      },
    ],
  },

  '@n8n/n8n-nodes-langchain.agent': {
    name: '@n8n/n8n-nodes-langchain.agent',
    displayName: 'AI Agent',
    subtitle: 'Tools Agent',
    description: 'Nó configurável largo (256x96) que orquestra Chat Model, Memory e Tools via portas suplementares.',
    category: 'ai',
    version: 1.7,
    icon: 'Bot',
    color: '#ff6d5a',
    isConfigurable: true,
    inputs: [
      { type: 'main', displayName: 'main' },
      { type: 'ai_languageModel', displayName: 'Chat Model', required: true, maxConnections: 1 },
      { type: 'ai_memory', displayName: 'Memory', required: false, maxConnections: 1 },
      { type: 'ai_tool', displayName: 'Tool', required: false },
    ],
    outputs: [{ type: 'main', displayName: 'main' }],
    properties: [
      {
        displayName: 'Prompt Source',
        name: 'promptType',
        type: 'options',
        default: 'define',
        options: [
          { name: 'Define below', value: 'define' },
          { name: 'Connected Chat Trigger', value: 'auto' },
        ],
      },
      {
        displayName: 'Prompt / User Message',
        name: 'text',
        type: 'string',
        default: '={{$json.query}}',
        rows: 3,
      },
      {
        displayName: 'System Message',
        name: 'systemMessage',
        type: 'string',
        default: 'Você é um assistente especialista integrado ao workflow do n8n.',
        rows: 3,
      },
    ],
  },

  '@n8n/n8n-nodes-langchain.lmChatOpenAi': {
    name: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    displayName: 'OpenAI Chat Model',
    subtitle: '={{$parameter["model"]}}',
    description: 'Sub-nó de configuração circular (80x80) que fornece o modelo LLM ao AI Agent.',
    category: 'ai_subnode',
    version: 1,
    icon: 'Sparkles',
    color: '#10a37f',
    isConfiguration: true,
    inputs: [],
    outputs: [{ type: 'ai_languageModel', displayName: 'Model' }],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        default: 'gpt-4o',
        options: [
          { name: 'gpt-4o', value: 'gpt-4o' },
          { name: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
          { name: 'claude-3-7-sonnet', value: 'claude-3-7-sonnet' },
        ],
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.2,
      },
    ],
  },

  '@n8n/n8n-nodes-langchain.memoryBufferWindow': {
    name: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
    displayName: 'Simple Memory',
    subtitle: 'Window Buffer (k={{$parameter["contextWindowLength"]}})',
    description: 'Sub-nó de configuração circular (80x80) para memória conversacional.',
    category: 'ai_subnode',
    version: 1,
    icon: 'Database',
    color: '#8b5cf6',
    isConfiguration: true,
    inputs: [],
    outputs: [{ type: 'ai_memory', displayName: 'Memory' }],
    properties: [
      {
        displayName: 'Context Window Length',
        name: 'contextWindowLength',
        type: 'number',
        default: 5,
      },
      {
        displayName: 'Session Key',
        name: 'sessionKey',
        type: 'string',
        default: '={{$json.userId}}',
      },
    ],
  },

  '@n8n/n8n-nodes-langchain.toolCalculator': {
    name: '@n8n/n8n-nodes-langchain.toolCalculator',
    displayName: 'Calculator',
    subtitle: 'Math Tool',
    description: 'Sub-nó circular (80x80) que permite ao AI Agent executar cálculos matemáticos.',
    category: 'ai_subnode',
    version: 1,
    icon: 'Calculator',
    color: '#f97316',
    isConfiguration: true,
    inputs: [],
    outputs: [{ type: 'ai_tool', displayName: 'Tool' }],
    properties: [
      {
        displayName: 'Precision Decimals',
        name: 'precision',
        type: 'number',
        default: 2,
      },
    ],
  },

  'n8n-nodes-base.stickyNote': {
    name: 'n8n-nodes-base.stickyNote',
    displayName: 'Sticky Note',
    subtitle: '',
    description: 'Nota adesiva markdown para documentar fluxos diretamente no Canvas.',
    category: 'annotation',
    version: 1,
    icon: 'StickyNote',
    color: '#eab308',
    isSticky: true,
    inputs: [],
    outputs: [],
    properties: [
      {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        default: '## Arquitetura do Fluxo\nClique duas vezes em qualquer nó para inspecionar entradas, expressões `={{ $json }}` e saídas.',
        rows: 5,
      },
      {
        displayName: 'Color Variant (1-7)',
        name: 'color',
        type: 'options',
        default: 1,
        options: [
          { name: '1 - Amarelo (Default)', value: 1 },
          { name: '2 - Laranja', value: 2 },
          { name: '3 - Coral / Vermelho', value: 3 },
          { name: '4 - Verde Esmeralda', value: 4 },
          { name: '5 - Azul Céu', value: 5 },
          { name: '6 - Roxo / Índigo', value: 6 },
          { name: '7 - Neutro / Cinza', value: 7 },
        ],
      },
      {
        displayName: 'Width (px)',
        name: 'width',
        type: 'number',
        default: 280,
      },
      {
        displayName: 'Height (px)',
        name: 'height',
        type: 'number',
        default: 160,
      },
    ],
  },
};

export function getNodeTypeDescription(type: string): INodeTypeDescription {
  return (
    NODE_TYPE_DESCRIPTIONS[type] ?? {
      name: type,
      displayName: type.split('.').pop() || type,
      description: 'Nó customizado',
      category: 'core',
      version: 1,
      icon: 'Box',
      color: '#ff6d5a',
      inputs: [{ type: 'main', displayName: 'main' }],
      outputs: [{ type: 'main', displayName: 'main' }],
      properties: [],
    }
  );
}

