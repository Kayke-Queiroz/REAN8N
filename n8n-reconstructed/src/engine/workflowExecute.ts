// ============================================================================
// n8n-core WorkflowExecute Engine
// Reconstructed from:
// - n8n-core/dist/execution-engine/workflow-execute.js (L57-L1000)
// Supports:
// - Stack-based execution (`nodeExecutionStack`) with `v1` (depth-first unshift) and `v0` (FIFO push)
// - Multi-input synchronization via `waitingExecution` & `waitingExecutionSource` (Merge node)
// - Pinned data override (`pinData`)
// - Disabled node pass-through (`handleDisabledNode`)
// - Partial execution up to a target node (`destinationNode` & `runNodeFilter`)
// - Supplemental AI Sub-nodes resolution (`ai_languageModel`, `ai_memory`, `ai_tool`)
// - Real-time lifecycle hooks (`onNodeExecuteBefore`, `onNodeExecuteAfter`)
// ============================================================================

import {
  IConnection,
  IDataObject,
  IExecuteData,
  INode,
  INodeExecutionData,
  IPinData,
  IRunExecutionData,
  ISourceData,
  ITaskData,
  NodeConnectionType,
} from './types';
import { Workflow } from './workflow';
import { getNodeTypeDescription } from './nodeTypes';

