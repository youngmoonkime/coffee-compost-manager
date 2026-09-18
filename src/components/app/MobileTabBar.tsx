import React, { useRef } from 'react';
import { ClipboardCheck, CirclePlus, LayoutGrid } from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { useAccess } from '../../contexts/AccessContext';
import type { ActiveTab } from '../../types';

interface MobileTabBarProps {
  /** 읽어 내려가는 동안 true — 탭바를 아래로 치운다 */
  hidden?: boolean;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
}

/**
 * 모바일(스마트폰) 전용 Apple 감성 플로팅 세그먼트 탭바
 * - 3개 핵심 탭 구성: 현장점검, 측정, 현황
 * - iOS 스타일의 미니멀 블러 글래스모피즘 & 부드러운 슬라이딩 인디케이터
 * - 가벼운 햅틱 및 스와이프 제스처 지원
 * - 본문을 읽어 내려가는 동안에는 아래로 미끄러져 숨는다 (hidden)
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ hidden = false }) => {
  const { activeTab, setActiveTab, setHistoryPileKey, setRanchPicked } = useCompost();
  const { isManager } = useAccess();
  // 가벼운 좌우 스와이프 제스처 — 훅은 아래 조건부 반환보다 먼저 부른다
  const touchStartX = useRef<number>(0);

  // 모바일 핵심 3대 탭 (시뮬레이션 제외)
  const navItems: NavItem[] = [
    { id: 'today', label: '현장점검', icon: ClipboardCheck },
    { id: 'monitoring', label: '측정', icon: CirclePlus },
    { id: 'history', label: '현황', icon: LayoutGrid },
  ];

  // 매니저 계정은 현장점검 단일 화면 운영
  if (isManager) return null;

  // 현재 활성 탭 인덱스 계산 (inspection은 today로 매핑)
  const currentTabId = activeTab === 'inspection' ? 'today' : activeTab;
  const activeIndex = Math.max(0, navItems.findIndex(item => item.id === currentTabId));

  const triggerSelect = (item: NavItem) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    if (item.id === 'history') setHistoryPileKey(null);
    if (item.id === 'today') setRanchPicked(false);
    setActiveTab(item.id);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 45; // 45px 이상 스와이프 시 전환

    if (deltaX < -threshold && activeIndex < navItems.length - 1) {
      // 좌측 스와이프 -> 다음 탭
      triggerSelect(navItems[activeIndex + 1]);
    } else if (deltaX > threshold && activeIndex > 0) {
      // 우측 스와이프 -> 이전 탭
      triggerSelect(navItems[activeIndex - 1]);
    }
  };

  return (
    <aside
      aria-label="모바일 하단 내비게이션"
      className={`md:hidden fixed bottom-4 left-0 right-0 z-40 flex justify-center pointer-events-none px-4 pb-safe transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none ${
        hidden ? 'translate-y-[160%] opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <nav
        role="navigation"
        aria-label="하단 주요 메뉴"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`${hidden ? 'pointer-events-none' : 'pointer-events-auto'} relative w-full max-w-[320px] h-[64px] p-1.5 rounded-[32px] bg-white/80 dark:bg-[#1c1c1e]/85 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] select-none`}
      >
        {/* 부드러운 슬라이딩 활성 캡슐 (Sliding Active Pill) */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-[26px] bg-white dark:bg-[#2c2c2e] shadow-[0_3px_12px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            width: 'calc((100% - 12px) / 3)',
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />

        {/* 3개 탭 그리드 */}
        <div className="relative z-10 w-full h-full grid grid-cols-3">
          {navItems.map((item, index) => {
            const isActive = index === activeIndex;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => triggerSelect(item)}
                className={`relative flex flex-col items-center justify-center h-full rounded-[26px] transition-all duration-200 active:scale-95 cursor-pointer outline-none ${
                  isActive
                    ? 'text-[#1B4332] dark:text-[#52B788]'
                    : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                }`}
                aria-label={`${item.label} 화면으로 이동`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* 아이콘 */}
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.3] scale-105' : 'stroke-[1.8]'
                  }`}
                />

                {/* 라벨 */}
                <span
                  className={`text-[11px] tracking-tight leading-none mt-1 transition-all duration-200 ${
                    isActive
                      ? 'font-semibold text-[#1B4332] dark:text-[#52B788]'
                      : 'font-medium opacity-80'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
