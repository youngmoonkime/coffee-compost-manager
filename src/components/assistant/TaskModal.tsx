import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface TaskModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 빠른 실행 결과를 띄우는 팝업 — 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 창.
 * 화면 전환 애니메이션(transform) 안에서 fixed 위치가 틀어지지 않도록 body 에 붙인다.
 */
export const TaskModal: React.FC<TaskModalProps> = ({ title, subtitle, onClose, children }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-black/5 dark:border-white/10 shrink-0">
          <div className="min-w-0">
            <h3 id="task-modal-title" className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
              {title}
            </h3>
            {subtitle && <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] truncate">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 shrink-0 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 sm:px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body
  );
};