export interface ExecutionLifecycleHooks {
  onWorkflowStart?: (workflow: Workflow) => void;
  onNodeExecuteBefore?: (nodeName: string) => Promise<void> | void;
  onNodeExecuteAfter?: (nodeName: string, taskData: ITaskData) => Promise<void> | void;
  onWorkflowFinish?: (runExecutionData: IRunExecutionData) => void;
  stepDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WorkflowExecute {
  public status: 'new' | 'running' | 'success' | 'error' | 'canceled' = 'new';
  public runExecutionData: IRunExecutionData;
  private hooks: ExecutionLifecycleHooks;
  private currentExecutionIndex = 0;

  constructor(hooks: ExecutionLifecycleHooks = {}) {
    this.hooks = hooks;
    this.runExecutionData = {
      startData: {},
      resultData: {
        runData: {},
        pinData: {},
      },
      executionData: {
        contextData: {},
        nodeExecutionStack: [],
        metadata: {},
        waitingExecution: {},
        waitingExecutionSource: {},
      },
    };
  }

  /**
   * Entry point matching `WorkflowExecute.run(workflow, startNode, destinationNode, pinData)`
   * in `n8n-core/dist/execution-engine/workflow-execute.js` L79-L123
   */
  public async run(
    workflow: Workflow,
    startNode?: INode,
    destinationNode?: string,
    pinData?: IPinData,
  ): Promise<IRunExecutionData> {
    this.status = 'running';
    const effectivePinData = pinData ?? workflow.pinData ?? {};

    const resolvedStartNode = startNode || workflow.getStartNode(destinationNode);
    if (!resolvedStartNode) {
      throw new Error('Nenhum nó inicial (Trigger) encontrado para iniciar o workflow.');
    }

    let runNodeFilter: string[] | undefined;
    if (destinationNode) {
      runNodeFilter = workflow.getParentNodes(destinationNode, 'ALL');
      runNodeFilter.push(destinationNode);
    }

    const nodeExecutionStack: IExecuteData[] = [
      {
        node: resolvedStartNode,
        data: {
          main: [[{ json: {} }]],
        },
        source: null,
      },
    ];

    this.runExecutionData = {
      startData: {
        destinationNode,
        runNodeFilter,
      },
      resultData: {
        runData: {},
        pinData: effectivePinData,
      },
      executionData: {
        contextData: {},
        nodeExecutionStack,
        metadata: {},
        waitingExecution: {},
        waitingExecutionSource: {},
      },
    };

    return this.processRunExecutionData(workflow);
  }

  /**
   * Direct port of `prepareWaitingToExecution` & `addNodeToBeExecuted`
   * from `n8n-core/dist/execution-engine/workflow-execute.js` L254-L483
   */
  private prepareWaitingToExecution(
    nodeName: string,
    numberOfConnections: number,
    runIndex: number,
  ): void {
    const executionData = this.runExecutionData.executionData!;
    executionData.waitingExecution[nodeName] ??= {};
    executionData.waitingExecutionSource[nodeName] ??= {};

    executionData.waitingExecution[nodeName][runIndex] = { main: [] };
    executionData.waitingExecutionSource[nodeName][runIndex] = { main: [] };

    for (let i = 0; i < numberOfConnections; i++) {
      executionData.waitingExecution[nodeName][runIndex].main.push(null);
      executionData.waitingExecutionSource[nodeName][runIndex].main.push(null);
    }
  }

  private addNodeToBeExecuted(
    workflow: Workflow,
    connectionData: IConnection,
    outputIndex: number,
    parentNodeName: string,
    nodeSuccessData: INodeExecutionData[][],
    runIndex: number,
  ): void {
    const executionData = this.runExecutionData.executionData!;
    const enqueueFn = workflow.settings.executionOrder === 'v1' ? 'unshift' : 'push';
    const targetNode = workflow.nodes[connectionData.node];
    if (!targetNode) return;

    const numberOfInputs =
      workflow.connectionsByDestinationNode[connectionData.node]?.main?.length ?? 0;

    if (numberOfInputs > 1) {
      if (!executionData.waitingExecution[connectionData.node]) {
        executionData.waitingExecution[connectionData.node] = {};
        executionData.waitingExecutionSource[connectionData.node] = {};
      }

      let waitingNodeIndex: number | undefined;
      let createNewWaitingEntry = true;

      for (const indexKey of Object.keys(
        executionData.waitingExecution[connectionData.node],
      )) {
        const idx = parseInt(indexKey, 10);
        if (
          !executionData.waitingExecution[connectionData.node][idx].main[
            connectionData.index
          ]
        ) {
          createNewWaitingEntry = false;
          waitingNodeIndex = idx;
          break;
        }
      }

      if (waitingNodeIndex === undefined) {
        waitingNodeIndex = Object.keys(
          executionData.waitingExecution[connectionData.node],
        ).length;
      }

      if (createNewWaitingEntry) {
        this.prepareWaitingToExecution(
          connectionData.node,
          numberOfInputs,
          waitingNodeIndex,
        );
      }

      executionData.waitingExecution[connectionData.node][waitingNodeIndex].main[
        connectionData.index
      ] = nodeSuccessData[outputIndex] ?? [];
      executionData.waitingExecutionSource[connectionData.node][waitingNodeIndex].main[
        connectionData.index
      ] = {
        previousNode: parentNodeName,
        previousNodeOutput: outputIndex,
        previousNodeRun: runIndex,
      };

      const waitingMain =
        executionData.waitingExecution[connectionData.node][waitingNodeIndex].main;
      const allDataFound = waitingMain.every((slot) => slot !== null);

      if (allDataFound) {
        executionData.nodeExecutionStack[enqueueFn]({
          node: targetNode,
          data: executionData.waitingExecution[connectionData.node][waitingNodeIndex],
          source: {
            main: executionData.waitingExecutionSource[connectionData.node][
              waitingNodeIndex
            ].main,
          },
        });
        delete executionData.waitingExecution[connectionData.node][waitingNodeIndex];
        delete executionData.waitingExecutionSource[connectionData.node][
          waitingNodeIndex
        ];
      }
      return;
    }

    // Single-input target node
    const connectionDataArray: Array<INodeExecutionData[] | null> = [];
    for (let i = 0; i <= connectionData.index; i++) {
      connectionDataArray[i] = null;
    }
    connectionDataArray[connectionData.index] = nodeSuccessData[outputIndex] ?? [];

    executionData.nodeExecutionStack[enqueueFn]({
      node: targetNode,
      data: {
        main: connectionDataArray,
      },
      source: {
        main: [
          {
            previousNode: parentNodeName,
            previousNodeOutput: outputIndex,
            previousNodeRun: runIndex,
          },
        ],
      },
    });
  }

  /**
   * Executes connected supplemental AI sub-nodes (`ai_languageModel`, `ai_memory`, `ai_tool`)
   * when an AI Agent (`isConfigurable`) runs, recording their `ITaskData` in `runData`.
   */
  private async executeSupplementalSubNodes(
    workflow: Workflow,
    agentNode: INode,
    itemJson: IDataObject,
  ): Promise<Record<string, IDataObject[]>> {
    const incoming = workflow.connectionsByDestinationNode[agentNode.name];
    const resolvedSubNodes: Record<string, IDataObject[]> = {};
    if (!incoming) return resolvedSubNodes;

    const subTypes: NodeConnectionType[] = [
      'ai_languageModel',
      'ai_memory',
      'ai_tool',
      'ai_outputParser',
    ];

    for (const subType of subTypes) {
      const branches = incoming[subType] ?? [];
      for (const branch of branches) {
        for (const conn of branch ?? []) {
          const subNode = workflow.nodes[conn.node];
          if (!subNode || subNode.disabled) continue;

          if (this.hooks.onNodeExecuteBefore) {
            await this.hooks.onNodeExecuteBefore(subNode.name);
          }
          if (this.hooks.stepDelayMs) {
            await sleep(Math.round(this.hooks.stepDelayMs * 0.6));
          }

          const startTime = Date.now();
          const evaluatedParams: IDataObject = {};
          for (const [k, v] of Object.entries(subNode.parameters)) {
            evaluatedParams[k] = workflow.evaluateExpression(v, {
              currentNode: subNode,
              itemJson,
              runData: this.runExecutionData.resultData.runData,
            });
          }

          const subOutput: IDataObject = {
            subNodeName: subNode.name,
            subNodeType: subNode.type,
            connectionType: subType,
            ...evaluatedParams,
          };

          const taskData: ITaskData = {
            startTime,
            executionTime: Math.max(4, Date.now() - startTime),
            executionIndex: this.currentExecutionIndex++,
            executionStatus: 'success',
            source: [{ previousNode: agentNode.name }],
            data: {
              [subType]: [[{ json: subOutput }]],
              main: [[{ json: subOutput }]],
            },
          };

          this.runExecutionData.resultData.runData[subNode.name] ??= [];
          this.runExecutionData.resultData.runData[subNode.name].push(taskData);

          if (this.hooks.onNodeExecuteAfter) {
            await this.hooks.onNodeExecuteAfter(subNode.name, taskData);
          }

          resolvedSubNodes[subType] ??= [];
          resolvedSubNodes[subType].push(subOutput);
        }
      }
    }

    return resolvedSubNodes;
  }

  /**
   * Executes a single node's logic (`runNode` in `n8n-core/dist/execution-engine/workflow-execute.js` L680-L708)
   */
  private async runNode(
    workflow: Workflow,
    executionData: IExecuteData,
    runIndex: number,
  ): Promise<INodeExecutionData[][]> {
    const { node } = executionData;

    // 1. Disabled node pass-through (`handleDisabledNode` L533-541)
    if (node.disabled) {
      const firstInput = executionData.data.main?.[0] ?? [];
      return [firstInput];
    }

    // 2. ExecuteOnce handling (`handleExecuteOnce` L578-589)
    let inputItems =
      executionData.data.main?.find((slot) => slot && slot.length > 0) ?? [
        { json: {} },
      ];
    if (node.executeOnce && inputItems.length > 1) {
      inputItems = inputItems.slice(0, 1);
    }

    const firstJson = inputItems[0]?.json ?? {};

    switch (node.type) {
      case 'ai.promptInput': {
        return [
          [
            {
              json: {
                requestTitle:
                  node.parameters.requestTitle || 'Transcrever Slides',
                userPrompt:
                  node.parameters.userPrompt ||
                  'Transcreva os slides da apresentação e gere tópicos executivos.',
                presentationId:
                  node.parameters.presentationId ||
                  'https://docs.google.com/presentation/d/1A2B3C-SlideDeck-Q4',
                language: node.parameters.language || 'pt-BR',
                submittedAt: new Date().toISOString(),
              },
              pairedItem: { item: 0 },
            },
          ],
        ];
      }

      case 'ai.responseOutput': {
        return [
          inputItems.map((item, idx) => {
            const resolvedTitle = workflow.evaluateExpression(
              node.parameters.documentTitle,
              {
                currentNode: node,
                itemJson: item.json,
                runData: this.runExecutionData.resultData.runData,
                itemIndex: idx,
              },
            );
            return {
              json: {
                status: 'entregue',
                channel: node.parameters.channel || 'Documento & Chat',
                documentTitle: resolvedTitle,
                finalResponse:
                  item.json.output ||
                  item.json.transcribedMarkdown ||
                  'Transcrição concluída com sucesso.',
                ...item.json,
                deliveredAt: new Date().toISOString(),
              },
              pairedItem: { item: idx },
            };
          }),
        ];
      }

      case 'n8n-nodes-base.manualTrigger': {
        const rawPayload = String(node.parameters.initialPayload || '{}');
        let parsed: IDataObject = {};
        try {
          parsed = JSON.parse(rawPayload);
        } catch {
          parsed = { raw: rawPayload };
        }
        return [[{ json: parsed, pairedItem: { item: 0 } }]];
      }

      case 'n8n-nodes-base.webhook': {
        const rawBody = String(node.parameters.simulatedBody || '{}');
        let parsedBody: IDataObject = {};
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = { body: rawBody };
        }
        return [
          [
            {
              json: {
                headers: {
                  'content-type': 'application/json',
                  'x-n8n-webhook': String(node.parameters.path || '/webhook'),
                },
                method: node.parameters.httpMethod || 'POST',
                body: parsedBody,
                ...parsedBody,
              },
              pairedItem: { item: 0 },
            },
          ],
        ];
      }

      case 'n8n-nodes-base.scheduleTrigger': {
        return [
          [
            {
              json: {
                cronExpression: node.parameters.cronExpression || '0 */6 * * *',
                triggeredAt: new Date().toISOString(),
                timezone: workflow.settings.timezone || 'America/Sao_Paulo',
              },
              pairedItem: { item: 0 },
            },
          ],
        ];
      }

      case 'n8n-nodes-base.httpRequest': {
        return inputItems.map((item, idx) => {
          const resolvedUrl = workflow.evaluateExpression(node.parameters.url, {
            currentNode: node,
            itemJson: item.json,
            runData: this.runExecutionData.resultData.runData,
            itemIndex: idx,
          });
          let mockData: IDataObject = {};
          try {
            mockData = JSON.parse(String(node.parameters.mockResponse || '{}'));
          } catch {
            mockData = {};
          }
          return {
            json: {
              ...item.json,
              httpRequest: {
                method: node.parameters.method || 'GET',
                url: resolvedUrl,
                ...mockData,
              },
              ...mockData,
            },
            pairedItem: { item: idx },
          };
        })
          ? [
              inputItems.map((item, idx) => {
                const resolvedUrl = workflow.evaluateExpression(
                  node.parameters.url,
                  {
                    currentNode: node,
                    itemJson: item.json,
                    runData: this.runExecutionData.resultData.runData,
                    itemIndex: idx,
                  },
                );
                let mockData: IDataObject = {};
                try {
                  mockData = JSON.parse(
                    String(node.parameters.mockResponse || '{}'),
                  );
                } catch {
                  mockData = {};
                }
                return {
                  json: {
                    ...item.json,
                    ...mockData,
                    requestUrl: resolvedUrl,
                    requestMethod: node.parameters.method || 'GET',
                  },
                  pairedItem: { item: idx },
                };
              }),
            ]
          : [[]];
      }

      case 'n8n-nodes-base.set': {
        const keepOnlySet = Boolean(node.parameters.keepOnlySet);
        let templateObj: IDataObject = {};
        try {
          templateObj = JSON.parse(String(node.parameters.fieldsJson || '{}'));
        } catch {
          templateObj = {};
        }

        const outItems: INodeExecutionData[] = inputItems.map((item, idx) => {
          const evaluatedFields: IDataObject = {};
          for (const [key, val] of Object.entries(templateObj)) {
            evaluatedFields[key] = workflow.evaluateExpression(val, {
              currentNode: node,
              itemJson: item.json,
              runData: this.runExecutionData.resultData.runData,
              itemIndex: idx,
            });
          }
          return {
            json: keepOnlySet
              ? evaluatedFields
              : { ...item.json, ...evaluatedFields },
            pairedItem: { item: idx },
          };
        });

        return [outItems];
      }

      case 'n8n-nodes-base.code': {
        const jsCode = String(node.parameters.jsCode || 'return items;');
        const clonedItems = inputItems.map((it) => ({
          json: { ...it.json },
        }));
        const $input = {
          all: () => clonedItems,
          first: () => clonedItems[0],
          item: clonedItems[0],
        };
        const $json = clonedItems[0]?.json ?? {};

        const fn = new Function('items', '$input', '$json', jsCode);
        const rawResult = fn(clonedItems, $input, $json);
        if (Array.isArray(rawResult)) {
          const normalized: INodeExecutionData[] = rawResult.map((entry, idx) =>
            entry && typeof entry === 'object' && 'json' in entry
              ? { json: entry.json as IDataObject, pairedItem: { item: idx } }
              : { json: entry as IDataObject, pairedItem: { item: idx } },
          );
          return [normalized];
        }
        return [[{ json: (rawResult as IDataObject) ?? {}, pairedItem: { item: 0 } }]];
      }

      case 'n8n-nodes-base.if': {
        const field = String(node.parameters.field || 'score');
        const operation = String(node.parameters.operation || 'largerEqual');
        const compareRaw = workflow.evaluateExpression(node.parameters.value, {
          currentNode: node,
          itemJson: firstJson,
          runData: this.runExecutionData.resultData.runData,
        });

        const trueBranch: INodeExecutionData[] = [];
        const falseBranch: INodeExecutionData[] = [];

        inputItems.forEach((item, idx) => {
          const actual = item.json[field];
          const numActual = Number(actual);
          const numCompare = Number(compareRaw);
          let matched = false;

          switch (operation) {
            case 'equal':
              matched = String(actual) === String(compareRaw);
              break;
            case 'notEqual':
              matched = String(actual) !== String(compareRaw);
              break;
            case 'larger':
              matched = numActual > numCompare;
              break;
            case 'largerEqual':
              matched = numActual >= numCompare;
              break;
            case 'smaller':
              matched = numActual < numCompare;
              break;
            case 'contains':
              matched = String(actual ?? '')
                .toLowerCase()
                .includes(String(compareRaw ?? '').toLowerCase());
              break;
            default:
              matched = Boolean(actual);
          }

          if (matched) {
            trueBranch.push({ json: { ...item.json, branch: 'true' }, pairedItem: { item: idx } });
          } else {
            falseBranch.push({
              json: { ...item.json, branch: 'false' },
              pairedItem: { item: idx },
            });
          }
        });

        return [trueBranch, falseBranch];
      }

      case 'n8n-nodes-base.switch': {
        const propName = String(node.parameters.propertyName || 'plan');
        const val0 = String(node.parameters.value0 || 'enterprise');
        const val1 = String(node.parameters.value1 || 'pro');

        const out0: INodeExecutionData[] = [];
        const out1: INodeExecutionData[] = [];
        const fallback: INodeExecutionData[] = [];

        inputItems.forEach((item, idx) => {
          const v = String(item.json[propName] ?? '');
          if (v === val0) {
            out0.push({ json: item.json, pairedItem: { item: idx } });
          } else if (v === val1) {
            out1.push({ json: item.json, pairedItem: { item: idx } });
          } else {
            fallback.push({ json: item.json, pairedItem: { item: idx } });
          }
        });

        return [out0, out1, fallback];
      }

      case 'n8n-nodes-base.merge': {
        const mode = String(node.parameters.mode || 'append');
        const slot0 = executionData.data.main?.[0] ?? [];
        const slot1 = executionData.data.main?.[1] ?? [];

        if (mode === 'chooseBranch1') {
          return [slot0];
        }
        if (mode === 'combine') {
          const maxLen = Math.max(slot0.length, slot1.length, 1);
          const combined: INodeExecutionData[] = [];
          for (let i = 0; i < maxLen; i++) {
            combined.push({
              json: {
                ...(slot0[i]?.json ?? slot0[0]?.json ?? {}),
                ...(slot1[i]?.json ?? slot1[0]?.json ?? {}),
                mergedAtRun: runIndex,
              },
              pairedItem: [{ item: i, input: 0 }, { item: i, input: 1 }],
            });
          }
          return [combined];
        }

        // Default: append
        return [[...slot0, ...slot1]];
      }

      case '@n8n/n8n-nodes-langchain.agent': {
        const subNodes = await this.executeSupplementalSubNodes(
          workflow,
          node,
          firstJson,
        );
        const promptText = workflow.evaluateExpression(node.parameters.text, {
          currentNode: node,
          itemJson: firstJson,
          runData: this.runExecutionData.resultData.runData,
        });
        const modelInfo =
          subNodes.ai_languageModel?.[0]?.model ?? 'google/gemini-2.5-flash';
        const memoryInfo = subNodes.ai_memory?.[0]
          ? `WindowBuffer(k=${subNodes.ai_memory[0].contextWindowLength})`
          : 'stateless';
        const toolsUsed = (subNodes.ai_tool ?? []).map(
          (t) => t.subNodeName || t.subNodeType,
        );
        const hasSlidesTool = (subNodes.ai_tool ?? []).some(
          (t) =>
            String(t.subNodeType).includes('Slides') ||
            String(t.subNodeType).includes('Slide') ||
            String(t.subNodeName).toLowerCase().includes('slide'),
        );

        // Extract numbers in prompt for Calculator tool demo
        const nums = String(promptText).match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
        const calcResult =
          nums.length >= 2
            ? nums.reduce((acc, n) => acc * n, 1)
            : (Number(firstJson.score || 10) * 12);

        return [
          inputItems.map((item, idx) => ({
            json: {
              ...item.json,
              output: hasSlidesTool
                ? `Transcrição concluída via ${modelInfo} usando [${toolsUsed.join(', ')}]:\n1. Slide 1 (Visão Geral): Alinhamento de metas Q4 e crescimento de 34%.\n2. Slide 2 (Arquitetura): Agentes conectados via Gateway LLM + Google Slides MCP.\n3. Slide 3 (Próximos Passos): Automatizar relatórios semanais para a equipe.`
                : `Análise concluída pelo AI Agent (${modelInfo}): O usuário ${item.json.name || 'Cliente'} no plano '${item.json.plan || 'pro'}' possui projeção calculada de $${calcResult.toLocaleString('pt-BR')}.`,
              transcribedSlides: hasSlidesTool
                ? [
                    { slide: 1, title: 'Visão Geral Q4', summary: 'Crescimento de 34% em produtividade com Agentes IA.' },
                    { slide: 2, title: 'Arquitetura MCP & Skills', summary: 'Conexão direta ao Google Slides sem código.' },
                    { slide: 3, title: 'Plano de Ação', summary: 'Compartilhar resumo executivo automaticamente.' },
                  ]
                : undefined,
              agentMetadata: {
                model: modelInfo,
                memory: memoryInfo,
                toolsInvoked: toolsUsed,
                promptEvaluated: promptText,
              },
            },
            pairedItem: { item: idx },
          })),
        ];
      }

      default:
        return [inputItems];
    }
  }

