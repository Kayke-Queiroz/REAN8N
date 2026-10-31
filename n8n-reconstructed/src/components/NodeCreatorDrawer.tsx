import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NODE_TYPE_DESCRIPTIONS } from '../engine/nodeTypes';
import { INodeTypeDescription, NodeCategory } from '../engine/types';
import { NodeIcon } from './NodeIcon';
import { EdgeConnectionContext } from './Canvas';

interface NodeCreatorDrawerProps {
  isOpen: boolean;
  connectionContext: EdgeConnectionContext | null;
  onClose: () => void;
  onSelectNodeType: (
    typeDesc: INodeTypeDescription,
    ctx: EdgeConnectionContext | null,
  ) => void;
}

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Gatilhos (Triggers — 36px Pill)',
  core: 'Ações & Transformação (Standard 96×96)',
  flow: 'Controle de Fluxo & Roteamento (IF / Switch / Merge)',
  ai: 'Agentes de IA Configuráveis (Wide 256×96)',
  ai_subnode: 'Sub-Nós de IA (Circular 80×80 — Portas Diamond)',
  annotation: 'Anotações no Canvas (Sticky Notes)',
};

export const NodeCreatorDrawer: React.FC<NodeCreatorDrawerProps> = ({
  isOpen,
  connectionContext,
  onClose,
  onSelectNodeType,
}) => {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const all = Object.values(NODE_TYPE_DESCRIPTIONS);
    const filtered = all.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.displayName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    });

    const map = new Map<NodeCategory, INodeTypeDescription[]>();
    for (const desc of filtered) {
      const list = map.get(desc.category) ?? [];
      list.push(desc);
      map.set(desc.category, list);
    }
    return map;
  }, [search]);

  if (!isOpen) return null;

  return (
    <aside
      style={{
        position: 'absolute',
        top: 56,
        right: 0,
        bottom: 0,
        width: 370,
        backgroundColor: 'var(--color--background--light-3)',
        borderLeft: '1px solid var(--color--foreground--tint-1)',
        boxShadow: 'var(--shadow--dark)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color--foreground--tint-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color--text--shade-1)',
            }}
          >
            What happens next?
          </div>
          {connectionContext && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--color--primary)',
                marginTop: 2,
              }}
            >
              Conectando a partir de: <strong>{connectionContext.sourceNode}</strong>
            </div>
          )}
        </div>
        <button className="n8n-toolbar-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'var(--color--background--light-2)',
            border: '1px solid var(--color--foreground--tint-1)',
            borderRadius: 6,
            padding: '7px 10px',
          }}
        >
          <Search size={15} color="var(--color--text--tint-1)" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes (HTTP, Code, If, AI Agent, Merge...)"
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: 'var(--color--text--shade-1)',
              fontSize: 13,
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Categorized Node List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;

          return (
            <div key={cat}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color--text--tint-1)',
                  marginBottom: 8,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => onSelectNodeType(item, connectionContext)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      textAlign: 'left',
                      padding: '10px 12px',
                      backgroundColor: 'var(--color--background--light-2)',
                      border: '1px solid var(--color--foreground--tint-1)',
                      borderRadius: 8,
                      transition: 'border-color 0.12s ease, transform 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor =
                        'var(--color--foreground--tint-1)';
                    }}
                  >
                    <NodeIcon iconName={item.icon} color={item.color} size={34} />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: 'var(--color--text--shade-1)',
                        }}
                      >
                        {item.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--color--text--tint-1)',
                          marginTop: 2,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

