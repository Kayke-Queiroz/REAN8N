import React from 'react';
import {
  Bot,
  Box,
  Calculator,
  Clock,
  Code2,
  Database,
  GitBranch,
  GitMerge,
  Globe,
  LucideIcon,
  MousePointerClick,
  PenLine,
  Sparkles,
  Split,
  StickyNote,
  Webhook,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  MousePointerClick,
  Webhook,
  Clock,
  Globe,
  PenLine,
  Code2,
  GitBranch,
  Split,
  GitMerge,
  Bot,
  Sparkles,
  Database,
  Calculator,
  StickyNote,
  Box,
};

interface NodeIconProps {
  iconName: string;
  color: string;
  size?: number;
}

export const NodeIcon: React.FC<NodeIconProps> = ({ iconName, color, size = 36 }) => {
  const IconComponent = ICON_MAP[iconName] || Box;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? 10 : 6,
        backgroundColor: `${color}1c`,
        border: `1px solid ${color}45`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconComponent size={Math.round(size * 0.62)} color={color} strokeWidth={2.1} />
    </div>
  );
};
