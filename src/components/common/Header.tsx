import React from 'react';

export const Header: React.FC = () => {


  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
      <div className="h-16 px-margin-screen max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logo.png"
            alt="지구를 지키는 소소한 행동"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
          />
          <span className="font-bold text-[15px] sm:text-[16px] text-primary leading-tight tracking-tight whitespace-nowrap">
            커피박 부숙 관리
          </span>
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
