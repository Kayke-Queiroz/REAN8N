import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  FolderPlus,
  Layers,
  MessageSquare,
  Moon,
  PenLine,
  Play,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import { IWorkflowData } from '../engine/types';

export type StudioViewTab = 'builder' | 'use-agent';

interface TopNavBarProps {
  workflow: IWorkflowData;
  isAgentCreated: boolean;
  activeMainTab: StudioViewTab;
  onChangeMainTab: (tab: StudioViewTab) => void;
  onUpdateAgentName: (newName: string) => void;
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
  isAgentCreated,
  activeMainTab,
  onChangeMainTab,
  onUpdateAgentName,
  isExecuting,
  theme,
  onExecuteWorkflow,
  onToggleTheme,
  onToggleAiChat,
  isAiChatOpen,
}) => {
  const [nameDraft, setNameDraft] = useState(workflow.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [justSavedBadge, setJustSavedBadge] = useState(false);

  useEffect(() => {
    setNameDraft(workflow.name);
  }, [workflow.name]);

  const commitName = () => {
    setIsEditingName(false);
    const trimmed = nameDraft.trim() || 'Meu Agente IA';
    setNameDraft(trimmed);
    if (trimmed !== workflow.name) {
      onUpdateAgentName(trimmed);
      setJustSavedBadge(true);
      setTimeout(() => setJustSavedBadge(false), 1800);
    }
  };

  return (
    <header
      style={{
        height: 54,
        backgroundColor: 'var(--color--background--light-3)',
        borderBottom: '1px solid var(--color--foreground--tint-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 40,
        gap: 14,
      }}
    >
      {/* Left: Editable Agent Name + Saved Agents Selector + View Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Editable Agent Name Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderRadius: 8,
            backgroundColor: 'var(--color--primary--tint-3)',
            border: isEditingName
              ? '1.5px solid var(--color--primary)'
              : '1px solid var(--color--primary--tint-1)',
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: isAgentCreated ? '#16a34a' : 'var(--color--primary)',
              flexShrink: 0,
            }}
            title={isAgentCreated ? 'Agente Criado e Ativo' : 'Em construção'}
          />

          <input
            type="text"
            value={nameDraft}
            onFocus={() => setIsEditingName(true)}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            title="Clique para escolher o nome do seu Agente (salvo automaticamente)"
            style={{
              fontWeight: 800,
              fontSize: 13.5,
              letterSpacing: '-0.01em',
              color: 'var(--color--primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              minWidth: 150,
              maxWidth: 240,
            }}
          />

          <PenLine
            size={12}
            color="var(--color--primary)"
            style={{ opacity: 0.7, pointerEvents: 'none', flexShrink: 0 }}
          />

          {justSavedBadge && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Check size={11} /> Salvo
            </span>
          )}
        </div>

        {/* Navigation Tabs: [ Montar Blocos ] | [ Usar Agente ] */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 8,
            padding: 3,
            gap: 4,
          }}
        >
          <button
            onClick={() => onChangeMainTab('builder')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor:
                activeMainTab === 'builder'
                  ? 'var(--color--background--light-3)'
                  : 'transparent',
              color:
                activeMainTab === 'builder'
                  ? 'var(--color--text--shade-1)'
                  : 'var(--color--text--tint-1)',
              fontWeight: activeMainTab === 'builder' ? 700 : 500,
              fontSize: 12.5,
              boxShadow:
                activeMainTab === 'builder'
                  ? '0 1px 3px rgba(0,0,0,0.08)'
                  : 'none',
              cursor: 'pointer',
            }}
          >
            <Layers size={13} />
            <span>Montar Blocos</span>
          </button>

          <button
            onClick={() => onChangeMainTab('use-agent')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor:
                activeMainTab === 'use-agent'
                  ? 'var(--color--primary)'
                  : 'transparent',
              color:
                activeMainTab === 'use-agent'
                  ? '#ffffff'
                  : 'var(--color--text--tint-1)',
              fontWeight: activeMainTab === 'use-agent' ? 700 : 600,
              fontSize: 12.5,
              boxShadow:
                activeMainTab === 'use-agent'
                  ? '0 2px 6px hsla(7, 100%, 68%, 0.35)'
                  : 'none',
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={13} />
            <span>Usar Agente</span>
            {isAgentCreated && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor:
                    activeMainTab === 'use-agent' ? '#ffffff' : '#16a34a',
                }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Right: Focused Actions (Falar com Agente, Theme, Criar Agente) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {activeMainTab === 'builder' && (
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
            <span>Montar com IA</span>
          </button>
        )}

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
              : isAgentCreated
                ? '#16a34a'
                : 'var(--color--primary)',
            border: `1px solid ${
              isAgentCreated ? '#15803d' : 'var(--color--primary--shade-1)'
            }`,
            color: '#ffffff',
            borderRadius: 7,
            padding: '7px 18px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: isAgentCreated
              ? '0 2px 8px hsla(142, 71%, 45%, 0.3)'
              : '0 2px 8px hsla(7, 100%, 68%, 0.35)',
            cursor: isExecuting ? 'not-allowed' : 'pointer',
          }}
        >
          {isExecuting ? (
            <Wand2 size={15} className="n8n-spin" />
          ) : isAgentCreated ? (
            <CheckCircle2 size={15} />
          ) : (
            <Play size={14} fill="#ffffff" />
          )}
          <span>
            {isExecuting
              ? 'Criando Agente...'
              : isAgentCreated
                ? 'Atualizar Agente'
                : 'Criar Agente'}
          </span>
        </button>
      </div>
    </header>
  );
};
