import React, { useLayoutEffect, useRef, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import type { MeasurementRecord } from '../../types';

const CHART_HEIGHT = 120;
const PADDING = { top: 18, right: 14, bottom: 14, left: 14 };
const MIN_MOISTURE = 20;
const MAX_MOISTURE = 80;
const VISIBLE_POINTS = 8;

interface MoistureChartProps {
  /** 한 장소의 기록 (오래된 순) */
  records: MeasurementRecord[];
  /** card: 독립된 카드로 / inline: 다른 카드 안에 끼워 넣을 때 */
  variant?: 'card' | 'inline';
}

/** 한 장소의 함수율 추이 — 깔개 사용 기준 구간을 함께 그린다 */
export const MoistureChart: React.FC<MoistureChartProps> = ({ records, variant = 'card' }) => {
  const { settings } = useCompost();

  const logs = records.slice(-VISIBLE_POINTS);
  const { usableMoistureMin: bandMin, usableMoistureMax: bandMax } = settings;

  // viewBox 를 실제 픽셀 폭에 맞춰야 가로·세로 배율이 1:1 이 되어 숫자와 점이 찌그러지지 않는다.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => setWidth(el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerLeft = PADDING.left;
  const innerRight = Math.max(innerLeft + 1, width - PADDING.right);
  const innerTop = PADDING.top;
  const innerBottom = CHART_HEIGHT - PADDING.bottom;

  const getY = (val: number) => {
    const clamped = Math.min(MAX_MOISTURE, Math.max(MIN_MOISTURE, val));
    const ratio = (clamped - MIN_MOISTURE) / (MAX_MOISTURE - MIN_MOISTURE);
    return innerBottom - ratio * (innerBottom - innerTop);
  };

  const bandTop = getY(bandMax);
  const bandBottom = getY(bandMin);

  const points = logs.map((log, index) => {
    const x =
      logs.length === 1
        ? (innerLeft + innerRight) / 2
        : innerLeft + (index * (innerRight - innerLeft)) / (logs.length - 1);
    return { x, y: getY(log.moisture), log };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-primary text-[18px]">show_chart</span>
          <h3 className="font-headline-sm text-[14px] font-bold text-on-surface tracking-tight whitespace-nowrap">
            함수율 추이
          </h3>
          {records.length > VISIBLE_POINTS && (
            <span className="font-caption text-[11px] text-outline whitespace-nowrap">최근 {VISIBLE_POINTS}회</span>
          )}
        </div>
        <span className="font-caption text-[11px] text-primary font-bold whitespace-nowrap">
          사용 기준 {bandMin}~{bandMax}%
        </span>
      </div>

      <div ref={containerRef} className="w-full relative bg-surface-container-low rounded-xl px-2 pt-2 pb-1.5">
        {logs.length === 0 ? (
          <div className="w-full flex items-center justify-center text-outline text-xs" style={{ height: CHART_HEIGHT }}>
            기록이 없습니다.
          </div>
        ) : (
          <>
            <svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${Math.max(width, 1)} ${CHART_HEIGHT}`}
              className="block overflow-visible"
              role="img"
              aria-label={`함수율 추이. 최근 ${logs.length}건. 깔개 사용 기준 ${bandMin}~${bandMax}%.`}
            >
              {/* 깔개 사용 가능 구간 */}
              <rect
                x={innerLeft}
                y={bandTop}
                width={innerRight - innerLeft}
                height={bandBottom - bandTop}
                fill="#2e4a2b"
                fillOpacity="0.1"
                rx="4"
              />
              <text fill="#2e4a2b" fontSize="10" fontWeight="700" textAnchor="end" x={innerRight - 4} y={bandBottom - 5}>
                깔개 사용 가능
              </text>

              {polylinePoints && (
                <polyline
                  fill="none"
                  points={polylinePoints}
                  stroke="#2e4a2b"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
              )}

              {points.map((p, idx) => {
                const isLatest = idx === points.length - 1;
                const inBand = p.log.moisture >= bandMin && p.log.moisture <= bandMax;
                const color = inBand ? '#2e4a2b' : '#7a573b';
                // 라벨이 잘리지 않도록 양 끝에서는 안쪽으로 정렬한다
                const anchor = points.length === 1 ? 'middle' : idx === 0 ? 'start' : isLatest ? 'end' : 'middle';
                const labelY = p.y > innerTop + 24 ? p.y - 9 : p.y + 16;

                return (
                  <g key={p.log.id}>
                    <circle cx={p.x} cy={p.y} fill={color} r={isLatest ? 5 : 3.5} stroke="#ffffff" strokeWidth="1.5" />
                    <text fill={color} fontSize={isLatest ? 11 : 10} fontWeight="700" textAnchor={anchor} x={p.x} y={labelY}>
                      {p.log.moisture}%
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* 하단 X축 라벨 */}
            <div className="flex justify-between items-center text-[9.5px] font-label-numeric text-outline px-1 pt-1.5">
              {logs.map((log, index) => (
                <span key={log.id} className={index === logs.length - 1 ? 'text-secondary font-bold' : ''}>
                  {Number(log.date.slice(5, 7))}/{Number(log.date.slice(8, 10))}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );

  if (variant === 'inline') return <div className="w-full">{body}</div>;

  return (
    <section className="w-full">
      <div className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm border border-outline-variant/20">{body}</div>
    </section>
  );
};
