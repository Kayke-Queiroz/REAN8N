import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Code,
  Database,
  Pin,
  Play,
  Settings,
  Sliders,
  Table,
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

interface NodeDetailsModalProps {
  node: INode | null;
  workflowModel: Workflow;
  runData: IRunData;
  pinData: IPinData;
  onClose: () => void;
  onUpdateNode: (nodeName: string, updated: Partial<INode>) => void;
  onRenameNode: (oldName: string, newName: string) => void;
  onExecuteNode: (nodeName: string) => void;
  onTogglePinData: (nodeName: string, customData?: INodeExecutionData[]) => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  node,
  workflowModel,
  runData,
  pinData,
  onClose,
  onUpdateNode,
  onRenameNode,
  onExecuteNode,
  onTogglePinData,
}) => {
  const [centerTab, setCenterTab] = useState<'parameters' | 'settings'>('parameters');
  const [inputView, setInputView] = useState<'table' | 'json'>('table');
  const [outputView, setOutputView] = useState<'table' | 'json'>('table');
  const [selectedOutputBranch, setSelectedOutputBranch] = useState(0);
  const [nameDraft, setNameDraft] = useState(node?.name ?? '');

  React.useEffect(() => {
    setNameDraft(node?.name ?? '');
    setSelectedOutputBranch(0);
  }, [node?.name]);

  // Compute incoming items from parent nodes in `runData`
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

  // Compute output items for this node
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
  const firstInputJson: IDataObject = incomingItems[0]?.json ?? {};
  const activeOutputItems = outputBranches[selectedOutputBranch] ?? [];

  const renderDataTable = (items: INodeExecutionData[]) => {
    if (!items || items.length === 0) {
      return (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--color--text--tint-1)',
            fontSize: 12.5,
          }}
        >
          Nenhum item disponível. Clique em <strong>Execute step</strong> para gerar dados.
        </div>
      );
    }

    const keys = Array.from(
      new Set(items.flatMap((it) => Object.keys(it.json || {}))),
    );

    return (
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            fontFamily: 'var(--font-family--monospace)',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--color--background--light-1)',
                borderBottom: '1px solid var(--color--foreground--tint-1)',
              }}
            >
              {keys.map((k) => (
                <th
                  key={k}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    color: 'var(--color--text--shade-1)',
                    fontWeight: 600,
                  }}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom: '1px solid var(--color--foreground--tint-2)',
                }}
              >
                {keys.map((k) => {
                  const val = item.json?.[k];
                  return (
                    <td
                      key={k}
                      style={{
                        padding: '7px 10px',
                        color: 'var(--color--text)',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'hsla(220, 15%, 8%, 0.68)',
        backdropFilter: 'blur(3px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      {/* 3-Column n8n Node Details View (NDV) Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1360,
          height: '86vh',
          backgroundColor: 'var(--color--background--light-3)',
          border: '1px solid var(--color--foreground--tint-1)',
          borderRadius: 12,
          boxShadow: 'var(--shadow--dark)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Modal Bar */}
        <div
          style={{
            height: 56,
            padding: '0 18px',
            borderBottom: '1px solid var(--color--foreground--tint-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color--background--light-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NodeIcon iconName={desc.icon} color={desc.color} size={34} />
            <div>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim() && nameDraft.trim() !== node.name) {
                    onRenameNode(node.name, nameDraft.trim());
                  }
                }}
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color--text--shade-1)',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color--text--tint-1)',
                  paddingLeft: 6,
                }}
              >
                {desc.name} (v{node.typeVersion})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => onTogglePinData(node.name)}
              style={{
                backgroundColor: isPinned
                  ? 'var(--color--secondary--tint-2)'
                  : 'var(--color--background--light-3)',
                border: `1px solid ${
                  isPinned
                    ? 'var(--color--secondary)'
                    : 'var(--color--foreground--tint-1)'
                }`,
                color: isPinned
                  ? 'var(--color--secondary)'
                  : 'var(--color--text)',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Pin size={14} />
              {isPinned ? 'Pinned Data Active' : 'Pin Data'}
            </button>

            <button
              onClick={() => onExecuteNode(node.name)}
              style={{
                backgroundColor: 'var(--color--primary)',
                border: '1px solid var(--color--primary--shade-1)',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Play size={13} fill="#fff" />
              Execute step
            </button>

            <button className="n8n-toolbar-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 3 Columns Body: INPUT | PARAMETERS/SETTINGS | OUTPUT */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', overflow: 'hidden' }}>
          {/* Left Panel: INPUT DATA */}
          <div
            style={{
              borderRight: '1px solid var(--color--foreground--tint-1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--color--background--light-2)',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color--text--tint-1)',
                }}
              >
                <Database size={13} />
                INPUT ({incomingItems.length} items)
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setInputView('table')}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor:
                      inputView === 'table'
                        ? 'var(--color--background--light-3)'
                        : 'transparent',
                    color: 'var(--color--text--shade-1)',
                  }}
                >
                  <Table size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Table
                </button>
                <button
                  onClick={() => setInputView('json')}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor:
                      inputView === 'json'
                        ? 'var(--color--background--light-3)'
                        : 'transparent',
                    color: 'var(--color--text--shade-1)',
                  }}
                >
                  <Code size={12} style={{ display: 'inline', marginRight: 4 }} />
                  JSON
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {inputView === 'table' ? (
                renderDataTable(incomingItems)
              ) : (
                <pre
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-family--monospace)',
                    color: 'var(--color--text--shade-1)',
                    whiteSpace: 'pre-wrap',
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
          </div>

          {/* Center Panel: NODE PARAMETERS & SETTINGS */}
          <div
            style={{
              borderRight: '1px solid var(--color--foreground--tint-1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--color--background--light-3)',
            }}
          >
            {/* Tabs: Parameters vs Settings */}
            <div
              style={{
                padding: '0 16px',
                borderBottom: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                gap: 20,
              }}
            >
              <button
                onClick={() => setCenterTab('parameters')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${
                    centerTab === 'parameters'
                      ? 'var(--color--primary)'
                      : 'transparent'
                  }`,
                  padding: '12px 4px',
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    centerTab === 'parameters'
                      ? 'var(--color--primary)'
                      : 'var(--color--text--tint-1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sliders size={14} />
                Parameters
              </button>
              <button
                onClick={() => setCenterTab('settings')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${
                    centerTab === 'settings'
                      ? 'var(--color--primary)'
                      : 'transparent'
                  }`,
                  padding: '12px 4px',
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    centerTab === 'settings'
                      ? 'var(--color--primary)'
                      : 'var(--color--text--tint-1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Settings size={14} />
                Settings
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {centerTab === 'parameters' ? (
                desc.properties.map((prop) => {
                  const rawVal =
                    node.parameters[prop.name] !== undefined
                      ? node.parameters[prop.name]
                      : prop.default;
                  const strVal = String(rawVal ?? '');
                  const isExpression =
                    strVal.trim().startsWith('=') || strVal.includes('{{');
                  const resolvedPreview = isExpression
                    ? workflowModel.evaluateExpression(strVal, {
                        currentNode: node,
                        itemJson: firstInputJson,
                        runData,
                      })
                    : null;

                  return (
                    <div key={prop.name}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <label
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--color--text--shade-1)',
                          }}
                        >
                          {prop.displayName}
                        </label>
                        {isExpression && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontFamily: 'var(--font-family--monospace)',
                              color: 'var(--color--primary)',
                              backgroundColor: 'var(--color--primary--tint-3)',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            Expression f(x)
                          </span>
                        )}
                      </div>

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
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--color--foreground--tint-1)',
                            backgroundColor: 'var(--color--background--light-2)',
                            color: 'var(--color--text--shade-1)',
                            fontSize: 13,
                          }}
                        >
                          {prop.options?.map((opt) => (
                            <option key={String(opt.value)} value={String(opt.value)}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
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
                      ) : prop.type === 'json' ||
                        prop.type === 'code' ||
                        (prop.rows && prop.rows > 1) ? (
                        <textarea
                          rows={prop.rows || 6}
                          value={strVal}
                          onChange={(e) =>
                            onUpdateNode(node.name, {
                              parameters: {
                                ...node.parameters,
                                [prop.name]: e.target.value,
                              },
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--color--foreground--tint-1)',
                            backgroundColor: 'var(--color--background--light-2)',
                            color: 'var(--color--text--shade-1)',
                            fontSize: 12.5,
                            fontFamily: 'var(--font-family--monospace)',
                            resize: 'vertical',
                          }}
                        />
                      ) : (
                        <input
                          type={prop.type === 'number' ? 'number' : 'text'}
                          value={strVal}
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
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--color--foreground--tint-1)',
                            backgroundColor: 'var(--color--background--light-2)',
                            color: 'var(--color--text--shade-1)',
                            fontSize: 13,
                          }}
                        />
                      )}

                      {/* Live Expression Resolution Box (`Result` preview in n8n NDV) */}
                      {isExpression && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '6px 10px',
                            borderRadius: 5,
                            backgroundColor: 'var(--color--success--tint-4)',
                            border: '1px solid var(--color--success--tint-1)',
                            fontSize: 11.5,
                            fontFamily: 'var(--font-family--monospace)',
                            color: 'var(--color--success)',
                          }}
                        >
                          Result: {String(resolvedPreview)}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Node Settings Tab (`alwaysOutputData`, `executeOnce`, `retryOnFail`, `disabled`, `notes`) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span>Always Output Data</span>
                    <input
                      type="checkbox"
                      checked={Boolean(node.alwaysOutputData)}
                      onChange={(e) =>
                        onUpdateNode(node.name, {
                          alwaysOutputData: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span>Execute Once (apenas 1º item)</span>
                    <input
                      type="checkbox"
                      checked={Boolean(node.executeOnce)}
                      onChange={(e) =>
                        onUpdateNode(node.name, { executeOnce: e.target.checked })
                      }
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span>Retry On Fail</span>
                    <input
                      type="checkbox"
                      checked={Boolean(node.retryOnFail)}
                      onChange={(e) =>
                        onUpdateNode(node.name, { retryOnFail: e.target.checked })
                      }
                    />
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <span>Disabled Node</span>
                    <input
                      type="checkbox"
                      checked={Boolean(node.disabled)}
                      onChange={(e) =>
                        onUpdateNode(node.name, { disabled: e.target.checked })
                      }
                    />
                  </label>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                      Node Notes
                    </div>
                    <textarea
                      rows={4}
                      value={node.notes || ''}
                      onChange={(e) =>
                        onUpdateNode(node.name, { notes: e.target.value })
                      }
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor: 'var(--color--background--light-2)',
                        color: 'var(--color--text--shade-1)',
                        fontSize: 12.5,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: OUTPUT DATA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--color--background--light-2)',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: isPinned
                    ? 'var(--color--secondary)'
                    : 'var(--color--success)',
                }}
              >
                <CheckCircle2 size={14} />
                OUTPUT ({activeOutputItems.length} items)
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {outputBranches.length > 1 &&
                  outputBranches.map((_b, bIdx) => (
                    <button
                      key={bIdx}
                      onClick={() => setSelectedOutputBranch(bIdx)}
                      style={{
                        fontSize: 11,
                        padding: '3px 7px',
                        borderRadius: 4,
                        border: '1px solid var(--color--foreground--tint-1)',
                        backgroundColor:
                          selectedOutputBranch === bIdx
                            ? 'var(--color--primary)'
                            : 'transparent',
                        color:
                          selectedOutputBranch === bIdx
                            ? '#fff'
                            : 'var(--color--text)',
                      }}
                    >
                      Branch {bIdx}
                    </button>
                  ))}

                <button
                  onClick={() => setOutputView('table')}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor:
                      outputView === 'table'
                        ? 'var(--color--background--light-3)'
                        : 'transparent',
                    color: 'var(--color--text--shade-1)',
                  }}
                >
                  Table
                </button>
                <button
                  onClick={() => setOutputView('json')}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor:
                      outputView === 'json'
                        ? 'var(--color--background--light-3)'
                        : 'transparent',
                    color: 'var(--color--text--shade-1)',
                  }}
                >
                  JSON
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {outputView === 'table' ? (
                renderDataTable(activeOutputItems)
              ) : (
                <pre
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-family--monospace)',
                    color: 'var(--color--text--shade-1)',
                    whiteSpace: 'pre-wrap',
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
          </div>
        </div>
      </div>
    </div>
  );
};

