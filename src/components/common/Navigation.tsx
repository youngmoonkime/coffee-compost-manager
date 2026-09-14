import React from 'react';
import { useCompost } from '../../contexts/CompostContext';
import type { ActiveTab } from '../../types';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, setHistoryPileKey } = useCompost();

  const navItems: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'monitoring', label: '측정 기록', icon: 'edit_note' },
    { id: 'history', label: '장소별 현황', icon: 'location_on' },
    { id: 'settings', label: '설정/관리', icon: 'tune' },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(46,74,43,0.06)]">
      <div className="max-w-xl mx-auto flex justify-around items-center h-16 px-margin-screen">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                // 하단 탭으로 들어오면 항상 장소 목록부터 보여준다 (상세는 목록이나 결과 화면에서 연다)
                if (item.id === 'history') setHistoryPileKey(null);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center min-w-[72px] min-h-[44px] gap-1 transition-all ${
                isActive
                  ? 'text-primary font-bold scale-105'
                  : 'text-on-surface-variant/80 hover:text-on-surface'
              }`}
              type="button"
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'font-bold' : ''}`}>
                {item.icon}
              </span>
              <span className="font-label-sm text-[11px] leading-tight">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary -mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
