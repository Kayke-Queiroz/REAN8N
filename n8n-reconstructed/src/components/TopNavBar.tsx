import React from 'react';
import {
  Download,
  Eraser,
  Layers,
  Moon,
  Play,
  Plus,
  Sparkles,
  Sun,
  Terminal,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { IWorkflowData } from '../engine/types';
import { SAMPLE_WORKFLOWS } from '../engine/sampleWorkflows';

interface TopNavBarProps {
  workflow: IWorkflowData;
  isExecuting: boolean;
  theme: 'dark' | 'light';
  logsOpen: boolean;
  onUpdateWorkflowMeta: (patch: Partial<IWorkflowData>) => void;
  onSelectTemplate: (template: IWorkflowData) => void;
  onExecuteWorkflow: () => void;
  onClearExecution: () => void;
  onOpenNodeCreator: () => void;
  onToggleTheme: () => void;
  onToggleLogs: () => void;
  onExportJson: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  workflow,
  isExecuting,
  theme,
  logsOpen,
  onUpdateWorkflowMeta,
  onSelectTemplate,
  onExecuteWorkflow,
  onClearExecution,
  onOpenNodeCreator,
  onToggleTheme,
  onToggleLogs,
  onExportJson,
}) => {
  return (
    <header
      style={{
        height: 56,
        backgroundColor: 'var(--color--background--light-3)',
        borderBottom: '1px solid var(--color--foreground--tint-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 40,
        gap: 12,
      }}
    >
      {/* Left: Brand + Workflow Name + Template Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            borderRadius: 6,
            backgroundColor: 'var(--color--primary--tint-3)',
            border: '1px solid var(--color--primary--tint-1)',
          }}
        >
          <WorkflowIcon size={18} color="var(--color--primary)" />
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '-0.02em',
              color: 'var(--color--primary)',
            }}
          >
            n8n
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-family--monospace)',
              color: 'var(--color--text--tint-1)',
            }}
          >
            v1.118.1 REA
          </span>
        </div>

        <input
          value={workflow.name}
          onChange={(e) => onUpdateWorkflowMeta({ name: e.target.value })}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color--text--shade-1)',
            minWidth: 260,
          }}
          title="Clique para editar o nome do workflow"
        />

        {/* Template Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={14} color="var(--color--text--tint-1)" />
          <select
            value={workflow.id}
            onChange={(e) => {
              const found = SAMPLE_WORKFLOWS.find((w) => w.id === e.target.value);
              if (found) onSelectTemplate(found);
            }}
            style={{
              backgroundColor: 'var(--color--background--light-2)',
              color: 'var(--color--text)',
              border: '1px solid var(--color--foreground--tint-1)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
            }}
          >
            {SAMPLE_WORKFLOWS.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Active switch, Execution Order, Theme, Logs, Export, Execute */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Active Workflow Switch */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color--text)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: workflow.active
                ? 'var(--color--success)'
                : 'var(--color--foreground--shade-1)',
            }}
          />
          <span>{workflow.active ? 'Active' : 'Inactive'}</span>
          <input
            type="checkbox"
            checked={workflow.active}
            onChange={(e) => onUpdateWorkflowMeta({ active: e.target.checked })}
            style={{ display: 'none' }}
          />
        </label>

        {/* Execution Order v1 vs v0 */}
        <button
          onClick={() =>
            onUpdateWorkflowMeta({
              settings: {
                ...workflow.settings,
                executionOrder:
                  workflow.settings.executionOrder === 'v1' ? 'v0' : 'v1',
              },
            })
          }
          title="Alternar Ordem de Execução do Motor (v1 Depth-First vs v0 Legacy FIFO)"
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text)',
            borderRadius: 4,
            padding: '5px 9px',
            fontSize: 12,
            fontFamily: 'var(--font-family--monospace)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Sparkles size={13} color="var(--color--primary)" />
          Order: {workflow.settings.executionOrder || 'v1'}
        </button>

        {/* Add Node Button */}
        <button
          onClick={onOpenNodeCreator}
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text--shade-1)',
            borderRadius: 4,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Plus size={14} />
          Add Node
        </button>

        {/* Clear Execution */}
        <button
          onClick={onClearExecution}
          title="Limpar dados da última execução"
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text)',
            borderRadius: 4,
            padding: '5px 8px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Eraser size={14} />
        </button>

        {/* Toggle Logs Drawer */}
        <button
          onClick={onToggleLogs}
          title="Abrir/Fechar painel de Logs de Execução"
          style={{
            backgroundColor: logsOpen
              ? 'var(--color--primary--tint-3)'
              : 'var(--color--background--light-2)',
            border: `1px solid ${
              logsOpen
                ? 'var(--color--primary)'
                : 'var(--color--foreground--tint-1)'
            }`,
            color: logsOpen ? 'var(--color--primary)' : 'var(--color--text)',
            borderRadius: 4,
            padding: '5px 9px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Terminal size={14} />
          Logs
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportJson}
          title="Exportar Workflow compatível com n8n (JSON)"
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text)',
            borderRadius: 4,
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Download size={14} />
        </button>

        {/* Light / Dark Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title="Alternar tema Light / Dark (Tokens n8n)"
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text--shade-1)',
            borderRadius: 4,
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Execute Workflow Primary CTA */}
        <button
          onClick={onExecuteWorkflow}
          disabled={isExecuting}
          style={{
            backgroundColor: isExecuting
              ? 'var(--color--primary--shade-1)'
              : 'var(--color--primary)',
            border: '1px solid var(--color--primary--shade-1)',
            color: '#ffffff',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 6px hsla(7, 100%, 68%, 0.3)',
          }}
        >
          <Play size={14} fill="#ffffff" />
          {isExecuting ? 'Executing...' : 'Execute workflow'}
        </button>
      </div>
    </header>
  );
};

