// ============================================================================
// n8n Canvas Geometry, Node Sizing, Handle Positioning & Edge Routing Engine
// Reconstructed from:
// - n8n-editor-ui/dist/assets/useTelemetry-BxbCYDca.js (L25175-L25433)
// - n8n-editor-ui/dist/assets/Canvas-Td0SIV0U.js (L965-L988, L10857-L10991)
// ============================================================================

import { IConnections, INode, NodeConnectionType } from './types';
import { getNodeTypeDescription } from './nodeTypes';

export const GRID_SIZE = 16;
export const DEFAULT_NODE_SIZE: [number, number] = [96, 96];
export const CONFIGURATION_NODE_SIZE: [number, number] = [80, 80];
export const CONFIGURABLE_NODE_SIZE: [number, number] = [256, 96];

export const EDGE_PADDING_BOTTOM = 130;
export const EDGE_PADDING_X = 40;
export const EDGE_BORDER_RADIUS = 16;
export const HANDLE_SIZE = 20;

export function snapToGrid(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

/**
 * Direct port of `calculateNodeSize` from `useTelemetry-BxbCYDca.js` L25420-25433
 * Extended with custom shape dimensions for non-technical AI Agent blocks (Prompt Pill, Gateway Capsule, Skill Hexagon, MCP Shield, Output Card).
 */
export function getNodeDimensions(node: INode): { width: number; height: number } {
  const desc = getNodeTypeDescription(node.type);

  if (desc.isSticky) {
    return {
      width: Number(node.parameters.width) || 280,
      height: Number(node.parameters.height) || 160,
    };
  }

  switch (desc.shapeVariant) {
    case 'prompt-pill':
      return { width: 208, height: 80 };
    case 'agent-card':
      return { width: 256, height: 96 };
    case 'gateway-capsule':
      return { width: 176, height: 72 };
    case 'skill-hexagon':
      return { width: 176, height: 76 };
    case 'mcp-shield':
      return { width: 176, height: 76 };
    case 'output-card':
      return { width: 208, height: 80 };
    case 'circle':
      return { width: 96, height: 96 };
    default:
      break;
  }

  const mainInputCount = desc.inputs.filter((i) => i.type === 'main').length;
  const mainOutputCount = desc.outputs.filter((o) => o.type === 'main').length;
  const nonMainInputCount = desc.inputs.filter((i) => i.type !== 'main').length;

  const defaultWidth = DEFAULT_NODE_SIZE[0];
  const defaultHeight = DEFAULT_NODE_SIZE[1];
  const configWidth = CONFIGURATION_NODE_SIZE[0];
  const configHeight = CONFIGURATION_NODE_SIZE[1];

  const height =
    defaultHeight +
    Math.max(0, Math.max(mainInputCount, mainOutputCount, 1) - 2) * (GRID_SIZE * 2);

  if (desc.isConfigurable) {
    const width =
      configWidth +
      GRID_SIZE *
        ((desc.isConfiguration ? 1 : 0) + (Math.max(4, nonMainInputCount) - 1) * 3);
    return { width, height };
  }

  if (desc.isConfiguration) {
    return { width: configWidth, height: configHeight };
  }

  return { width: defaultWidth, height };
}

export interface HandleDescriptor {
  mode: 'inputs' | 'outputs';
  type: NodeConnectionType;
  index: number;
  position: 'left' | 'right' | 'top' | 'bottom';
  offsetX: number;
  offsetY: number;
  label?: string;
  required?: boolean;
}

/**
 * Computes exact port positions around the node perimeter matching `useCanvasNode` handles.
 */
export function getNodeHandles(node: INode): HandleDescriptor[] {
  const desc = getNodeTypeDescription(node.type);
  if (desc.isSticky) return [];

  const { width, height } = getNodeDimensions(node);
  const handles: HandleDescriptor[] = [];

  // 1. Inputs
  const mainInputs = desc.inputs.filter((i) => i.type === 'main');
  const nonMainInputs = desc.inputs.filter((i) => i.type !== 'main');

  mainInputs.forEach((port, idx) => {
    const step = height / (mainInputs.length + 1);
    handles.push({
      mode: 'inputs',
      type: port.type,
      index: idx,
      position: 'left',
      offsetX: 0,
      offsetY: Math.round(step * (idx + 1)),
      label: mainInputs.length > 1 ? port.displayName : undefined,
      required: port.required,
    });
  });

  nonMainInputs.forEach((port, idx) => {
    const step = width / (nonMainInputs.length + 1);
    handles.push({
      mode: 'inputs',
      type: port.type,
      index: idx,
      position: 'bottom',
      offsetX: Math.round(step * (idx + 1)),
      offsetY: height,
      label: port.displayName,
      required: port.required,
    });
  });

  // 2. Outputs
  const mainOutputs = desc.outputs.filter((o) => o.type === 'main');
  const nonMainOutputs = desc.outputs.filter((o) => o.type !== 'main');

  mainOutputs.forEach((port, idx) => {
    const step = height / (mainOutputs.length + 1);
    handles.push({
      mode: 'outputs',
      type: port.type,
      index: idx,
      position: 'right',
      offsetX: width,
      offsetY: Math.round(step * (idx + 1)),
      label: mainOutputs.length > 1 ? port.displayName : undefined,
    });
  });

  nonMainOutputs.forEach((port, idx) => {
    const step = width / (nonMainOutputs.length + 1);
    handles.push({
      mode: 'outputs',
      type: port.type,
      index: idx,
      position: 'top',
      offsetX: Math.round(step * (idx + 1)),
      offsetY: 0,
      label: port.displayName,
    });
  });

  return handles;
}

/**
 * Direct port of `isValidConnection` from `Canvas-Td0SIV0U.js` L12008-12016
 */
export function isValidHandleConnection(
  sourceNodeName: string,
  sourceMode: 'inputs' | 'outputs',
  sourceType: NodeConnectionType,
  targetNodeName: string,
  targetMode: 'inputs' | 'outputs',
  targetType: NodeConnectionType,
): boolean {
  if (sourceNodeName === targetNodeName) return false;
  return sourceMode !== targetMode && sourceType === targetType;
}

/**
 * Generates a Cubic Bezier SVG path matching `@vue-flow/core` `getBezierPath`.
 */
export function computeBezierPath(
  sourceX: number,
  sourceY: number,
  sourcePosition: 'left' | 'right' | 'top' | 'bottom',
  targetX: number,
  targetY: number,
  targetPosition: 'left' | 'right' | 'top' | 'bottom',
): { path: string; labelX: number; labelY: number } {
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  const curvature = 0.35;

  let c1x = sourceX;
  let c1y = sourceY;
  let c2x = targetX;
  let c2y = targetY;

  const horizontalOffset = Math.max(dx * curvature, 48);
  const verticalOffset = Math.max(dy * curvature, 48);

  if (sourcePosition === 'right') c1x += horizontalOffset;
  if (sourcePosition === 'left') c1x -= horizontalOffset;
  if (sourcePosition === 'bottom') c1y += verticalOffset;
  if (sourcePosition === 'top') c1y -= verticalOffset;

  if (targetPosition === 'left') c2x -= horizontalOffset;
  if (targetPosition === 'right') c2x += horizontalOffset;
  if (targetPosition === 'top') c2y -= verticalOffset;
  if (targetPosition === 'bottom') c2y += verticalOffset;

  const path = `M ${sourceX},${sourceY} C ${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`;
  const labelX = sourceX * 0.125 + c1x * 0.375 + c2x * 0.375 + targetX * 0.125;
  const labelY = sourceY * 0.125 + c1y * 0.375 + c2y * 0.375 + targetY * 0.125;

  return { path, labelX, labelY };
}

/**
 * Direct port of `getEdgeRenderData` from `Canvas-Td0SIV0U.js` L10857-L10903:
 * - Forward connections (`!(sourceX - HANDLE_SIZE > targetX)` or non-main): single Cubic Bezier path
 * - Backward / Loop connections (`sourceX - HANDLE_SIZE > targetX` on `main`): 2-segment SmoothStep path looping below the nodes
 */
export function getEdgeRenderData(params: {
  sourceX: number;
  sourceY: number;
  sourcePosition: 'left' | 'right' | 'top' | 'bottom';
  targetX: number;
  targetY: number;
  targetPosition: 'left' | 'right' | 'top' | 'bottom';
  connectionType: NodeConnectionType;
}): {
  segments: string[];
  labelPosition: [number, number];
  isConnectorStraight: boolean;
  isBackwardLoop: boolean;
} {
  const {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    connectionType,
  } = params;

  const isBackward = sourceX - HANDLE_SIZE > targetX;

  if (!isBackward || connectionType !== 'main') {
    const bezier = computeBezierPath(
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    );
    return {
      segments: [bezier.path],
      labelPosition: [bezier.labelX, bezier.labelY],
      isConnectorStraight: sourceY === targetY,
      isBackwardLoop: false,
    };
  }

  // Backward loop connection: 2 smooth-step segments routed underneath (`EDGE_PADDING_BOTTOM = 130`)
  const bottomY = Math.max(sourceY, targetY) + EDGE_PADDING_BOTTOM;
  const midX = (sourceX + targetX) / 2;
  const r = EDGE_BORDER_RADIUS;
  const rightOutX = sourceX + EDGE_PADDING_X;
  const leftInX = targetX - EDGE_PADDING_X;

  const firstSegment = [
    `M ${sourceX},${sourceY}`,
    `L ${rightOutX - r},${sourceY}`,
    `Q ${rightOutX},${sourceY} ${rightOutX},${sourceY + r}`,
    `L ${rightOutX},${bottomY - r}`,
    `Q ${rightOutX},${bottomY} ${rightOutX - r},${bottomY}`,
    `L ${midX},${bottomY}`,
  ].join(' ');

  const secondSegment = [
    `M ${midX},${bottomY}`,
    `L ${leftInX + r},${bottomY}`,
    `Q ${leftInX},${bottomY} ${leftInX},${bottomY - r}`,
    `L ${leftInX},${targetY + r}`,
    `Q ${leftInX},${targetY} ${leftInX + r},${targetY}`,
    `L ${targetX},${targetY}`,
  ].join(' ');

  return {
    segments: [firstSegment, secondSegment],
    labelPosition: [midX, bottomY],
    isConnectorStraight: false,
    isBackwardLoop: true,
  };
}

/**
 * Auto-layout (`Tidy Up Workflow` / `Shift+Alt+T`) snapping nodes to the 16px grid.
 */
export function tidyUpWorkflowNodes(
  nodes: INode[],
  connections: IConnections,
): INode[] {
  const rankMap = new Map<string, number>();
  const nonStickyNodes = nodes.filter(
    (n) => !getNodeTypeDescription(n.type).isSticky && !getNodeTypeDescription(n.type).isConfiguration,
  );

  nonStickyNodes.forEach((n) => {
    if (getNodeTypeDescription(n.type).isTrigger) {
      rankMap.set(n.name, 0);
    }
  });

  // Propagate topological ranks across main connections
  for (let iter = 0; iter < nonStickyNodes.length; iter++) {
    for (const [sourceName, byType] of Object.entries(connections)) {
      const srcRank = rankMap.get(sourceName) ?? 0;
      const branches = byType.main ?? [];
      for (const branch of branches) {
        for (const conn of branch ?? []) {
          const prev = rankMap.get(conn.node) ?? 0;
          if (srcRank + 1 > prev && srcRank < 12) {
            rankMap.set(conn.node, srcRank + 1);
          }
        }
      }
    }
  }

  const columns = new Map<number, INode[]>();
  for (const node of nonStickyNodes) {
    const r = rankMap.get(node.name) ?? 0;
    const list = columns.get(r) ?? [];
    list.push(node);
    columns.set(r, list);
  }

  const updatedPositions = new Map<string, [number, number]>();
  const startX = 144;
  const startY = 208;
  const colSpacing = 320;
  const rowSpacing = 176;

  for (const [colIdx, colNodes] of columns.entries()) {
    colNodes.forEach((n, rowIdx) => {
      const yOffset = (rowIdx - (colNodes.length - 1) / 2) * rowSpacing;
      updatedPositions.set(n.name, [
        snapToGrid(startX + colIdx * colSpacing),
        snapToGrid(startY + yOffset),
      ]);
    });
  }

  // Group AI Configuration sub-nodes by their parent AI Agent so multiple Skills/MCPs never overlap
  const subNodesByParent = new Map<
    string,
    Array<{ name: string; connType: string }>
  >();
  for (const [sourceName, byType] of Object.entries(connections)) {
    const subNode = nodes.find((n) => n.name === sourceName);
    if (!subNode || !getNodeTypeDescription(subNode.type).isConfiguration) continue;

    for (const [connType, branches] of Object.entries(byType)) {
      if (connType === 'main') continue;
      const targetName = branches?.[0]?.[0]?.node;
      if (targetName && updatedPositions.has(targetName)) {
        const list = subNodesByParent.get(targetName) ?? [];
        list.push({ name: sourceName, connType });
        subNodesByParent.set(targetName, list);
      }
    }
  }

  for (const [parentName, children] of subNodesByParent.entries()) {
    const [parentX, parentY] = updatedPositions.get(parentName)!;
    const orderWeight = (t: string) =>
      t === 'ai_languageModel' ? 0 : t === 'ai_memory' ? 1 : 2;
    children.sort((a, b) => orderWeight(a.connType) - orderWeight(b.connType));

    const subSpacing = 208;
    children.forEach((child, idx) => {
      const xOffset = (idx - (children.length - 1) / 2) * subSpacing;
      updatedPositions.set(child.name, [
        snapToGrid(parentX + 40 + xOffset),
        snapToGrid(parentY + 192),
      ]);
    });
  }

  return nodes.map((node) => {
    const nextPos = updatedPositions.get(node.name);
    return nextPos ? { ...node, position: nextPos } : node;
  });
}

