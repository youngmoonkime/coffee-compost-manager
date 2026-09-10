import React from 'react';
import { useCompost } from '../../contexts/CompostContext';

export const MoistureChart: React.FC = () => {
  const { activeBatchMeasurements, settings } = useCompost();

  // 최근 측정 데이터 추출 (최대 6개)
  const logs = activeBatchMeasurements.slice(-6);
  const targetThreshold = settings.targetMoistureThreshold;

  // SVG 차트 좌표 계산
  // viewBox: 0 0 320 100
  // X 범위: 20 ~ 300
  // Y 범위: 함수율 30% ~ 80% 매핑 (0 -> 80%, 100 -> 30%)
  const minMoist = 30;
  const maxMoist = 80;

  const getY = (val: number) => {
    const clamped = Math.min(maxMoist, Math.max(minMoist, val));
    const ratio = (clamped - minMoist) / (maxMoist - minMoist);
    // ratio가 1일때(80%) Y는 10, ratio가 0일때(30%) Y는 90
    return 90 - ratio * 80;
  };

  const lineThresholdY = getY(targetThreshold);

  // X 좌표 균등 배분
  const points = logs.map((log, index) => {
    const x = logs.length === 1 ? 160 : 20 + (index * (280 / (logs.length - 1)));
    const y = getY(log.moisture);
    return { x, y, log };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const polygonPoints = points.length > 0
    ? `${points[0].x},95 ${polylinePoints} ${points[points.length - 1].x},95`
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

        <div className="w-full h-36 relative bg-surface-container-low rounded-xl p-2 flex flex-col justify-between overflow-hidden">
          {logs.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-outline text-xs">
              계측 기록이 없습니다.
            </div>
          ) : (
            <svg className="w-full h-24 overflow-visible" preserveAspectRatio="none" viewBox="0 0 320 100">
              <defs>
                <linearGradient id="moistureGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2e4a2b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#2e4a2b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* 한계 기준선 */}
              <line
                stroke="#ba1a1a"
                strokeDasharray="4,4"
                strokeWidth="1.5"
                x1="10"
                x2="310"
                y1={lineThresholdY}
                y2={lineThresholdY}
              />
              <text
                fill="#ba1a1a"
                fontFamily="JetBrains Mono"
                fontSize="8.5"
                fontWeight="bold"
                x="240"
                y={lineThresholdY - 4}
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
                const circleColor = isReady ? '#2e4a2b' : isLatest ? '#7a573b' : '#2e4a2b';

                return (
                  <g key={p.log.id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      fill={circleColor}
                      r={isLatest ? 5 : 3.5}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      fill={circleColor}
                      fontFamily="JetBrains Mono"
                      fontSize={isLatest ? '9.5' : '8.5'}
                      fontWeight="bold"
                      x={p.x - 10}
                      y={p.y > 60 ? p.y - 8 : p.y + 14}
                    >
                      {p.log.moisture}%
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* 하단 X축 라벨 */}
          <div className="flex justify-between items-center text-[9.5px] font-label-numeric text-outline px-1 pt-1">
            {logs.map((log, index) => {
              const isLatest = index === logs.length - 1;
              return (
                <span
                  key={log.id}
                  className={isLatest ? 'text-secondary font-bold' : ''}
                >
                  D+{log.dayNumber}{isLatest ? ' (최근)' : ''}
                </span>
              );
            })}
          </div>
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
            <span className="w-2.5 h-0.5 bg-error border-dashed"></span>
            <span className="font-caption text-[11px] text-error font-medium whitespace-nowrap">
              투입 한계선 ({targetThreshold}%)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
