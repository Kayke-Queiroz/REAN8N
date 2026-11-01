import React, { useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { generateWorkflowFromPrompt } from '../engine/aiWorkflowGenerator';
import { IWorkflowData } from '../engine/types';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
  actionBadge?: string;
}

interface BottomAiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: IWorkflowData;
  onApplyGeneratedWorkflow: (nextWorkflow: IWorkflowData) => void;
  onExecuteWorkflow: () => void;
  onTidyUp: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const BottomAiChatDrawer: React.FC<BottomAiChatDrawerProps> = ({
  isOpen,
  onClose,
  workflow,
  onApplyGeneratedWorkflow,
  onExecuteWorkflow,
  onTidyUp,
  messages,
  setMessages,
}) => {
  const [chatHeight, setChatHeight] = useState(280);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(
    () => localStorage.getItem('n8n_rea_gemini_key') || '',
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const scrollToBottom = () => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);
  };

  const handleSendPrompt = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isGenerating) return;

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

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    scrollToBottom();

    const lower = trimmed.toLowerCase();

    if (
      lower === 'executar' ||
      lower.includes('executar') ||
      lower.includes('criar agente') ||
      lower.includes('rodar')
    ) {
      onExecuteWorkflow();
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now() + 1}`,
          role: 'assistant',
          text: `Iniciei o processamento do agente "${workflow.name}" com ${workflow.nodes.length} blocos!`,
          timestamp: now,
          actionBadge: 'Agente Criado / Em Execução',
        },
      ]);
      scrollToBottom();
      return;
    }

    if (lower.includes('organizar') || lower.includes('arrumar') || lower.includes('alinhar')) {
      onTidyUp();
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now() + 1}`,
          role: 'assistant',
          text: 'Alinhei todos os blocos no grid perfeitamente!',
          timestamp: now,
          actionBadge: 'Auto-Layout Aplicado',
        },
      ]);
      scrollToBottom();
      return;
    }

    setIsGenerating(true);
    try {
      const genResult = await generateWorkflowFromPrompt(trimmed, workflow, {
        provider: geminiApiKey.trim() ? 'gemini' : 'local-semantic',
        apiKey: geminiApiKey.trim() || undefined,
      });
      onApplyGeneratedWorkflow(genResult.workflow);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now() + 2}`,
          role: 'assistant',
          text: genResult.explanation,
          timestamp: now,
          actionBadge: genResult.badgeText,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: `Erro ao processar pedido: ${err?.message || err}`,
          timestamp: now,
        },
      ]);
    } finally {
      setIsGenerating(false);
      scrollToBottom();
    }
  };

  const actualHeight = isExpanded ? 460 : chatHeight;

  return (
    <div
      style={{
        height: actualHeight,
        backgroundColor: 'var(--color--background--light-3)',
        borderTop: '2px solid var(--color--foreground--tint-1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 45,
        boxShadow: '0 -4px 20px hsla(215, 28%, 15%, 0.12)',
        transition: 'height 0.18s ease',
      }}
    >
      {/* Top Header of Bottom Drawer */}
      <div
        style={{
          height: 44,
          padding: '0 16px',
          backgroundColor: 'var(--color--background--light-2)',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #ff6d5a, #7c3aed)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={14} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color--text--shade-1)',
              }}
            >
              Construtor de Agentes IA
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="n8n-toolbar-btn"
            title={isExpanded ? 'Reduzir altura' : 'Expandir altura'}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            className="n8n-toolbar-btn"
            title="Fechar chat"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Optional API Key Input */}
      {showKeyConfig && (
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: 'var(--color--background--light-1)',
            borderBottom: '1px solid var(--color--foreground--tint-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color--text--tint-1)' }}>
            Chave Gemini (Opcional):
          </span>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => {
              setGeminiApiKey(e.target.value);
              localStorage.setItem('n8n_rea_gemini_key', e.target.value);
            }}
            placeholder="Cole sua GEMINI_API_KEY aqui..."
            style={{
              flex: 1,
              maxWidth: 380,
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 5,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-3)',
              color: 'var(--color--text--shade-1)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => setShowKeyConfig(false)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              backgroundColor: 'var(--color--primary)',
              color: '#fff',
            }}
          >
            Salvar
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
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
                gap: 8,
                maxWidth: '85%',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
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
                {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  lineHeight: 1.45,
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
                      fontSize: 10,
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

      {/* Input Form at bottom of Drawer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt(chatInput);
        }}
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'var(--color--background--light-2)',
          flexShrink: 0,
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ex: 'Monte um agente para transcrever slides do Google Slides' ou 'Troque o modelo para Claude'..."
          style={{
            flex: 1,
            border: '1px solid var(--color--foreground--tint-1)',
            backgroundColor: 'var(--color--background--light-3)',
            borderRadius: 6,
            padding: '7px 12px',
            fontSize: 13,
            color: 'var(--color--text--shade-1)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isGenerating}
          title="Enviar pedido para o Agente IA"
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'var(--color--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          <Send size={14} />
          <span>{isGenerating ? 'Montando...' : 'Enviar'}</span>
        </button>
      </form>
    </div>
  );
};

