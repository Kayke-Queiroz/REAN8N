import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  Info,
  Maximize2,
  Pin,
  Play,
  Power,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import {
  IDataObject,
  INode,
  INodeExecutionData,
  IPinData,
  IRunData,
} from '../engine/types';
import { getNodeTypeDescription } from '../engine/nodeTypes';
import { Workflow } from '../engine/workflow';
import { NodeIcon } from './NodeIcon';

interface RightNodeSidebarProps {
  node: INode | null;
  workflowModel: Workflow;
  runData: IRunData;
  pinData: IPinData;
  onClose: () => void;
  onOpenFullModal: (nodeName: string) => void;
  onSelectNode: (nodeName: string) => void;
  onUpdateNode: (nodeName: string, updated: Partial<INode>) => void;
  onRenameNode: (oldName: string, newName: string) => void;
  onExecuteNode: (nodeName: string) => void;
  onToggleDisableNode: (nodeName: string) => void;
  onTogglePinData: (nodeName: string, customData?: INodeExecutionData[]) => void;
  onDuplicateNode: (nodeName: string) => void;
  onDeleteNode: (nodeName: string) => void;
}

export const RightNodeSidebar: React.FC<RightNodeSidebarProps> = ({
  node,
  workflowModel,
  runData,
  pinData,
  onClose,
  onOpenFullModal,
  onSelectNode,
  onUpdateNode,
  onRenameNode,
  onExecuteNode,
  onToggleDisableNode,
  onTogglePinData,
  onDuplicateNode,
  onDeleteNode,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'data' | 'info'>('params');
  const [nameDraft, setNameDraft] = useState(node?.name ?? '');
  const [selectedOutputBranch, setSelectedOutputBranch] = useState(0);

  useEffect(() => {
    setNameDraft(node?.name ?? '');
    setSelectedOutputBranch(0);
  }, [node?.name]);

  // Incoming items from parent nodes
  const incomingItems = useMemo<INodeExecutionData[]>(() => {
    if (!node) return [];
    const incomingConns =
      workflowModel.connectionsByDestinationNode[node.name]?.main ?? [];
    const items: INodeExecutionData[] = [];
    for (const branch of incomingConns) {
      for (const conn of branch ?? []) {
        const parentPinned = pinData[conn.node];
        if (parentPinned?.length) {
          items.push(...parentPinned);
          continue;
        }
        const parentTasks = runData[conn.node];
        const lastParentTask = parentTasks?.[parentTasks.length - 1];
        const branchData = lastParentTask?.data?.main?.[conn.index];
        if (branchData) {
          items.push(...branchData);
        }
      }
    }
    return items;
  }, [node, pinData, runData, workflowModel]);

  // Output branches of this node
  const outputBranches = useMemo<Array<INodeExecutionData[] | null>>(() => {
    if (!node) return [];
    if (pinData[node.name]?.length) {
      return [pinData[node.name]];
    }
    const tasks = runData[node.name];
    const lastTask = tasks?.[tasks.length - 1];
    if (!lastTask?.data) return [];
    return lastTask.data.main ?? Object.values(lastTask.data)[0] ?? [];
  }, [node, pinData, runData]);

  if (!node) return null;

  const desc = getNodeTypeDescription(node.type);
  const isPinned = Boolean(pinData[node.name]?.length);
  const nodeTasks = runData[node.name];
  const lastTask = nodeTasks?.[nodeTasks.length - 1];
  const firstInputJson: IDataObject = incomingItems[0]?.json ?? {};
  const activeOutputItems = outputBranches[selectedOutputBranch] ?? [];

  // Parent & Child nodes in the graph
  const parentNodes = workflowModel.getParentNodes(node.name, 'ALL', 1);
  const childNodes = workflowModel.getChildNodes(node.name, 'ALL', 1);

  return (
    <aside
      style={{
        width: 375,
        height: '100%',
        backgroundColor: 'var(--color--background--light-3)',
        borderLeft: '1px solid var(--color--foreground--tint-1)',
        boxShadow: '-4px 0 18px hsla(215, 28%, 15%, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 35,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 1. Node Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <NodeIcon iconName={desc.icon} color={desc.color} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim() && nameDraft.trim() !== node.name) {
                    onRenameNode(node.name, nameDraft.trim());
                  }
                }}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color--text--shade-1)',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 4,
                  padding: '1px 4px',
                  width: '100%',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 4,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color--text--tint-1)',
                  }}
                >
                  {desc.displayName} · v{node.typeVersion}
                </span>
                {node.disabled ? (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor: 'var(--color--background--shade-1)',
                      color: 'var(--color--text--tint-1)',
                    }}
                  >
                    Desativado
                  </span>
                ) : isPinned ? (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor: 'var(--color--secondary--tint-2)',
                      color: 'var(--color--secondary)',
                    }}
                  >
                    Pinado
                  </span>
                ) : lastTask ? (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor: 'var(--color--success--tint-3)',
                      color: 'var(--color--success)',
                    }}
                  >
                    Executado ({lastTask.executionTime}ms)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="n8n-toolbar-btn"
              title="Abrir Inspector em Tela Cheia (3 Colunas NDV)"
              onClick={() => onOpenFullModal(node.name)}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="n8n-toolbar-btn"
              title="Fechar Sidebar Direita"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onExecuteNode(node.name)}
            style={{
              flex: 1,
              backgroundColor: 'var(--color--primary)',
              border: '1px solid var(--color--primary--shade-1)',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: 'var(--shadow)',
            }}
          >
            <Play size={13} fill="#fff" />
            Executar Nó
          </button>

          <button
            onClick={() => onTogglePinData(node.name)}
            title="Fixar / Desafixar Dados (Pin Data)"
            style={{
              padding: '6px 9px',
              borderRadius: 6,
              border: `1px solid ${
                isPinned
                  ? 'var(--color--secondary)'
                  : 'var(--color--foreground--tint-1)'
              }`,
              backgroundColor: isPinned
                ? 'var(--color--secondary--tint-2)'
                : 'var(--color--background--light-3)',
              color: isPinned
                ? 'var(--color--secondary)'
                : 'var(--color--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pin size={13} />
          </button>

          <button
            onClick={() => onToggleDisableNode(node.name)}
            title={node.disabled ? 'Ativar Nó' : 'Desativar Nó'}
            style={{
              padding: '6px 9px',
              borderRadius: 6,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-3)',
              color: node.disabled
                ? 'var(--color--warning)'
                : 'var(--color--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Power size={13} />
          </button>

          <button
            onClick={() => onDuplicateNode(node.name)}
            title="Duplicar Nó"
            style={{
              padding: '6px 9px',
              borderRadius: 6,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-3)',
              color: 'var(--color--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Copy size={13} />
          </button>

          <button
            onClick={() => onDeleteNode(node.name)}
            title="Excluir Nó"
            style={{
              padding: '6px 9px',
              borderRadius: 6,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-3)',
              color: 'var(--color--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs (`Parâmetros` | `Dados (I/O)` | `Info & Fluxo`) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-3)',
          padding: '0 12px',
          gap: 16,
        }}
      >
        {[
          { id: 'params', label: 'Parâmetros', icon: Sliders },
          {
            id: 'data',
            label: `Dados (${activeOutputItems.length})`,
            icon: Database,
          },
          { id: 'info', label: 'Info & Conexões', icon: Info },
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'params' | 'data' | 'info')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--color--primary)'
                  : '2px solid transparent',
                color: isActive
                  ? 'var(--color--primary)'
                  : 'var(--color--text--tint-1)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                padding: '10px 2px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <IconComp size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {activeTab === 'params' && (
          <>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--color--text--tint-1)',
                backgroundColor: 'var(--color--background--light-2)',
                border: '1px solid var(--color--foreground--tint-1)',
                padding: '8px 10px',
                borderRadius: 6,
                lineHeight: 1.4,
              }}
            >
              {desc.description}
            </div>

            {desc.properties.map((prop) => {
              const rawVal = node.parameters[prop.name] ?? prop.default ?? '';
              const isExpression =
                typeof rawVal === 'string' && rawVal.startsWith('={{');
              const evaluatedPreview = isExpression
                ? workflowModel.evaluateExpression(rawVal, {
                    currentNode: node,
                    itemJson: firstInputJson,
                    runData,
                  })
                : null;

              return (
                <div
                  key={prop.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color--text--shade-1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{prop.displayName}</span>
                    {isExpression && (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--color--primary)',
                          fontFamily: 'var(--font-family--monospace)',
                        }}
                      >
                        Expressão Dinâmica
                      </span>
                    )}
                  </label>

                  {prop.type === 'options' ? (
                    <select
                      value={String(rawVal)}
                      onChange={(e) =>
                        onUpdateNode(node.name, {
                          parameters: {
                            ...node.parameters,
                            [prop.name]: e.target.value,
                          },
                        })
                      }
                      style={{
                        padding: '7px 9px',
                        borderRadius: 6,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12.5,
                      }}
                    >
                      {prop.options?.map((opt) => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : prop.type === 'code' || prop.type === 'json' ? (
                    <textarea
                      rows={prop.type === 'code' ? 7 : 5}
                      value={
                        typeof rawVal === 'object'
                          ? JSON.stringify(rawVal, null, 2)
                          : String(rawVal)
                      }
                      onChange={(e) => {
                        let parsed: any = e.target.value;
                        if (prop.type === 'json') {
                          try {
                            parsed = JSON.parse(e.target.value);
                          } catch {
                            parsed = e.target.value;
                          }
                        }
                        onUpdateNode(node.name, {
                          parameters: {
                            ...node.parameters,
                            [prop.name]: parsed,
                          },
                        });
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12,
                        fontFamily: 'var(--font-family--monospace)',
                        lineHeight: 1.45,
                        resize: 'vertical',
                      }}
                    />
                  ) : prop.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(rawVal)}
                      onChange={(e) =>
                        onUpdateNode(node.name, {
                          parameters: {
                            ...node.parameters,
                            [prop.name]: e.target.checked,
                          },
                        })
                      }
                    />
                  ) : (
                    <input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      value={String(rawVal)}
                      placeholder={prop.placeholder}
                      onChange={(e) =>
                        onUpdateNode(node.name, {
                          parameters: {
                            ...node.parameters,
                            [prop.name]:
                              prop.type === 'number'
                                ? Number(e.target.value)
                                : e.target.value,
                          },
                        })
                      }
                      style={{
                        padding: '7px 9px',
                        borderRadius: 6,
                        border: `1px solid ${
                          isExpression
                            ? 'var(--color--primary)'
                            : 'var(--color--foreground--tint-1)'
                        }`,
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12.5,
                        fontFamily: isExpression
                          ? 'var(--font-family--monospace)'
                          : 'inherit',
                      }}
                    />
                  )}

                  {isExpression && (
                    <div
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 4,
                        backgroundColor: 'var(--color--success--tint-4)',
                        border: '1px solid var(--color--success--tint-1)',
                        color: 'var(--color--success)',
                        fontFamily: 'var(--font-family--monospace)',
                      }}
                    >
                      Resultado: {JSON.stringify(evaluatedPreview)}
                    </div>
                  )}

                  {prop.description && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color--text--tint-1)',
                      }}
                    >
                      {prop.description}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Notes / Documentation Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color--text--shade-1)',
                }}
              >
                Notas / Documentação do Nó
              </label>
              <textarea
                rows={3}
                value={node.notes ?? ''}
                placeholder="Adicione observações técnicas sobre este nó..."
                onChange={(e) =>
                  onUpdateNode(node.name, { notes: e.target.value })
                }
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--color--foreground--tint-1)',
                  backgroundColor: 'var(--color--background--light-2)',
                  color: 'var(--color--text--shade-1)',
                  fontSize: 12,
                }}
              />
            </div>
          </>
        )}

        {activeTab === 'data' && (
          <>
            {/* Output Branch Selector if multiple outputs */}
            {outputBranches.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {outputBranches.map((b, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedOutputBranch(idx)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--color--foreground--tint-1)',
                      backgroundColor:
                        selectedOutputBranch === idx
                          ? 'var(--color--primary)'
                          : 'var(--color--background--light-2)',
                      color:
                        selectedOutputBranch === idx
                          ? '#fff'
                          : 'var(--color--text)',
                    }}
                  >
                    Saída #{idx} ({b?.length ?? 0})
                  </button>
                ))}
              </div>
            )}

            {/* Output Data Section */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color--text--tint-1)',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Output Gerado ({activeOutputItems.length} itens)</span>
                {activeOutputItems.length > 0 && (
                  <span
                    style={{
                      color: 'var(--color--success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={12} /> OK
                  </span>
                )}
              </div>
              {activeOutputItems.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px dashed var(--color--foreground--tint-1)',
                    fontSize: 12,
                    color: 'var(--color--text--tint-1)',
                    textAlign: 'center',
                  }}
                >
                  Sem dados de saída ainda. Clique em <strong>Executar Nó</strong> acima para processar.
                </div>
              ) : (
                <pre
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px solid var(--color--foreground--tint-1)',
                    fontSize: 11,
                    fontFamily: 'var(--font-family--monospace)',
                    color: 'var(--color--text--shade-1)',
                    overflowX: 'auto',
                    maxHeight: 260,
                  }}
                >
                  {JSON.stringify(
                    activeOutputItems.map((i) => i.json),
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>

            {/* Incoming Data Section */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color--text--tint-1)',
                  marginBottom: 6,
                }}
              >
                Input Recebido ({incomingItems.length} itens)
              </div>
              {incomingItems.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px solid var(--color--foreground--tint-1)',
                    fontSize: 11.5,
                    color: 'var(--color--text--tint-1)',
                  }}
                >
                  Nenhum item de entrada recebido dos nós anteriores.
                </div>
              ) : (
                <pre
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px solid var(--color--foreground--tint-1)',
                    fontSize: 11,
                    fontFamily: 'var(--font-family--monospace)',
                    color: 'var(--color--text--shade-1)',
                    overflowX: 'auto',
                    maxHeight: 200,
                  }}
                >
                  {JSON.stringify(
                    incomingItems.map((i) => i.json),
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>
          </>
        )}

        {activeTab === 'info' && (
          <>
            {/* Technical Metadata Card */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: 'var(--color--background--light-2)',
                border: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color--text--tint-1)' }}>ID do Nó:</span>
                <code style={{ fontWeight: 600 }}>{node.id}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color--text--tint-1)' }}>Tipo Interno:</span>
                <code style={{ fontWeight: 600 }}>{node.type}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color--text--tint-1)' }}>Posição (Grid 16px):</span>
                <code style={{ fontWeight: 600 }}>
                  X: {node.position[0]}px, Y: {node.position[1]}px
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color--text--tint-1)' }}>Categoria:</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  {desc.category}
                </span>
              </div>
            </div>

            {/* Upstream Parent Nodes */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color--text--tint-1)',
                  marginBottom: 6,
                }}
              >
                Nós de Entrada (Anteriores: {parentNodes.length})
              </div>
              {parentNodes.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color--text--tint-1)',
                    padding: '8px 10px',
                    backgroundColor: 'var(--color--background--light-2)',
                    borderRadius: 6,
                  }}
                >
                  Este é um nó inicial (sem conexões de entrada).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {parentNodes.map((pName) => (
                    <button
                      key={pName}
                      onClick={() => onSelectNode(pName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span>{pName}</span>
                      <ArrowRight size={13} color="var(--color--primary)" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Downstream Child Nodes */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color--text--tint-1)',
                  marginBottom: 6,
                }}
              >
                Próximos Nós Conectados ({childNodes.length})
              </div>
              {childNodes.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color--text--tint-1)',
                    padding: '8px 10px',
                    backgroundColor: 'var(--color--background--light-2)',
                    borderRadius: 6,
                  }}
                >
                  Nenhuma saída conectada a partir deste nó.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {childNodes.map((cName) => (
                    <button
                      key={cName}
                      onClick={() => onSelectNode(cName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span>{cName}</span>
                      <ArrowRight size={13} color="var(--color--primary)" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

