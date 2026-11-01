import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { NODE_TYPE_DESCRIPTIONS } from '../engine/nodeTypes';
import {
  INodeTypeDescription,
  IWorkflowData,
} from '../engine/types';
import { NodeIcon } from './NodeIcon';

interface LeftSidebarProps {
  workflow: IWorkflowData;
  onAddNode: (typeDesc: INodeTypeDescription) => void;
  onToggleAiChat: () => void;
  isAiChatOpen: boolean;
}

interface DropdownCategory {
  id: string;
  title: string;
  description: string;
  badge: string;
  color: string;
  icon: string;
  items: INodeTypeDescription[];
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  workflow,
  onAddNode,
  onToggleAiChat,
  isAiChatOpen,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    inputs: true,
    agent: false,
    skills: false,
    mcps: false,
    repeater: false,
    outputs: false,
  });

  const toggleDropdown = (id: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: INodeTypeDescription,
  ) => {
    e.dataTransfer.setData('application/n8n-node-type', item.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Structured groups with their individual dropdown options
  const dropdownCategories = useMemo<DropdownCategory[]>(() => {
    const all = NODE_TYPE_DESCRIPTIONS;

    const inputItems: INodeTypeDescription[] = [
      all['ai.inputPdf'],
      all['ai.inputSheets'],
      all['ai.inputText'],
      all['ai.promptInput'],
    ].filter(Boolean);

    const agentItems: INodeTypeDescription[] = [
      all['@n8n/n8n-nodes-langchain.agent'],
    ].filter(Boolean);

    const skillItems: INodeTypeDescription[] = [
      all['ai.customSkill'],
      all['ai.skillSlideTranscriber'],
      all['@n8n/n8n-nodes-langchain.toolCalculator'],
    ].filter(Boolean);

    const mcpItems: INodeTypeDescription[] = [
      all['ai.mcpGoogleSlides'],
    ].filter(Boolean);

    const repeaterItems: INodeTypeDescription[] = [
      all['ai.repeater'],
    ].filter(Boolean);

    const outputItems: INodeTypeDescription[] = [
      all['ai.outputReport'],
      all['ai.outputDashboard'],
      all['ai.outputText'],
      all['ai.responseOutput'],
    ].filter(Boolean);

    const categories: DropdownCategory[] = [
      {
        id: 'inputs',
        title: 'Entradas (Origem)',
        description: 'PDF, Google Docs, Planilhas ou Texto',
        badge: 'ENTRADA',
        color: '#3b82f6',
        icon: 'UploadCloud',
        items: inputItems,
      },
      {
        id: 'agent',
        title: 'Inteligência Artificial (IA)',
        description: 'Cérebro central que orquestra',
        badge: 'CÉREBRO',
        color: '#ff6d5a',
        icon: 'Bot',
        items: agentItems,
      },
      {
        id: 'skills',
        title: 'Habilidades (Skills)',
        description: 'Transcrever, sintetizar, calcular',
        badge: 'SKILL',
        color: '#f59e0b',
        icon: 'Wand2',
        items: skillItems,
      },
      {
        id: 'mcps',
        title: 'Conectores (MCP)',
        description: 'Google Slides, bancos e APIs externas',
        badge: 'MCP',
        color: '#0ea5e9',
        icon: 'Presentation',
        items: mcpItems,
      },
      {
        id: 'repeater',
        title: 'Repetidor & Prazos',
        description: 'Intervalos, agendamentos e prazos',
        badge: 'REPETIDOR',
        color: '#8b5cf6',
        icon: 'Repeat',
        items: repeaterItems,
      },
      {
        id: 'outputs',
        title: 'Saídas (Entrega)',
        description: 'Relatório, Dashboard ou Texto no Chat',
        badge: 'SAÍDA',
        color: '#16a34a',
        icon: 'FileCheck',
        items: outputItems,
      },
    ];

    if (!search.trim()) return categories;

    const q = search.trim().toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.displayName.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.badgeLabel?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search]);

  // Collapsed Rail View
  if (isCollapsed) {
    return (
      <aside
        style={{
          width: 54,
          height: '100%',
          backgroundColor: 'var(--color--background--light-3)',
          borderRight: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 12,
          zIndex: 35,
          boxShadow: '2px 0 10px hsla(215, 28%, 15%, 0.04)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expandir barra de blocos"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--color--foreground--tint-1)',
            backgroundColor: 'var(--color--background--light-2)',
            color: 'var(--color--text--shade-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronRight size={17} />
        </button>

        <div
          style={{
            width: 28,
            height: 1,
            backgroundColor: 'var(--color--foreground--tint-1)',
          }}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {dropdownCategories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => {
                setIsCollapsed(false);
                setOpenDropdowns({ [cat.id]: true });
              }}
              title={cat.title}
              style={{
                cursor: 'pointer',
                padding: 4,
                borderRadius: 8,
              }}
            >
              <NodeIcon iconName={cat.icon} color={cat.color} size={30} />
            </div>
          ))}
        </div>

        <button
          onClick={onToggleAiChat}
          title="Falar com o Agente"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: 'none',
            backgroundColor: 'var(--color--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 310,
        height: '100%',
        backgroundColor: 'var(--color--background--light-3)',
        borderRight: '1px solid var(--color--foreground--tint-1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 35,
        boxShadow: '4px 0 16px hsla(215, 28%, 15%, 0.04)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Minimalista */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color--background--light-2)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 800,
              color: 'var(--color--text--shade-1)',
            }}
          >
            Blocos do Agente
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color--text--tint-1)',
              marginTop: 2,
            }}
          >
            Clique no drop-down para ver e arrastar
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          title="Recolher barra"
          className="n8n-toolbar-btn"
          style={{
            border: '1px solid var(--color--foreground--tint-1)',
            backgroundColor: 'var(--color--background--light-3)',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* 2. Campo de Busca com Lupa */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--color--foreground--tint-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 8,
            padding: '7px 11px',
          }}
        >
          <Search size={14} color="var(--color--text--tint-1)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar opção (PDF, Relatório, Docs...)"
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--color--text--shade-1)',
              fontSize: 12,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* 3. Blocos com Drop-downs Nativos no Sidebar */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {dropdownCategories.map((cat) => {
          const isOpen = Boolean(openDropdowns[cat.id]) || Boolean(search);

          return (
            <div
              key={cat.id}
              style={{
                borderRadius: 9,
                border: `1px solid ${
                  isOpen ? cat.color : 'var(--color--foreground--tint-1)'
                }`,
                backgroundColor: 'var(--color--background--light-2)',
                overflow: 'hidden',
                transition: 'border-color 0.14s ease',
              }}
            >
              {/* Dropdown Trigger Header */}
              <button
                onClick={() => toggleDropdown(cat.id)}
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isOpen ? `${cat.color}0a` : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <NodeIcon iconName={cat.icon} color={cat.color} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--color--text--shade-1)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {cat.title}
                      </span>
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 800,
                          color: cat.color,
                          backgroundColor: `${cat.color}18`,
                          padding: '1px 5px',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        {cat.badge}
                      </span>
                    </div>
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
                      {cat.description}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    color: 'var(--color--text--tint-1)',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.14s ease',
                  }}
                >
                  <ChevronDown size={15} />
                </div>
              </button>

              {/* Dropdown Options List */}
              {isOpen && (
                <div
                  style={{
                    padding: '6px 8px 8px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    borderTop: '1px solid var(--color--foreground--tint-2)',
                    backgroundColor: 'var(--color--background--light-3)',
                  }}
                >
                  {cat.items.map((item) => (
                    <div
                      key={item.name}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onClick={() => onAddNode(item)}
                      title="Arraste para o mapa ou clique para adicionar"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 9px',
                        backgroundColor: 'var(--color--background--light-2)',
                        border: '1px solid var(--color--foreground--tint-1)',
                        borderLeft: `3.5px solid ${item.color}`,
                        borderRadius: 7,
                        cursor: 'grab',
                        userSelect: 'none',
                        transition:
                          'border-color 0.12s ease, transform 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = item.color;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor =
                          'var(--color--foreground--tint-1)';
                        e.currentTarget.style.borderLeftColor = item.color;
                      }}
                    >
                      <GripVertical
                        size={12}
                        color="var(--color--text--tint-2)"
                        style={{ flexShrink: 0 }}
                      />
                      <NodeIcon iconName={item.icon} color={item.color} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: 'var(--color--text--shade-1)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.displayName}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--color--text--tint-1)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.description}
                        </div>
                      </div>
                      <Plus size={12} color="var(--color--text--tint-1)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Botão Falar com IA no Rodapé */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-2)',
        }}
      >
        <button
          onClick={onToggleAiChat}
          style={{
            width: '100%',
            height: 38,
            borderRadius: 8,
            border: 'none',
            background: isAiChatOpen
              ? 'var(--color--primary--shade-1)'
              : 'linear-gradient(135deg, #ff6d5a, #7c3aed)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
          }}
        >
          <Sparkles size={16} />
          <span>{isAiChatOpen ? 'Fechar Chat' : 'Pedir para a IA Montar'}</span>
        </button>
      </div>
    </aside>
  );
};
