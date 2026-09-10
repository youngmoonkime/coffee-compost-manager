import React from 'react';
import { useCompost } from '../../contexts/CompostContext';

export const Header: React.FC = () => {
  const { activeBatch } = useCompost();

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
      <div className="h-16 px-margin-screen max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">compost</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[14.5px] sm:text-[16px] text-primary leading-tight tracking-tight whitespace-nowrap">
                커피박 부숙 관리
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container font-medium text-[10px] sm:text-[11px] font-mono tracking-tight shrink-0">
                {activeBatch?.ranchName?.replace(' (본장)', '') || '건준목장'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim animate-pulse shrink-0"></span>
              <span className="text-[10.5px] sm:text-caption text-on-surface-variant leading-none truncate">
                현장 센서 정상 가동
              </span>
            </div>
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
