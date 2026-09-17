import React, { useState } from 'react';
import { MoreHorizontal, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { MoreMenu } from './MoreMenu';
import { useAccess } from '../../contexts/AccessContext';

interface AppHeaderProps {
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenHelp, onOpenAbout }) => {
  const { isDark, toggleTheme } = useTheme();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { managerRanch } = useAccess();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 pt-safe bg-white/85 dark:bg-[#121214]/90 backdrop-blur-2xl border-b border-black/5 dark:border-white/10 shadow-xs">
      <div className="h-14 px-4 flex items-center justify-between">
        {/* 좌측: 서비스명 및 로고 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/logo.png"
            alt="지구를 지키는 소소한 행동"
            className="w-8 h-8 object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-bold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight truncate leading-tight">
              커피박 부숙 관리
            </h1>
            {managerRanch && (
              <span className="block text-[11px] font-semibold text-[#315C36] dark:text-[#34C759] truncate">
                {managerRanch} 매니저
              </span>
            )}
          </div>
        </div>

        {/* 우측: 테마 변경 + 더보기 버튼 */}
        <div className="flex items-center gap-1.5">
          {/* 다크/라이트 모드 토글 버튼 (44x44px 터치 영역) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-95 transition-all"
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#FF9F0A]" />
            ) : (
              <Moon className="w-4 h-4 text-[#1D1D1F]" />
            )}
          </button>

          {/* 더보기 버튼 (44x44px 터치 영역) */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(prev => !prev)}
            className={`min-w-[44px] min-h-[44px] w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
              isMoreMenuOpen
                ? 'bg-[#315C36] text-white'
                : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C]'
            }`}
            title="더보기 메뉴 열기"
            aria-label="더보기 메뉴 열기"
            aria-expanded={isMoreMenuOpen}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 전역 Popover 더보기 메뉴 */}
      <MoreMenu
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        onOpenHelp={onOpenHelp}
        onOpenAbout={onOpenAbout}
      />
    </header>
  );
};
