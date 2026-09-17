import React, { useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  BarChart3,
  Settings,
  HelpCircle,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { useAccess } from '../../contexts/AccessContext';

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({
  isOpen,
  onClose,
  onOpenHelp,
  onOpenAbout,
}) => {
  const { setActiveTab } = useCompost();
  const { isManager } = useAccess();
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 감지
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-40 bg-black/10 dark:bg-black/25 backdrop-blur-[1px] md:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover 메뉴 컨테이너 */}
      <div
        ref={menuRef}
        role="menu"
        aria-label="더보기 글로벌 메뉴"
        className="fixed right-3 top-16 z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-black/8 dark:border-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)] p-2 text-[#1D1D1F] dark:text-[#F5F5F7] animate-in fade-in zoom-in-95 duration-150 origin-top-right focus:outline-none"
      >
        {/* 목장 매니저에게는 분석 도구를 보여 주지 않는다 */}
        {!isManager && (
        <>
        {/* 그룹 1: 작업 도구 */}
        <div className="px-2 pt-2 pb-1 text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] uppercase tracking-wider">
          작업 도구
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(() => setActiveTab('impact'))}
            className="w-full flex items-center justify-between min-h-[46px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#315C36]/10 dark:bg-[#34C759]/15 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold block">수거 & 임팩트 대시보드</span>
                <span className="text-[11px] text-[#8E8E93] block">월별 매장 수거량 및 통계 분석</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(() => setActiveTab('assistant'))}
            className="w-full flex items-center justify-between min-h-[46px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#315C36]/10 dark:bg-[#34C759]/15 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold block">지소행 AI 어시스턴트</span>
                <span className="text-[11px] text-[#8E8E93] block">자원순환 임팩트 리포터 & 가이드</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(() => setActiveTab('simulation'))}
            className="w-full flex items-center justify-between min-h-[46px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#315C36]/10 dark:bg-[#34C759]/15 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <span className="text-sm font-semibold block">축사 시뮬레이션</span>
                <span className="text-[11px] text-[#8E8E93] block">악취 및 톱밥 절감 효과 분석</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* 구분선 */}
        <div className="my-1.5 h-px bg-black/5 dark:bg-white/10" />

        </>
        )}

        {/* 그룹 2: 관리 */}
        <div className="px-2 pt-1 pb-1 text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] uppercase tracking-wider">
          관리
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(() => setActiveTab('settings'))}
            className="w-full flex items-center justify-between min-h-[44px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold">설정</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* 구분선 */}
        <div className="my-1.5 h-px bg-black/5 dark:bg-white/10" />

        {/* 그룹 3: 기타 */}
        <div className="px-2 pt-1 pb-1 text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] uppercase tracking-wider">
          기타
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(onOpenHelp)}
            className="w-full flex items-center justify-between min-h-[44px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold">도움말</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleItemClick(onOpenAbout)}
            className="w-full flex items-center justify-between min-h-[44px] px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.99] transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center">
                <Info className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold">앱 정보</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-[#1D1D1F] dark:group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    </>
  );
};
