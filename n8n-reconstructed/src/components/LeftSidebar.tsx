import React, { useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { NODE_TYPE_DESCRIPTIONS } from '../engine/nodeTypes';
import {
  INodeTypeDescription,
  IRunData,
  IWorkflowData,
  NodeCategory,
} from '../engine/types';
import { NodeIcon } from './NodeIcon';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
  actionBadge?: string;
}

interface LeftSidebarProps {
  workflow: IWorkflowData;
  runData: IRunData;
  onAddNode: (typeDesc: INodeTypeDescription) => void;
  onExecuteWorkflow: () => void;
  onTidyUp: () => void;
  onSelectNode: (nodeName: string) => void;
}

const CATEGORY_TABS: Array<{ id: 'all' | NodeCategory; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'trigger', label: 'Gatilhos' },
  { id: 'core', label: 'Ações' },
  { id: 'flow', label: 'Fluxo' },
  { id: 'ai', label: 'Agentes IA' },
  { id: 'ai_subnode', label: 'Sub-Nós IA' },
  { id: 'annotation', label: 'Notas' },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  workflow,
  runData,
  onAddNode,
  onExecuteWorkflow,
  onTidyUp,
  onSelectNode,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | NodeCategory>('all');

  // Bottom AI Chat state
  const [chatOpen, setChatOpen] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: 'Olá! Sou o Copiloto IA do seu workflow. Você pode arrastar componentes acima para o mapa ou me pedir para adicionar nós, executar ou explicar o fluxo!',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredComponents = useMemo(() => {
    const all = Object.values(NODE_TYPE_DESCRIPTIONS);
    return all.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.displayName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, search]);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: INodeTypeDescription,
  ) => {
    e.dataTransfer.setData('application/n8n-node-type', item.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const scrollToBottom = () => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);
  };

  const processUserPrompt = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: now,
    };

    const lower = trimmed.toLowerCase();
    let replyText = '';
    let actionBadge: string | undefined;

    // Intelligent Workflow Commands
    if (
      lower.includes('executar') ||
      lower.includes('rodar') ||
      lower.includes('run') ||
      lower.includes('testar')
    ) {
      onExecuteWorkflow();
      replyText = `Iniciei a execução do workflow "${workflow.name}" com ${workflow.nodes.length} nós! Acompanhe os resultados em tempo real no canvas e na sidebar direita.`;
      actionBadge = 'Workflow Executado';
    } else if (
      lower.includes('organizar') ||
      lower.includes('arrumar') ||
      lower.includes('tidy') ||
      lower.includes('alinhar')
    ) {
      onTidyUp();
      replyText =
        'Pronto! Alinhei todos os nós automaticamente no grid de 16px usando ordenação topológica em camadas.';
      actionBadge = 'Auto-Layout Aplicado';
    } else if (
      lower.includes('adicionar') ||
      lower.includes('criar') ||
      lower.includes('inserir') ||
      lower.includes('add') ||
      lower.startsWith('+')
    ) {
      const allTypes = Object.values(NODE_TYPE_DESCRIPTIONS);
      const matched =
        allTypes.find(
          (t) =>
            lower.includes(t.displayName.toLowerCase()) ||
            lower.includes(t.name.split('.').pop()?.toLowerCase() || ''),
        ) ||
        (lower.includes('http') || lower.includes('api')
          ? NODE_TYPE_DESCRIPTIONS['n8n-nodes-base.httpRequest']
          : lower.includes('code') ||
              lower.includes('js') ||
              lower.includes('código')
            ? NODE_TYPE_DESCRIPTIONS['n8n-nodes-base.code']
            : lower.includes('agent') || lower.includes('ia')
              ? NODE_TYPE_DESCRIPTIONS['@n8n/n8n-nodes-langchain.agent']
              : lower.includes('if') || lower.includes('condi')
                ? NODE_TYPE_DESCRIPTIONS['n8n-nodes-base.if']
                : lower.includes('webhook')
                  ? NODE_TYPE_DESCRIPTIONS['n8n-nodes-base.webhook']
                  : null);

      if (matched) {
        onAddNode(matched);
        replyText = `Adicionei o componente "${matched.displayName}" ao canvas e já o conectei ao fluxo! Clique nele para ver e editar suas informações na sidebar direita.`;
        actionBadge = `+ ${matched.displayName}`;
      } else {
        replyText =
          'Qual componente você deseja adicionar? Exemplos: "Adicionar HTTP Request", "Adicionar AI Agent", "Adicionar Code JS" ou "Adicionar IF".';
      }
    } else if (
      lower.includes('explicar') ||
      lower.includes('resumo') ||
      lower.includes('o que faz') ||
      lower.includes('status')
    ) {
      const nodeNames = workflow.nodes.map((n) => n.name).join(' → ');
      const executedCount = Object.keys(runData).length;
      replyText = `O workflow atual ("${workflow.name}") possui ${workflow.nodes.length} nós: ${nodeNames}. Até o momento, ${executedCount} nó(s) possuem dados de execução registrados.`;
      actionBadge = 'Análise do Fluxo';
    } else {
      // Check if user mentioned a specific node in the workflow
      const mentionedNode = workflow.nodes.find((n) =>
        lower.includes(n.name.toLowerCase()),
      );
      if (mentionedNode) {
        onSelectNode(mentionedNode.name);
        replyText = `Selecionei o nó "${mentionedNode.name}" (${mentionedNode.type}) e abri as informações dele na sidebar da direita para você configurar!`;
        actionBadge = `Foco: ${mentionedNode.name}`;
      } else {
        replyText = `Entendido! Seu workflow "${workflow.name}" conta com ${workflow.nodes.length} nós ativos. Você pode arrastar qualquer bloco da lista acima para o mapa branco gelo, clicar em um nó para abrir o inspetor na direita, ou me pedir: "Adicionar HTTP Request", "Executar workflow" ou "Organizar nós".`;
      }
    }

    const assistantMsg: ChatMessage = {
      id: `ai-${Date.now() + 1}`,
      role: 'assistant',
      text: replyText,
      timestamp: now,
      actionBadge,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput('');
    scrollToBottom();
  };

  // Collapsed Rail View (`54px` wide)
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
          padding: '10px 0',
          gap: 10,
          zIndex: 35,
          boxShadow: '2px 0 10px hsla(215, 28%, 15%, 0.04)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expandir Sidebar de Componentes & Chat IA"
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

        {/* Quick Draggable Icons in Collapsed Rail */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '2px 0',
          }}
        >
          {Object.values(NODE_TYPE_DESCRIPTIONS)
            .slice(0, 9)
            .map((item) => (
              <div
                key={item.name}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => onAddNode(item)}
                title={`${item.displayName} — Clique ou arraste para o Canvas`}
                style={{
                  cursor: 'grab',
                  padding: 3,
                  borderRadius: 8,
                  border: '1px solid transparent',
                  transition: 'transform 0.12s ease, background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--color--background--light-2)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <NodeIcon iconName={item.icon} color={item.color} size={30} />
              </div>
            ))}
        </div>

        {/* Open AI Chat Button at Bottom of Rail */}
        <button
          onClick={() => {
            setIsCollapsed(false);
            setChatOpen(true);
          }}
          title="Abrir Chat com IA"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid var(--color--primary)',
            backgroundColor: 'var(--color--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow)',
          }}
        >
          <Bot size={18} />
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
        boxShadow: '4px 0 16px hsla(215, 28%, 15%, 0.05)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* 1. Top Header of Left Sidebar */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color--background--light-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: 'var(--color--primary--tint-2)',
              color: 'var(--color--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={15} />
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color--text--shade-1)',
                lineHeight: 1.2,
              }}
            >
              Componentes
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--color--text--tint-1)',
              }}
            >
              Arraste para o mapa ou clique
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          title="Minimizar Sidebar Esquerda"
          className="n8n-toolbar-btn"
          style={{
            border: '1px solid var(--color--foreground--tint-1)',
            backgroundColor: 'var(--color--background--light-3)',
          }}
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* 2. Search & Category Filter Pills */}
      <div
        style={{
          padding: '10px 12px 8px 12px',
          borderBottom: '1px solid var(--color--foreground--tint-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 7,
            padding: '6px 9px',
          }}
        >
          <Search size={14} color="var(--color--text--tint-1)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nó (HTTP, AI, IF, Code...)"
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

        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: `1px solid ${
                    active
                      ? 'var(--color--primary)'
                      : 'var(--color--foreground--tint-1)'
                  }`,
                  backgroundColor: active
                    ? 'var(--color--primary--tint-2)'
                    : 'var(--color--background--light-3)',
                  color: active
                    ? 'var(--color--primary)'
                    : 'var(--color--text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Draggable Components List */}
      <div
        style={{
          flex: 1,
          minHeight: 120,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {filteredComponents.map((item) => (
          <div
            key={item.name}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onClick={() => onAddNode(item)}
            title="Arraste para o Canvas ou clique para adicionar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 10px',
              backgroundColor: 'var(--color--background--light-2)',
              border: '1px solid var(--color--foreground--tint-1)',
              borderRadius: 8,
              cursor: 'grab',
              userSelect: 'none',
              transition:
                'border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color--primary)';
              e.currentTarget.style.boxShadow = 'var(--shadow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor =
                'var(--color--foreground--tint-1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <GripVertical
              size={14}
              color="var(--color--text--tint-2)"
              style={{ flexShrink: 0 }}
            />
            <NodeIcon iconName={item.icon} color={item.color} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
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
                  fontSize: 10.5,
                  color: 'var(--color--text--tint-1)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.description}
              </div>
            </div>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                backgroundColor: 'var(--color--background--light-3)',
                border: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color--text--tint-1)',
                flexShrink: 0,
              }}
            >
              <Plus size={12} />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Bottom Integrated AI Chat Section ("embaixo um chat que poderá ser usando para falar com ia") */}
      <div
        style={{
          height: chatOpen ? (chatExpanded ? 410 : 275) : 44,
          borderTop: '2px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-3)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.18s ease',
          flexShrink: 0,
        }}
      >
        {/* AI Chat Header */}
        <div
          onClick={() => setChatOpen((prev) => !prev)}
          style={{
            height: 42,
            padding: '0 12px',
            backgroundColor: 'var(--color--background--light-2)',
            borderBottom: chatOpen
              ? '1px solid var(--color--foreground--tint-1)'
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #ff6d5a, #7c3aed)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={13} />
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--color--text--shade-1)',
              }}
            >
              Assistente IA (Copilot)
            </span>
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
              Online
            </span>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            {chatOpen && (
              <button
                className="n8n-toolbar-btn"
                title={chatExpanded ? 'Reduzir altura do chat' : 'Expandir altura do chat'}
                onClick={() => setChatExpanded((prev) => !prev)}
              >
                {chatExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            )}
            <button
              className="n8n-toolbar-btn"
              title={chatOpen ? 'Minimizar Chat IA' : 'Abrir Chat IA'}
              onClick={() => setChatOpen((prev) => !prev)}
            >
              {chatOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>
        </div>

        {chatOpen && (
          <>
            {/* Quick Suggestion Chips */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                padding: '6px 10px',
                overflowX: 'auto',
                borderBottom: '1px solid var(--color--foreground--tint-2)',
                backgroundColor: 'var(--color--background--light-2)',
                flexShrink: 0,
              }}
            >
              {[
                { label: '+ HTTP Request', prompt: 'Adicionar HTTP Request' },
                { label: '+ AI Agent', prompt: 'Adicionar AI Agent' },
                { label: '▶ Executar', prompt: 'Executar workflow agora' },
                { label: '✨ Organizar', prompt: 'Organizar nós no mapa' },
                { label: 'Explicar Fluxo', prompt: 'Explicar o que este workflow faz' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => processUserPrompt(chip.prompt)}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 999,
                    border: '1px solid var(--color--foreground--tint-1)',
                    backgroundColor: 'var(--color--background--light-3)',
                    color: 'var(--color--text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      maxWidth: '92%',
                      flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor:
                          m.role === 'assistant'
                            ? 'var(--color--primary--tint-2)'
                            : 'var(--color--secondary--tint-2)',
                        color:
                          m.role === 'assistant'
                            ? 'var(--color--primary)'
                            : 'var(--color--secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {m.role === 'assistant' ? (
                        <Bot size={13} />
                      ) : (
                        <User size={13} />
                      )}
                    </div>

                    <div
                      style={{
                        padding: '7px 10px',
                        borderRadius: 9,
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        backgroundColor:
                          m.role === 'user'
                            ? 'var(--color--primary)'
                            : 'var(--color--background--light-2)',
                        color:
                          m.role === 'user'
                            ? '#ffffff'
                            : 'var(--color--text--shade-1)',
                        border:
                          m.role === 'user'
                            ? 'none'
                            : '1px solid var(--color--foreground--tint-1)',
                      }}
                    >
                      {m.actionBadge && (
                        <div
                          style={{
                            display: 'inline-block',
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: 'var(--color--success--tint-3)',
                            color: 'var(--color--success)',
                            marginBottom: 4,
                          }}
                        >
                          ✓ {m.actionBadge}
                        </div>
                      )}
                      <div>{m.text}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processUserPrompt(chatInput);
              }}
              style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--color--foreground--tint-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'var(--color--background--light-2)',
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Peça algo para a IA..."
                style={{
                  flex: 1,
                  border: '1px solid var(--color--foreground--tint-1)',
                  backgroundColor: 'var(--color--background--light-3)',
                  borderRadius: 6,
                  padding: '6px 9px',
                  fontSize: 12,
                  color: 'var(--color--text--shade-1)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                title="Enviar mensagem"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'var(--color--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Send size={13} />
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
};

