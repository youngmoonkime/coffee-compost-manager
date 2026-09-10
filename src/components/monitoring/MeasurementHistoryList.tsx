import React, { useLayoutEffect, useRef, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';

/** 목록에 펼쳐 보여줄 최대 행 수. 나머지는 목록 안에서 스크롤한다. */
const VISIBLE_ROWS = 3;

export const MeasurementHistoryList: React.FC = () => {
  const { activeBatchMeasurements, deleteMeasurementLog, setActiveTab } = useCompost();
  const { showToast } = useToast();

  // 최신순으로 역순 정렬
  const reversedLogs = [...activeBatchMeasurements].reverse();
  const isScrollable = reversedLogs.length > VISIBLE_ROWS;

  // 행 높이는 글꼴·줄바꿈·화면 폭에 따라 달라지므로 고정값 대신 실제로 측정한다.
  // 3번째 행의 아래쪽까지를 최대 높이로 잡아 딱 3개만 보이게 한다.
  const listRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !isScrollable) {
      setMaxHeight(undefined);
      return;
    }

    const measure = () => {
      const rows = Array.from(el.children) as HTMLElement[];
      if (rows.length < VISIBLE_ROWS) return;
      const lastVisible = rows[VISIBLE_ROWS - 1];
      setMaxHeight(lastVisible.offsetTop + lastVisible.offsetHeight - rows[0].offsetTop);
    };

    measure();

    // 화면 회전이나 폭 변화로 행이 줄바꿈되면 다시 측정
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isScrollable, reversedLogs.length]);

  const handleDelete = (id: string, day: number) => {
    deleteMeasurementLog(id);
    showToast(`D+${day}일차 기록이 삭제되었습니다`, undefined, 'info');
  };

  return (
    <section className="w-full mb-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[18px]">history</span>
          <h3 className="font-headline-sm text-[15px] font-bold text-on-surface tracking-tight whitespace-nowrap">
            최근 계측 기록
          </h3>
          {isScrollable && (
            <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-[10px] font-bold whitespace-nowrap">
              전체 {reversedLogs.length}건
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveTab('history')}
          className="font-label-sm text-[12px] font-semibold text-secondary hover:underline flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
          type="button"
        >
          <span>전체 이력</span>
          <span className="material-symbols-outlined text-[15px]">chevron_right</span>
        </button>
      </div>

      {reversedLogs.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl p-4 text-center text-xs text-outline border border-outline-variant/20">
          기록된 계측 로그가 없습니다.
        </div>
      ) : (
        <div
          ref={listRef}
          style={maxHeight ? { maxHeight } : undefined}
          className={`space-y-1.5 ${
            isScrollable
              ? 'overflow-y-auto smooth-scroll scroll-stable pr-1.5 -mr-1.5'
              : ''
          }`}
        >
          {reversedLogs.map((log, idx) => {
            const isLatest = idx === 0;
            const isReady = log.verdict === 'ready';
            const isAction = log.verdict === 'action_needed';

            return (
              <div
                key={log.id}
                className="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/20 flex items-center justify-between group hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                    isLatest
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}>
                    <span className="font-caption text-[8.5px] font-bold uppercase leading-none">DAY</span>
                    <span className="font-label-numeric text-[13px] font-bold leading-tight">{log.dayNumber}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-sm text-[13px] text-on-surface font-bold whitespace-nowrap">
                        함수율 {log.moisture}%
                      </span>
                      <span className="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-caption text-[10px] whitespace-nowrap">
                        심부 {log.coreTemp}℃ (차 {log.tempDiff}℃)
                      </span>
                    </div>
                    <span className="font-caption text-[11px] text-outline block mt-0.5 truncate">
                      외기 {log.ambientTemp}℃ · 습도 {log.ambientHum}% · {log.time}
                    </span>
                    {log.notes && (
                      <span
                        className="font-caption text-[11px] text-secondary mt-1 flex items-start gap-1"
                        title={log.notes}
                      >
                        <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">
                          sticky_note_2
                        </span>
                        <span className="min-w-0 break-keep line-clamp-2">{log.notes}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className={`px-2 py-0.5 rounded-full font-caption text-[10.5px] font-bold whitespace-nowrap ${
                    isReady
                      ? 'bg-primary-fixed text-on-primary-fixed'
                      : isAction
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-secondary-container text-on-secondary-container'
                  }`}>
                    {isReady ? '완숙적합' : isAction ? '교반필요' : '부숙지속'}
                  </span>

                  <button
                    onClick={() => handleDelete(log.id, log.dayNumber)}
                    className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 text-outline hover:text-error rounded-md active:scale-95"
                    title="기록 삭제"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
