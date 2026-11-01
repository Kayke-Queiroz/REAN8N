import React from 'react';
import {
  BarChart3,
  Bot,
  Box,
  Calculator,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Database,
  FileCheck,
  FileText,
  GitBranch,
  GitMerge,
  Globe,
  LayoutDashboard,
  LucideIcon,
  MessageSquare,
  MessageSquareText,
  MousePointerClick,
  PenLine,
  PlugZap,
  Presentation,
  Repeat,
  SendHorizontal,
  Sparkles,
  Split,
  StickyNote,
  Table,
  UploadCloud,
  Wand2,
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
  MessageSquareText,
  Cpu,
  Presentation,
  Repeat,
  PlugZap,
  CheckCircle2,
  Wand2,
  FileText,
  FileCheck,
  LayoutDashboard,
  BarChart3,
  UploadCloud,
  MessageSquare,
  SendHorizontal,
  Table,
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
