import React, { useRef, useEffect } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { AppHeader } from './AppHeader';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';

interface AppShellProps {
  children: React.ReactNode;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  onOpenHelp,
  onOpenAbout,
}) => {
  const { activeTab } = useCompost();
  const mainRef = useRef<HTMLElement>(null);

  // 탭 전환 시 스크롤 상단 리셋
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  return (
    <div className="flex h-full w-full bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] overflow-hidden antialiased selection:bg-[#315C36] selection:text-white transition-colors duration-200">
      {/* 데스크톱 사이드바 */}
      <DesktopSidebar />

      {/* 메인 영역 */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative bg-[#F5F5F7] dark:bg-[#000000] transition-colors duration-200">
        {/* 모바일 헤더 */}
        <AppHeader onOpenHelp={onOpenHelp} onOpenAbout={onOpenAbout} />

        {/* 컨텐츠 스크롤 영역 */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-6 pb-24 md:pb-8 px-4 sm:px-6 md:px-8 w-full max-w-5xl mx-auto smooth-scroll bg-[#F5F5F7] dark:bg-[#000000] transition-colors duration-200"
        >
          {children}
        </main>

        {/* 모바일 하단 탭 바 */}
        <MobileTabBar />
      </div>
    </div>
  );
};
