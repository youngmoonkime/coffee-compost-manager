import React from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import {
  MIXING_LEVEL_LABELS,
  MOLD_LABELS,
  type CycleStatus,
} from '../../utils/fieldOps';
import { Card } from '../ui/Card';
import { SourceBadge } from '../ui/SourceBadge';
import { PileAccumulationChart } from './PileAccumulationChart';

const MIXING_STYLE: Record<string, string> = {
  ok: 'text-[#315C36] dark:text-[#34C759]',
  low: 'text-[#D97706] dark:text-[#FF9F0A]',
  none: 'text-[#C5221F] dark:text-[#FF453A]',
  unknown: 'text-[#6E6E73] dark:text-[#8E8E93]',
};

/**
 * 건준목장 메인 현황 대시보드.
 *
 * 현재 추정 더미량 박스 내에 핵심 상태 4종(함수율, 심부온도, 혼합관리, 곰팡이) 및
 * 변화 그래프(함수율·심부온도 통합)를 일체형으로 배치하여
 * 메인 페이지에서 스크롤 없이 핵심 정보만을 직관적으로 확인할 수 있도록 합니다.
 */
export const CycleDashboard: React.FC<{ status: CycleStatus; showHeader?: boolean }> = ({
  status,
  showHeader = false,
}) => {
  const { startNewCycle, setActiveTab } = useCompost();
  const { showToast } = useToast();

  const handleNewCycle = () => {
    const confirmed = window.confirm(
      `${status.ranchName}의 새 운영 사이클을 시작할까요?\n\n` +
        '지금까지 모인 양과 기록은 지난 사이클로 남고,\n오늘부터의 기록이 새 사이클로 묶입니다.'
    );
    if (!confirmed) return;
    const next = startNewCycle(status.ranchName);
    showToast('새 운영 사이클을 시작했습니다', next.id ?? undefined, 'success');
  };

  const hasBeddingUsed = status.beddingUsedKg > 0;

  return (
    <div className="space-y-2">
      {/* 사이클 머리말 (선택적) */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                {status.ranchName}
              </h3>
              <span className="text-[10.5px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
                {status.cycleDays !== null && `${status.cycleDays}일째`} (방문 {status.visitCount}회)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewCycle}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F2F2F7] active:scale-95 transition-all"
          >
            새 사이클 시작
          </button>
        </div>
      )}

      {/* 현장 점검 권장 알림 (슬림 인라인) */}
      {status.visitDue && status.daysSinceLastVisit !== null && (
        <div className="rounded-xl bg-[#007AFF]/10 border border-[#007AFF]/20 px-3 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0062CC] dark:text-[#0A84FF] text-[18px] shrink-0">
            event_available
          </span>
          <span className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">
            마지막 방문 이후 {status.daysSinceLastVisit}일 경과 · 현장 점검 권장
          </span>
        </div>
      )}

      {/* 혼합 밀림 안내 (슬림 인라인) */}
      {status.mixingNotice && (
        <div className="rounded-xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 px-3 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#D97706] dark:text-[#FF9F0A] text-[18px] shrink-0">
            rotate_right
          </span>
          <span className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">{status.mixingNotice}</span>
        </div>
      )}

      {/*
        통합 올인원 메인 카드 (모바일 뷰포트 최적화 초슬림형):
        - 1) 현재 추정 더미량 & 진행률 바
        - 2) 일체형 4대 지표 (가로 1행 4열 슬림 스트립)
        - 3) 일체형 변화 그래프 (함수율·심부온도 초슬림 통합)
      */}
      <Card className="p-3 sm:p-4 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-xs rounded-2xl space-y-2.5">
        {/* 더미량 헤더 및 수치 */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-bold text-[#6E6E73] dark:text-[#8E8E93]">현재 추정 더미량</span>
              <SourceBadge kind="computed" />
            </div>
            {hasBeddingUsed && (
              <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-[#315C36]/10 text-[#315C36] dark:text-[#34C759]">
                중간 깔개 활용 ({status.beddingUsedKg.toLocaleString('ko-KR')}kg)
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="font-display-metric text-[26px] sm:text-[30px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
                {status.currentPileKg.toLocaleString('ko-KR')}
              </span>
              <span className="text-sm font-semibold text-[#6E6E73] dark:text-[#8E8E93]">kg</span>
            </div>
            {status.targetPileKg && (
              <span className="text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                목표 {status.targetPileKg.toLocaleString('ko-KR')}kg
              </span>
            )}
          </div>

          {status.targetPileKg ? (
            <div className="mt-1.5">
              <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#315C36] dark:bg-[#34C759] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, status.progressPercent ?? 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6E6E73] dark:text-[#8E8E93] mt-1 tabular-nums">
                <span>진행률 {status.progressPercent}%</span>
                <span>
                  투입 {status.addedKg.toLocaleString('ko-KR')}kg · 깔개 활용{' '}
                  <strong className={hasBeddingUsed ? 'text-[#315C36] dark:text-[#34C759]' : ''}>
                    {status.beddingUsedKg.toLocaleString('ko-KR')}kg
                  </strong>
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="mt-2 w-full rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] p-2 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] transition-colors"
            >
              깔개 목표량을 설정해주세요 →
            </button>
          )}
        </div>

        {/*
          구분선 및 일체형 4대 현황 지표 (가로 1행 4열 초컴팩트 스트립)
          세로 공간을 대폭 절약하여 스크롤 없이 액션 버튼이 보이게 함
        */}
        <div className="pt-2.5 border-t border-black/5 dark:border-white/10">
          <div className="grid grid-cols-4 gap-1.5">
            {/* 1. 누적 수거 투입량 */}
            <div className="p-1.5 rounded-lg bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 text-center">
              <span className="block text-[10px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] truncate">
                누적 투입
              </span>
              <span className="block font-display-metric text-[14px] sm:text-[16px] leading-tight font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5 truncate">
                {status.addedKg.toLocaleString('ko-KR')}kg
              </span>
              <span className="block text-[9px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
                방문 {status.visitCount}회
              </span>
            </div>

            {/* 2. 혼합 뒤집기 관리 */}
            <div className="p-1.5 rounded-lg bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 text-center">
              <span className="block text-[10px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] truncate">
                혼합 뒤집기
              </span>
              <span className="block font-display-metric text-[14px] sm:text-[16px] leading-tight font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5 truncate">
                {status.mixingLevel === 'unknown' ? '—' : `주 ${status.mixingCountLast7Days}회`}
              </span>
              <span className="block text-[9px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
                {status.mixingLevel === 'unknown' ? (
                  '—'
                ) : (
                  <span className={MIXING_STYLE[status.mixingLevel]}>
                    {MIXING_LEVEL_LABELS[status.mixingLevel]}
                  </span>
                )}
              </span>
            </div>

            {/* 3. 곰팡이 관찰 */}
            <div className="p-1.5 rounded-lg bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 text-center">
              <span className="block text-[10px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] truncate">
                곰팡이
              </span>
              <span className="block font-display-metric text-[14px] sm:text-[16px] leading-tight font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums truncate mt-0.5">
                {status.moldStatus ? MOLD_LABELS[status.moldStatus] : '—'}
              </span>
              <span className="block text-[9px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
                {status.latest?.moldColor || (status.moldStatus === 'none' ? '미발생' : '정상')}
              </span>
            </div>

            {/* 4. 악취 / 깔개 활용 */}
            <div className="p-1.5 rounded-lg bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 text-center">
              <span className="block text-[10px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] truncate">
                악취 / 깔개
              </span>
              <span className="block font-display-metric text-[14px] sm:text-[16px] leading-tight font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums truncate mt-0.5">
                {status.odor === true ? '냄새이상' : status.odor === false ? '정상' : '—'}
              </span>
              <span className="block text-[9px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
                {hasBeddingUsed ? `깔개 ${status.beddingUsedKg.toLocaleString('ko-KR')}kg` : '깔개 미활용'}
              </span>
            </div>
          </div>
        </div>

        {/* 하단 일체형 수거 투입량 및 누적 더미량 추이 그래프 */}
        <div className="pt-2.5 border-t border-black/5 dark:border-white/10">
          <PileAccumulationChart
            records={status.records}
            targetPileKg={status.targetPileKg}
            isEmbedded={true}
          />
        </div>
      </Card>
    </div>
  );
};
