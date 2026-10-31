// ============================================================================
// n8n-workflow Graph Model & Expression Resolver
// Reconstructed from:
// - n8n-workflow/dist/cjs/workflow.js (Evidence ID: ev_811f0c8f9a781d302d1b14a4ad5c9e0d6e228265d28510d741c4a3daaaa73586)
// - n8n-workflow/dist/cjs/workflow-data-proxy.js
// ============================================================================

import {
  IConnections,
  IDataObject,
  INode,
  INodeParameters,
  IPinData,
  IRunData,
  IWorkflowData,
  IWorkflowSettings,
  NodeConnectionType,
} from './types';
import { getNodeTypeDescription } from './nodeTypes';

export class Workflow {
  public id: string;
  public name: string;
  public active: boolean;
  public nodes: Record<string, INode> = {};
  public connectionsBySourceNode: IConnections = {};
  public connectionsByDestinationNode: IConnections = {};
  public pinData: IPinData = {};
  public settings: IWorkflowSettings = { executionOrder: 'v1' };

  constructor(data: IWorkflowData) {
    this.id = data.id;
    this.name = data.name;
    this.active = data.active;
    this.settings = data.settings ?? { executionOrder: 'v1' };
    this.setNodes(data.nodes);
    this.setConnections(data.connections);
    this.setPinData(data.pinData ?? {});
  }

  public setNodes(nodes: INode[]): void {
    this.nodes = {};
    for (const node of nodes) {
      const desc = getNodeTypeDescription(node.type);
      const mergedParams: INodeParameters = {};
      for (const prop of desc.properties) {
        mergedParams[prop.name] =
          node.parameters[prop.name] !== undefined
            ? node.parameters[prop.name]
            : prop.default;
      }
      this.nodes[node.name] = {
        ...node,
        parameters: { ...mergedParams, ...node.parameters },
      };
    }
  }

  public setConnections(connections: IConnections): void {
    this.connectionsBySourceNode = connections;
    this.connectionsByDestinationNode = Workflow.getConnectionsByDestination(
      this.connectionsBySourceNode,
    );
  }

  public setPinData(pinData: IPinData): void {
    this.pinData = pinData;
  }

  /**
   * Direct port of `Workflow.getConnectionsByDestination` from `n8n-workflow/dist/cjs/workflow.js` L135-172
   */
  public static getConnectionsByDestination(connections: IConnections): IConnections {
    const returnConnection: IConnections = {};

    for (const sourceNode of Object.keys(connections)) {
      const byType = connections[sourceNode];
      if (!byType) continue;

      for (const typeKey of Object.keys(byType) as NodeConnectionType[]) {
        const outputBranches = byType[typeKey];
        if (!outputBranches) continue;

        for (let outputIndex = 0; outputIndex < outputBranches.length; outputIndex++) {
          const targets = outputBranches[outputIndex] ?? [];
          for (const connectionInfo of targets) {
            if (!returnConnection[connectionInfo.node]) {
              returnConnection[connectionInfo.node] = {};
            }
            if (!returnConnection[connectionInfo.node][connectionInfo.type]) {
              returnConnection[connectionInfo.node][connectionInfo.type] = [];
            }

            const destBranches =
              returnConnection[connectionInfo.node][connectionInfo.type]!;
            const maxIndex = destBranches.length - 1;
            for (let j = maxIndex; j < connectionInfo.index; j++) {
              destBranches.push([]);
            }

            destBranches[connectionInfo.index]?.push({
              node: sourceNode,
              type: typeKey,
              index: outputIndex,
            });
          }
        }
      }
    }

    return returnConnection;
  }

  public getNode(nodeName: string): INode | null {
    return this.nodes[nodeName] ?? null;
  }

  public getTriggerNodes(): INode[] {
    return Object.values(this.nodes).filter((node) => {
      if (node.disabled) return false;
      const desc = getNodeTypeDescription(node.type);
      return !!desc.isTrigger;
    });
  }

  /**
   * Finds the starting trigger node for full or partial execution (`getStartNode` in `n8n-workflow`).
   */
  public getStartNode(destinationNode?: string): INode | undefined {
    if (destinationNode) {
      const destNode = this.nodes[destinationNode];
      if (destNode) {
        const desc = getNodeTypeDescription(destNode.type);
        if (desc.isTrigger) return destNode;
      }
      const parents = this.getParentNodes(destinationNode);
      for (const parentName of parents) {
        const node = this.nodes[parentName];
        if (node && !node.disabled) {
          const desc = getNodeTypeDescription(node.type);
          if (desc.isTrigger) return node;
        }
      }
      // Fallback to highest ancestor
      if (parents.length > 0) {
        const rootName = parents[parents.length - 1];
        return this.nodes[rootName];
      }
    }

    const triggers = this.getTriggerNodes();
    if (triggers.length > 0) {
      return triggers[0];
    }

    return Object.values(this.nodes).find((n) => !n.disabled && !getNodeTypeDescription(n.type).isSticky);
  }

