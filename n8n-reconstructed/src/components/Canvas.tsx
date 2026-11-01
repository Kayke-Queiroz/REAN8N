import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Hand,
  Map as MapIcon,
  Maximize2,
  MoreHorizontal,
  MousePointer,
  Pin,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  IConnections,
  INode,
  IPinData,
  IRunData,
  NodeConnectionType,
} from '../engine/types';
import { getNodeTypeDescription } from '../engine/nodeTypes';
import {
  computeBezierPath,
  getEdgeRenderData,
  getNodeDimensions,
  getNodeHandles,
  GRID_SIZE,
  HandleDescriptor,
  isValidHandleConnection,
  snapToGrid,
} from '../engine/geometry';
import { NodeIcon } from './NodeIcon';
import { Workflow } from '../engine/workflow';

export interface EdgeConnectionContext {
  sourceNode: string;
  sourceOutputIndex: number;
  connectionType: NodeConnectionType;
  targetNode?: string;
  targetInputIndex?: number;
  position: [number, number];
}

interface CanvasProps {
  workflowId: string;
  workflowModel: Workflow;
  nodes: INode[];
  connections: IConnections;
  runData: IRunData;
  pinData: IPinData;
  runningNodeName: string | null;
  selectedNodeNames: string[];
  onSelectNodes: (names: string[]) => void;
  onUpdateNodePosition: (nodeName: string, position: [number, number]) => void;
  onOpenNodeDetails: (nodeName: string) => void;
  onExecuteSingleNode: (nodeName: string) => void;
  onToggleDisableNode: (nodeName: string) => void;
  onTogglePinNode: (nodeName: string) => void;
  onDuplicateNode: (nodeName: string) => void;
  onDeleteNode: (nodeName: string) => void;
  onConnect: (
    sourceNode: string,
    sourceType: NodeConnectionType,
    sourceIndex: number,
    targetNode: string,
    targetType: NodeConnectionType,
    targetIndex: number,
  ) => void;
  onDeleteConnection: (
    sourceNode: string,
    connType: NodeConnectionType,
    outputIndex: number,
    targetNode: string,
    targetIndex: number,
  ) => void;
  onOpenCreatorFromContext: (ctx: EdgeConnectionContext) => void;
  onDropNodeType?: (nodeTypeName: string, position: [number, number]) => void;
  onTidyUp: () => void;
}

interface PointerInteractionState {
  type: 'pan' | 'node';
  nodeName?: string;
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  isDragging: boolean;
}

interface MinimapViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
  offset: number;
  viewScale: number;
}

