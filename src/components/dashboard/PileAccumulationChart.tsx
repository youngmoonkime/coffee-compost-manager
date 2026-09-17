import React, { useLayoutEffect, useRef, useState } from 'react';
import type { MeasurementRecord } from '../../types';
import { formatShortDate } from '../../utils/calculations';
import { MOLD_LABELS } from '../../utils/fieldOps';

const CHART_HEIGHT = 100;
const PADDING = { top: 16, right: 16, bottom: 24, left: 16 };
const VISIBLE_POINTS = 8;

interface PileAccumulationChartProps {
  records: MeasurementRecord[];
  targetPileKg?: number | null;
  isEmbedded?: boolean;
}

interface ChartPoint {
  date: string;
  displayDate: string;
  addedKg: number;
  beddingUsedKg: number;
  cumulativePileKg: number;
  mixed?: boolean;
  moldStatus?: string;
  odor?: boolean;
  notes?: string;
}

export const PileAccumulationChart: React.FC<PileAccumulationChartProps> = ({
  records,
  targetPileKg = null,
  isEmbedded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 날짜별 누적 더미량 및 투입량 계산 (시간순)
  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));

  let runningPile = 0;
  const allPoints: ChartPoint[] = sortedRecords.map(r => {
    const added = r.addedKg ?? r.collectedKg ?? 0;
    const bedding = r.beddingUsedKg ?? 0;
    runningPile = Math.max(0, runningPile + added - bedding);

    return {
      date: r.date,
      displayDate: formatShortDate(r.date),
      addedKg: added,
      beddingUsedKg: bedding,
      cumulativePileKg: runningPile,
      mixed: r.mixed,
      moldStatus: r.moldStatus ? MOLD_LABELS[r.moldStatus] : undefined,
      odor: r.odor,
      notes: r.notes,
    };
  });

  // 최근 N개 포인트만 표시
  const points = allPoints.slice(-VISIBLE_POINTS);

  if (points.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-[#6E6E73] dark:text-[#8E8E93]">
        아직 기록된 수거 투입 내역이 없습니다.
      </div>
    );
  }

  // Y축 범위 계산
  const maxPile = Math.max(
    ...points.map(p => p.cumulativePileKg),
    targetPileKg ?? 0,
    ...points.map(p => p.addedKg),
    100
  );
  const yMax = Math.ceil(maxPile * 1.15);
  const yMin = 0;

  const innerLeft = PADDING.left;
  const innerRight = Math.max(innerLeft + 1, width - PADDING.right);
  const innerTop = PADDING.top;
  const innerBottom = CHART_HEIGHT - PADDING.bottom;

  const getX = (idx: number) => {
    if (points.length <= 1) return (innerLeft + innerRight) / 2;
    return innerLeft + (idx * (innerRight - innerLeft)) / (points.length - 1);
  };

  const getY = (val: number) => {
    const ratio = (val - yMin) / (yMax - yMin || 1);
    return innerBottom - ratio * (innerBottom - innerTop);
  };

  // 누적 더미량 선형 경로 (Area & Line)
  const linePoints = points.map((p, i) => `${getX(i)},${getY(p.cumulativePileKg)}`);
  const linePath = `M ${linePoints.join(' L ')}`;
  const areaPath = `M ${getX(0)},${innerBottom} L ${linePoints.join(' L ')} L ${getX(points.length - 1)},${innerBottom} Z`;

  // 목표량 가이드라인 Y 위치
  const targetY = targetPileKg ? getY(targetPileKg) : null;

  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div className={`relative ${isEmbedded ? '' : 'p-3'}`}>
      <div className="flex items-center justify-between text-[11px] font-bold text-[#6E6E73] dark:text-[#8E8E93] mb-1">
        <div className="flex items-center gap-2">
          <span>수거 투입 및 더미 누적 추이</span>
          <span className="flex items-center gap-1 font-normal text-[10px]">
            <span className="inline-block w-2.5 h-1 rounded-full bg-[#315C36] dark:bg-[#34C759]" />
            더미량
          </span>
          <span className="flex items-center gap-1 font-normal text-[10px]">
            <span className="inline-block w-2 h-2 rounded-xs bg-[#007AFF]/40 dark:bg-[#0A84FF]/50" />
            일별 투입
          </span>
        </div>
        {targetPileKg && (
          <span className="text-[10px] text-[#FF9F0A]">
            목표 {targetPileKg.toLocaleString('ko-KR')}kg
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="w-full relative select-none touch-pan-y"
        style={{ height: CHART_HEIGHT }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={CHART_HEIGHT}
            className="overflow-visible"
            onClick={() => setActiveIdx(null)}
          >
            <defs>
              {/* 더미량 영역 채우기 그라데이션 */}
              <linearGradient id="pileAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#315C36" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#315C36" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* 목표선 (점선) */}
            {targetY !== null && targetY >= innerTop && targetY <= innerBottom && (
              <line
                x1={innerLeft}
                y1={targetY}
                x2={innerRight}
                y2={targetY}
                stroke="#FF9F0A"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            )}

            {/* 투입량 바 차트 */}
            {points.map((p, idx) => {
              if (p.addedKg <= 0) return null;
              const barX = getX(idx);
              const barY = getY(p.addedKg);
              const barHeight = Math.max(2, innerBottom - barY);
              const barWidth = Math.min(14, Math.max(6, (width / points.length) * 0.3));

              return (
                <rect
                  key={`bar-${idx}`}
                  x={barX - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  className="fill-[#007AFF]/35 dark:fill-[#0A84FF]/45 hover:fill-[#007AFF]/60 cursor-pointer transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    setActiveIdx(idx);
                  }}
                />
              );
            })}

            {/* 누적 더미량 영역 및 라인 */}
            <path d={areaPath} fill="url(#pileAreaGrad)" />
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="text-[#315C36] dark:text-[#34C759]"
            />

            {/* 포인트 점들 */}
            {points.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.cumulativePileKg);
              const isSelected = activeIdx === idx;

              return (
                <g
                  key={`point-${idx}`}
                  className="cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    setActiveIdx(isSelected ? null : idx);
                  }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5 : 3.5}
                    className={`${
                      isSelected
                        ? 'fill-[#315C36] dark:fill-[#34C759] stroke-white dark:stroke-[#1C1C1E]'
                        : 'fill-white dark:fill-[#1C1C1E] stroke-[#315C36] dark:stroke-[#34C759]'
                    } transition-all`}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />

                  {/* X축 날짜 라벨 */}
                  <text
                    x={cx}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    className={`text-[9px] select-none ${
                      isSelected
                        ? 'fill-[#315C36] dark:fill-[#34C759] font-bold'
                        : 'fill-[#8E8E93] dark:fill-[#6E6E73]'
                    }`}
                  >
                    {p.displayDate}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* 터치/클릭 시 상세 팝오버 카드 */}
      {activePoint && (
        <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 shadow-md text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-1 mb-1.5">
            <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {activePoint.date} 점검 및 수거
            </span>
            <button
              type="button"
              onClick={() => setActiveIdx(null)}
              className="text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] px-1"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[#6E6E73] dark:text-[#8E8E93] block">누적 더미량</span>
              <strong className="text-sm font-display-metric text-[#315C36] dark:text-[#34C759]">
                {activePoint.cumulativePileKg.toLocaleString('ko-KR')} kg
              </strong>
            </div>
            <div>
              <span className="text-[#6E6E73] dark:text-[#8E8E93] block">당일 투입량</span>
              <strong className="text-sm font-display-metric text-[#007AFF] dark:text-[#0A84FF]">
                +{activePoint.addedKg.toLocaleString('ko-KR')} kg
              </strong>
            </div>
            {activePoint.mixed !== undefined && (
              <div>
                <span className="text-[#6E6E73] dark:text-[#8E8E93] block">혼합 작업</span>
                <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {activePoint.mixed ? '✅ 완료' : '미실시'}
                </span>
              </div>
            )}
            {activePoint.moldStatus && (
              <div>
                <span className="text-[#6E6E73] dark:text-[#8E8E93] block">곰팡이 관찰</span>
                <span className="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {activePoint.moldStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
