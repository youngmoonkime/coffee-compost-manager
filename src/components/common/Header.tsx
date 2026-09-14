import React from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';

export const Header: React.FC = () => {
  const { activePile } = useCompost();

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
      <div className="h-16 px-margin-screen max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">compost</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-bold text-[14.5px] sm:text-[16px] text-primary leading-tight tracking-tight whitespace-nowrap">
              커피박 부숙 관리
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[10px] sm:text-[11px] font-mono tracking-tight shrink-0">
              {activePile.ranchName || DEFAULT_RANCH_NAME}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            title="관리자 프로필"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
