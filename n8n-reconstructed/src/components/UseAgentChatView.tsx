import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Paperclip,
  Play,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Trash2,
  User,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import { IWorkflowData } from '../engine/types';
import { getNodeTypeDescription } from '../engine/nodeTypes';
import {
  AgentAttachedDocument,
  AgentChatMessageRecord,
  chatWithCompiledAgent,
  CompiledAgentRecord,
  compileAgentFromWorkflow,
  saveAgentConversationAndDocs,
} from '../engine/agentDatabase';
import { NodeIcon } from './NodeIcon';

interface UseAgentChatViewProps {
  workflow: IWorkflowData;
  compiledAgent: CompiledAgentRecord | null;
  onUpdateCompiledAgent?: (updated: CompiledAgentRecord) => void;
  isAgentCreated: boolean;
  isCreatingAgent: boolean;
  onCreateAgentNow: () => void;
  onBackToEditor: () => void;
}

/**
 * Extracts text content from uploaded files (.txt, .md, .csv, .json, or readable text strings inside .pdf/.docx)
 */
async function extractTextFromFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  const isPlainText =
    file.type.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.html');

  if (isPlainText) {
    try {
      const txt = await file.text();
      if (txt.trim()) return txt;
    } catch {
      // fallback
    }
  }

  // Smart extraction for PDF, DOCX and binary documents
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(bytes);

    // 1. PDF Text streams: extract text inside Tj / TJ blocks or parentheses
    const pdfTjMatches = raw.match(/\(([^()]{2,})\)\s*Tj/g);
    if (pdfTjMatches && pdfTjMatches.length > 0) {
      const pdfText = pdfTjMatches
        .map((m) => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim())
        .filter((t) => t.length > 1 && !/^[0-9\s]+$/.test(t))
        .join(' ');
      if (pdfText.length > 30) {
        return pdfText;
      }
    }

    // 2. XML / Word (.docx) tags: extract inner text inside <w:t>...</w:t>
    const docxMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (docxMatches && docxMatches.length > 0) {
      const docxText = docxMatches
        .map((m) => m.replace(/<[^>]+>/g, '').trim())
        .filter((t) => t.length > 0)
        .join(' ');
      if (docxText.length > 20) {
        return docxText;
      }
    }

    // 3. Fallback: Extract natural sentence words, excluding PDF syntax headers like /Type /Pages /ProcSet
    const wordMatches = raw.match(/[A-Za-zÀ-ÿ0-9.,;:!?\-]{3,}/g) || [];
    const filteredWords = wordMatches.filter(
      (w) =>
        !/^(Type|Catalog|Pages|StructTreeRoot|MarkInfo|Metadata|ViewerPreferences|Kids|Parent|Resources|ProcSet|Font|FlateDecode|Length|Filter|Stream|endstream|endobj|xref|trailer|startxref)$/i.test(
          w,
        ),
    );

    if (filteredWords.length > 20) {
      return filteredWords.slice(0, 400).join(' ');
    }
  } catch {
    // ignore
  }

  return `Documento anexado: "${file.name}" (${Math.max(
    1,
    Math.round(file.size / 1024),
  )} KB). Extração pronta para análise do agente.`;
}