  /**
   * Traverses `connectionsByDestinationNode` backwards (`getParentNodes` in `n8n-workflow`).
   */
  public getParentNodes(
    nodeName: string,
    type: NodeConnectionType | 'ALL' = 'main',
    depth = -1,
  ): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (current: string, currentDepth: number) => {
      if (depth !== -1 && currentDepth === 0) return;
      const incomingByType = this.connectionsByDestinationNode[current];
      if (!incomingByType) return;

      const typesToCheck =
        type === 'ALL'
          ? (Object.keys(incomingByType) as NodeConnectionType[])
          : [type];

      for (const connType of typesToCheck) {
        const branches = incomingByType[connType] ?? [];
        for (const branch of branches) {
          for (const conn of branch ?? []) {
            if (!visited.has(conn.node)) {
              visited.add(conn.node);
              result.push(conn.node);
              visit(conn.node, currentDepth - 1);
            }
          }
        }
      }
    };

    visit(nodeName, depth);
    return result;
  }

  /**
   * Traverses `connectionsBySourceNode` forwards (`getChildNodes` in `n8n-workflow`).
   */
  public getChildNodes(
    nodeName: string,
    type: NodeConnectionType | 'ALL' = 'main',
    depth = -1,
  ): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (current: string, currentDepth: number) => {
      if (depth !== -1 && currentDepth === 0) return;
      const outgoingByType = this.connectionsBySourceNode[current];
      if (!outgoingByType) return;

      const typesToCheck =
        type === 'ALL'
          ? (Object.keys(outgoingByType) as NodeConnectionType[])
          : [type];

      for (const connType of typesToCheck) {
        const branches = outgoingByType[connType] ?? [];
        for (const branch of branches) {
          for (const conn of branch ?? []) {
            if (!visited.has(conn.node)) {
              visited.add(conn.node);
              result.push(conn.node);
              visit(conn.node, currentDepth - 1);
            }
          }
        }
      }
    };

    visit(nodeName, depth);
    return result;
  }

  /**
   * Evaluates n8n expressions (`={{ $json.foo }}`, `={{ $parameter["bar"] }}`, `={{ $node["Name"].json.baz }}`)
   * Inspired by `Expression` & `WorkflowDataProxy` in `n8n-workflow`.
   */
  public evaluateExpression(
    rawExpression: unknown,
    context: {
      currentNode: INode;
      itemJson: IDataObject;
      runData?: IRunData;
      itemIndex?: number;
    },
  ): any {
    if (typeof rawExpression !== 'string') {
      return rawExpression;
    }

    const trimmed = rawExpression.trim();
    if (!trimmed.startsWith('=') && !trimmed.includes('{{')) {
      return rawExpression;
    }

    const normalized = trimmed.startsWith('=') ? trimmed.slice(1) : trimmed;

    // Build proxy variables matching WorkflowDataProxy
    const $json = context.itemJson ?? {};
    const $parameter = context.currentNode.parameters ?? {};
    const $itemIndex = context.itemIndex ?? 0;
    const $now = new Date().toISOString();

    const $node: Record<string, { json: IDataObject }> = {};
    if (context.runData) {
      for (const [nName, tasks] of Object.entries(context.runData)) {
        const lastTask = tasks[tasks.length - 1];
        const firstOutput = lastTask?.data?.main?.[0]?.[0]?.json ?? {};
        $node[nName] = { json: firstOutput };
      }
    }

    // If the entire string is a single `{{ ... }}` block, return the raw evaluated value (number/boolean/object)
    const singleMatch = normalized.match(/^\{\{([\s\S]+?)\}\}$/);
    if (singleMatch) {
      try {
        const fn = new Function(
          '$json',
          '$parameter',
          '$node',
          '$itemIndex',
          '$now',
          `return (${singleMatch[1].trim()});`,
        );
        return fn($json, $parameter, $node, $itemIndex, $now);
      } catch {
        return rawExpression;
      }
    }

    // Otherwise interpolate multiple `{{ ... }}` blocks inside the string
    return normalized.replace(/\{\{([\s\S]+?)\}\}/g, (_match, exprCode) => {
      try {
        const fn = new Function(
          '$json',
          '$parameter',
          '$node',
          '$itemIndex',
          '$now',
          `return (${exprCode.trim()});`,
        );
        const val = fn($json, $parameter, $node, $itemIndex, $now);
        return val === undefined || val === null
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      } catch {
        return _match;
      }
    });
  }
}

