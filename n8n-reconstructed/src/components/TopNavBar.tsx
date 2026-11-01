import React from 'react';
import {
  Moon,
  Play,
  Plus,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import { IWorkflowData } from '../engine/types';

interface TopNavBarProps {
  workflow: IWorkflowData;
  isExecuting: boolean;
  theme: 'dark' | 'light';
  onExecuteWorkflow: () => void;
  onOpenNodeCreator: () => void;
  onToggleTheme: () => void;
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  workflow,
  isExecuting,
  theme,
  onExecuteWorkflow,
  onOpenNodeCreator,
  onToggleTheme,
  onToggleAiChat,
  isAiChatOpen,
}) => {
  return (
    <header
      style={{
        height: 52,
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
      {/* Left: Minimal Clean Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 10px',
            borderRadius: 7,
            backgroundColor: 'var(--color--primary--tint-3)',
            border: '1px solid var(--color--primary--tint-1)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: 'var(--color--primary)',
            }}
          />
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '-0.02em',
              color: 'var(--color--primary)',
            }}
          >
            AI Agent Studio
          </span>
        </div>
      </div>

      {/* Right: Focused Actions (Construtor IA, Theme, Criar Agente) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Toggle AI Agent Builder Drawer */}
        <button
          onClick={onToggleAiChat}
          style={{
            backgroundColor: isAiChatOpen
              ? 'var(--color--primary--tint-2)'
              : 'var(--color--background--light-2)',
            border: `1px solid ${
              isAiChatOpen
                ? 'var(--color--primary)'
                : 'var(--color--foreground--tint-1)'
            }`,
            color: isAiChatOpen
              ? 'var(--color--primary)'
              : 'var(--color--text--shade-1)',
            borderRadius: 7,
            padding: '6px 13px',
            fontSize: 12.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} color="var(--color--primary)" />
          <span>Falar com Agente</span>
        </button>

        {/* Light / Dark Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title="Alternar tema Claro / Escuro"
          style={{
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            color: 'var(--color--text--shade-1)',
            borderRadius: 7,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Primary CTA: "Criar Agente" */}
        <button
          onClick={onExecuteWorkflow}
          disabled={isExecuting}
          style={{
            backgroundColor: isExecuting
              ? 'var(--color--primary--shade-1)'
              : 'var(--color--primary)',
            border: '1px solid var(--color--primary--shade-1)',
            color: '#ffffff',
            borderRadius: 7,
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: '0 2px 8px hsla(7, 100%, 68%, 0.35)',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
          }}
        >
          {isExecuting ? (
            <Wand2 size={15} className="n8n-spin" />
          ) : (
            <Play size={14} fill="#ffffff" />
          )}
          <span>{isExecuting ? 'Executando...' : 'Criar Agente'}</span>
        </button>
      </div>
    </header>
  );
};
