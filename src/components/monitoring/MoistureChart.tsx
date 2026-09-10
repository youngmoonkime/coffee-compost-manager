import React, { useLayoutEffect, useRef, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';

const CHART_HEIGHT = 116;
const PADDING = { top: 18, right: 14, bottom: 14, left: 14 };
const MIN_MOISTURE = 30;
const MAX_MOISTURE = 80;

export const MoistureChart: React.FC = () => {
  const { activeBatchMeasurements, settings } = useCompost();

  // 최근 측정 데이터 추출 (최대 6개)
  const logs = activeBatchMeasurements.slice(-6);
  const targetThreshold = settings.targetMoistureThreshold;

  /**
   * 이전에는 viewBox 320x100 을 preserveAspectRatio="none" 으로 컨테이너에 늘렸다.
   * 가로·세로 배율이 서로 달라져 숫자와 점이 찌그러져 보였다.
   * 실제 픽셀 폭을 측정해 viewBox 를 그 폭에 맞추면 배율이 1:1 이라 왜곡이 없다.
   */
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

  const lineThresholdY = getY(targetThreshold);

  const points = logs.map((log, index) => {
    const x =
      logs.length === 1
        ? (innerLeft + innerRight) / 2
        : innerLeft + (index * (innerRight - innerLeft)) / (logs.length - 1);
    return { x, y: getY(log.moisture), log };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const polygonPoints =
    points.length > 0
      ? `${points[0].x},${innerBottom} ${polylinePoints} ${points[points.length - 1].x},${innerBottom}`
      : '';

  return (
    <section className="w-full mb-3">
      <div className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm border border-outline-variant/20">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">show_chart</span>
            <h3 className="font-headline-sm text-[14px] font-bold text-on-surface tracking-tight whitespace-nowrap">
              심부 함수율 추이 (최근 계측)
            </h3>
          </div>
          <span className="font-caption text-[11px] text-secondary font-bold whitespace-nowrap">
            목표 {targetThreshold}%
          </span>
        </div>

        <p className="font-caption text-[11px] text-on-surface-variant mb-2 leading-tight break-keep">
          기준치 {targetThreshold}% 이하 하강 시 가축분뇨 퇴비화 투입 조건 충족
        </p>

        <div
          ref={containerRef}
          className="w-full relative bg-surface-container-low rounded-xl px-2 pt-2 pb-1.5"
        >
          {logs.length === 0 ? (
            <div className="w-full flex items-center justify-center text-outline text-xs" style={{ height: CHART_HEIGHT }}>
              계측 기록이 없습니다.
            </div>
          ) : (
            <>
              <svg
                width="100%"
                height={CHART_HEIGHT}
                viewBox={`0 0 ${Math.max(width, 1)} ${CHART_HEIGHT}`}
                className="block overflow-visible"
                role="img"
                aria-label={`심부 함수율 추이. 최근 ${logs.length}건.`}
              >
                <defs>
                  <linearGradient id="moistureGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2e4a2b" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#2e4a2b" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* 투입 한계 기준선 */}
                <line
                  stroke="#ba1a1a"
                  strokeDasharray="4,4"
                  strokeWidth="1.5"
                  x1={innerLeft}
                  x2={innerRight}
                  y1={lineThresholdY}
                  y2={lineThresholdY}
                />
                <text
                  fill="#ba1a1a"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="end"
                  x={innerRight}
                  y={lineThresholdY - 5}
                >
                  한계선 {targetThreshold}%
                </text>

                {/* 그라디언트 영역 및 연결선 */}
                {polygonPoints && <polygon fill="url(#moistureGradient)" points={polygonPoints} />}
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

                {/* 각 포인트 및 수치 라벨 */}
                {points.map((p, idx) => {
                  const isLatest = idx === points.length - 1;
                  const isReady = p.log.moisture <= targetThreshold;
                  const color = isReady ? '#2e4a2b' : isLatest ? '#7a573b' : '#2e4a2b';

                  // 라벨이 잘리지 않도록 양 끝에서는 안쪽으로 정렬한다
                  const anchor = idx === 0 ? 'start' : isLatest ? 'end' : 'middle';
                  // 점이 아래쪽에 있으면 라벨을 위로, 위쪽이면 아래로 피한다
                  const labelY = p.y > innerTop + 24 ? p.y - 9 : p.y + 16;

                  return (
                    <g key={p.log.id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        fill={color}
                        r={isLatest ? 5 : 3.5}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        fill={color}
                        fontSize={isLatest ? 11 : 10}
                        fontWeight="700"
                        textAnchor={anchor}
                        x={p.x}
                        y={labelY}
                      >
                        {p.log.moisture}%
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* 하단 X축 라벨 */}
              <div className="flex justify-between items-center text-[9.5px] font-label-numeric text-outline px-1 pt-1.5">
                {logs.map((log, index) => {
                  const isLatest = index === logs.length - 1;
                  return (
                    <span key={log.id} className={isLatest ? 'text-secondary font-bold' : ''}>
                      D+{log.dayNumber}
                      {isLatest ? ' (최근)' : ''}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-4 mt-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-primary rounded-full"></span>
            <span className="font-caption text-[11px] text-on-surface-variant whitespace-nowrap">
              함수율 추이 (%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-error"></span>
            <span className="font-caption text-[11px] text-error font-medium whitespace-nowrap">
              투입 한계선 ({targetThreshold}%)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
