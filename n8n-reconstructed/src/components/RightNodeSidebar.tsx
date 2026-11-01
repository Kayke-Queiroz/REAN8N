import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
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
            onClick={() => onToggleDisableNode(node.name)}
            title={node.disabled ? 'Ativar Bloco' : 'Desativar Bloco'}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-3)',
              color: node.disabled
                ? 'var(--color--warning)'
                : 'var(--color--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Power size={13} />
            {node.disabled ? 'Ativar' : 'Desativar'}
          </button>

          <button
            onClick={() => onDuplicateNode(node.name)}
            title="Duplicar Bloco"
            style={{
              padding: '6px 10px',
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
            title="Excluir Bloco"
            style={{
              padding: '6px 10px',
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

      {/* 2. Cabeçalho de Parâmetros Elegante */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-3)',
          padding: '12px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: `${desc.color || 'var(--color--primary)'}1c`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sliders size={14} color={desc.color || 'var(--color--primary)'} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color--text--shade-1)' }}>
              Configuração do Bloco
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--color--text--tint-1)' }}>
              Ajuste as opções e instruções em linguagem simples
            </div>
          </div>
        </div>
      </div>

      {/* 3. Form Body com Design Card Organizado */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Banner de Ajuda / Resumo do Bloco */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--color--text--shade-1)',
            backgroundColor: `${desc.color || 'var(--color--primary)'}0c`,
            border: `1px solid ${desc.color || 'var(--color--primary)'}30`,
            padding: '10px 14px',
            borderRadius: 8,
            lineHeight: 1.45,
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
                gap: 6,
                backgroundColor: 'var(--color--background--light-2)',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--color--foreground--tint-1)',
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 650,
                  color: 'var(--color--text--shade-1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{prop.displayName}</span>
                {isExpression && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: 'var(--color--primary)',
                      fontFamily: 'var(--font-family--monospace)',
                      backgroundColor: 'var(--color--primary--tint-3)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Dinâmico
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
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor: 'var(--color--background)',
                    color: 'var(--color--text--shade-1)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    outline: 'none',
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
                    backgroundColor: 'var(--color--background)',
                    color: 'var(--color--text--shade-1)',
                    fontSize: 12,
                    fontFamily: 'var(--font-family--monospace)',
                    lineHeight: 1.45,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              ) : (prop.rows && prop.rows > 1) ? (
                <textarea
                  rows={prop.rows}
                  value={String(rawVal)}
                  placeholder={prop.placeholder}
                  onChange={(e) =>
                    onUpdateNode(node.name, {
                      parameters: {
                        ...node.parameters,
                        [prop.name]: e.target.value,
                      },
                    })
                  }
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor: 'var(--color--background)',
                    color: 'var(--color--text--shade-1)',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              ) : prop.type === 'boolean' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
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
                  <span>Habilitar esta opção</span>
                </label>
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
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: `1px solid ${
                      isExpression
                        ? 'var(--color--primary)'
                        : 'var(--color--foreground--tint-1)'
                    }`,
                    backgroundColor: 'var(--color--background)',
                    color: 'var(--color--text--shade-1)',
                    fontSize: 12.5,
                    outline: 'none',
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            backgroundColor: 'var(--color--background--light-2)',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid var(--color--foreground--tint-1)',
          }}
        >
          <label
            style={{
              fontSize: 12,
              fontWeight: 650,
              color: 'var(--color--text--shade-1)',
            }}
          >
            Anotações / Lembretes do Bloco
          </label>
          <textarea
            rows={2}
            value={node.notes ?? ''}
            placeholder="Adicione observações ou lembretes sobre este bloco..."
            onChange={(e) =>
              onUpdateNode(node.name, { notes: e.target.value })
            }
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background)',
              color: 'var(--color--text--shade-1)',
              fontSize: 12,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
      </div>
    </aside>
  );
};