  /**
   * Main execution loop matching `processRunExecutionData` in `n8n-core/dist/execution-engine/workflow-execute.js` L768-L1000
   */
  public async processRunExecutionData(
    workflow: Workflow,
  ): Promise<IRunExecutionData> {
    if (this.hooks.onWorkflowStart) {
      this.hooks.onWorkflowStart(workflow);
    }

    const executionData = this.runExecutionData.executionData!;
    const { pinData } = this.runExecutionData.resultData;
    let loopGuard = 0;
    const MAX_EXECUTION_STEPS = 40;

    while (executionData.nodeExecutionStack.length > 0) {
      if (this.status === 'canceled') break;
      if (++loopGuard > MAX_EXECUTION_STEPS) {
        throw new Error(
          'Stopped execution because it seems to be in an endless loop (max steps reached).',
        );
      }

      const currentItem = executionData.nodeExecutionStack.shift()!;
      const executionNode = currentItem.node;

      if (
        this.runExecutionData.startData?.runNodeFilter &&
        !this.runExecutionData.startData.runNodeFilter.includes(executionNode.name)
      ) {
        continue;
      }

      const runIndex =
        currentItem.runIndex ??
        (this.runExecutionData.resultData.runData[executionNode.name]?.length || 0);

      if (this.hooks.onNodeExecuteBefore) {
        await this.hooks.onNodeExecuteBefore(executionNode.name);
      }
      if (this.hooks.stepDelayMs) {
        await sleep(this.hooks.stepDelayMs);
      }

      const startTime = Date.now();
      let nodeSuccessData: INodeExecutionData[][] = [];

      try {
        // Check Pinned Data first (`workflow-execute.js` L925-928)
        if (
          pinData &&
          !executionNode.disabled &&
          pinData[executionNode.name] !== undefined &&
          pinData[executionNode.name].length > 0
        ) {
          nodeSuccessData = [pinData[executionNode.name]];
        } else {
          nodeSuccessData = await this.runNode(workflow, currentItem, runIndex);
        }

        const taskData: ITaskData = {
          startTime,
          executionTime: Math.max(6, Date.now() - startTime),
          executionIndex: this.currentExecutionIndex++,
          executionStatus: 'success',
          source: currentItem.source?.main ?? [],
          data: {
            main: nodeSuccessData,
          },
        };

        this.runExecutionData.resultData.runData[executionNode.name] ??= [];
        this.runExecutionData.resultData.runData[executionNode.name].push(taskData);
        this.runExecutionData.resultData.lastNodeExecuted = executionNode.name;

        if (this.hooks.onNodeExecuteAfter) {
          await this.hooks.onNodeExecuteAfter(executionNode.name, taskData);
        }

        // Stop propagating if we reached the explicit destinationNode
        if (
          this.runExecutionData.startData?.destinationNode &&
          executionNode.name === this.runExecutionData.startData.destinationNode
        ) {
          continue;
        }

        // Enqueue downstream connections (`workflow.connectionsBySourceNode`)
        const outgoingMain =
          workflow.connectionsBySourceNode[executionNode.name]?.main ?? [];

        for (
          let outputIndex = 0;
          outputIndex < outgoingMain.length;
          outputIndex++
        ) {
          const outputItems = nodeSuccessData[outputIndex];
          if (!outputItems || outputItems.length === 0) {
            continue;
          }

          const targets = outgoingMain[outputIndex] ?? [];
          for (const connectionData of targets) {
            // Avoid infinite loop on backward edges once destination has already executed twice
            const targetRuns =
              this.runExecutionData.resultData.runData[connectionData.node]
                ?.length ?? 0;
            const sourceX = executionNode.position[0];
            const targetNodeObj = workflow.nodes[connectionData.node];
            const isBackwardEdge =
              targetNodeObj && sourceX - 20 > targetNodeObj.position[0];

            if (isBackwardEdge && targetRuns >= 2) {
              continue;
            }

            this.addNodeToBeExecuted(
              workflow,
              connectionData,
              outputIndex,
              executionNode.name,
              nodeSuccessData,
              runIndex,
            );
          }
        }
      } catch (err: any) {
        const errorObj = {
          message: err?.message || String(err),
          stack: err?.stack,
        };
        const errorTask: ITaskData = {
          startTime,
          executionTime: Math.max(2, Date.now() - startTime),
          executionIndex: this.currentExecutionIndex++,
          executionStatus: 'error',
          source: currentItem.source?.main ?? [],
          error: errorObj,
        };
        this.runExecutionData.resultData.runData[executionNode.name] ??= [];
        this.runExecutionData.resultData.runData[executionNode.name].push(errorTask);
        this.runExecutionData.resultData.lastNodeExecuted = executionNode.name;
        this.runExecutionData.resultData.error = {
          ...errorObj,
          nodeName: executionNode.name,
        };
        this.status = 'error';

        if (this.hooks.onNodeExecuteAfter) {
          await this.hooks.onNodeExecuteAfter(executionNode.name, errorTask);
        }
        break;
      }
    }

    if (this.status === 'running') {
      this.status = 'success';
    }
    if (this.hooks.onWorkflowFinish) {
      this.hooks.onWorkflowFinish(this.runExecutionData);
    }

    return this.runExecutionData;
  }
}

