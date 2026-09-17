import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { compareRecords, getCurrentDateString, normalizeName } from '../../utils/calculations';
import { summarizeCycle } from '../../utils/fieldOps';
import { Button } from '../ui/Button';

/**
 * 현장점검 탭의 첫 화면 — 어느 목장을 볼지 먼저 고른다.
 * 목장 등록은 측정 탭에서 한다: 첫 투입 기록이 저장된 목장만 여기에 보인다.
 */
export const RanchPicker: React.FC = () => {
  const { records, settings, getCycle, measuredRanchNames, activePile, setActivePile, setRanchPicked, setActiveTab } =
    useCompost();
  const today = getCurrentDateString();

  const summaries = useMemo(
    () =>
      measuredRanchNames.map(ranchName => ({
        ranchName,
        status: summarizeCycle({ records, ranchName, settings, cycle: getCycle(ranchName), today }),
      })),
    [measuredRanchNames, records, settings, getCycle, today]
  );

  const pick = (ranchName: string) => {
    // 그 목장에서 마지막으로 기록한 장소를 이어서 쓴다
    const latest = records
      .filter(r => normalizeName(r.ranchName) === ranchName)
      .sort(compareRecords)
      .pop();
    setActivePile({ ranchName, location: latest?.location ?? '' });
    setRanchPicked(true);
  };

  return (
    <div className="flex flex-col w-full pb-4 space-y-3">
      <div className="pt-0.5">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">현장 점검</h2>
        <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
          {summaries.length > 0 ? '점검할 목장을 선택하세요.' : '아직 점검할 목장이 없습니다.'}
        </p>
      </div>

      {summaries.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 p-5 text-center space-y-3">
          <span className="material-symbols-outlined text-[32px] text-[#315C36] dark:text-[#34C759]">agriculture</span>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] break-keep">
            측정 탭에서 목장을 고르고 첫 커피박 투입을 기록하면 여기에 목장이 나타납니다.
          </p>
          <Button variant="primary" size="md" icon="add_circle" onClick={() => setActiveTab('monitoring')}>
            측정 탭으로 가기
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {summaries.map(({ ranchName, status }) => {
            const current = normalizeName(activePile.ranchName) === ranchName;
            return (
              <li key={ranchName}>
                <button
                  type="button"
                  onClick={() => pick(ranchName)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border text-left active:scale-[0.99] transition-all ${
                    current
                      ? 'border-[#315C36]/40 dark:border-[#34C759]/40'
                      : 'border-black/5 dark:border-white/10 hover:border-[#315C36]/30'
                  }`}
                >
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-[#315C36]/10 dark:bg-[#34C759]/15 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">agriculture</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
                      {ranchName}
                    </span>
                    <span className="block text-[12px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
                      {status.latest
                        ? `더미 ${status.currentPileKg.toLocaleString('ko-KR')}kg${
                            status.targetPileKg ? ` / 목표 ${status.targetPileKg.toLocaleString('ko-KR')}kg` : ''
                          } · 방문 ${status.visitCount}회 · 최근 ${
                            status.daysSinceLastVisit === 0 ? '오늘' : `${status.daysSinceLastVisit}일 전`
                          }`
                        : '이번 사이클 기록 없음'}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-[#AEAEB2]" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {summaries.length > 0 && (
        <p className="text-[11.5px] text-center text-[#8E8E93]">새 목장은 측정 탭에서 첫 투입을 기록하면 추가됩니다.</p>
      )}
    </div>
  );
};
