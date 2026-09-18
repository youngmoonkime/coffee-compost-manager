import React from 'react';
import {
  Sun,
  ClipboardCheck,
  CirclePlus,
  LayoutGrid,
  Sparkles,
  Bot,
  BarChart3,
  Settings,
  Moon,
} from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { useAccess } from '../../contexts/AccessContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ActiveTab } from '../../types';

export const DesktopSidebar: React.FC = () => {
  const { activeTab, setActiveTab, setHistoryPileKey, setRanchPicked, isSheetBackend, pendingCount } =
    useCompost();
  const { isDark, toggleTheme } = useTheme();

  const { isManager, managerRanch } = useAccess();

  const allFieldNavItems: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'today', label: '현장점검', icon: ClipboardCheck },
    { id: 'monitoring', label: '측정 기록', icon: CirclePlus },
    { id: 'history', label: '장소 현황', icon: LayoutGrid },
  ];
  // 목장 매니저: 현장점검 단일 탭만
  const fieldNavItems = isManager
    ? [{ id: 'today' as ActiveTab, label: '현장점검', icon: ClipboardCheck }]
    : allFieldNavItems;

  const analysisNavItems: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'impact', label: '수거 & 임팩트', icon: BarChart3 },
    { id: 'assistant', label: '지소행 AI 어시스턴트', icon: Bot },
    { id: 'simulation', label: '축사 시뮬레이션', icon: Sparkles },
  ];

  const managementNavItems: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'settings', label: '설정', icon: Settings },
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-60 lg:w-64 bg-[#FFFFFF] dark:bg-[#1C1C1E] border-r border-black/5 dark:border-white/10 h-full shrink-0 select-none z-30 transition-colors duration-200"
      role="navigation"
      aria-label="데스크톱 메뉴"
    >
      {/* 로고 및 서비스 타이틀 */}
      <div className="p-5 pb-4 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="지구를 지키는 소소한 행동"
            className="w-10 h-10 object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-tight">
              C.TRACK
            </h1>
            {managerRanch ? (
              <span className="text-[11px] font-semibold text-[#315C36] dark:text-[#34C759]">{managerRanch} 매니저</span>
            ) : (
              <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">커피박 자원순환 시스템</span>
            )}
          </div>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* 현장 작업 그룹 */}
        <div>
          <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] px-3 mb-1.5 block uppercase tracking-wider">
            현장 작업
          </span>
          <div className="space-y-1">
            {fieldNavItems.map(item => {
              const isActive =
                activeTab === item.id || (item.id === 'today' && activeTab === 'inspection');
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'history') setHistoryPileKey(null);
                    if (item.id === 'today') setRanchPicked(false);
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#E7F0E6] dark:bg-[#315C36]/30 text-[#315C36] dark:text-[#34C759] font-bold shadow-xs'
                      : 'text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'monitoring' && pendingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FF9F0A] text-white text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!isManager && (
        <>
        {/* 분석 그룹 */}
        <div>
          <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] px-3 mb-1.5 block uppercase tracking-wider">
            분석
          </span>
          <div className="space-y-1">
            {analysisNavItems.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#E7F0E6] dark:bg-[#315C36]/30 text-[#315C36] dark:text-[#34C759] font-bold shadow-xs'
                      : 'text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        </>
        )}

        {/* 관리 그룹 */}
        <div>
          <span className="text-[11px] font-bold text-[#8E8E93] dark:text-[#6E6E73] px-3 mb-1.5 block uppercase tracking-wider">
            관리
          </span>
          <div className="space-y-1">
            {managementNavItems.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#E7F0E6] dark:bg-[#315C36]/30 text-[#315C36] dark:text-[#34C759] font-bold shadow-xs'
                      : 'text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 하단 시스템 상태 & 테마 토글 */}
      <div className="p-3.5 border-t border-black/5 dark:border-white/10 bg-[#F9F9FB] dark:bg-[#2C2C2E]/60 m-3 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isSheetBackend ? 'bg-[#34C759]' : 'bg-[#FF9F0A]'
              }`}
            />
            <span className="text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {isSheetBackend ? '시트 연동 중' : '로컬 모드'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F2F2F7] dark:hover:bg-[#3A3A3C] active:scale-95 transition-all"
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#FF9F0A]" />
                <span>라이트</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#1D1D1F]" />
                <span>다크</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