interface MinimapDragState {
  startClientX: number;
  startClientY: number;
  initialViewportX: number;
  initialViewportY: number;
  clickWorldX: number;
  clickWorldY: number;
  worldUnitsPerPx: number;
  frozenViewBox: MinimapViewBox;
  hasDragged: boolean;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 120;
const MINIMAP_OFFSET_SCALE = 5;
const MINIMAP_NODE_RX = 16;

interface SnappedTargetHandle {
  nodeName: string;
  mode: 'inputs' | 'outputs';
  type: NodeConnectionType;
  index: number;
  position: 'left' | 'right' | 'top' | 'bottom';
  x: number;
  y: number;
}

interface ConnectingState {
  sourceNode: string;
  sourceMode: 'inputs' | 'outputs';
  sourceType: NodeConnectionType;
  sourceIndex: number;
  sourcePosition: 'left' | 'right' | 'top' | 'bottom';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  snappedTarget?: SnappedTargetHandle | null;
}

const DRAG_THRESHOLD_PX = 5;

export const Canvas: React.FC<CanvasProps> = ({
  workflowId,
  workflowModel,
  nodes,
  connections,
  runData,
  pinData,
  runningNodeName,
  selectedNodeNames,
  onSelectNodes,
  onUpdateNodePosition,
  onOpenNodeDetails,
  onExecuteSingleNode,
  onToggleDisableNode,
  onTogglePinNode,
  onDuplicateNode,
  onDeleteNode,
  onConnect,
  onDeleteConnection,
  onOpenCreatorFromContext,
  onDropNodeType,
  onTidyUp,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 60, y: 40, zoom: 0.9 });
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 700 });

  // Interaction mode: 'select' (default pointer) or 'pan' (hand tool)
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [isActivelyPanning, setIsActivelyPanning] = useState(false);

  // Ref-backed pointer state so window mousemove/mouseup never read stale closures or get stuck
  const interactionRef = useRef<PointerInteractionState | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const [connecting, setConnecting] = useState<ConnectingState | null>(null);
  const connectingRef = useRef<ConnectingState | null>(null);
  connectingRef.current = connecting;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const edgeHoverTimeoutRef = useRef<number | null>(null);

  // Keep Minimap visible by default so the user can always see the overview map
  const [showMinimap, setShowMinimap] = useState(true);
  const minimapDragRef = useRef<MinimapDragState | null>(null);
  const [frozenMinimapView, setFrozenMinimapView] =
    useState<MinimapViewBox | null>(null);
  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  // Track container dimensions for accurate Zoom & Minimap viewport rectangle
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return [0, 0];
      const v = viewportRef.current;
      return [
        (clientX - rect.left - v.x) / v.zoom,
        (clientY - rect.top - v.y) / v.zoom,
      ];
    },
    [],
  );

  // Fit View (`1` shortcut or Zoom to Fit button)
  const handleFitView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const { width, height } = getNodeDimensions(node);
      minX = Math.min(minX, node.position[0]);
      minY = Math.min(minY, node.position[1]);
      maxX = Math.max(maxX, node.position[0] + width);
      maxY = Math.max(maxY, node.position[1] + height + 56);
    }

    const contentW = Math.max(400, maxX - minX + 200);
    const contentH = Math.max(300, maxY - minY + 180);
    const nextZoom = Math.min(
      1.15,
      Math.max(0.35, Math.min(rect.width / contentW, rect.height / contentH)),
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setViewport({
      zoom: Number(nextZoom.toFixed(2)),
      x: Math.round(rect.width / 2 - centerX * nextZoom),
      y: Math.round(rect.height / 2 - centerY * nextZoom),
    });
  }, [nodes]);

  // Automatically fit view when workflow template changes
  useEffect(() => {
    const id = window.setTimeout(() => {
      handleFitView();
    }, 40);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // Zoom around the center of the visible canvas (used by Lupa ZoomIn / ZoomOut buttons)
  const zoomAroundCenter = useCallback((factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 600;
    const cy = rect ? rect.height / 2 : 350;

    setViewport((v) => {
      const nextZoom = Math.min(2.2, Math.max(0.25, +(v.zoom * factor).toFixed(3)));
      const nextX = Math.round(cx - ((cx - v.x) / v.zoom) * nextZoom);
      const nextY = Math.round(cy - ((cy - v.y) / v.zoom) * nextZoom);
      return { x: nextX, y: nextY, zoom: nextZoom };
    });
  }, []);

  // Global window mousemove / mouseup / blur listeners to prevent stuck drag/pan states
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      // Safety guard: if no mouse button is pressed (`e.buttons === 0`), immediately release everything!
      if (e.buttons === 0) {
        if (interactionRef.current) {
          interactionRef.current = null;
          setIsActivelyPanning(false);
        }
        if (minimapDragRef.current) {
          minimapDragRef.current = null;
          setFrozenMinimapView(null);
        }
        if (connectingRef.current) {
          setConnecting(null);
        }
        return;
      }

      const minimapActive = minimapDragRef.current;
      if (minimapActive) {
        const dx = e.clientX - minimapActive.startClientX;
        const dy = e.clientY - minimapActive.startClientY;
        if (!minimapActive.hasDragged && Math.hypot(dx, dy) >= 2) {
          minimapActive.hasDragged = true;
        }
        if (minimapActive.hasDragged) {
          setViewport((v) => ({
            ...v,
            x: Math.round(
              minimapActive.initialViewportX -
                dx * minimapActive.worldUnitsPerPx * v.zoom,
            ),
            y: Math.round(
              minimapActive.initialViewportY -
                dy * minimapActive.worldUnitsPerPx * v.zoom,
            ),
          }));
        }
        return;
      }

      const active = interactionRef.current;
      if (active) {
        const rawDx = e.clientX - active.startClientX;
        const rawDy = e.clientY - active.startClientY;

        if (!active.isDragging) {
          if (Math.hypot(rawDx, rawDy) < DRAG_THRESHOLD_PX) {
            return;
          }
          active.isDragging = true;
          if (active.type === 'pan') {
            setIsActivelyPanning(true);
          }
        }

        if (active.type === 'pan') {
          setViewport((v) => ({
            ...v,
            x: active.initialX + rawDx,
            y: active.initialY + rawDy,
          }));
        } else if (active.type === 'node' && active.nodeName) {
          const z = viewportRef.current.zoom;
          const snappedX = snapToGrid(active.initialX + rawDx / z, GRID_SIZE);
          const snappedY = snapToGrid(active.initialY + rawDy / z, GRID_SIZE);
          onUpdateNodePosition(active.nodeName, [snappedX, snappedY]);
        }
        return;
      }

      if (connectingRef.current) {
        const currConn = connectingRef.current;
        const [cx, cy] = screenToCanvas(e.clientX, e.clientY);

        // Find magnetic snap target (either within 48px of a compatible port OR hovering anywhere over a compatible node)
        let bestTarget: SnappedTargetHandle | null = null;
        let bestScore = Infinity;

        for (const candidateNode of nodesRef.current) {
          if (candidateNode.name === currConn.sourceNode) continue;
          const desc = getNodeTypeDescription(candidateNode.type);
          if (desc.isSticky) continue;

          const { width, height } = getNodeDimensions(candidateNode);
          const nx = candidateNode.position[0];
          const ny = candidateNode.position[1];
          const isCursorOverNodeBody =
            cx >= nx - 24 &&
            cx <= nx + width + 24 &&
            cy >= ny - 24 &&
            cy <= ny + height + 24;

          const candidateHandles = getNodeHandles(candidateNode);
          for (const h of candidateHandles) {
            if (
              !isValidHandleConnection(
                currConn.sourceNode,
                currConn.sourceMode,
                currConn.sourceType,
                candidateNode.name,
                h.mode,
                h.type,
              )
            ) {
              continue;
            }

            const hx = nx + h.offsetX;
            const hy = ny + h.offsetY;
            const distToPort = Math.hypot(cx - hx, cy - hy);

            if (distToPort <= 48 || isCursorOverNodeBody) {
              // Prioritize direct port proximity, or pick closest compatible port on the hovered node
              const score = isCursorOverNodeBody ? distToPort * 0.5 : distToPort;
              if (score < bestScore) {
                bestScore = score;
                bestTarget = {
                  nodeName: candidateNode.name,
                  mode: h.mode,
                  type: h.type,
                  index: h.index,
                  position: h.position,
                  x: hx,
                  y: hy,
                };
              }
            }
          }
        }

        const updated: ConnectingState = {
          ...currConn,
          currentX: bestTarget ? bestTarget.x : cx,
          currentY: bestTarget ? bestTarget.y : cy,
          snappedTarget: bestTarget,
        };
        connectingRef.current = updated;
        setConnecting(updated);
      }
    };

    const stopAllInteractions = () => {
      if (interactionRef.current) {
        const finished = interactionRef.current;
        interactionRef.current = null;
        setIsActivelyPanning(false);

        // Open Right Sidebar ONLY when the user clicked a node WITHOUT dragging it!
        if (
          finished.type === 'node' &&
          !finished.isDragging &&
          finished.nodeName
        ) {
          onOpenNodeDetails(finished.nodeName);
        } else if (
          finished.type === 'pan' &&
          !finished.isDragging
        ) {
          // Deselect nodes only if the user performed a stationary click on the empty canvas
          onSelectNodes([]);
        }
      }
      if (minimapDragRef.current) {
        const dragState = minimapDragRef.current;
        minimapDragRef.current = null;
        setFrozenMinimapView(null);
        // If user clicked without dragging inside the viewport box, center camera on clicked world point
        if (!dragState.hasDragged) {
          const cs = containerSizeRef.current;
          setViewport((v) => ({
            ...v,
            x: Math.round(cs.width / 2 - dragState.clickWorldX * v.zoom),
            y: Math.round(cs.height / 2 - dragState.clickWorldY * v.zoom),
          }));
        }
      }
      if (connectingRef.current) {
        const finishedConn = connectingRef.current;
        connectingRef.current = null;
        setConnecting(null);

        // If magnetically snapped onto a valid target port/node, complete the connection immediately!
        if (finishedConn.snappedTarget) {
          const tgt = finishedConn.snappedTarget;
          if (finishedConn.sourceMode === 'outputs') {
            onConnect(
              finishedConn.sourceNode,
              finishedConn.sourceType,
              finishedConn.sourceIndex,
              tgt.nodeName,
              tgt.type,
              tgt.index,
            );
          } else {
            onConnect(
              tgt.nodeName,
              tgt.type,
              tgt.index,
              finishedConn.sourceNode,
              finishedConn.sourceType,
              finishedConn.sourceIndex,
            );
          }
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', stopAllInteractions);
    window.addEventListener('blur', stopAllInteractions);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', stopAllInteractions);
      window.removeEventListener('blur', stopAllInteractions);
    };
  }, [onConnect, onOpenNodeDetails, onUpdateNodePosition, screenToCanvas]);

  // Keyboard shortcuts matching n8n (`Delete`, `1` fit view, `0` reset zoom, `+`/`-`, `d` disable, `p` pin)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === '1') {
        handleFitView();
      } else if (e.key === '0') {
        setViewport((v) => ({ ...v, zoom: 1 }));
      } else if (e.key === '=' || e.key === '+') {
        zoomAroundCenter(1.15);
      } else if (e.key === '-') {
        zoomAroundCenter(1 / 1.15);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedNodeNames.length > 0
      ) {
        selectedNodeNames.forEach((n) => onDeleteNode(n));
      } else if (e.key.toLowerCase() === 'd' && selectedNodeNames.length === 1) {
        onToggleDisableNode(selectedNodeNames[0]);
      } else if (e.key.toLowerCase() === 'p' && selectedNodeNames.length === 1) {
        onTogglePinNode(selectedNodeNames[0]);
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        onTidyUp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleFitView,
    onDeleteNode,
    onTidyUp,
    onToggleDisableNode,
    onTogglePinNode,
    selectedNodeNames,
    zoomAroundCenter,
  ]);

  // Wheel Zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(2.2, Math.max(0.25, +(viewport.zoom * factor).toFixed(3)));
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nextX = mouseX - ((mouseX - viewport.x) / viewport.zoom) * nextZoom;
    const nextY = mouseY - ((mouseY - viewport.y) / viewport.zoom) * nextZoom;

    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  };

  // Start potential canvas pan (only activates after moving >= 5px)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    interactionRef.current = {
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: viewport.x,
      initialY: viewport.y,
      isDragging: false,
    };
  };

  // Start potential node drag (or canvas pan if Hand tool is active)
  const handleNodeMouseDown = (e: React.MouseEvent, node: INode) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    if (interactionMode === 'pan') {
      interactionRef.current = {
        type: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialX: viewport.x,
        initialY: viewport.y,
        isDragging: false,
      };
      return;
    }

    onSelectNodes([node.name]);
    interactionRef.current = {
      type: 'node',
      nodeName: node.name,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: node.position[0],
      initialY: node.position[1],
      isDragging: false,
    };
  };

  // Precompute all rendered edges with exact coordinates
  const renderedEdges = useMemo(() => {
    const nodeMap = new Map<string, INode>();
    const handleMap = new Map<string, HandleDescriptor[]>();
    for (const n of nodes) {
      nodeMap.set(n.name, n);
      handleMap.set(n.name, getNodeHandles(n));
    }

    const list: Array<{
      id: string;
      sourceNode: string;
      targetNode: string;
      connectionType: NodeConnectionType;
      sourceOutputIndex: number;
      targetInputIndex: number;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      segments: string[];
      labelPosition: [number, number];
      isBackwardLoop: boolean;
      status: 'success' | 'pinned' | 'supplemental' | 'default';
      itemCount: number | null;
      outputLabel?: string;
    }> = [];

    for (const [sourceName, byType] of Object.entries(connections)) {
      const srcNode = nodeMap.get(sourceName);
      const srcHandles = handleMap.get(sourceName);
      if (!srcNode || !srcHandles) continue;

      for (const [connTypeKey, branches] of Object.entries(byType)) {
        const connType = connTypeKey as NodeConnectionType;
        if (!branches) continue;

        branches.forEach((targets, outputIdx) => {
          if (!targets) return;
          const srcHandle = srcHandles.find(
            (h) =>
              h.mode === 'outputs' &&
              h.type === connType &&
              h.index === outputIdx,
          );
          if (!srcHandle) return;

          const sourceX = srcNode.position[0] + srcHandle.offsetX;
          const sourceY = srcNode.position[1] + srcHandle.offsetY;

          targets.forEach((targetConn) => {
            const dstNode = nodeMap.get(targetConn.node);
            const dstHandles = handleMap.get(targetConn.node);
            if (!dstNode || !dstHandles) return;

            const dstHandle = dstHandles.find(
              (h) =>
                h.mode === 'inputs' &&
                h.type === targetConn.type &&
                h.index === targetConn.index,
            );
            if (!dstHandle) return;

            const targetX = dstNode.position[0] + dstHandle.offsetX;
            const targetY = dstNode.position[1] + dstHandle.offsetY;

            const renderData = getEdgeRenderData({
              sourceX,
              sourceY,
              sourcePosition: srcHandle.position,
              targetX,
              targetY,
              targetPosition: dstHandle.position,
              connectionType: connType,
            });

            const srcTasks = runData[sourceName];
            const lastTask = srcTasks?.[srcTasks.length - 1];
            const branchItems = lastTask?.data?.[connType]?.[outputIdx];
            const hasPinned = Boolean(pinData[sourceName]?.length);

            let status: 'success' | 'pinned' | 'supplemental' | 'default' =
              'default';
            let itemCount: number | null = null;

            if (connType !== 'main') {
              status = branchItems ? 'success' : 'supplemental';
            } else if (hasPinned) {
              status = 'pinned';
              itemCount = pinData[sourceName].length;
            } else if (branchItems && branchItems.length > 0) {
              status = 'success';
              itemCount = branchItems.length;
            }

            list.push({
              id: `${sourceName}__${connType}__${outputIdx}__${targetConn.node}__${targetConn.index}`,
              sourceNode: sourceName,
              targetNode: targetConn.node,
              connectionType: connType,
              sourceOutputIndex: outputIdx,
              targetInputIndex: targetConn.index,
              sourceX,
              sourceY,
              targetX,
              targetY,
              segments: renderData.segments,
              labelPosition: renderData.labelPosition,
              isBackwardLoop: renderData.isBackwardLoop,
              status,
              itemCount,
              outputLabel: srcHandle.label,
            });
          });
        });
      }
    }

    return list;
  }, [connections, nodes, pinData, runData]);

  // Authentic n8n `@vue-flow/minimap` geometry (`Canvas-Td0SIV0U.js` L10620-10661)
  const minimapData = useMemo(() => {
    const viewBB = {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      width: containerSize.width / viewport.zoom,
      height: containerSize.height / viewport.zoom,
    };

    let boundingRect = viewBB;

    if (nodes.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const n of nodes) {
        const { width, height } = getNodeDimensions(n);
        minX = Math.min(minX, n.position[0]);
        minY = Math.min(minY, n.position[1]);
        maxX = Math.max(maxX, n.position[0] + width);
        maxY = Math.max(maxY, n.position[1] + height);
      }

      const unionMinX = Math.min(minX, viewBB.x);
      const unionMinY = Math.min(minY, viewBB.y);
      const unionMaxX = Math.max(maxX, viewBB.x + viewBB.width);
      const unionMaxY = Math.max(maxY, viewBB.y + viewBB.height);

      boundingRect = {
        x: unionMinX,
        y: unionMinY,
        width: Math.max(100, unionMaxX - unionMinX),
        height: Math.max(100, unionMaxY - unionMinY),
      };
    }

    const scaledWidth = boundingRect.width / MINIMAP_WIDTH;
    const scaledHeight = boundingRect.height / MINIMAP_HEIGHT;
    const liveViewScale = Math.max(scaledWidth, scaledHeight, 0.1);
    const liveViewWidth = liveViewScale * MINIMAP_WIDTH;
    const liveViewHeight = liveViewScale * MINIMAP_HEIGHT;
    const liveOffset = MINIMAP_OFFSET_SCALE * liveViewScale;

    const liveViewBox: MinimapViewBox = {
      x: boundingRect.x - (liveViewWidth - boundingRect.width) / 2 - liveOffset,
      y: boundingRect.y - (liveViewHeight - boundingRect.height) / 2 - liveOffset,
      width: liveViewWidth + liveOffset * 2,
      height: liveViewHeight + liveOffset * 2,
      offset: liveOffset,
      viewScale: liveViewScale,
    };

    // Freeze viewBox while dragging inside the Minimap so nodes never jitter or oscillate under the cursor
    const activeViewBox = frozenMinimapView ?? liveViewBox;

    // Even-odd SVG mask path covering the outer world and cutting out `viewBB`
    const outerPad = activeViewBox.offset * 20;
    const outerX = activeViewBox.x - outerPad;
    const outerY = activeViewBox.y - outerPad;
    const outerW = activeViewBox.width + outerPad * 2;
    const outerH = activeViewBox.height + outerPad * 2;

    const maskPath = `M${outerX},${outerY} h${outerW} v${outerH} h${-outerW}z M${viewBB.x},${viewBB.y} h${viewBB.width} v${viewBB.height} h${-viewBB.width}z`;

    return {
      viewBB,
      liveViewBox,
      activeViewBox,
      maskPath,
    };
  }, [
    containerSize.height,
    containerSize.width,
    frozenMinimapView,
    nodes,
    viewport.x,
    viewport.y,
    viewport.zoom,
  ]);

  // Start dragging or clicking inside the Minimap (with frozen viewBox so there is zero feedback oscillation)
  const handleMinimapMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;

      const svgRect = e.currentTarget.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;

      const vb = minimapData.activeViewBox;
      const ratioX = (e.clientX - svgRect.left) / svgRect.width;
      const ratioY = (e.clientY - svgRect.top) / svgRect.height;

      const clickWorldX = vb.x + ratioX * vb.width;
      const clickWorldY = vb.y + ratioY * vb.height;
      const worldUnitsPerPx = vb.width / svgRect.width;

      const { viewBB } = minimapData;
      const isInsideViewportWindow =
        clickWorldX >= viewBB.x &&
        clickWorldX <= viewBB.x + viewBB.width &&
        clickWorldY >= viewBB.y &&
        clickWorldY <= viewBB.y + viewBB.height;

      let initialViewportX = viewportRef.current.x;
      let initialViewportY = viewportRef.current.y;

      // If the user clicked outside the current viewport window, immediately jump the window to the cursor and allow seamless dragging from there
      if (!isInsideViewportWindow) {
        const z = viewportRef.current.zoom;
        initialViewportX = Math.round(containerSize.width / 2 - clickWorldX * z);
        initialViewportY = Math.round(containerSize.height / 2 - clickWorldY * z);
        setViewport((v) => ({
          ...v,
          x: initialViewportX,
          y: initialViewportY,
        }));
      }

      setFrozenMinimapView(vb);
      minimapDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialViewportX,
        initialViewportY,
        clickWorldX,
        clickWorldY,
        worldUnitsPerPx,
        frozenViewBox: vb,
        hasDragged: !isInsideViewportWindow,
      };
    },
    [containerSize.height, containerSize.width, minimapData],
  );

  // Wheel zoom directly over the Minimap (`zoomable: true` in n8n)
  const handleMinimapWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.stopPropagation();
      e.preventDefault();
      zoomAroundCenter(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    [zoomAroundCenter],
  );

  // Evaluate subtitle expression (`={{$parameter["method"]}}` etc.)
  const resolveNodeSubtitle = (node: INode): string => {
    const desc = getNodeTypeDescription(node.type);
    if (!desc.subtitle) return '';
    const evaluated = workflowModel.evaluateExpression(desc.subtitle, {
      currentNode: node,
      itemJson: {},
      runData,
    });
    return String(evaluated || '');
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const nodeTypeName = e.dataTransfer.getData('application/n8n-node-type');
        if (nodeTypeName && onDropNodeType) {
          const [wx, wy] = screenToCanvas(e.clientX, e.clientY);
          onDropNodeType(nodeTypeName, [
            snapToGrid(wx - 48, GRID_SIZE),
            snapToGrid(wy - 48, GRID_SIZE),
          ]);
        }
      }}
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 400,
        overflow: 'hidden',
        backgroundColor: 'var(--canvas--color--background)',
        backgroundImage: `radial-gradient(var(--canvas--dot--color) ${Math.max(
          1,
          1.35 * viewport.zoom,
        )}px, transparent 0)`,
        backgroundSize: `${GRID_SIZE * viewport.zoom}px ${
          GRID_SIZE * viewport.zoom
        }px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        cursor: isActivelyPanning
          ? 'grabbing'
          : interactionMode === 'pan'
            ? 'grab'
            : 'default',
      }}
    >
      {/* Transformed Canvas World Plane */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transformOrigin: '0 0',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          pointerEvents: 'none',
        }}
      >
        {/* 1. Sticky Notes Layer (behind edges & nodes) */}
        {nodes
          .filter((n) => getNodeTypeDescription(n.type).isSticky)
          .map((sticky) => {
            const { width, height } = getNodeDimensions(sticky);
            const variant = Number(sticky.parameters.color) || 1;
            const bgVar =
              variant === 1
                ? 'var(--sticky--color--background)'
                : `var(--sticky--color--background--variant-${variant})`;
            const borderVar =
              variant === 1
                ? 'var(--sticky--border--color)'
                : `var(--sticky--border--color--variant-${variant})`;
            const isSelected = selectedNodeNames.includes(sticky.name);

            return (
              <div
                key={sticky.id}
                onMouseDown={(e) => handleNodeMouseDown(e, sticky)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenNodeDetails(sticky.name);
                }}
                style={{
                  position: 'absolute',
                  left: sticky.position[0],
                  top: sticky.position[1],
                  width,
                  height,
                  backgroundColor: bgVar,
                  border: `1.5px solid ${borderVar}`,
                  borderRadius: 'var(--radius--lg)',
                  padding: '12px 14px',
                  color: 'var(--sticky--color--text)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  boxShadow: isSelected
                    ? '0 0 0 6px var(--canvas--color--selected-transparent)'
                    : 'var(--shadow)',
                  pointerEvents: 'auto',
                  cursor: interactionMode === 'pan' ? 'grab' : 'move',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {String(sticky.parameters.content || '')}
              </div>
            );
          })}

        {/* 2. SVG Edges Layer (`CanvasEdge`) */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 5000,
            height: 5000,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <marker
              id="n8n-arrow-default"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 7 3.5, 0 7"
                fill="var(--color--foreground--shade-2)"
              />
            </marker>
            <marker
              id="n8n-arrow-success"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="var(--color--success)" />
            </marker>
            <marker
              id="n8n-arrow-primary"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="var(--color--primary)" />
            </marker>
            <marker
              id="n8n-arrow-pinned"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="var(--color--secondary)" />
            </marker>
          </defs>

          {renderedEdges.map((edge) => {
            const isHovered = hoveredEdgeId === edge.id;
            const isNonMain = edge.connectionType !== 'main';
            const strokeColor = isHovered
              ? 'var(--color--primary)'
              : edge.status === 'success'
                ? 'var(--color--success)'
                : edge.status === 'pinned'
                  ? 'var(--color--secondary)'
                  : isNonMain
                    ? 'var(--node-type--supplemental--color)'
                    : 'var(--color--foreground--shade-2)';

            const markerEnd = isNonMain
              ? undefined
              : isHovered
                ? 'url(#n8n-arrow-primary)'
                : edge.status === 'success'
                  ? 'url(#n8n-arrow-success)'
                  : edge.status === 'pinned'
                    ? 'url(#n8n-arrow-pinned)'
                    : 'url(#n8n-arrow-default)';

            return (
              <g
                key={edge.id}
                style={{ pointerEvents: 'auto' }}
                onMouseEnter={() => {
                  if (edgeHoverTimeoutRef.current) {
                    window.clearTimeout(edgeHoverTimeoutRef.current);
                  }
                  setHoveredEdgeId(edge.id);
                }}
                onMouseLeave={() => {
                  edgeHoverTimeoutRef.current = window.setTimeout(() => {
                    setHoveredEdgeId((curr) => (curr === edge.id ? null : curr));
                  }, 450);
                }}
              >
                {edge.segments.map((segPath, segIdx) => (
                  <React.Fragment key={segIdx}>
                    <path
                      d={segPath}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      style={{ cursor: 'pointer' }}
                    />
                    <path
                      d={segPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHovered ? 2.6 : 2}
                      strokeDasharray={isNonMain ? '8,8' : undefined}
                      markerEnd={
                        segIdx === edge.segments.length - 1 ? markerEnd : undefined
                      }
                      style={{
                        transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
                      }}
                    />
                  </React.Fragment>
                ))}
              </g>
            );
          })}

          {/* Active Connection Dragging Preview (with Magnetic Snap Feedback) */}
          {connecting && (
            <g>
              <path
                d={
                  computeBezierPath(
                    connecting.startX,
                    connecting.startY,
                    connecting.sourcePosition,
                    connecting.currentX,
                    connecting.currentY,
                    connecting.snappedTarget
                      ? connecting.snappedTarget.position
                      : connecting.sourcePosition === 'right'
                        ? 'left'
                        : connecting.sourcePosition === 'left'
                          ? 'right'
                          : connecting.sourcePosition === 'top'
                            ? 'bottom'
                            : 'top',
                  ).path
                }
                fill="none"
                stroke={
                  connecting.snappedTarget
                    ? 'var(--color--success)'
                    : 'var(--color--primary)'
                }
                strokeWidth={connecting.snappedTarget ? 2.8 : 2.2}
                strokeDasharray={
                  connecting.sourceType !== 'main' ? '6,6' : undefined
                }
              />
              <circle
                cx={connecting.currentX}
                cy={connecting.currentY}
                r={connecting.snappedTarget ? 7 : 4.5}
                fill={
                  connecting.snappedTarget
                    ? 'var(--color--success)'
                    : 'var(--color--primary)'
                }
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* 3. Edge Labels & Edge Hover Toolbars (`CanvasEdgeToolbar`) */}
        {renderedEdges.map((edge) => {
          const isHovered = hoveredEdgeId === edge.id;
          const [lx, ly] = edge.labelPosition;

          return (
            <div
              key={`${edge.id}-label`}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => {
                if (edgeHoverTimeoutRef.current) {
                  window.clearTimeout(edgeHoverTimeoutRef.current);
                }
                setHoveredEdgeId(edge.id);
              }}
              onMouseLeave={() => {
                edgeHoverTimeoutRef.current = window.setTimeout(() => {
                  setHoveredEdgeId((curr) => (curr === edge.id ? null : curr));
                }, 450);
              }}
              style={{
                position: 'absolute',
                left: lx,
                top: ly,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                zIndex: isHovered ? 25 : 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isHovered ? (
                <div className="n8n-node-toolbar-items">
                  {edge.connectionType === 'main' && (
                    <button
                      className="n8n-toolbar-btn"
                      title="Inserir nó no meio desta conexão"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreatorFromContext({
                          sourceNode: edge.sourceNode,
                          sourceOutputIndex: edge.sourceOutputIndex,
                          connectionType: edge.connectionType,
                          targetNode: edge.targetNode,
                          targetInputIndex: edge.targetInputIndex,
                          position: [snapToGrid(lx - 48), snapToGrid(ly - 48)],
                        });
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                  <button
                    className="n8n-toolbar-btn danger"
                    title="Remover conexão"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConnection(
                        edge.sourceNode,
                        edge.connectionType,
                        edge.sourceOutputIndex,
                        edge.targetNode,
                        edge.targetInputIndex,
                      );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                edge.itemCount !== null && (
                  <div
                    style={{
                      backgroundColor: 'var(--canvas--label--color--background)',
                      border: `1px solid ${
                        edge.status === 'pinned'
                          ? 'var(--color--secondary)'
                          : 'var(--color--success--tint-1)'
                      }`,
                      color:
                        edge.status === 'pinned'
                          ? 'var(--color--secondary)'
                          : 'var(--color--success)',
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {edge.itemCount} {edge.itemCount === 1 ? 'item' : 'items'}
                  </div>
                )
              )}
            </div>
          );
        })}

        {/* 4. Interactive Workflow Nodes (`CanvasNode`) */}
        {nodes
          .filter((n) => !getNodeTypeDescription(n.type).isSticky)
          .map((node) => {
            const desc = getNodeTypeDescription(node.type);
            const { width, height } = getNodeDimensions(node);
            const handles = getNodeHandles(node);
            const isSelected = selectedNodeNames.includes(node.name);
            const isRunning = runningNodeName === node.name;
            const nodeTasks = runData[node.name];
            const lastTask = nodeTasks?.[nodeTasks.length - 1];
            const isPinned = Boolean(pinData[node.name]?.length);
            const hasError = lastTask?.executionStatus === 'error';
            const hasSuccess =
              !hasError && Boolean(lastTask && lastTask.executionStatus === 'success');
            const subtitleText = resolveNodeSubtitle(node);

            const statusClass = isRunning
              ? 'status-running'
              : hasError
                ? 'status-error'
                : isPinned
                  ? 'status-pinned'
                  : hasSuccess
                    ? 'status-success'
                    : '';

            const singleMainStrikethrough =
              node.disabled &&
              desc.inputs.filter((i) => i.type === 'main').length === 1 &&
              desc.outputs.filter((o) => o.type === 'main').length === 1;

            return (
              <div
                key={node.id}
                className="n8n-canvas-node-container"
                style={{
                  position: 'absolute',
                  left: node.position[0],
                  top: node.position[1],
                  width,
                  height,
                  pointerEvents: 'auto',
                }}
              >
                {/* Floating Toolbar above Node on hover/select (`CanvasNodeToolbar`) */}
                <div
                  className="n8n-node-toolbar"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="n8n-node-toolbar-items">
                    <button
                      className="n8n-toolbar-btn"
                      title={
                        node.disabled
                          ? 'Ativar bloco (Tecla D)'
                          : 'Desativar bloco (Tecla D)'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDisableNode(node.name);
                      }}
                    >
                      <Power size={13} />
                    </button>
                    <button
                      className="n8n-toolbar-btn"
                      title="Duplicar bloco"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateNode(node.name);
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="n8n-toolbar-btn danger"
                      title="Excluir bloco (Delete)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.name);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Main Node Body (`CanvasNodeRenderer`) */}
                <div
                  className={[
                    'n8n-canvas-node',
                    desc.isTrigger ? 'is-trigger' : '',
                    desc.isConfiguration && !desc.isInlineCard ? 'is-configuration' : '',
                    desc.shapeVariant ? `shape-${desc.shapeVariant}` : '',
                    isSelected ? 'is-selected' : '',
                    node.disabled ? 'is-disabled' : '',
                    statusClass,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    width,
                    height,
                    padding:
                      desc.isConfigurable || desc.isInlineCard
                        ? '0 14px'
                        : 0,
                    justifyContent:
                      desc.isConfigurable || desc.isInlineCard
                        ? 'flex-start'
                        : 'center',
                    gap: desc.isConfigurable || desc.isInlineCard ? 10 : 0,
                    borderColor:
                      !statusClass && !node.disabled ? desc.color : undefined,
                    cursor: interactionMode === 'pan' ? 'grab' : 'grab',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenNodeDetails(node.name);
                  }}
                >
                  {/* Disabled horizontal strikethrough line (`Canvas-Bn6gWZ4a.css`) */}
                  {singleMainStrikethrough && (
                    <div
                      style={{
                        position: 'absolute',
                        left: -4,
                        right: -4,
                        top: '50%',
                        height: 2,
                        backgroundColor: 'var(--color--foreground--shade-1)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Trigger Bolt Badge on Left Edge (Desativado para entrada de documentos e repetidor para manter visual limpo) */}
                  {desc.isTrigger && !['ai.promptInput', 'ai.inputPdf', 'ai.inputDocs', 'ai.inputSheets', 'ai.inputText', 'ai.repeater'].includes(node.type) && (
                    <div
                      style={{
                        position: 'absolute',
                        left: -10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: desc.color || 'var(--color--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        boxShadow: 'var(--shadow)',
                      }}
                      title="Bloco Inicial / Gatilho"
                    >
                      ⚡
                    </div>
                  )}

                  {/* Category / Shape Pill Badge on Top-Right of Non-Inline Standard Nodes */}
                  {!desc.isInlineCard && !desc.isConfigurable && desc.badgeLabel && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -9,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: desc.color,
                        color: '#ffffff',
                        fontSize: 8.5,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        padding: '1px 6px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                        pointerEvents: 'none',
                      }}
                    >
                      {desc.badgeLabel}
                    </div>
                  )}

                  <NodeIcon
                    iconName={desc.icon}
                    color={desc.color}
                    size={
                      desc.isInlineCard
                        ? 38
                        : desc.isConfiguration
                          ? 34
                          : 42
                    }
                  />

                  {/* Inline Badge, Title & Live Parameter Preview for AI/Gateway/Skill/MCP/Input/Output Blocks */}
                  {(desc.isConfigurable || desc.isInlineCard) && (
                    <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      {desc.badgeLabel && (
                        <div
                          style={{
                            display: 'inline-block',
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: 0.45,
                            textTransform: 'uppercase',
                            color: desc.color,
                            backgroundColor: `${desc.color}18`,
                            border: `1px solid ${desc.color}40`,
                            borderRadius: 999,
                            padding: '1px 6px',
                            marginBottom: 2,
                          }}
                        >
                          {desc.badgeLabel}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: desc.isConfigurable ? 14 : 12.5,
                          fontWeight: 700,
                          color: 'var(--color--text--shade-1)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {node.name}
                      </div>
                      {subtitleText && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: 'var(--color--text--tint-1)',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subtitleText}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom-Right Status Icons (`CanvasNodeStatusIcons`) */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 5,
                      right: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {isRunning && (
                      <RefreshCw
                        size={14}
                        color="var(--color--primary)"
                        className="n8n-spin"
                      />
                    )}
                    {!isRunning && node.disabled && (
                      <Power size={13} color="var(--color--text--tint-1)" />
                    )}
                    {!isRunning && !node.disabled && hasError && (
                      <AlertTriangle size={14} color="var(--color--danger)" />
                    )}
                    {!isRunning && !node.disabled && !hasError && isPinned && (
                      <Pin size={13} color="var(--color--secondary)" />
                    )}
                    {!isRunning &&
                      !node.disabled &&
                      !hasError &&
                      !isPinned &&
                      hasSuccess && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            color: 'var(--color--success)',
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          <Check size={14} strokeWidth={2.8} />
                          {nodeTasks.length > 1 && <span>{nodeTasks.length}</span>}
                        </div>
                      )}
                  </div>
                </div>

                {/* Below-Node Label & Subtitle for Compact Non-Inline Nodes */}
                {!desc.isConfigurable && !desc.isInlineCard && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: 8,
                      width: width * 2,
                      textAlign: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color--text--shade-1)',
                        lineHeight: 1.25,
                        wordBreak: 'break-word',
                      }}
                    >
                      {node.name}
                    </div>
                    {subtitleText && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color--text--tint-1)',
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {subtitleText}
                      </div>
                    )}
                  </div>
                )}

                {/* Node Handles / Ports (`CanvasHandleRenderer`) */}
                {handles.map((h) => {
                  const isDiamond = h.type !== 'main';
                  const isValidTarget =
                    connecting &&
                    isValidHandleConnection(
                      connecting.sourceNode,
                      connecting.sourceMode,
                      connecting.sourceType,
                      node.name,
                      h.mode,
                      h.type,
                    );
                  const isSnappedTarget =
                    connecting?.snappedTarget?.nodeName === node.name &&
                    connecting?.snappedTarget?.mode === h.mode &&
                    connecting?.snappedTarget?.type === h.type &&
                    connecting?.snappedTarget?.index === h.index;

                  const outgoingCount =
                    h.mode === 'outputs'
                      ? (connections[node.name]?.[h.type]?.[h.index]?.length ?? 0)
                      : 0;

                  return (
                    <div
                      key={`${h.mode}-${h.type}-${h.index}`}
                      style={{
                        position: 'absolute',
                        left: h.offsetX,
                        top: h.offsetY,
                        width: 28,
                        height: 28,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'crosshair',
                      }}
                      title={`${h.mode === 'inputs' ? 'Entrada' : 'Saída'}: ${
                        h.label || h.type
                      } (Segure e arraste para conectar)`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        interactionRef.current = null;
                        const startX = node.position[0] + h.offsetX;
                        const startY = node.position[1] + h.offsetY;
                        const nextConn: ConnectingState = {
                          sourceNode: node.name,
                          sourceMode: h.mode,
                          sourceType: h.type,
                          sourceIndex: h.index,
                          sourcePosition: h.position,
                          startX,
                          startY,
                          currentX: startX,
                          currentY: startY,
                          snappedTarget: null,
                        };
                        connectingRef.current = nextConn;
                        setConnecting(nextConn);
                      }}
                    >
                      <div
                        className={[
                          isDiamond
                            ? 'n8n-handle-diamond'
                            : h.mode === 'inputs'
                              ? 'n8n-handle-input-main'
                              : 'n8n-handle-output-main',
                          isValidTarget ? 'is-connecting-valid' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={
                          isSnappedTarget
                            ? {
                                backgroundColor: 'var(--color--success)',
                                boxShadow: '0 0 0 6px hsla(150, 60%, 40%, 0.28)',
                                transform: isDiamond
                                  ? 'rotate(45deg) scale(1.4)'
                                  : 'scale(1.45)',
                              }
                            : undefined
                        }
                      />

                      {h.label && h.position === 'right' && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 22,
                            top: -10,
                            fontSize: 10,
                            fontFamily: 'var(--font-family--monospace)',
                            color: 'var(--color--text--tint-1)',
                            backgroundColor: 'var(--canvas--label--color--background)',
                            padding: '0 4px',
                            borderRadius: 3,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.label}
                        </span>
                      )}

                      {h.label && h.position === 'bottom' && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 22,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 9.5,
                            fontWeight: 500,
                            color: 'var(--node-type--supplemental--label--color)',
                            backgroundColor: 'var(--canvas--label--color--background)',
                            padding: '0 4px',
                            borderRadius: 3,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.label}
                          {h.required ? ' *' : ''}
                        </span>
                      )}


                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>

      {/* Bottom-Left Interactive Minimap (`200x120` matching n8n `.vue-flow__minimap`) + CanvasControlButtons */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 30,
        }}
      >
        {showMinimap && (
          <div
            className={`n8n-minimap ${frozenMinimapView ? 'is-dragging' : ''}`}
            title="Minimapa do Workflow (Clique ou arraste a janela de câmera, ou use o scroll para dar zoom)"
          >
            <svg
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              viewBox={`${minimapData.activeViewBox.x} ${minimapData.activeViewBox.y} ${minimapData.activeViewBox.width} ${minimapData.activeViewBox.height}`}
              shapeRendering="crispEdges"
              onMouseDown={handleMinimapMouseDown}
              onWheel={handleMinimapWheel}
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              {/* 1. Sticky Notes inside Minimap (`minimap-node-n8n-nodes-base-stickyNote`) */}
              {nodes
                .filter((n) => getNodeTypeDescription(n.type).isSticky)
                .map((n) => {
                  const { width, height } = getNodeDimensions(n);
                  return (
                    <rect
                      key={n.id}
                      className="minimap-node-sticky"
                      x={n.position[0]}
                      y={n.position[1]}
                      width={width}
                      height={height}
                      rx={MINIMAP_NODE_RX}
                      ry={MINIMAP_NODE_RX}
                      shapeRendering="geometricPrecision"
                    />
                  );
                })}

              {/* 2. Workflow Nodes inside Minimap (`minimap-node-default`) */}
              {nodes
                .filter((n) => !getNodeTypeDescription(n.type).isSticky)
                .map((n) => {
                  const { width, height } = getNodeDimensions(n);
                  const desc = getNodeTypeDescription(n.type);
                  const isSelected = selectedNodeNames.includes(n.name);
                  const isRunning = runningNodeName === n.name;
                  const rx =
                    desc.shapeVariant === 'gateway-capsule' ||
                    desc.shapeVariant === 'circle'
                      ? 36
                      : desc.shapeVariant === 'prompt-pill' ||
                          desc.shapeVariant === 'output-card'
                        ? 24
                        : desc.isConfiguration
                          ? 36
                          : MINIMAP_NODE_RX;
                  return (
                    <rect
                      key={n.id}
                      className={`minimap-node-default ${
                        isSelected ? 'is-selected' : ''
                      } ${isRunning ? 'is-running' : ''}`}
                      x={n.position[0]}
                      y={n.position[1]}
                      width={width}
                      height={height}
                      rx={rx}
                      ry={rx}
                      style={{
                        fill: isRunning
                          ? 'var(--color--primary)'
                          : isSelected
                            ? desc.color
                            : `${desc.color}42`,
                        stroke: desc.color,
                        strokeWidth: 4,
                      }}
                      shapeRendering="geometricPrecision"
                    />
                  );
                })}

              {/* 3. Authentic `@vue-flow/minimap` Even-Odd Cutout Mask (`vue-flow__minimap-mask`) */}
              <path
                className="n8n-minimap-mask"
                d={minimapData.maskPath}
                fillRule="evenodd"
              />

              {/* 4. Subtle Viewport Cutout Window Border */}
              <rect
                x={minimapData.viewBB.x}
                y={minimapData.viewBB.y}
                width={minimapData.viewBB.width}
                height={minimapData.viewBB.height}
                fill="none"
                stroke="var(--minimap--mask--stroke)"
                strokeWidth={1.25 * minimapData.activeViewBox.viewScale}
                pointerEvents="none"
              />
            </svg>
          </div>
        )}

        {/* Canvas Control Buttons (`Pointer/Hand`, `Minimap Toggle`, `Zoom to Fit`, `Zoom In`, `Zoom Out`, `Reset`, `Tidy Up`) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'var(--color--background--light-3)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 'var(--radius--lg)',
            padding: 4,
            boxShadow: 'var(--shadow)',
          }}
        >
          <button
            className="n8n-toolbar-btn"
            title="Modo Seleção / Mover Nós (Ponteiro)"
            onClick={() => setInteractionMode('select')}
            style={{
              backgroundColor:
                interactionMode === 'select'
                  ? 'var(--color--primary--tint-3)'
                  : 'transparent',
              color:
                interactionMode === 'select'
                  ? 'var(--color--primary)'
                  : 'var(--color--text--tint-1)',
            }}
          >
            <MousePointer size={14} />
          </button>
          <button
            className="n8n-toolbar-btn"
            title="Modo Mão / Arrastar Mapa (Hand Pan Tool)"
            onClick={() => setInteractionMode('pan')}
            style={{
              backgroundColor:
                interactionMode === 'pan'
                  ? 'var(--color--primary--tint-3)'
                  : 'transparent',
              color:
                interactionMode === 'pan'
                  ? 'var(--color--primary)'
                  : 'var(--color--text--tint-1)',
            }}
          >
            <Hand size={14} />
          </button>

          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: 'var(--color--foreground--tint-1)',
              margin: '0 2px',
            }}
          />

          <button
            className="n8n-toolbar-btn"
            title="Mostrar / Ocultar Minimapa"
            onClick={() => setShowMinimap((prev) => !prev)}
            style={{
              color: showMinimap
                ? 'var(--color--primary)'
                : 'var(--color--text--tint-1)',
            }}
          >
            <MapIcon size={14} />
          </button>

          <button
            className="n8n-toolbar-btn"
            title="Centralizar Tudo / Zoom to Fit (Atalho: 1)"
            onClick={handleFitView}
          >
            <Maximize2 size={14} />
          </button>
          <button
            className="n8n-toolbar-btn"
            title="Zoom In (Atalho: +)"
            onClick={() => zoomAroundCenter(1.15)}
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="n8n-toolbar-btn"
            title="Zoom Out (Atalho: -)"
            onClick={() => zoomAroundCenter(1 / 1.15)}
          >
            <ZoomOut size={14} />
          </button>
          <button
            className="n8n-toolbar-btn"
            title="Reset Zoom 100% (Atalho: 0)"
            onClick={() => setViewport((v) => ({ ...v, zoom: 1 }))}
          >
            <RotateCcw size={13} />
          </button>
          <div
            style={{
              width: 1,
              height: 16,
              backgroundColor: 'var(--color--foreground--tint-1)',
              margin: '0 2px',
            }}
          />
          <button
            className="n8n-toolbar-btn"
            title="Tidy Up Workflow / Auto-Layout no Grid 16px (Shift+Alt+T)"
            onClick={onTidyUp}
          >
            <Sparkles size={14} />
          </button>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-family--monospace)',
              color: 'var(--color--text--tint-1)',
              padding: '0 6px',
            }}
          >
            {Math.round(viewport.zoom * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
