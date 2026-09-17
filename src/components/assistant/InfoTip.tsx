import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';

/*
 * ⓘ 설명 — 판정 방식·출처·AI 사용 여부 같은 보조 설명은 화면에 늘어놓지 않고 여기에 접어 둔다.
 * 누르면 바로 아래에 펼쳐진다 (팝업 안에서도 잘리지 않도록 겹쳐 띄우지 않는다).
 */

export const InfoButton: React.FC<{ open: boolean; onToggle: () => void; controls: string; label: string }> = ({
  open,
  onToggle,
  controls,
  label,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    aria-controls={controls}
    aria-label={`${label} 설명`}
    className={`inline-flex items-center justify-center w-6 h-6 -m-1 rounded-full shrink-0 transition-colors ${
      open ? 'text-[#315C36] dark:text-[#34C759]' : 'text-[#AEAEB2] dark:text-[#636366] hover:text-[#6E6E73]'
    }`}
  >
    <Info className="w-3.5 h-3.5" />
  </button>
);

export const InfoNote: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({
  id,
  children,
  className = '',
}) => (
  <div
    id={id}
    className={`mt-1.5 px-2.5 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] text-[11.5px] leading-relaxed text-[#6E6E73] dark:text-[#8E8E93] break-keep ${className}`}
  >
    {children}
  </div>
);

/** 제목 옆 ⓘ + 펼침 설명 */
export const InfoHeading: React.FC<{
  title: React.ReactNode;
  label: string;
  note: React.ReactNode;
  /** 제목 아래 늘 보이는 한 줄 (선택) */
  description?: React.ReactNode;
  className?: string;
}> = ({ title, label, note, description, className = '' }) => {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {title}
        <InfoButton open={open} onToggle={() => setOpen(v => !v)} controls={noteId} label={label} />
      </div>
      {description}
      {open && <InfoNote id={noteId}>{note}</InfoNote>}
    </div>
  );
};
