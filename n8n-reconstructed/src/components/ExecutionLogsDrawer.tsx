import React from 'react';
import { CheckCircle2, Clock, Terminal, X, XCircle } from 'lucide-react';
import { IRunData } from '../engine/types';

interface ExecutionLogsDrawerProps {
  isOpen: boolean;
  runData: IRunData;
  onClose: () => void;
  onSelectNode: (nodeName: string) => void;
}

export const ExecutionLogsDrawer: React.FC<ExecutionLogsDrawerProps> = ({
  isOpen,
  runData,
  onClose,
  onSelectNode,
}) => {
  if (!isOpen) return null;

  const entries = Object.entries(runData)
    .flatMap(([nodeName, tasks]) =>
      tasks.map((t, runIdx) => ({ nodeName, runIdx, task: t })),
    )
    .sort((a, b) => a.task.executionIndex - b.task.executionIndex);

  return (
    <div
      style={{
        height: 210,
        backgroundColor: 'var(--color--background--light-3)',
        borderTop: '1px solid var(--color--foreground--tint-1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 35,
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color--background--light-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color--text--shade-1)',
          }}
        >
          <Terminal size={14} color="var(--color--primary)" />
          <span>Logs & Execution Timeline (`WorkflowExecute` ITaskData[])</span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--color--text--tint-1)',
              fontFamily: 'var(--font-family--monospace)',
            }}
          >
            ({entries.length} steps)
          </span>
        </div>
        <button className="n8n-toolbar-btn" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {entries.length === 0 ? (
          <div
            style={{
              color: 'var(--color--text--tint-1)',
              fontSize: 12.5,
              padding: '16px 0',
            }}
          >
            Nenhuma execução registrada ainda. Clique em{' '}
            <strong>Execute workflow</strong> no topo ou no ícone Play de qualquer nó.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map(({ nodeName, runIdx, task }) => {
              const isError = task.executionStatus === 'error';
              const outBranches =
                task.data?.main ?? Object.values(task.data || {})[0] ?? [];
              const totalItems = outBranches.reduce(
                (acc, b) => acc + (b?.length || 0),
                0,
              );

              return (
                <div
                  key={`${nodeName}-${runIdx}-${task.executionIndex}`}
                  onClick={() => onSelectNode(nodeName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 12px',
                    borderRadius: 6,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px solid var(--color--foreground--tint-1)',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-family--monospace)',
                        fontSize: 11,
                        color: 'var(--color--text--tint-1)',
                      }}
                    >
                      #{task.executionIndex + 1}
                    </span>
                    {isError ? (
                      <XCircle size={14} color="var(--color--danger)" />
                    ) : (
                      <CheckCircle2 size={14} color="var(--color--success)" />
                    )}
                    <strong style={{ color: 'var(--color--text--shade-1)' }}>
                      {nodeName}
                    </strong>
                    {task.source?.[0]?.previousNode && (
                      <span style={{ color: 'var(--color--text--tint-1)' }}>
                        ← {task.source[0].previousNode}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      fontFamily: 'var(--font-family--monospace)',
                      fontSize: 11,
                      color: 'var(--color--text--tint-1)',
                    }}
                  >
                    <span>{totalItems} items</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {task.executionTime}ms
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

