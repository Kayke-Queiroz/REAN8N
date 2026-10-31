import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IConnections,
  INode,
  INodeExecutionData,
  INodeTypeDescription,
  IPinData,
  IRunData,
  IWorkflowData,
  NodeConnectionType,
} from './engine/types';
import { SAMPLE_WORKFLOWS } from './engine/sampleWorkflows';
import { Workflow } from './engine/workflow';
import { WorkflowExecute } from './engine/workflowExecute';
import { snapToGrid, tidyUpWorkflowNodes } from './engine/geometry';
import { getNodeTypeDescription } from './engine/nodeTypes';
import { TopNavBar } from './components/TopNavBar';
import { Canvas, EdgeConnectionContext } from './components/Canvas';
import { LeftSidebar } from './components/LeftSidebar';
import { RightNodeSidebar } from './components/RightNodeSidebar';
import { NodeCreatorDrawer } from './components/NodeCreatorDrawer';
import { NodeDetailsModal } from './components/NodeDetailsModal';
import { ExecutionLogsDrawer } from './components/ExecutionLogsDrawer';

export const App: React.FC = () => {
  const [workflow, setWorkflow] = useState<IWorkflowData>(() =>
    structuredClone(SAMPLE_WORKFLOWS[0]),
  );
  const [runData, setRunData] = useState<IRunData>({});
  const [pinData, setPinData] = useState<IPinData>(workflow.pinData ?? {});
  const [runningNodeName, setRunningNodeName] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const [selectedNodeNames, setSelectedNodeNames] = useState<string[]>([]);
  const [rightSidebarNodeName, setRightSidebarNodeName] = useState<string | null>(
    null,
  );
  const [activeDetailsNodeName, setActiveDetailsNodeName] = useState<string | null>(
    null,
  );
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorContext, setCreatorContext] =
    useState<EdgeConnectionContext | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const workflowModel = useMemo(
    () => new Workflow({ ...workflow, pinData }),
    [workflow, pinData],
  );

  // Execute full workflow or partial workflow up to `destinationNode`
  const handleRunWorkflow = useCallback(
    async (destinationNode?: string) => {
      if (isExecuting) return;
      setIsExecuting(true);
      setRunData({});

      const wfInstance = new Workflow({ ...workflow, pinData });
      const engine = new WorkflowExecute({
        stepDelayMs: 260,
        onNodeExecuteBefore: (nodeName) => {
          setRunningNodeName(nodeName);
        },
        onNodeExecuteAfter: (nodeName, taskData) => {
          setRunData((prev) => ({
            ...prev,
            [nodeName]: [...(prev[nodeName] || []), taskData],
          }));
        },
        onWorkflowFinish: () => {
          setRunningNodeName(null);
        },
      });

      try {
        await engine.run(wfInstance, undefined, destinationNode, pinData);
      } catch (err) {
        console.error('Workflow execution error:', err);
      } finally {
        setRunningNodeName(null);
        setIsExecuting(false);
      }
    },
    [isExecuting, pinData, workflow],
  );

  const handleUpdateNodePosition = useCallback(
    (nodeName: string, position: [number, number]) => {
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.name === nodeName ? { ...n, position } : n,
        ),
      }));
    },
    [],
  );

  const handleUpdateNode = useCallback(
    (nodeName: string, updated: Partial<INode>) => {
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.name === nodeName ? { ...n, ...updated } : n,
        ),
      }));
    },
    [],
  );

  const handleRenameNode = useCallback((oldName: string, newName: string) => {
    setWorkflow((prev) => {
      if (prev.nodes.some((n) => n.name === newName)) return prev;
      const nextNodes = prev.nodes.map((n) =>
        n.name === oldName ? { ...n, name: newName } : n,
      );
      const nextConns: IConnections = {};
      for (const [src, byType] of Object.entries(prev.connections)) {
        const nextSrc = src === oldName ? newName : src;
        nextConns[nextSrc] = {};
        for (const [tKey, branches] of Object.entries(byType)) {
          const cType = tKey as NodeConnectionType;
          nextConns[nextSrc][cType] = branches?.map((b) =>
            b
              ? b.map((conn) =>
                  conn.node === oldName ? { ...conn, node: newName } : conn,
                )
              : null,
          );
        }
      }
      return { ...prev, nodes: nextNodes, connections: nextConns };
    });
    setActiveDetailsNodeName((curr) => (curr === oldName ? newName : curr));
    setRightSidebarNodeName((curr) => (curr === oldName ? newName : curr));
    setSelectedNodeNames((prev) =>
      prev.map((n) => (n === oldName ? newName : n)),
    );
  }, []);

  const handleToggleDisableNode = useCallback((nodeName: string) => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.name === nodeName ? { ...n, disabled: !n.disabled } : n,
      ),
    }));
  }, []);

  const handleTogglePinNode = useCallback(
    (nodeName: string, customData?: INodeExecutionData[]) => {
      setPinData((prev) => {
        const next = { ...prev };
        if (next[nodeName]?.length) {
          delete next[nodeName];
        } else {
          const existingRun =
            runData[nodeName]?.[runData[nodeName].length - 1]?.data?.main?.[0];
          next[nodeName] = customData ??
            existingRun ?? [
              {
                json: {
                  pinned: true,
                  node: nodeName,
                  pinnedAt: new Date().toISOString(),
                },
              },
            ];
        }
        return next;
      });
    },
    [runData],
  );

  const handleConnect = useCallback(
    (
      sourceNode: string,
      sourceType: NodeConnectionType,
      sourceIndex: number,
      targetNode: string,
      targetType: NodeConnectionType,
      targetIndex: number,
    ) => {
      setWorkflow((prev) => {
        const nextConns: IConnections = structuredClone(prev.connections);
        nextConns[sourceNode] ??= {};
        nextConns[sourceNode][sourceType] ??= [];
        const branches = nextConns[sourceNode][sourceType]!;
        while (branches.length <= sourceIndex) {
          branches.push([]);
        }
        const slot = branches[sourceIndex] ?? [];
        const exists = slot.some(
          (c) =>
            c.node === targetNode &&
            c.type === targetType &&
            c.index === targetIndex,
        );
        if (!exists) {
          slot.push({
            node: targetNode,
            type: targetType,
            index: targetIndex,
          });
        }
        branches[sourceIndex] = slot;
        return { ...prev, connections: nextConns };
      });
    },
    [],
  );

  const handleDeleteConnection = useCallback(
    (
      sourceNode: string,
      connType: NodeConnectionType,
      outputIndex: number,
      targetNode: string,
      targetIndex: number,
    ) => {
      setWorkflow((prev) => {
        const nextConns: IConnections = structuredClone(prev.connections);
        const slot = nextConns[sourceNode]?.[connType]?.[outputIndex];
        if (!slot) return prev;
        nextConns[sourceNode]![connType]![outputIndex] = slot.filter(
          (c) => !(c.node === targetNode && c.index === targetIndex),
        );
        return { ...prev, connections: nextConns };
      });
    },
    [],
  );

  const handleDeleteNode = useCallback((nodeName: string) => {
    setWorkflow((prev) => {
      const nextNodes = prev.nodes.filter((n) => n.name !== nodeName);
      const nextConns: IConnections = {};
      for (const [src, byType] of Object.entries(prev.connections)) {
        if (src === nodeName) continue;
        nextConns[src] = {};
        for (const [tKey, branches] of Object.entries(byType)) {
          const cType = tKey as NodeConnectionType;
          nextConns[src][cType] = branches?.map((b) =>
            b ? b.filter((c) => c.node !== nodeName) : null,
          );
        }
      }
      return { ...prev, nodes: nextNodes, connections: nextConns };
    });
    setSelectedNodeNames((prev) => prev.filter((n) => n !== nodeName));
    setRightSidebarNodeName((curr) => (curr === nodeName ? null : curr));
    setActiveDetailsNodeName((curr) => (curr === nodeName ? null : curr));
  }, []);

  const handleDuplicateNode = useCallback((nodeName: string) => {
    setWorkflow((prev) => {
      const orig = prev.nodes.find((n) => n.name === nodeName);
      if (!orig) return prev;
      let copyIdx = 1;
      let candidateName = `${orig.name} ${copyIdx}`;
      while (prev.nodes.some((n) => n.name === candidateName)) {
        copyIdx++;
        candidateName = `${orig.name} ${copyIdx}`;
      }
      const copyNode: INode = {
        ...structuredClone(orig),
        id: `node-${Date.now()}`,
        name: candidateName,
        position: [
          snapToGrid(orig.position[0] + 64),
          snapToGrid(orig.position[1] + 64),
        ],
      };
      return { ...prev, nodes: [...prev.nodes, copyNode] };
    });
  }, []);

  const handleAddNodeFromCreator = useCallback(
    (typeDesc: INodeTypeDescription, ctx: EdgeConnectionContext | null) => {
      let createdName = '';
      setWorkflow((prev) => {
        let idx = 1;
        let baseName = typeDesc.displayName;
        let finalName = baseName;
        while (prev.nodes.some((n) => n.name === finalName)) {
          finalName = `${baseName} ${idx++}`;
        }
        createdName = finalName;

        const defaultParams: Record<string, any> = {};
        for (const prop of typeDesc.properties) {
          defaultParams[prop.name] = prop.default;
        }

        const pos: [number, number] = ctx
          ? ctx.position
          : [snapToGrid(480 + prev.nodes.length * 32), snapToGrid(256)];

        const newNode: INode = {
          id: `node-${Date.now()}`,
          name: finalName,
          type: typeDesc.name,
          typeVersion: typeDesc.version,
          position: pos,
          parameters: defaultParams,
        };

        const nextConns: IConnections = structuredClone(prev.connections);

        // If added from a handle `+` or edge `+`, wire automatically
        if (ctx && ctx.sourceNode && !typeDesc.isSticky) {
          nextConns[ctx.sourceNode] ??= {};
          nextConns[ctx.sourceNode][ctx.connectionType] ??= [];
          const branches = nextConns[ctx.sourceNode][ctx.connectionType]!;
          while (branches.length <= ctx.sourceOutputIndex) {
            branches.push([]);
          }

          if (ctx.targetNode !== undefined && ctx.targetInputIndex !== undefined) {
            // Splice node in the middle of an existing connection (`Insert node on edge`)
            branches[ctx.sourceOutputIndex] = (
              branches[ctx.sourceOutputIndex] ?? []
            ).map((conn) =>
              conn.node === ctx.targetNode && conn.index === ctx.targetInputIndex
                ? { node: finalName, type: ctx.connectionType, index: 0 }
                : conn,
            );
            nextConns[finalName] = {
              [ctx.connectionType]: [
                [
                  {
                    node: ctx.targetNode,
                    type: ctx.connectionType,
                    index: ctx.targetInputIndex,
                  },
                ],
              ],
            };
          } else {
            branches[ctx.sourceOutputIndex] ??= [];
            branches[ctx.sourceOutputIndex]!.push({
              node: finalName,
              type: ctx.connectionType,
              index: 0,
            });
          }
        }

        return {
          ...prev,
          nodes: [...prev.nodes, newNode],
          connections: nextConns,
        };
      });

      if (createdName) {
        setSelectedNodeNames([createdName]);
      }
      setCreatorOpen(false);
      setCreatorContext(null);
    },
    [],
  );

  const handleDropNodeOnCanvas = useCallback(
    (nodeTypeName: string, position: [number, number]) => {
      const typeDesc = getNodeTypeDescription(nodeTypeName);
      handleAddNodeFromCreator(typeDesc, {
        sourceNode: '',
        sourceOutputIndex: 0,
        connectionType: 'main',
        position,
      });
    },
    [handleAddNodeFromCreator],
  );

  const handleTidyUp = useCallback(() => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: tidyUpWorkflowNodes(prev.nodes, prev.connections),
    }));
  }, []);

  const handleExportJson = useCallback(() => {
    const payload = JSON.stringify({ ...workflow, pinData }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pinData, workflow]);

  const activeDetailsNode = useMemo(
    () => workflow.nodes.find((n) => n.name === activeDetailsNodeName) ?? null,
    [activeDetailsNodeName, workflow.nodes],
  );

  const rightSidebarNode = useMemo(
    () => workflow.nodes.find((n) => n.name === rightSidebarNodeName) ?? null,
    [rightSidebarNodeName, workflow.nodes],
  );

  const handleSelectNodesOnCanvas = useCallback((names: string[]) => {
    setSelectedNodeNames(names);
    if (names.length === 0) {
      setRightSidebarNodeName(null);
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TopNavBar
        workflow={workflow}
        isExecuting={isExecuting}
        theme={theme}
        logsOpen={logsOpen}
        onUpdateWorkflowMeta={(patch) =>
          setWorkflow((prev) => ({ ...prev, ...patch }))
        }
        onSelectTemplate={(tpl) => {
          setWorkflow(structuredClone(tpl));
          setRunData({});
          setPinData(tpl.pinData ?? {});
          setSelectedNodeNames([]);
          setRightSidebarNodeName(null);
        }}
        onExecuteWorkflow={() => handleRunWorkflow()}
        onClearExecution={() => setRunData({})}
        onOpenNodeCreator={() => {
          setCreatorContext(null);
          setCreatorOpen(true);
        }}
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
        onToggleLogs={() => setLogsOpen((prev) => !prev)}
        onExportJson={handleExportJson}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left Collapsible Sidebar: Draggable Components Palette + Bottom AI Chat */}
        <LeftSidebar
          workflow={workflow}
          runData={runData}
          onAddNode={(typeDesc) => handleAddNodeFromCreator(typeDesc, null)}
          onExecuteWorkflow={() => handleRunWorkflow()}
          onTidyUp={handleTidyUp}
          onSelectNode={(nodeName) => {
            setSelectedNodeNames([nodeName]);
            setRightSidebarNodeName(nodeName);
          }}
        />

        {/* Center Ice-White ("Branco Gelo") Workflow Canvas */}
        <Canvas
          workflowId={workflow.id}
          workflowModel={workflowModel}
          nodes={workflow.nodes}
          connections={workflow.connections}
          runData={runData}
          pinData={pinData}
          runningNodeName={runningNodeName}
          selectedNodeNames={selectedNodeNames}
          onSelectNodes={handleSelectNodesOnCanvas}
          onUpdateNodePosition={handleUpdateNodePosition}
          onOpenNodeDetails={(name) => {
            setSelectedNodeNames([name]);
            setRightSidebarNodeName(name);
          }}
          onExecuteSingleNode={(name) => handleRunWorkflow(name)}
          onToggleDisableNode={handleToggleDisableNode}
          onTogglePinNode={handleTogglePinNode}
          onDuplicateNode={handleDuplicateNode}
          onDeleteNode={handleDeleteNode}
          onConnect={handleConnect}
          onDeleteConnection={handleDeleteConnection}
          onOpenCreatorFromContext={(ctx) => {
            setCreatorContext(ctx);
            setCreatorOpen(true);
          }}
          onDropNodeType={handleDropNodeOnCanvas}
          onTidyUp={handleTidyUp}
        />

        {/* Right Node Inspector Sidebar: Opens automatically when clicking any node */}
        <RightNodeSidebar
          node={rightSidebarNode}
          workflowModel={workflowModel}
          runData={runData}
          pinData={pinData}
          onClose={() => {
            setRightSidebarNodeName(null);
            setSelectedNodeNames([]);
          }}
          onOpenFullModal={(nodeName) => setActiveDetailsNodeName(nodeName)}
          onSelectNode={(nodeName) => {
            setSelectedNodeNames([nodeName]);
            setRightSidebarNodeName(nodeName);
          }}
          onUpdateNode={handleUpdateNode}
          onRenameNode={handleRenameNode}
          onExecuteNode={(name) => handleRunWorkflow(name)}
          onToggleDisableNode={handleToggleDisableNode}
          onTogglePinData={handleTogglePinNode}
          onDuplicateNode={handleDuplicateNode}
          onDeleteNode={handleDeleteNode}
        />

        <NodeCreatorDrawer
          isOpen={creatorOpen}
          connectionContext={creatorContext}
          onClose={() => {
            setCreatorOpen(false);
            setCreatorContext(null);
          }}
          onSelectNodeType={handleAddNodeFromCreator}
        />
      </div>

      <ExecutionLogsDrawer
        isOpen={logsOpen}
        runData={runData}
        onClose={() => setLogsOpen(false)}
        onSelectNode={(nodeName) => setActiveDetailsNodeName(nodeName)}
      />

      <NodeDetailsModal
        node={activeDetailsNode}
        workflowModel={workflowModel}
        runData={runData}
        pinData={pinData}
        onClose={() => setActiveDetailsNodeName(null)}
        onUpdateNode={handleUpdateNode}
        onRenameNode={handleRenameNode}
        onExecuteNode={(name) => handleRunWorkflow(name)}
        onTogglePinData={handleTogglePinNode}
      />
    </div>
  );
};