export const UseAgentChatView: React.FC<UseAgentChatViewProps> = ({
  workflow,
  compiledAgent,
  onUpdateCompiledAgent,
  isAgentCreated,
  isCreatingAgent,
  onCreateAgentNow,
  onBackToEditor,
}) => {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showDbInspector, setShowDbInspector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Active compiled record (uses saved DB record or live compilation fallback)
  const activeAgentRecord = useMemo<CompiledAgentRecord>(
    () => compiledAgent ?? compileAgentFromWorkflow(workflow),
    [compiledAgent, workflow],
  );

  const [messages, setMessages] = useState<AgentChatMessageRecord[]>(
    () => activeAgentRecord.chatHistory || [],
  );
  const [attachedDocs, setAttachedDocs] = useState<AgentAttachedDocument[]>(
    () => activeAgentRecord.attachedDocuments || [],
  );

  // Sync local state when switching agents or when compiledAgent updates
  useEffect(() => {
    const savedHistory = activeAgentRecord.chatHistory || [];
    const savedDocs = activeAgentRecord.attachedDocuments || [];
    setAttachedDocs(savedDocs);

    if (isAgentCreated) {
      if (savedHistory.length > 0) {
        setMessages(savedHistory);
      } else {
        const roleName = activeAgentRecord.aiBrain.agentRole;
        const toolsList = [
          ...activeAgentRecord.skills.map((s) => s.skillName),
          ...activeAgentRecord.mcps.map((m) => m.nodeName),
        ];
        const welcomeMsg: AgentChatMessageRecord = {
          id: 'welcome-msg',
          role: 'agent',
          text: `Olá! Eu sou o **${activeAgentRecord.name}** (*${roleName}*).\n\nMinhas configurações e conversas ficam salvas automaticamente no banco de dados:\n- **Diretriz da IA**: ${activeAgentRecord.aiBrain.systemMessage}\n- **Tom de Voz**: ${activeAgentRecord.aiBrain.toneOfVoice}\n- **Skills & MCPs**: ${toolsList.join(', ') || 'Raciocínio Direto'}\n- **Formato de Entrega**: ${activeAgentRecord.outputs.map((o) => o.outputType).join(', ') || 'Resposta no Chat'}\n\n💡 *Dica: Clique no botão **+** ao lado da barra de mensagem para anexar documentos (PDF, Word, TXT, CSV) para eu analisar!*`,
          toolsUsed: toolsList,
          modelBadge: 'Agente Compilado • Gemini 2.5 Flash Pronto',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMessages([welcomeMsg]);
        void saveAgentConversationAndDocs(
          activeAgentRecord.id,
          [welcomeMsg],
          savedDocs,
          activeAgentRecord,
        ).then((updated) => {
          if (updated && onUpdateCompiledAgent) onUpdateCompiledAgent(updated);
        });
      }
    }
  }, [isAgentCreated, activeAgentRecord.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Extract connected blocks for the active Agent summary
  const aiNode = workflow.nodes.find(
    (n) => n.type === '@n8n/n8n-nodes-langchain.agent',
  );
  const inputNodes = workflow.nodes.filter((n) => {
    const d = getNodeTypeDescription(n.type);
    return d.category === 'trigger' && n.type !== 'ai.repeater';
  });
  const repeaterNodes = workflow.nodes.filter((n) => n.type === 'ai.repeater');
  const toolNodes = workflow.nodes.filter((n) => {
    const d = getNodeTypeDescription(n.type);
    return d.category === 'ai_subnode';
  });
  const outputNodes = workflow.nodes.filter((n) =>
    [
      'ai.responseOutput',
      'ai.outputReport',
      'ai.outputDashboard',
      'ai.outputText',
    ].includes(n.type),
  );

  // Persist helper for chat + documents
  const persistChatAndDocs = async (
    nextMessages: AgentChatMessageRecord[],
    nextDocs: AgentAttachedDocument[],
  ) => {
    const updated = await saveAgentConversationAndDocs(
      activeAgentRecord.id,
      nextMessages,
      nextDocs,
      activeAgentRecord,
    );
    if (updated && onUpdateCompiledAgent) {
      onUpdateCompiledAgent(updated);
    }
  };

  // Handle uploading documents via the "+" button
  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newDocs: AgentAttachedDocument[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const extractedText = await extractTextFromFile(file);

      // Convert file to Base64 asynchronously using FileReader so it never blocks or hangs
      let base64Data: string | undefined;
      try {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || '');
            const base64Index = res.indexOf('base64,');
            if (base64Index !== -1) {
              resolve(res.substring(base64Index + 7));
            } else {
              resolve(res);
            }
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      } catch {
        // fallback
      }

      newDocs.push({
        id: `doc-${Date.now()}-${i}`,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        uploadedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        extractedText,
        base64Data,
      });
    }

    const updatedDocs = [...attachedDocs, ...newDocs];
    setAttachedDocs(updatedDocs);
    await persistChatAndDocs(messages, updatedDocs);

    // Reset input value so the same file can be selected again if needed
    e.target.value = '';
  };

  const handleRemoveDocument = async (docId: string) => {
    const nextDocs = attachedDocs.filter((d) => d.id !== docId);
    setAttachedDocs(nextDocs);
    await persistChatAndDocs(messages, nextDocs);
  };

  const handleClearConversation = async () => {
    const welcomeOnly = messages.slice(0, 1);
    setMessages(welcomeOnly);
    await persistChatAndDocs(welcomeOnly, attachedDocs);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptText = (customPrompt ?? input).trim();
    if (!promptText || isThinking) return;

    const userMsg: AgentChatMessageRecord = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      attachedDocNames:
        attachedDocs.length > 0 ? attachedDocs.map((d) => d.name) : undefined,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const historyWithUser = [...messages, userMsg];
    setMessages(historyWithUser);
    if (!customPrompt) setInput('');
    setIsThinking(true);

    // Save user message immediately in DB
    await persistChatAndDocs(historyWithUser, attachedDocs);

    try {
      const usedTools = [
        ...activeAgentRecord.skills.map((s) => s.skillName),
        ...activeAgentRecord.mcps.map((m) => m.nodeName),
      ];

      const result = await chatWithCompiledAgent(
        activeAgentRecord,
        promptText,
        messages.map((m) => ({ role: m.role, text: m.text })),
        attachedDocs,
      );

      const agentMsg: AgentChatMessageRecord = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        text: result.text,
        toolsUsed: usedTools,
        modelBadge: result.usedGeminiLive
          ? `Gemini (${result.modelUsed})`
          : 'Motor Compilado Local',
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const finalMessages = [...historyWithUser, agentMsg];
      setMessages(finalMessages);
      await persistChatAndDocs(finalMessages, attachedDocs);
    } finally {
      setIsThinking(false);
    }
  };

  // STATE 1: AGENT NOT CREATED YET
  if (!isAgentCreated) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color--background)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            backgroundColor: 'var(--color--background--light-3)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 16,
            padding: '36px 32px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'hsla(7, 100%, 68%, 0.12)',
              border: '2px dashed #ff6d5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff6d5a',
            }}
          >
            <Bot size={32} />
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--color--text--shade-1)',
              }}
            >
              Agente ainda não criado
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13.5,
                color: 'var(--color--text--tint-1)',
                lineHeight: 1.5,
              }}
            >
              Você montou os blocos de{' '}
              <strong>{workflow.name || 'seu Agente'}</strong> no estúdio, mas
              ainda precisa clicar em <strong>Criar Agente</strong> para
              registrar as informações no banco de dados e usá-lo como no
              ChatGPT.
            </p>
          </div>

          {/* Preview of blocks that will be compiled */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--color--background--light-2)',
              border: '1px solid var(--color--foreground--tint-1)',
              borderRadius: 10,
              padding: '12px 14px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: 'var(--color--text--shade-1)',
                marginBottom: 2,
              }}
            >
              Blocos prontos para registro ({workflow.nodes.length}):
            </div>
            <div style={{ color: 'var(--color--text--tint-1)' }}>
              • <strong>Cérebro IA:</strong>{' '}
              {aiNode
                ? `${aiNode.name} (${aiNode.parameters?.agentRole || 'Especialista'})`
                : 'Nenhum bloco de IA'}
            </div>
            <div style={{ color: 'var(--color--text--tint-1)' }}>
              • <strong>Entradas:</strong>{' '}
              {inputNodes.length > 0
                ? inputNodes.map((i) => i.name).join(', ')
                : 'Nenhuma entrada'}
            </div>
            <div style={{ color: 'var(--color--text--tint-1)' }}>
              • <strong>Skills & Conectores MCP:</strong>{' '}
              {toolNodes.length > 0
                ? toolNodes.map((t) => t.name).join(', ')
                : 'Nenhuma ferramenta conectada'}
            </div>
            <div style={{ color: 'var(--color--text--tint-1)' }}>
              • <strong>Saídas:</strong>{' '}
              {outputNodes.length > 0
                ? outputNodes.map((o) => o.name).join(', ')
                : 'Resposta padrão no chat'}
            </div>
          </div>

          <div
            style={{ display: 'flex', gap: 10, width: '100%', marginTop: 6 }}
          >
            <button
              onClick={onBackToEditor}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--color--foreground--tint-1)',
                backgroundColor: 'var(--color--background--light-2)',
                color: 'var(--color--text--shade-1)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Voltar aos Blocos
            </button>

            <button
              onClick={onCreateAgentNow}
              disabled={isCreatingAgent}
              style={{
                flex: 1.3,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--color--primary--shade-1)',
                backgroundColor: 'var(--color--primary)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                cursor: isCreatingAgent ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px hsla(7, 100%, 68%, 0.3)',
              }}
            >
              {isCreatingAgent ? (
                <Wand2 size={15} className="n8n-spin" />
              ) : (
                <Play size={14} fill="#ffffff" />
              )}
              <span>
                {isCreatingAgent ? 'Criando Agente...' : 'Criar Agente Agora'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STATE 2: CHATGPT-LIKE INTERFACE WITH CONNECTED TOOLS, DOCUMENT UPLOAD (+) & DB PERSISTENCE
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--color--background)',
        overflow: 'hidden',
      }}
    >
      {/* Hidden File Input triggered by "+" buttons */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.pptx,.xlsx"
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      {/* Left Info Column: Active Agent Capabilities + Uploaded Docs + Database Registration */}
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid var(--color--foreground--tint-1)',
          backgroundColor: 'var(--color--background--light-3)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingBottom: 14,
            borderBottom: '1px solid var(--color--foreground--tint-1)',
          }}
        >
          <NodeIcon iconName="Bot" color="#ff6d5a" size={40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--color--text--shade-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeAgentRecord.name}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: '#16a34a',
                marginTop: 2,
              }}
            >
              <CheckCircle2 size={12} /> Salvo no Banco (v
              {activeAgentRecord.version})
            </div>
          </div>
        </div>

        {/* AI Brain Summary */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid hsla(7, 100%, 68%, 0.35)',
            fontSize: 11.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 800, color: '#ff6d5a' }}>
            CÉREBRO IA ({activeAgentRecord.aiBrain.agentRole})
          </div>
          <div style={{ color: 'var(--color--text--tint-1)', lineHeight: 1.4 }}>
            {activeAgentRecord.aiBrain.systemMessage}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--color--text--shade-1)',
              marginTop: 2,
            }}
          >
            <strong>Tom:</strong> {activeAgentRecord.aiBrain.toneOfVoice}
          </div>
        </div>

        {/* Uploaded Documents Section with "+" Button */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--color--text--tint-1)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Paperclip size={12} /> Documentos no Agente ({attachedDocs.length}
              )
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Adicionar Documento ao Agente"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #3b82f6',
                backgroundColor: 'hsla(217, 91%, 60%, 0.12)',
                color: '#3b82f6',
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attachedDocs.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 11.5,
                  color: 'var(--color--text--tint-1)',
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px dashed var(--color--foreground--tint-1)',
                  backgroundColor: 'var(--color--background--light-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                + Clique para anexar PDF, Word, TXT ou Planilha
              </div>
            ) : (
              attachedDocs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 8,
                    backgroundColor: 'var(--color--background--light-2)',
                    border: '1px solid hsla(217, 91%, 60%, 0.35)',
                  }}
                >
                  <FileText size={16} color="#3b82f6" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--color--text--shade-1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {doc.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--color--text--tint-1)',
                      }}
                    >
                      {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB •{' '}
                      {doc.uploadedAt}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(doc.id)}
                    title="Remover documento"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color--text--tint-1)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Tools / Skills */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--color--text--tint-1)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Wrench size={12} /> Ferramentas Conectadas ({toolNodes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {toolNodes.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color--text--tint-1)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  backgroundColor: 'var(--color--background--light-2)',
                }}
              >
                Nenhuma Skill ou MCP extra conectado.
              </div>
            ) : (
              toolNodes.map((t) => {
                const d = getNodeTypeDescription(t.type);
                const subDetail =
                  t.type === 'ai.customSkill'
                    ? String(t.parameters?.skillName || d.badgeLabel)
                    : d.badgeLabel || 'FERRAMENTA';
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      backgroundColor: 'var(--color--background--light-2)',
                      border: `1px solid ${d.color}40`,
                    }}
                  >
                    <NodeIcon iconName={d.icon} color={d.color} size={26} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--color--text--shade-1)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.name}
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
                        {subDetail}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Repeater / Schedule if present */}
        {repeaterNodes.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color--text--tint-1)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Repeat size={12} /> Agendamento Ativo
            </div>
            {repeaterNodes.map((rep) => (
              <div
                key={rep.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  backgroundColor: 'hsla(258, 90%, 66%, 0.1)',
                  border: '1px solid #8b5cf6',
                  fontSize: 12,
                  color: 'var(--color--text--shade-1)',
                }}
              >
                <strong>
                  {String(rep.parameters?.repeatInterval || 'Todo Dia')}
                </strong>{' '}
                ({String(rep.parameters?.executionSchedule || '09:00')})
              </div>
            ))}
          </div>
        )}

        {/* Database Inspector & Clear Chat */}
        <div
          style={{
            marginTop: 'auto',
            borderTop: '1px solid var(--color--foreground--tint-1)',
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleClearConversation}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--color--foreground--tint-1)',
                backgroundColor: 'var(--color--background)',
                color: 'var(--color--text--tint-1)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} /> Limpar Histórico da Conversa
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDbInspector((prev) => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color--foreground--tint-1)',
              backgroundColor: 'var(--color--background--light-2)',
              color: 'var(--color--text--shade-1)',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} color="#3b82f6" /> Registro no Banco (
              {messages.length} msgs)
            </span>
            {showDbInspector ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>

          {showDbInspector && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: 'var(--color--background)',
                border: '1px solid var(--color--foreground--tint-1)',
                fontSize: 10.5,
                color: 'var(--color--text--tint-1)',
                maxHeight: 200,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}
            >
              {`ID: ${activeAgentRecord.id}\nMensagens Salvas: ${
                messages.length
              }\nDocumentos Anexados: ${
                attachedDocs.length
              }\nAtualizado: ${new Date(
                activeAgentRecord.updatedAt,
              ).toLocaleTimeString()}\n\n--- PROMPT COMPILADO ---\n${
                activeAgentRecord.compiledSystemPrompt
              }`}
            </div>
          )}
        </div>
      </aside>

      {/* Main ChatGPT-like Conversation Area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: 'var(--color--background)',
        }}
      >
        {/* Outer Full-Width Scroll Container -> Places scrollbar at the far right edge ("canto direito total") */}
        <div
          style={{
            flex: 1,
            width: '100%',
            overflowY: 'auto',
            padding: '28px 24px',
          }}
        >
          {/* Inner Centered Message Column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              maxWidth: 820,
              width: '100%',
              margin: '0 auto',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor:
                      msg.role === 'user' ? '#3b82f6' : '#ff6d5a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {msg.role === 'user' ? <User size={17} /> : <Bot size={18} />}
                </div>

                <div
                  style={{
                    maxWidth: '78%',
                    backgroundColor:
                      msg.role === 'user'
                        ? '#3b82f6'
                        : 'var(--color--background--light-3)',
                    color:
                      msg.role === 'user'
                        ? '#ffffff'
                        : 'var(--color--text--shade-1)',
                    border:
                      msg.role === 'user'
                        ? 'none'
                        : '1px solid var(--color--foreground--tint-1)',
                    borderRadius: 14,
                    padding: '14px 18px',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.role === 'agent' &&
                    ((msg.toolsUsed && msg.toolsUsed.length > 0) ||
                      msg.modelBadge) && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {msg.modelBadge && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              backgroundColor: 'hsla(142, 72%, 29%, 0.12)',
                              color: '#16a34a',
                              border: '1px solid hsla(142, 72%, 29%, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {msg.modelBadge}
                          </span>
                        )}
                        {msg.toolsUsed?.map((tName) => (
                          <span
                            key={tName}
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              backgroundColor: 'hsla(38, 92%, 50%, 0.14)',
                              color: '#d97706',
                              border: '1px solid hsla(38, 92%, 50%, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Sparkles size={10} /> {tName}
                          </span>
                        ))}
                      </div>
                    )}

                  {msg.attachedDocNames && msg.attachedDocNames.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      {msg.attachedDocNames.map((docName) => (
                        <span
                          key={docName}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor:
                              msg.role === 'user'
                                ? 'rgba(255,255,255,0.2)'
                                : 'hsla(217, 91%, 60%, 0.12)',
                            color:
                              msg.role === 'user' ? '#ffffff' : '#3b82f6',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <FileText size={11} /> {docName}
                        </span>
                      ))}
                    </div>
                  )}

                  <div>{msg.text}</div>

                  <div
                    style={{
                      fontSize: 10,
                      opacity: 0.65,
                      marginTop: 6,
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isThinking && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: '#ff6d5a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot size={18} />
                </div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    backgroundColor: 'var(--color--background--light-3)',
                    border: '1px solid var(--color--foreground--tint-1)',
                    fontSize: 13,
                    color: 'var(--color--text--tint-1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Wand2 size={14} className="n8n-spin" color="#ff6d5a" />
                  Consultando Gemini com os documentos e regras do seu agente...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Bottom Prompt Input Bar (ChatGPT Style with "+" Document Upload Button) */}
        <div
          style={{
            borderTop: '1px solid var(--color--foreground--tint-1)',
            backgroundColor: 'var(--color--background--light-3)',
            padding: '14px 24px 16px',
          }}
        >
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {/* Active Attached Document Chips above input */}
            {attachedDocs.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {attachedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      backgroundColor: 'hsla(217, 91%, 60%, 0.12)',
                      border: '1px solid hsla(217, 91%, 60%, 0.35)',
                      color: '#3b82f6',
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    <FileText size={12} />
                    <span>{doc.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              {/* "+" Button to Add Documents (PDF, Docs, TXT, CSV) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Adicionar documento (PDF, Word, TXT, CSV, Planilha)"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  border: '1px solid var(--color--foreground--tint-1)',
                  backgroundColor: 'var(--color--background)',
                  color: 'var(--color--text--shade-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={20} />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Envie uma mensagem ou anexe documentos no (+) para ${activeAgentRecord.name}...`}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--color--foreground--tint-1)',
                  backgroundColor: 'var(--color--background)',
                  color: 'var(--color--text--shade-1)',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                style={{
                  padding: '12px 20px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor:
                    input.trim() && !isThinking
                      ? '#ff6d5a'
                      : 'var(--color--foreground--tint-1)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor:
                    input.trim() && !isThinking ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={15} />
                Enviar
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
