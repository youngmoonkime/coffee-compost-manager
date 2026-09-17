import React from 'react';

/**
 * 이 숫자가 어디서 왔는지 밝히는 배지.
 *
 * - measured: 현장에서 직접 잰 값
 * - computed: 앱이 기록으로 셈한 값
 * - observed: 현장 경험에서 나온 기준 (확정된 기준이 아니다)
 * - ai: AI 가 만든 문장
 */
export type SourceKind = 'measured' | 'computed' | 'observed' | 'ai';

const SOURCE_META: Record<SourceKind, { text: string; className: string }> = {
  measured: {
    text: '실측',
    className: 'bg-[#315C36]/10 text-[#315C36] dark:bg-[#34C759]/20 dark:text-[#34C759]',
  },
  computed: {
    text: '계산',
    className: 'bg-[#007AFF]/10 text-[#0062CC] dark:bg-[#0A84FF]/20 dark:text-[#0A84FF]',
  },
  observed: {
    text: '현장 관찰',
    className: 'bg-[#FF9F0A]/10 text-[#B06000] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A]',
  },
  ai: {
    text: 'AI 제안',
    className: 'bg-[#AF52DE]/10 text-[#8944AB] dark:bg-[#BF5AF2]/20 dark:text-[#BF5AF2]',
  },
};

export const SourceBadge: React.FC<{ kind: SourceKind; className?: string }> = ({ kind, className = '' }) => {
  const meta = SOURCE_META[kind];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-caption text-[10px] font-bold whitespace-nowrap ${meta.className} ${className}`}
    >
      {meta.text}
    </span>
  );
};
