import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import type { MeasurementRecord } from '../../types';
import { getVisitEvents } from '../../utils/fieldOps';

const CHART_HEIGHT = 70;
const PADDING = { top: 10, right: 14, bottom: 10, left: 14 };
/** 한 화면에 보여 줄 최근 방문 수 */
const VISIBLE_POINTS = 7;

interface CombinedTrendChartProps {
  /** 한 사이클의 방문 기록 (오래된 순) */
  records: MeasurementRecord[];
  /** 함수율 현장 관찰 사용 후보 구간 */
  moistureBand?: { min: number; max: number; label: string } | null;
  /** 신규 투입 여부 안내 */
  trendHasNewInput?: boolean;
  /** 더미량 박스 내부에 포함(임베드)되었는지 여부 */
  isEmbedded?: boolean;
}

/**
 * 모바일 터치 최적화 미니멀 통합 변화 그래프.
 *
 * - 평소: 텍스트 노이즈(상시 수치 라벨, 이벤트 배지) 없이 깨끗한 선과 포인트만 노출
 * - 터치/클릭 시: 해당 시점의 함수율, 심부온도 및 세부 작업 내용이 툴팁으로 상세 표시
 */
export const CombinedTrendChart: React.FC<CombinedTrendChartProps> = ({
  records,
  moistureBand = null,
  trendHasNewInput = false,
  isEmbedded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 외부 클릭 시 안내 팝오버 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  const logs = records.filter(r => r.moisture > 0 || r.coreTemp > 0).slice(-VISIBLE_POINTS);

  const moistureValues = logs.map(r => r.moisture).filter(v => v > 0);
  const tempValues = logs.map(r => r.coreTemp).filter(v => v > 0);
  const allValues = [...moistureValues, ...tempValues];

  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 100;
  const lowBound = moistureBand ? Math.min(rawMin, moistureBand.min) : rawMin;
  const highBound = moistureBand ? Math.max(rawMax, moistureBand.max) : rawMax;

  const pad = Math.max(6, (highBound - lowBound) * 0.18);
  const axisMin = Math.max(0, Math.floor(lowBound - pad));
  const axisMax = Math.min(100, Math.ceil(highBound + pad));

  const innerLeft = PADDING.left;
  const innerRight = Math.max(innerLeft + 1, width - PADDING.right);
  const innerTop = PADDING.top;
  const innerBottom = CHART_HEIGHT - PADDING.bottom;

  const getY = (value: number) => {
    const ratio = (Math.min(axisMax, Math.max(axisMin, value)) - axisMin) / (axisMax - axisMin || 1);
    return innerBottom - ratio * (innerBottom - innerTop);
  };

  const getX = (index: number) => {
    if (logs.length <= 1) return (innerLeft + innerRight) / 2;
    return innerLeft + (index * (innerRight - innerLeft)) / (logs.length - 1);
  };

  const moisturePoints = logs.map((log, index) => ({
    x: getX(index),
    y: getY(log.moisture),
    value: log.moisture,
    id: log.id,
  }));

  const tempPoints = logs.map((log, index) => ({
    x: getX(index),
    y: getY(log.coreTemp),
    value: log.coreTemp,
    id: log.id,
  }));

  const activeLog = activeIdx !== null ? logs[activeIdx] : null;
  const activeEvents = activeLog ? getVisitEvents(activeLog) : [];

  const cardWrapperClass = isEmbedded
    ? 'w-full'
    : 'apple-card p-3 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-xs rounded-xl';

  return (
    <div className={cardWrapperClass}>
      {/* 1줄 통합 헤더 & 초슬림 범례 */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] font-bold text-[#6E6E73] dark:text-[#8E8E93] tracking-tight">
            변화 그래프
          </span>

          {/* i 인포메이션 팝오버 버튼 */}
          <div className="relative" ref={infoRef}>
            <button
              type="button"
              onClick={() => setShowInfo(prev => !prev)}
              className={`p-0.5 rounded-full text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors ${
                showInfo ? 'bg-black/10 dark:bg-white/20 text-[#1D1D1F] dark:text-[#F5F5F7]' : ''
              }`}
              title="그래프 상세 안내"
              aria-label="그래프 상세 안내"
            >
              <Info className="w-3 h-3" />
            </button>

            {showInfo && (
              <div className="absolute left-0 top-5 z-40 w-68 sm:w-72 p-2.5 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/15 shadow-xl text-xs text-[#1D1D1F] dark:text-[#F5F5F7] space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-1">
                  <span className="font-bold flex items-center gap-1 text-[11px] text-[#315C36] dark:text-[#34C759]">
                    <Info className="w-3 h-3" /> 그래프 안내
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInfo(false)}
                    className="text-[#8E8E93] hover:text-black dark:hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1 text-[10.5px] leading-relaxed text-[#6E6E73] dark:text-[#E5E5EA]">
                  <p>
                    <strong className="text-[#315C36] dark:text-[#34C759]">함수율(녹색 실선)</strong>: 목표 20~30% 구간으로 하강
                  </p>
                  <p>
                    <strong className="text-[#D97706] dark:text-[#FF9F0A]">심부 온도(주황 점선)</strong>: 65℃ 이하 관리 권장
                  </p>
                  <p className="text-[10px] text-[#8E8E93] pt-0.5">
                    💡 그래프 선이나 마커를 누르면 해당 시점의 상세 측정치와 작업 내역을 확인할 수 있습니다.
                  </p>
                  {trendHasNewInput && (
                    <div className="p-1.5 rounded-lg bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 text-[#D97706] dark:text-[#FF9F0A] font-medium text-[10px]">
                      💡 최근 신규 커피박 투입으로 함수율/온도가 일시 상승할 수 있습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 초슬림 범례 (Legend) */}
        <div className="flex items-center gap-2 text-[9.5px] font-medium text-[#6E6E73] dark:text-[#8E8E93]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#315C36] dark:bg-[#34C759] rounded-full" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#315C36] dark:bg-[#34C759]" />
            <span className="font-semibold text-[#315C36] dark:text-[#34C759]">함수율(%)</span>
          </span>

          <span className="inline-flex items-center gap-1">
            <span className="w-2 border-t border-dashed border-[#D97706] dark:border-[#FF9F0A]" />
            <span className="w-1.5 h-1.5 rotate-45 bg-[#D97706] dark:bg-[#FF9F0A]" />
            <span className="font-semibold text-[#D97706] dark:text-[#FF9F0A]">심부온도(℃)</span>
          </span>
        </div>
      </div>

      {/* 터치 시 나타나는 상세 인터랙티브 툴팁 바 */}
      {activeLog && (
        <div className="flex items-center justify-between px-2 py-1 mb-1 rounded-lg bg-[#315C36]/10 dark:bg-[#34C759]/15 border border-[#315C36]/20 text-xs text-[#1D1D1F] dark:text-[#F5F5F7] animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-[11px] min-w-0">
            <span className="font-bold tabular-nums text-[#315C36] dark:text-[#34C759]">
              {Number(activeLog.date.slice(5, 7))}월 {Number(activeLog.date.slice(8, 10))}일
            </span>
            <span>
              함수율 <strong className="text-[#315C36] dark:text-[#34C759]">{activeLog.moisture}%</strong>
            </span>
            <span>
              심부 <strong className="text-[#D97706] dark:text-[#FF9F0A]">{activeLog.coreTemp}℃</strong>
            </span>
            {activeEvents.length > 0 && (
              <span className="text-[10px] text-[#6E6E73] dark:text-[#8E8E93] truncate">
                ({activeEvents.map(e => e.label).join(', ')})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            className="text-[#8E8E93] hover:text-black dark:hover:text-white p-0.5 ml-1 shrink-0"
            aria-label="닫기"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 차트 SVG 영역 (상시 텍스트 노이즈 없이 깨끗한 선과 포인트만 노출) */}
      <div ref={containerRef} className="w-full bg-[#F2F2F7]/50 dark:bg-[#2C2C2E]/40 rounded-lg px-1.5 pt-1.5 pb-1">
        {logs.length === 0 ? (
          <div
            className="w-full flex items-center justify-center text-[11px] text-[#8E8E93]"
            style={{ height: CHART_HEIGHT }}
          >
            기록 없음
          </div>
        ) : (
          <svg
            width="100%"
            height={CHART_HEIGHT}
            viewBox={`0 0 ${Math.max(width, 1)} ${CHART_HEIGHT}`}
            className="block overflow-visible cursor-pointer select-none"
            role="img"
            aria-label={`함수율 및 심부온도 변화 그래프`}
          >
            {/* 가로 중앙 가이드라인 1개만 미니멀하게 제공 */}
            <line
              x1={innerLeft}
              y1={getY(50)}
              x2={innerRight}
              y2={getY(50)}
              stroke="currentColor"
              className="text-black/5 dark:text-white/5"
              strokeDasharray="2 2"
            />

            {/* 깔개 사용 후보 관찰 구간 (20~30% 음영) */}
            {moistureBand && (
              <rect
                x={innerLeft}
                y={getY(moistureBand.max)}
                width={Math.max(1, innerRight - innerLeft)}
                height={Math.max(2, getY(moistureBand.min) - getY(moistureBand.max))}
                fill="#FF9F0A"
                fillOpacity="0.08"
                rx="2"
                stroke="#FF9F0A"
                strokeOpacity="0.3"
                strokeWidth="0.8"
                strokeDasharray="3 2"
              />
            )}

            {/* 선택된 포인트의 세로 가이드 인디케이터 라인 */}
            {activeIdx !== null && (
              <line
                x1={getX(activeIdx)}
                y1={innerTop}
                x2={getX(activeIdx)}
                y2={innerBottom}
                stroke="#315C36"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                className="opacity-70"
              />
            )}

            {/* 1. 심부온도 폴리라인 (주황 점선) */}
            {tempPoints.length > 1 && (
              <polyline
                fill="none"
                points={tempPoints.map(p => `${p.x},${p.y}`).join(' ')}
                stroke="#D97706"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            )}

            {/* 2. 함수율 폴리라인 (녹색 실선) */}
            {moisturePoints.length > 1 && (
              <polyline
                fill="none"
                points={moisturePoints.map(p => `${p.x},${p.y}`).join(' ')}
                stroke="#315C36"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            )}

            {/* 심부온도 마커 (다이아몬드) - 상시 텍스트 없음 */}
            {tempPoints.map((p, index) => {
              const isSelected = activeIdx === index;
              return (
                <g key={`temp-${p.id}`}>
                  <polygon
                    points={`${p.x},${p.y - (isSelected ? 4 : 2.5)} ${p.x + (isSelected ? 4 : 2.5)},${p.y} ${p.x},${p.y + (isSelected ? 4 : 2.5)} ${p.x - (isSelected ? 4 : 2.5)},${p.y}`}
                    fill="#D97706"
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? 2 : 1}
                  />
                </g>
              );
            })}

            {/* 함수율 마커 (원형) - 상시 텍스트 없음 */}
            {moisturePoints.map((p, index) => {
              const isSelected = activeIdx === index;
              return (
                <g key={`moist-${p.id}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 4 : 2.5}
                    fill="#315C36"
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? 2 : 1}
                  />
                </g>
              );
            })}

            {/* 손가락 터치/클릭을 위한 투명 세로 히트박스 영역 */}
            {logs.map((log, index) => {
              const x = getX(index);
              const colWidth = Math.max(30, width / logs.length);
              return (
                <rect
                  key={`hit-${log.id}`}
                  x={x - colWidth / 2}
                  y={0}
                  width={colWidth}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  className="cursor-pointer active:fill-black/5 dark:active:fill-white/5"
                  onClick={() => setActiveIdx(prev => (prev === index ? null : index))}
                  onTouchStart={() => setActiveIdx(index)}
                />
              );
            })}
          </svg>
        )}

        {/* 하단 일자 라벨 (이벤트 태그 없이 미니멀한 날짜만 표시) */}
        {logs.length > 0 && (
          <div className="flex justify-between items-center px-1 pt-1 border-t border-black/5 dark:border-white/5">
            {logs.map((log, index) => {
              const isSelected = activeIdx === index;
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setActiveIdx(prev => (prev === index ? null : index))}
                  className={`text-[8.5px] tabular-nums font-medium transition-colors ${
                    isSelected
                      ? 'font-bold text-[#315C36] dark:text-[#34C759]'
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {Number(log.date.slice(5, 7))}/{Number(log.date.slice(8, 10))}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
