import React from 'react';
import { Sun, CirclePlus, LayoutGrid } from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import type { ActiveTab } from '../../types';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
}

export const MobileTabBar: React.FC = () => {
  const { activeTab, setActiveTab, setHistoryPileKey } = useCompost();

  const navItems: NavItem[] = [
    { id: 'today', label: '오늘', icon: Sun },
    { id: 'monitoring', label: '측정', icon: CirclePlus },
    { id: 'history', label: '현황', icon: LayoutGrid },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-white/85 dark:bg-[#121214]/90 backdrop-blur-2xl border-t border-black/5 dark:border-white/10 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      role="navigation"
      aria-label="하단 네비게이션 메뉴"
    >
      <div className="flex justify-around items-center h-16 px-4 max-w-md mx-auto">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'history') setHistoryPileKey(null);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition-all active:scale-95 ${
                isActive
                  ? 'text-[#315C36] dark:text-[#34C759] font-bold'
                  : 'text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
              }`}
              type="button"
              aria-label={`${item.label} 화면으로 이동`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center">
                <IconComponent
                  className={`w-6 h-6 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span className="text-[11px] font-medium leading-tight mt-1">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#315C36] dark:bg-[#34C759] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
