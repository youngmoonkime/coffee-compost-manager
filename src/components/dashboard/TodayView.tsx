import React, { useMemo } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';
import { getCurrentDateString, normalizeName } from '../../utils/calculations';
import { summarizeCycle } from '../../utils/fieldOps';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CycleDashboard } from './CycleDashboard';
import { BeddingAdvisorChat } from './BeddingAdvisorChat';
import { RanchPicker } from './RanchPicker';
import { useAccess } from '../../contexts/AccessContext';

/**
 * 부숙관리 메인 화면.
 *
 * 건준목장은 한 구역에 커피박을 계속 모으고 기존 커피박과 섞어 관리한다.
 * 그래서 "주차별 측정"이 아니라 "지금 모여 있는 더미가 깔개로 쓸 상태에 가까워지고 있는가"를 보여 준다.
 */
export const TodayView: React.FC = () => {
  const {
    records,
    settings,
    activePile,
    measuredRanchNames,
    ranchPicked,
    setRanchPicked,
    getCycle,
    startInspection,
    startNewCycle,
    pendingCount,
    isSheetBackend,
    reloadFromSheet,
    isLoadingFromSheet,
  } = useCompost();
  const { showToast } = useToast();
  const { isManager } = useAccess();

  const today = getCurrentDateString();

  // 현장점검은 측정 탭에서 투입 기록이 저장된 목장만 다룬다
  const ranchName = measuredRanchNames.includes(normalizeName(activePile.ranchName))
    ? normalizeName(activePile.ranchName)
    : (measuredRanchNames[0] ?? DEFAULT_RANCH_NAME);

  const status = useMemo(
    () => summarizeCycle({ records, ranchName, settings, cycle: getCycle(ranchName), today }),
    [records, ranchName, settings, getCycle, today]
  );

  const formattedTodayDate = useMemo(() => {
    const d = new Date();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
  }, []);

  const handleNewCycle = () => {
    const confirmed = window.confirm(
      `${status.ranchName}의 새 운영 사이클을 시작할까요?\n\n` +
        '지금까지 모인 양과 기록은 지난 사이클로 남고,\n오늘부터의 기록이 새 사이클로 묶입니다.'
    );
    if (!confirmed) return;
    const next = startNewCycle(status.ranchName);
    showToast('새 운영 사이클을 시작했습니다', next.id ?? undefined, 'success');
  };

  // 목장부터 고른다 — 목장마다 수거량과 관리 방식이 다르다
  if (!ranchPicked || measuredRanchNames.length === 0) return <RanchPicker />;

  return (
    <div className="flex flex-col w-full pb-4 space-y-2.5">
      {/* 1. 상단 타이틀 & 날짜 & 목장 사이클 상태 카드 (일체형 박스) */}
      <Card className="p-3.5 sm:p-4 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-xs rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#8E8E93] tracking-tight block">
              {formattedTodayDate}
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                현장 점검
              </h2>
              <button
                type="button"
                onClick={() => setRanchPicked(false)}
                disabled={isManager}
                title={isManager ? undefined : '다른 목장 선택'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#315C36]/10 dark:bg-[#34C759]/15 text-[#315C36] dark:text-[#34C759] text-xs font-bold hover:bg-[#315C36]/15 dark:hover:bg-[#34C759]/25 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[15px] shrink-0">agriculture</span>
                <span>{status.ranchName}</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                <span className="text-[11px] font-normal opacity-90">
                  {status.cycleDays !== null && `${status.cycleDays}일째`} (방문 {status.visitCount}회)
                </span>
                {!isManager && (
                  <span className="material-symbols-outlined text-[15px] shrink-0 opacity-70">expand_more</span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSheetBackend && (
              <button
                type="button"
                onClick={() => reloadFromSheet()}
                disabled={isLoadingFromSheet}
                className="h-8 w-8 sm:w-auto sm:px-2.5 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 flex items-center justify-center gap-1 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-95 transition-all disabled:opacity-50"
                title="구글 시트에서 새로고침"
              >
                <span
                  className={`material-symbols-outlined text-[16px] text-[#315C36] dark:text-[#34C759] ${
                    isLoadingFromSheet ? 'animate-spin' : ''
                  }`}
                >
                  refresh
                </span>
                <span className="hidden sm:inline">{isLoadingFromSheet ? '동기화 중' : '새로고침'}</span>
              </button>
            )}
            {!isManager && (
            <button
              type="button"
              onClick={handleNewCycle}
              className="h-8 px-2.5 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-95 transition-all shrink-0"
            >
              새 사이클 시작
            </button>
            )}
          </div>
        </div>

      </Card>

      {/* 시트로 보내지 못한 기록 */}
      {pendingCount > 0 && (
        <div className="rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[#FF9F0A] text-[20px] shrink-0">cloud_off</span>
            <span className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] font-medium truncate">
              시트로 보내지 못한 기록 {pendingCount}건이 기기에 보관되어 있습니다.
            </span>
          </div>
          <button
            type="button"
            onClick={() => reloadFromSheet()}
            className="text-xs font-bold text-[#D97706] dark:text-[#FF9F0A] hover:underline shrink-0"
          >
            재전송
          </button>
        </div>
      )}



      {/* 2. 운영 사이클 현황 */}
      <CycleDashboard status={status} />

      {/* 3. 현장 점검 기록 */}
      <Button
        variant="primary"
        size="lg"
        icon="fact_check"
        onClick={startInspection}
        className="w-full shadow-xs"
      >
        현장 점검 기록하기
      </Button>

      {/* 4. 깔개 활용 AI 진단 브리핑 (컴팩트 아이콘 버튼 - 클릭 시 모달 오픈) */}
      <BeddingAdvisorChat status={status} settings={settings} />
    </div>
  );
};
