import React, { useEffect, useMemo, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { VERDICT_BADGES } from '../../constants/verdictBadges';
import { formatShortDate, summarizePiles } from '../../utils/calculations';
import type { PileSummary } from '../../utils/calculations';
import { MoistureChart } from '../common/MoistureChart';
import { ScriptVersionNotice } from '../common/ScriptVersionNotice';
import { PileRecordList } from './PileRecordList';

function formatSigned(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/** 장소 한 곳의 요약 — 목록에서는 눌러서 상세로, 상세에서는 머리글로 쓴다 */
const PileSummaryCard: React.FC<{ summary: PileSummary; onClick?: () => void }> = ({ summary, onClick }) => {
  const { pile, latest, verdict, records } = summary;
  const previous = records[records.length - 2];
  const badge = VERDICT_BADGES[verdict.type];

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-caption text-[11.5px] text-secondary font-bold block">{pile.ranchName}</span>
          <h3 className="font-headline-sm text-[16px] font-bold text-on-surface mt-0.5 break-keep">{pile.location}</h3>
        </div>
        <span className="flex items-center gap-1 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.className}`}>{badge.text}</span>
          {onClick && <span className="material-symbols-outlined text-[20px] text-outline">chevron_right</span>}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-display-metric text-[28px] leading-none font-semibold text-on-surface tabular-nums">
          {latest.moisture}%
        </span>
        {previous && (
          <span
            className={`font-label-numeric text-[13px] font-bold tabular-nums ${
              latest.moisture < previous.moisture ? 'text-primary' : latest.moisture > previous.moisture ? 'text-error' : 'text-outline'
            }`}
          >
            {formatSigned(latest.moisture - previous.moisture)}%p
          </span>
        )}
        <span className="ml-auto font-caption text-[12px] text-on-surface-variant tabular-nums">심부 {latest.coreTemp}℃</span>
      </div>

      {verdict.type !== 'first' && (
        <p className="mt-2 font-caption text-[12.5px] text-on-surface break-keep flex items-start gap-1">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-px">
            {verdict.timing ? 'event_available' : 'assignment'}
          </span>
          {verdict.timing ?? verdict.action}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-outline-variant/20 text-center">
        <div>
          <span className="font-caption text-[10.5px] text-outline block">최근 기록</span>
          <span className="font-label-numeric text-[12.5px] font-bold text-on-surface">{formatShortDate(latest.date)}</span>
        </div>
        <div>
          <span className="font-caption text-[10.5px] text-outline block">누적 수거량</span>
          <span className="font-label-numeric text-[12.5px] font-bold text-primary">
            {summary.totalCollectedKg.toLocaleString('ko-KR')}kg
          </span>
        </div>
        <div>
          <span className="font-caption text-[10.5px] text-outline block">기록</span>
          <span className="font-label-numeric text-[12.5px] font-bold text-secondary">{records.length}회</span>
        </div>
      </div>
    </>
  );

  const className = 'w-full text-left bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20';

  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition-all active:scale-[0.99]`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

/**
 * 장소별 현황.
 * 목록에서는 장소마다 요약만 보여주고, 장소를 누르면 그 장소의 함수율 추이와 기록을 연다.
 * (추이 그래프를 입력 화면마다 붙여 두면 입력에 방해가 되어 여기로 모았다)
 */
/** 시트를 마지막으로 읽어온 지 얼마나 지났는지 — 자동 새로고침이 돌고 있음을 알 수 있게 */
function sinceText(at: number | null): string {
  if (!at) return '아직 불러오지 못했습니다';
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return '방금 확인';
  if (min < 60) return `${min}분 전 확인`;
  return `${Math.floor(min / 60)}시간 전 확인`;
}

export const LocationStatusView: React.FC = () => {
  const {
    records,
    settings,
    setActivePile,
    setActiveTab,
    historyPileKey,
    setHistoryPileKey,
    setIsGoogleModalOpen,
    reloadFromSheet,
    isLoadingFromSheet,
    isSheetBackend,
    pendingCount,
    lastSheetLoadAt,
  } = useCompost();
  const { showToast } = useToast();

  const allPiles = useMemo(() => summarizePiles(records, settings), [records, settings]);
  // 기록을 모두 지워 장소가 사라졌으면 목록으로 돌아간다
  const selected = allPiles.find(p => p.key === historyPileKey) ?? null;

  // 목장이 둘 이상이면 목장별로 골라 본다 (시트의 목장별 탭과 같은 구분)
  const ranches = useMemo(() => [...new Set(allPiles.map(p => p.pile.ranchName))], [allPiles]);
  const [ranchFilter, setRanchFilter] = useState<string | null>(null);
  const activeRanch = ranchFilter && ranches.includes(ranchFilter) ? ranchFilter : null;
  const piles = activeRanch ? allPiles.filter(p => p.pile.ranchName === activeRanch) : allPiles;
  const usableCount = piles.filter(p => p.verdict.type === 'usable').length;

  // 목록 ↔ 상세를 오갈 때 스크롤을 맨 위로
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [selected?.key]);

  const handleReload = async () => {
    const res = await reloadFromSheet();
    showToast(res.success ? '구글 시트에서 불러왔습니다' : '시트를 읽지 못했습니다', res.message, res.success ? 'success' : 'error');
  };

  if (selected) {
    return (
      <div className="flex flex-col w-full pb-8 gap-3">
        <button
          type="button"
          onClick={() => setHistoryPileKey(null)}
          className="self-start -ml-1 flex items-center gap-0.5 py-1 font-label-sm text-[13px] font-semibold text-secondary active:opacity-70"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          장소 목록
        </button>

        <PileSummaryCard summary={selected} />

        <button
          type="button"
          onClick={() => {
            setActivePile(selected.pile);
            setActiveTab('monitoring');
          }}
          className="w-full h-12 rounded-2xl bg-primary text-on-primary font-headline-sm text-[15px] font-semibold shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-outlined text-[19px]">edit_note</span>
          기록 수정하기
        </button>

        <MoistureChart records={selected.records} />
        <PileRecordList records={selected.records} />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-on-surface">장소별 현황</h2>
          <p className="font-caption text-caption text-on-surface-variant mt-0.5 break-keep">
            장소를 누르면 함수율 추이와 기록을 볼 수 있습니다 (깔개 사용 기준 {settings.usableMoistureMin}~
            {settings.usableMoistureMax}%)
          </p>
          {isSheetBackend && (
            <p className="font-caption text-[11px] text-outline mt-1 break-keep">
              {isLoadingFromSheet ? '구글 시트에서 불러오는 중…' : `구글 시트 기준 · ${sinceText(lastSheetLoadAt)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isSheetBackend && (
            <button
              type="button"
              onClick={handleReload}
              disabled={isLoadingFromSheet}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant/40 text-xs font-bold active:scale-95 transition-all disabled:opacity-60"
              title="구글 시트에서 최신 내용 다시 불러오기"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoadingFromSheet ? 'animate-spin' : ''}`}>
                {isLoadingFromSheet ? 'progress_activity' : 'refresh'}
              </span>
              <span className="hidden sm:inline">{isLoadingFromSheet ? '불러오는 중' : '시트에서 새로고침'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsGoogleModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300/80 text-xs font-bold active:scale-95 transition-all"
            title="구글 스프레드시트 연동 설정"
          >
            <span className="material-symbols-outlined text-[16px]">table_chart</span>
            <span className="hidden sm:inline">시트 설정</span>
          </button>
        </div>
      </div>

      <ScriptVersionNotice className="mb-3" />

      {pendingCount > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] shrink-0">cloud_off</span>
          <span className="font-caption text-[12px] leading-relaxed break-keep">
            시트로 보내지 못한 기록 {pendingCount}건이 이 기기에 있습니다.
            {isSheetBackend ? ' 통신이 되는 곳에서 [시트에서 새로고침]을 누르면 다시 보냅니다.' : ''}
          </span>
        </div>
      )}

      {ranches.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto smooth-scroll -mx-1 px-1 pb-0.5">
          {[null, ...ranches].map(name => {
            const active = name === activeRanch;
            return (
              <button
                key={name ?? '__all'}
                type="button"
                onClick={() => setRanchFilter(name)}
                className={`shrink-0 px-3 py-1.5 rounded-full font-caption text-[12.5px] font-semibold transition-all active:scale-95 ${
                  active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {name ?? '전체 목장'}
              </button>
            );
          })}
        </div>
      )}

      {piles.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-container-low px-3 py-2">
            <span className="font-caption text-[11px] text-on-surface-variant block">관리 중인 장소</span>
            <span className="font-label-numeric text-[17px] font-bold text-on-surface">{piles.length}곳</span>
          </div>
          <div className="rounded-xl bg-primary-fixed px-3 py-2 text-on-primary-fixed">
            <span className="font-caption text-[11px] opacity-80 block">깔개로 쓸 수 있는 곳</span>
            <span className="font-label-numeric text-[17px] font-bold">{usableCount}곳</span>
          </div>
        </div>
      )}

      {piles.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/20 shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-outline/60">location_on</span>
          <p className="font-label-md text-sm font-bold text-on-surface mt-2">아직 기록이 없습니다</p>
          <p className="font-caption text-[11.5px] text-outline mt-1 leading-relaxed">
            [측정 기록] 탭에서 하역 장소와 측정값을 저장하면 장소별로 모입니다.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('monitoring')}
            className="mt-4 px-4 h-10 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            기록하러 가기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {piles.map(summary => (
            <PileSummaryCard key={summary.key} summary={summary} onClick={() => setHistoryPileKey(summary.key)} />
          ))}
        </div>
      )}
    </div>
  );
};
