import React, { useMemo, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { formatShortDate, summarizePiles } from '../../utils/calculations';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { LocationDetail } from './LocationDetail';
import { ScriptVersionNotice } from '../common/ScriptVersionNotice';
import { useAccess } from '../../contexts/AccessContext';

type StatusFilterType = 'all' | 'action_needed' | 'usable' | 'drying';

export const LocationStatusView: React.FC = () => {
  const {
    records,
    settings,
    setActiveTab,
    historyPileKey,
    setHistoryPileKey,
    reloadFromSheet,
    isLoadingFromSheet,
    isSheetBackend,
    pendingCount,
  } = useCompost();
  const { showToast } = useToast();
  const { isManager } = useAccess();

  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [ranchFilter, setRanchFilter] = useState<string | null>(null);

  // 장소 요약 목록
  const allPiles = useMemo(() => summarizePiles(records, settings), [records, settings]);

  // 목장 목록
  const ranches = useMemo(() => [...new Set(allPiles.map(p => p.pile.ranchName))], [allPiles]);
  const activeRanch = ranchFilter && ranches.includes(ranchFilter) ? ranchFilter : null;

  // 필터링 및 우선순위 정렬 (확인 필요한 장소를 맨 위로)
  const filteredPiles = useMemo(() => {
    let list = activeRanch ? allPiles.filter(p => p.pile.ranchName === activeRanch) : allPiles;

    if (statusFilter === 'action_needed') {
      list = list.filter(p => p.verdict.type === 'action_needed');
    } else if (statusFilter === 'usable') {
      list = list.filter(p => p.verdict.type === 'usable');
    } else if (statusFilter === 'drying') {
      list = list.filter(p => p.verdict.type === 'drying' || p.verdict.type === 'too_dry' || p.verdict.type === 'first');
    }

    // 확인 필요 장소를 최상단에 우선 정렬
    return [...list].sort((a, b) => {
      const aNeed = a.verdict.type === 'action_needed' ? 1 : 0;
      const bNeed = b.verdict.type === 'action_needed' ? 1 : 0;
      if (aNeed !== bNeed) return bNeed - aNeed;
      return b.latest.date.localeCompare(a.latest.date);
    });
  }, [allPiles, activeRanch, statusFilter]);

  // 현재 선택된 장소
  const selectedPile = useMemo(() => {
    if (!historyPileKey) return filteredPiles[0] ?? null;
    return allPiles.find(p => p.key === historyPileKey) ?? filteredPiles[0] ?? null;
  }, [allPiles, historyPileKey, filteredPiles]);

  const handleReload = async () => {
    const res = await reloadFromSheet();
    showToast(
      res.success ? '구글 시트에서 불러왔습니다' : '시트를 읽지 못했습니다',
      res.message,
      res.success ? 'success' : 'error'
    );
  };

  // 모바일에서 상세 화면이 선택된 경우 (화면 전체 덮기)
  // 단, 화면 크기 md 이상에서는 Split View를 유지
  return (
    <div className="flex flex-col w-full pb-8">
      {/* 1. 상단 헤더 */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] dark:text-[#FFFFFF] tracking-tight">
            장소 현황
          </h2>
          <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            장소별 함수율 및 부숙 단계를 확인하고 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isSheetBackend && (
            <button
              type="button"
              onClick={handleReload}
              disabled={isLoadingFromSheet}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] active:scale-95 transition-all disabled:opacity-50"
              title="구글 시트에서 최신 기록 가져오기"
            >
              <span className={`material-symbols-outlined text-[16px] text-[#315C36] dark:text-[#34C759] ${isLoadingFromSheet ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span className="hidden sm:inline">{isLoadingFromSheet ? '가져오는 중' : '새로고침'}</span>
            </button>
          )}
        </div>
      </div>

      {!isManager && <ScriptVersionNotice className="mb-3" />}

      {pendingCount > 0 && (
        <div className="mb-3 rounded-2xl border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 p-3 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FF9F0A] text-[18px]">cloud_off</span>
          <span>시트로 보내지 못한 기록 {pendingCount}건이 있습니다.</span>
        </div>
      )}

      {/* 2. 필터 바 */}
      {/* 2-1. 목장 필터 */}
      {ranches.length > 1 && (
        <div className="flex gap-1.5 mb-2.5 overflow-x-auto pb-1">
          {[null, ...ranches].map(name => {
            const active = name === activeRanch;
            return (
              <button
                key={name ?? '__all'}
                type="button"
                onClick={() => setRanchFilter(name)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
                  active
                    ? 'bg-[#315C36] text-white'
                    : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10 hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
                }`}
              >
                {name ?? '전체 목장'}
              </button>
            );
          })}
        </div>
      )}

      {/* 2-2. 상태 필터 Chips */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {[
          { id: 'all', label: '전체' },
          { id: 'action_needed', label: '확인 필요' },
          { id: 'usable', label: '사용 가능' },
          { id: 'drying', label: '부숙 진행 중' },
        ].map(tab => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as StatusFilterType)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                active
                  ? 'bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] shadow-xs'
                  : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. 본문: 모바일 상세 단독 뷰 vs 데스크톱 Split View */}
      {allPiles.length === 0 ? (
        <EmptyState
          icon="location_on"
          title="아직 등록된 장소가 없습니다"
          description={
            isManager
              ? '회사에서 이 목장의 커피박 투입을 기록하면 이곳에서 장소별 상태를 볼 수 있습니다.'
              : '[측정] 탭에서 하역 장소와 측정값을 입력하면 이곳에서 장소별 상태를 모아볼 수 있습니다.'
          }
          actionLabel={isManager ? undefined : '첫 측정 기록하기'}
          onAction={isManager ? undefined : () => setActiveTab('monitoring')}
        />
      ) : (
        <>
          {/* 모바일 화면: 상세가 열려있을 때 상세만 렌더링 */}
          <div className="block lg:hidden">
            {historyPileKey && selectedPile ? (
              <div key={selectedPile.key} className="view-enter">
                <LocationDetail
                  summary={selectedPile}
                  onBack={() => setHistoryPileKey(null)}
                />
              </div>
            ) : (

              <div className="space-y-2.5">
                {filteredPiles.map(summary => {
                  const previous = summary.records[summary.records.length - 2];
                  const diffMoisture = previous
                    ? Number((summary.latest.moisture - previous.moisture).toFixed(1))
                    : undefined;

                  return (
                    <div
                      key={summary.key}
                      onClick={() => setHistoryPileKey(summary.key)}
                      className="apple-card-interactive p-4 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] block">
                            {summary.pile.ranchName}
                          </span>
                          <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                            {summary.pile.location}
                          </h3>
                        </div>
                        <StatusBadge type={summary.verdict.type} size="sm" />
                      </div>

                      <div className="flex items-baseline gap-2.5 mt-2.5">
                        <span className="font-display-metric text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                          {summary.measured ? `${summary.latest.moisture}%` : '측정 없음'}
                        </span>
                        {diffMoisture !== undefined && (
                          <span
                            className={`text-xs font-bold font-label-numeric tabular-nums ${
                              diffMoisture < 0
                                ? 'text-[#315C36] dark:text-[#34C759]'
                                : diffMoisture > 0
                                ? 'text-[#FF3B30] dark:text-[#FF453A]'
                                : 'text-[#6E6E73] dark:text-[#8E8E93]'
                            }`}
                          >
                            {diffMoisture > 0 ? `+${diffMoisture}` : diffMoisture}%p
                          </span>
                        )}
                        <span className="ml-auto text-xs text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                          심부 {summary.measured ? `${summary.latest.coreTemp}℃` : '—'}
                        </span>
                      </div>

                      <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-2 break-keep line-clamp-1">
                        {summary.verdict.action}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                        <span>최근 측정: {formatShortDate(summary.latest.date)}</span>
                        <span className="text-[#315C36] dark:text-[#34C759] font-semibold flex items-center">
                          상세보기 <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 데스크톱 화면: Split View (좌측 장소 리스트 + 우측 선택 장소 Detail) */}
          <div className="hidden lg:grid lg:grid-cols-[360px_1fr] gap-6 items-start">
            {/* 좌측 리스트 */}
            <div className="space-y-2.5 max-h-[calc(100vh-180px)] overflow-y-auto pr-1 smooth-scroll">
              {filteredPiles.map(summary => {
                const isSelected = selectedPile?.key === summary.key;
                const previous = summary.records[summary.records.length - 2];
                const diffMoisture = previous
                  ? Number((summary.latest.moisture - previous.moisture).toFixed(1))
                  : undefined;

                return (
                  <div
                    key={summary.key}
                    onClick={() => setHistoryPileKey(summary.key)}
                    className={`apple-card-interactive p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#315C36] dark:ring-[#34C759] shadow-xs'
                        : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] block truncate">
                          {summary.pile.ranchName}
                        </span>
                        <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 truncate">
                          {summary.pile.location}
                        </h3>
                      </div>
                      <StatusBadge type={summary.verdict.type} size="sm" />
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="font-display-metric text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                        {summary.measured ? `${summary.latest.moisture}%` : '측정 없음'}
                      </span>
                      {diffMoisture !== undefined && (
                        <span
                          className={`text-xs font-bold font-label-numeric tabular-nums ${
                            diffMoisture < 0 ? 'text-[#315C36] dark:text-[#34C759]' : 'text-[#FF3B30] dark:text-[#FF453A]'
                          }`}
                        >
                          {diffMoisture > 0 ? `+${diffMoisture}` : diffMoisture}%p
                        </span>
                      )}
                      <span className="ml-auto text-xs text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                        심부 {summary.measured ? `${summary.latest.coreTemp}℃` : '—'}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/10 text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                      최근 측정: {formatShortDate(summary.latest.date)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 우측 상세 화면 */}
            <div className="sticky top-0">
              {selectedPile ? (
                <div key={selectedPile.key} className="view-enter">
                  <LocationDetail summary={selectedPile} />
                </div>
              ) : (

                <Card className="p-12 text-center text-[#6E6E73] dark:text-[#8E8E93]">
                  장소를 선택하면 상세 내역과 함수율 추이 차트가 표시됩니다.
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
