import React, { useMemo } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { summarizePiles, getWeeklyCollection, getCurrentDateString, formatShortDate, daysBetween } from '../../utils/calculations';
import { Card } from '../ui/Card';
import { MetricDisplay } from '../ui/MetricDisplay';

export const TodayView: React.FC = () => {
  const {
    records,
    settings,
    setActiveTab,
    setActivePile,
    setHistoryPileKey,
    pendingCount,
    isSheetBackend,
    reloadFromSheet,
    isLoadingFromSheet,
  } = useCompost();

  const today = getCurrentDateString();

  // 장소별 분석 데이터
  const pileSummaries = useMemo(() => summarizePiles(records, settings), [records, settings]);

  // Attention First: 확인이 필요한 장소 (action_needed, 과열, 과습)
  const attentionPiles = useMemo(() => {
    return pileSummaries.filter(
      p =>
        p.verdict.type === 'action_needed' ||
        p.latest.coreTemp > settings.highTempThreshold ||
        p.latest.moisture > settings.highMoistureThreshold
    );
  }, [pileSummaries, settings]);

  // 사용 가능 장소
  const usablePiles = useMemo(
    () => pileSummaries.filter(p => p.verdict.type === 'usable'),
    [pileSummaries]
  );

  // 이번 주 수거량
  const weekly = useMemo(() => getWeeklyCollection(records, today), [records, today]);

  // 최근 측정 기록 3건
  const recentRecords = useMemo(() => {
    return [...records].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 3);
  }, [records]);

  // 최근 측정 일자 및 경과 일수
  const latestMeasuredRecord = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0];
  }, [records]);

  const daysSinceLastMeasurement = useMemo(() => {
    if (!latestMeasuredRecord) return null;
    return Math.max(0, daysBetween(latestMeasuredRecord.date, today));
  }, [latestMeasuredRecord, today]);

  // 현장 전체 현황 종합 분석 및 안내 멘트
  const overallBriefing = useMemo(() => {
    if (pileSummaries.length === 0) {
      return {
        type: 'info' as const,
        icon: 'info',
        badge: '모니터링 대기',
        badgeColor: 'text-[#007AFF] bg-[#007AFF]/10 dark:text-[#0A84FF] dark:bg-[#0A84FF]/20',
        title: '등록된 퇴비사 측정 기록이 없습니다',
        description: '하역 장소별 수분율과 심부 온도를 기록하시면 부숙 진행도와 맞춤형 관리 안내가 이곳에 자동으로 제공됩니다.',
        breakdown: [] as Array<{ label: string; count: number; color: string }>,
      };
    }

    const attentionCount = attentionPiles.length;
    const usableCount = usablePiles.length;
    const dryingCount = Math.max(0, pileSummaries.length - attentionCount - usableCount);

    // Case 1: 조치 또는 점검이 필요한 장소가 있는 경우
    if (attentionCount > 0) {
      const attentionNames = attentionPiles.map(p => `'${p.pile.location}'`).join(', ');
      const firstAtt = attentionPiles[0];
      let guidance = '';

      if (firstAtt.latest.moisture > settings.highMoistureThreshold) {
        guidance = `수분율이 ${firstAtt.latest.moisture}%로 기준치(${settings.highMoistureThreshold}%)를 초과하여 과습 상태입니다. 혐기 발효 방지를 위해 마른 커피박을 투입하거나 뒤집기(교반)가 권장됩니다.`;
      } else if (firstAtt.latest.coreTemp > settings.highTempThreshold) {
        guidance = `심부 온도가 ${firstAtt.latest.coreTemp}℃로 고온입니다. 내부 열 방출과 산소 공급을 위해 통기 교반을 진행해주세요.`;
      } else if (firstAtt.verdict.action) {
        guidance = firstAtt.verdict.action;
      } else {
        guidance = '호기성 발효 상태를 점검하고 필요 시 뒤집기 작업을 진행해주세요.';
      }

      return {
        type: 'warning' as const,
        icon: 'warning',
        badge: `확인 필요 ${attentionCount}곳`,
        badgeColor: 'text-[#D97706] bg-[#FF9F0A]/10 dark:text-[#FF9F0A] dark:bg-[#FF9F0A]/20',
        title: `${attentionNames}의 집중 관리가 필요합니다`,
        description: `${guidance}${usableCount > 0 ? ` (참고: 축사 깔개로 즉시 활용 가능한 장소도 ${usableCount}곳 있습니다.)` : ''}`,
        breakdown: [
          { label: '확인 필요', count: attentionCount, color: 'text-[#D97706] dark:text-[#FF9F0A]' },
          { label: '부숙 진행', count: dryingCount, color: 'text-[#6E6E73] dark:text-[#8E8E93]' },
          { label: '깔개 가능', count: usableCount, color: 'text-[#315C36] dark:text-[#34C759]' },
        ],
      };
    }

    // Case 2: 깔개 사용 가능한 장소가 있는 경우 (주의 대상 없음)
    if (usableCount > 0) {
      const usableNames = usablePiles.map(p => `'${p.pile.location}'`).join(', ');
      const firstUsable = usablePiles[0];
      return {
        type: 'usable' as const,
        icon: 'check_circle',
        badge: `깔개 사용 가능 ${usableCount}곳`,
        badgeColor: 'text-[#315C36] bg-[#315C36]/10 dark:text-[#34C759] dark:bg-[#34C759]/20',
        title: `${usableNames}의 부숙이 완료되어 축사 깔개로 투입할 수 있습니다`,
        description: `수분율이 ${firstUsable.latest.moisture}%로 감량 기준(${settings.usableMoistureMin}%~${settings.usableMoistureMax}%)을 충족하여 유기물 안정화가 완료되었습니다. 축사 깔개로 우선 활용하세요.`,
        breakdown: [
          { label: '깔개 가능', count: usableCount, color: 'text-[#315C36] dark:text-[#34C759]' },
          { label: '부숙 진행', count: dryingCount, color: 'text-[#6E6E73] dark:text-[#8E8E93]' },
        ],
      };
    }

    // Case 3: 전체 장소 안정 부숙 진행 중
    const avgMoisture = Math.round(
      pileSummaries.reduce((acc, p) => acc + p.latest.moisture, 0) / pileSummaries.length
    );
    const avgTemp = Math.round(
      pileSummaries.reduce((acc, p) => acc + p.latest.coreTemp, 0) / pileSummaries.length
    );

    return {
      type: 'normal' as const,
      icon: 'verified',
      badge: '전체 현황 양호',
      badgeColor: 'text-[#315C36] bg-[#315C36]/10 dark:text-[#34C759] dark:bg-[#34C759]/20',
      title: '모든 퇴비사가 적정 수분과 온도에서 안정적으로 발효 중입니다',
      description: `관리 중인 ${pileSummaries.length}개 장소(평균 수분 ${avgMoisture}%, 심부 ${avgTemp}℃) 모두 과열·과습 없이 호기성 발효가 순조롭게 진행되고 있습니다.`,
      breakdown: [
        { label: '정상 부숙', count: pileSummaries.length, color: 'text-[#315C36] dark:text-[#34C759]' },
      ],
    };
  }, [pileSummaries, attentionPiles, usablePiles, settings]);


  // 한국어 날짜 포맷
  const formattedTodayDate = useMemo(() => {
    const d = new Date();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
  }, []);

  const handleOpenPileDetail = (pileKey: string, pile: { ranchName: string; location: string }) => {
    setActivePile(pile);
    setHistoryPileKey(pileKey);
    setActiveTab('history');
  };

  return (
    <div className="flex flex-col w-full pb-6 space-y-6">
      {/* 1. 상단 타이틀 & 날짜 */}
      <div className="flex items-end justify-between pt-1">
        <div>
          <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] tracking-tight block">
            {formattedTodayDate}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mt-0.5">
            오늘
          </h2>
        </div>
        {isSheetBackend && (
          <button
            type="button"
            onClick={() => reloadFromSheet()}
            disabled={isLoadingFromSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] active:scale-95 transition-all disabled:opacity-50"
            title="구글 시트에서 새로고침"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-[#315C36] dark:text-[#34C759] ${
                isLoadingFromSheet ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span className="hidden sm:inline">
              {isLoadingFromSheet ? '동기화 중' : '새로고침'}
            </span>
          </button>
        )}
      </div>

      {/* 미전송 기록 경보 배너 */}
      {pendingCount > 0 && (
        <div className="rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[#FF9F0A] text-[20px] shrink-0">
              cloud_off
            </span>
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

      {/* 2. 현장 전체 상황 종합 안내 */}
      <section aria-labelledby="today-briefing-heading">
        <Card
          className={`p-4 sm:p-5 transition-all ${
            overallBriefing.type === 'warning'
              ? 'bg-gradient-to-br from-[#FFFBEB] to-white dark:from-[#241C12] dark:to-[#1C1C1E] border-[#FF9F0A]/30 dark:border-[#FF9F0A]/40 shadow-sm'
              : overallBriefing.type === 'usable'
              ? 'bg-gradient-to-br from-[#F0FDF4] to-white dark:from-[#132316] dark:to-[#1C1C1E] border-[#315C36]/30 dark:border-[#34C759]/40 shadow-sm'
              : 'bg-gradient-to-br from-white to-[#F9F9FB] dark:from-[#181E19] dark:to-[#1C1C1E] border-black/5 dark:border-white/10 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${overallBriefing.badgeColor}`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {overallBriefing.icon}
              </span>
              {overallBriefing.badge}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="text-xs font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#315C36] dark:hover:text-[#34C759] flex items-center gap-0.5 transition-colors"
            >
              장소별 현황 <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          <h3
            id="today-briefing-heading"
            className="text-base sm:text-lg font-bold text-[#1D1D1F] dark:text-[#FFFFFF] leading-snug"
          >
            {overallBriefing.title}
          </h3>
          <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#A1A1A6] mt-1.5 break-keep leading-relaxed">
            {overallBriefing.description}
          </p>

          {overallBriefing.breakdown.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3 border-t border-black/5 dark:border-white/10 text-xs">
              <span className="text-[11px] font-semibold text-[#8E8E93] dark:text-[#8E8E93]">
                현황 요약:
              </span>
              {overallBriefing.breakdown.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-[#2C2C2E] border border-black/5 dark:border-white/5 text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]"
                >
                  <span>{item.label}</span>
                  <strong className={item.color}>{item.count}곳</strong>
                </span>
              ))}
              {latestMeasuredRecord && daysSinceLastMeasurement !== null && (
                <span className="text-[11px] text-[#8E8E93] dark:text-[#8E8E93] ml-auto">
                  최근 기록: {formatShortDate(latestMeasuredRecord.date)} (
                  {daysSinceLastMeasurement === 0
                    ? '오늘'
                    : `${daysSinceLastMeasurement}일 전`}
                  )
                </span>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* 3. 현장 요약 현황 섹터 */}
      <section aria-labelledby="sector-summary-heading">
        <div className="flex items-center gap-2 mb-2.5 px-0.5">
          <span className="w-1.5 h-3.5 rounded-full bg-[#315C36] dark:bg-[#34C759]" />
          <h3
            id="sector-summary-heading"
            className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] tracking-wide"
          >
            현장 요약 현황
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          <Card className="p-3.5 sm:p-4 text-center bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm">
            <MetricDisplay
              label="깔개 사용 가능"
              value={usablePiles.length}
              unit="곳"
              size="sm"
              className="items-center"
            />
          </Card>

          <Card className="p-3.5 sm:p-4 text-center bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm">
            <MetricDisplay
              label="관리 중 장소"
              value={pileSummaries.length}
              unit="곳"
              size="sm"
              className="items-center"
            />
          </Card>

          <Card className="p-3.5 sm:p-4 text-center bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm">
            <MetricDisplay
              label="이번 주 수거"
              value={weekly.totalKg.toLocaleString('ko-KR')}
              unit="kg"
              size="sm"
              className="items-center"
            />
          </Card>
        </div>
      </section>

      {/* 4. 최근 측정 내역 섹터 */}
      {recentRecords.length > 0 && (
        <section aria-labelledby="sector-recent-heading">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 rounded-full bg-[#007AFF] dark:bg-[#0A84FF]" />
              <h3
                id="sector-recent-heading"
                className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] tracking-wide"
              >
                최근 측정 내역
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="text-xs font-semibold text-[#315C36] dark:text-[#34C759] hover:underline flex items-center gap-0.5"
            >
              전체 보기 <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>

          <div className="space-y-2">
            {recentRecords.map(record => (
              <div
                key={record.id}
                onClick={() =>
                  handleOpenPileDetail(`${record.ranchName}|${record.location}`, {
                    ranchName: record.ranchName,
                    location: record.location,
                  })
                }
                className="apple-card-interactive p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] font-medium">
                      {record.ranchName}
                    </span>
                    <span className="text-xs text-black/20 dark:text-white/20">·</span>
                    <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                      {formatShortDate(record.date)} {record.time}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 truncate">
                    {record.location}
                  </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <div className="text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                      {record.moisture}%
                    </div>
                    <div className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                      심부 {record.coreTemp}℃
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#6E6E73] dark:text-[#8E8E93]">
                    chevron_right
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
