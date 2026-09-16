import React from 'react';
import type { VerdictType } from '../../types';

interface StatusBadgeProps {
  type?: VerdictType;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

const BADGE_CONFIG: Record<
  VerdictType,
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  usable: {
    label: '사용 가능',
    icon: 'task_alt',
    bg: 'bg-[#E7F0E6] dark:bg-[#315C36]/30',
    text: 'text-[#315C36] dark:text-[#34C759]',
    border: 'border-[#315C36]/20 dark:border-[#315C36]/40',
  },
  action_needed: {
    label: '확인 필요',
    icon: 'warning',
    bg: 'bg-[#FF9F0A]/12 dark:bg-[#FF9F0A]/20',
    text: 'text-[#D97706] dark:text-[#FF9F0A]',
    border: 'border-[#FF9F0A]/30 dark:border-[#FF9F0A]/40',
  },
  drying: {
    label: '부숙 진행 중',
    icon: 'heat_pump',
    bg: 'bg-[#F2F2F7] dark:bg-[#2C2C2E]',
    text: 'text-[#6E6E73] dark:text-[#8E8E93]',
    border: 'border-black/5 dark:border-white/10',
  },
  too_dry: {
    label: '기준보다 건조',
    icon: 'water_drop',
    bg: 'bg-[#F2F2F7] dark:bg-[#2C2C2E]',
    text: 'text-[#6E6E73] dark:text-[#8E8E93]',
    border: 'border-black/5 dark:border-white/10',
  },
  first: {
    label: '첫 기록',
    icon: 'flag',
    bg: 'bg-[#F2F2F7] dark:bg-[#2C2C2E]',
    text: 'text-[#6E6E73] dark:text-[#8E8E93]',
    border: 'border-black/5 dark:border-white/10',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type = 'drying',
  label,
  className = '',
  size = 'md',
}) => {
  const config = BADGE_CONFIG[type] ?? BADGE_CONFIG.drying;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${config.bg} ${config.text} ${config.border} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      } ${className}`}
    >
      <span className="material-symbols-outlined text-[14px] leading-none">
        {config.icon}
      </span>
      <span>{displayLabel}</span>
    </span>
  );
};
