import React, { useLayoutEffect, useRef, useState } from 'react';
import type { MeasurementRecord } from '../../types';
import { getVisitEvents, type VisitEventType } from '../../utils/fieldOps';
import { SourceBadge } from '../ui/SourceBadge';

const CHART_HEIGHT = 130;
const PADDING = { top: 20, right: 16, bottom: 16, left: 16 };
/** 한 화면에 보여 줄 방문 수 */
const VISIBLE_POINTS = 8;

const EVENT_STYLE: Record<VisitEventType, { color: string; background: string }> = {
  input: { color: '#7a573b', background: '#f4ece4' },
  mix: { color: '#1a73e8', background: '#e8f0fe' },
  bedding: { color: '#2e4a2b', background: '#e6f4ea' },
  mold: { color: '#c5221f', background: '#fce8e6' },
};

interface TrendChartProps {
  /** 한 사이클의 방문 기록 (오래된 순) */
  records: MeasurementRecord[];
  metric: 'moisture' | 'coreTemp';
  title: string;
  unit: string;
  /** 함수율 그래프에만 그리는 현장 관찰 구간 */
  band?: { min: number; max: number; label: string } | null;
}

/**
 * 온도·함수율 변화 그래프.
 *
 * 값이 갑자기 튄 이유(신규 커피박 투입 등)를 함께 보여 준다.
 * 신규 커피박이 섞이면 함수율이 다시 오를 수 있는데, 그것을 부숙 실패로 읽으면 안 되기 때문이다.
 */
export const TrendChart: React.FC<TrendChartProps> = ({ records, metric, title, unit, band = null }) => {
  const logs = records.filter(r => r[metric] > 0).slice(-VISIBLE_POINTS);

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

  const values = logs.map(r => r[metric]);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 100;
  const lowBound = band ? Math.min(rawMin, band.min) : rawMin;
  const highBound = band ? Math.max(rawMax, band.max) : rawMax;
  // 값이 거의 같을 때 선이 한 줄에 붙지 않도록 위아래를 조금 벌린다
  const pad = Math.max(4, (highBound - lowBound) * 0.2);
  const axisMin = Math.max(0, lowBound - pad);
  const axisMax = highBound + pad;

  const innerLeft = PADDING.left;
  const innerRight = Math.max(innerLeft + 1, width - PADDING.right);
  const innerTop = PADDING.top;
  const innerBottom = CHART_HEIGHT - PADDING.bottom;

  const getY = (value: number) => {
    const ratio = (Math.min(axisMax, Math.max(axisMin, value)) - axisMin) / (axisMax - axisMin || 1);
    return innerBottom - ratio * (innerBottom - innerTop);
  };

  const points = logs.map((log, index) => ({
    x:
      logs.length === 1
        ? (innerLeft + innerRight) / 2
        : innerLeft + (index * (innerRight - innerLeft)) / (logs.length - 1),
    y: getY(log[metric]),
    log,
  }));

  return (
    <div className="apple-card p-3.5 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">{title}</h4>
          <SourceBadge kind="measured" />
        </div>
        {band && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#B06000] dark:text-[#FF9F0A] whitespace-nowrap">
            {band.label} {band.min}~{band.max}
            {unit}
          </span>
        )}
      </div>

      <div ref={containerRef} className="w-full bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 rounded-xl px-2 pt-1.5 pb-1">
        {logs.length === 0 ? (
          <div
            className="w-full flex items-center justify-center text-xs text-[#6E6E73] dark:text-[#8E8E93]"
            style={{ height: CHART_HEIGHT }}
          >
            측정 기록이 없습니다.
          </div>
        ) : (
          <svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${Math.max(width, 1)} ${CHART_HEIGHT}`}
            className="block overflow-visible"
            role="img"
            aria-label={`${title} 변화. 최근 ${logs.length}회 방문.`}
          >
            {band && (
              <rect
                x={innerLeft}
                y={getY(band.max)}
                width={innerRight - innerLeft}
                height={Math.max(2, getY(band.min) - getY(band.max))}
                fill="#b06000"
                fillOpacity="0.06"
                rx="4"
                stroke="#b06000"
                strokeOpacity="0.5"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
            )}

            {points.length > 1 && (
              <polyline
                fill="none"
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                stroke="#2e4a2b"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            )}

            {points.map((p, index) => {
              const isLatest = index === points.length - 1;
              const anchor =
                points.length === 1 ? 'middle' : index === 0 ? 'start' : isLatest ? 'end' : 'middle';
              const labelY = p.y > innerTop + 22 ? p.y - 9 : p.y + 16;
              return (
                <g key={p.log.id}>
                  <circle cx={p.x} cy={p.y} r={isLatest ? 5 : 3.5} fill="#2e4a2b" stroke="#ffffff" strokeWidth="1.5" />
                  <text
                    x={p.x}
                    y={labelY}
                    fill="#2e4a2b"
                    fontSize={isLatest ? 11 : 10}
                    fontWeight="700"
                    textAnchor={anchor}
                    paintOrder="stroke"
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  >
                    {p.log[metric]}
                    {unit}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* 날짜와 그날 한 일 — 값이 왜 움직였는지 그래프에서 바로 읽히게 한다 */}
        {logs.length > 0 && (
          <div className="flex justify-between items-start gap-1 pt-1 pb-0.5">
            {logs.map(log => {
              const events = getVisitEvents(log);
              return (
                <div key={log.id} className="flex flex-col items-center gap-0.5 min-w-0">
                  <span className="text-[9.5px] tabular-nums text-[#6E6E73] dark:text-[#8E8E93]">
                    {Number(log.date.slice(5, 7))}/{Number(log.date.slice(8, 10))}
                  </span>
                  {events.map(event => (
                    <span
                      key={event.type}
                      className="px-1 rounded text-[9px] font-bold leading-4 whitespace-nowrap"
                      style={{ color: EVENT_STYLE[event.type].color, background: EVENT_STYLE[event.type].background }}
                    >
                      {event.label}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
