import type { CompostSettings, MeasurementRecord, OperatingCycle } from '../types';
import { DEFAULT_RANCH_NAME, DEFAULT_SAWDUST_PRICE_PER_TON } from '../constants/defaultData';
import { getCurrentDateString, normalizeName, summarizePiles } from '../utils/calculations';
import { summarizeCycle } from '../utils/fieldOps';
import type { CollectionData, DashboardData } from './gasClient';

/**
 * 리포트에 들어가는 숫자는 모두 여기서 만든다.
 * AI 에게는 여기서 나온 값만 넘기고 문장만 받는다 — 그래야 같은 자료면 늘 같은 숫자가 나온다.
 */

export interface ReportPeriod {
  year: number;
  month: number;
  label: string;
}

/**
 * 현장 운영 현황 — 지금 모여 있는 더미 한 덩어리의 상태.
 * 숫자와 판정은 모두 코드가 셈한 것이고, AI 는 이 값을 설명만 한다.
 */
export interface FieldFact {
  source: 'compost-gas';
  ranchName: string;
  cycleId: string | null;
  cycleDays: number | null;
  visitCount: number;
  daysSinceLastVisit: number | null;
  /** 누적 신규 투입 - 누적 깔개 사용 */
  currentPileKg: number;
  addedKg: number;
  beddingUsedKg: number;
  targetPileKg: number | null;
  progressPercent: number | null;
  currentMoisture: number | null;
  moistureTrend: string;
  currentCoreTemp: number | null;
  temperatureTrend: string;
  mixingCountLast7Days: number;
  daysSinceLastMixing: number | null;
  moldStatus: string;
  /** 코드가 정한 판정 — AI 가 바꾸면 안 된다 */
  beddingStatus: string;
  beddingStatusLabel: string;
  beddingStatusReason: string;
  /** 판정을 막고 있는, 빠진 자료 */
  dataGaps: string[];
  /** 이 수치를 읽는 법 */
  note: string;
}

export interface RanchSaving {
  ranchName: string;
  tons: number;
  pricePerTon: number;
  /** ranch = 목장별로 입력한 단가, default = 기본 단가 */
  priceSource: 'ranch' | 'default';
  costKrw: number;
}

export interface PileFact {
  ranchName: string;
  location: string;
  latestDate: string;
  moisture: number;
  coreTemp: number;
  verdict: string;
  recordCount: number;
  totalCollectedKg: number;
}

export interface ImpactFacts {
  period: ReportPeriod;
  generatedAt: string;
  /** 어느 시트를 읽을 수 있었는지 — 한쪽이 없어도 나머지로 리포트를 만든다 */
  endpoints: {
    /** 부숙관리 GAS (기록·사진·AI) */
    compostConnected: boolean;
    /** 수거관리 GAS (대시보드·매장별 수거량) */
    collectionConnected: boolean;
  };
  /** 수거관리 GAS 에서 온 값 — 매장에서 실제로 걷은 양. 연동 전이면 null */
  collection: {
    /** 이 숫자의 출처. 부숙 기록과 같은 값이 아니다 */
    source: 'collection-gas';
    totalKg: number;
    previousMonthKg: number | null;
    changePercent: number | null;
    activeStoreCount: number;
    weeklyKg: number[];
    isPartialMonth: boolean;
    topStores: { storeName: string; totalKg: number }[];
    weeklyComparison?: {
      currentWeek: number;
      currentKg: number;
      prevWeek: number;
      prevKg: number;
      changeKg: number;
      changePercent: number | null;
    } | null;
    samePeriodComparison?: {
      weeksCount: number;
      currentWeeksKg: number;
      prevMonthWeeksKg: number | null;
      changeKg: number | null;
      changePercent: number | null;
      achievementPercent: number | null;
    } | null;
  } | null;
  /** 부숙관리 GAS 에서 온 값 — 목장에 하역해 부숙 중인 더미 기록 */
  compost: {
    /** 이 숫자의 출처. 매장 수거량과 같은 값이 아니다 */
    source: 'compost-gas';
    monthRecordCount: number;
    monthCollectedKg: number;
    pileCount: number;
    ranchNames: string[];
    piles: PileFact[];
    usableLocations: string[];
    actionNeededLocations: string[];
    usableMoistureMin: number;
    usableMoistureMax: number;
  };
  /** 지금 모여 있는 더미의 현장 운영 현황. 기록이 없으면 null */
  field: FieldFact | null;
  /** 톱밥 대체 절감 추정 — 근거가 되는 수거량이 없으면 null */
  savings: {
    basisKg: number;
    basisLabel: string;
    /** 절감액을 어느 쪽 숫자로 셈했는지 */
    basisSource: 'collection-gas' | 'compost-gas';
    /** 근거 수거량(톤) */
    basisTons: number;
    /** 목장별 (톤 × 그 목장 단가) 합계 */
    sawdustCostKrw: number;
    /** 목장별 계산 — 목장마다 톱밥 구매 단가가 다르다 */
    byRanch: RanchSaving[];
    /** 목장 단가가 없는 목장에 쓴 기본 단가 */
    defaultPricePerTon: number;
    /** 기본 단가가 설정에서 바꾸지 않은 임시 가정값이고, 실제로 그 값을 쓴 목장이 있는지 */
    priceIsDefault: boolean;
  } | null;
  /** 어떤 숫자가 어디서 왔는지 — 리포트 '근거' 칸에 그대로 쓴다 */
  sources: string[];
  /** 믿기 어려워 리포트에서 뺀 값 — 사람에게 보여 주고 AI 에게는 숫자를 주지 않는다 */
  dataWarnings: string[];
  /** 표준화된 7개 섹션 월간 현황 보고서용 Facts */
  standardReport?: StandardReportFacts;
}

/* ─────────────────── 표준 월간 보고서 스키마 (7대 섹션 표준화) ─────────────────── */

export interface StandardReportPeriod {
  year: number;
  month: number;
  label: string; // "2026년 9월"
  dateRange: string; // "2026.09.01 ~ 2026.09.30"
  daysInMonth: number;
  elapsedDays: number;
  status: 'completed' | 'in_progress';
  statusLabel: string; // "완료" | "진행 중"
}

export interface WeeklyFact {
  weekNumber: number;
  weekLabel: string; // "1주차"
  dateRange: string; // "9/1 ~ 9/7"
  days: number;
  totalKg: number;
  dailyAverageKg: number;
  sharePercent: number;
  status: 'completed' | 'in_progress' | 'no_collection';
}

export interface StoreFact {
  rank: number;
  storeName: string;
  totalKg: number;
  sharePercent: number;
  weeklyKg: number[];
  isNew?: boolean;
  isZero?: boolean;
}

export interface ComparisonFact {
  hasPreviousMonth: boolean;
  previousMonthKg: number | null;
  currentMonthKg: number;
  differenceKg: number | null;
  changePercent: number | null;
  previousActiveStores: number | null;
  currentActiveStores: number;
  activeStoreDifference: number | null;
  previousDailyAverageKg: number | null;
  currentDailyAverageKg: number;
  dailyAverageDifference: number | null;
  isPartialMonth: boolean;
  weeklyComparison?: {
    currentWeek: number;
    currentKg: number;
    prevWeek: number;
    prevKg: number;
    changeKg: number;
    changePercent: number | null;
  } | null;
  samePeriodComparison?: {
    weeksCount: number;
    currentWeeksKg: number;
    prevMonthWeeksKg: number | null;
    changeKg: number | null;
    changePercent: number | null;
    achievementPercent: number | null;
  } | null;
}

export interface KeyChangesFact {
  highestWeek: { weekNumber: number; weekLabel: string; totalKg: number; dailyAverageKg: number } | null;
  lowestWeek: { weekNumber: number; weekLabel: string; totalKg: number; dailyAverageKg: number } | null;
  top5SharePercent: number;
  top1SharePercent: number;
  newStores: string[];
  zeroStores: string[];
  fluctuations: string[];
}

export interface OperationalIssueFact {
  title: string;
  evidence: string;
  action: string;
}

export interface StandardReportFacts {
  title: string;
  subtitle: string;
  period: StandardReportPeriod;
  collection: {
    totalKg: number;
    registeredStoreCount: number;
    activeStoreCount: number;
    dailyAverageKg: number;
    topStore: { storeName: string; totalKg: number; sharePercent: number } | null;
  };
  weekly: WeeklyFact[];
  topStores: StoreFact[];
  top5SharePercent: number;
  allStores: StoreFact[];
  comparison: ComparisonFact;
  keyChanges: KeyChangesFact;
  codeIssues: OperationalIssueFact[];
  codeNextActions: string[];
  dataLimitations: {
    source: string;
    periodText: string;
    statusText: string;
    verifiedTiers: {
      measured: string[];
      calculated: string[];
      fieldVerified: string[];
      fieldObserved: string[];
      aiProposed: string[];
    };
    environmentalNotice: string;
  };
}

export function getCurrentPeriod(): ReportPeriod {
  const today = getCurrentDateString();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return { year, month, label: `${year}년 ${month}월` };
}

export function makePeriod(year: number, month: number): ReportPeriod {
  return { year, month, label: `${year}년 ${month}월` };
}

/** 리포트 및 대시보드에서 선택 가능한 기간 목록 */
export function periodOptions(records: MeasurementRecord[] = []): ReportPeriod[] {
  const now = getCurrentPeriod();
  const years = new Set<number>([now.year, 2026, 2025]);
  for (const r of records) {
    if (r.date && r.date.length >= 4) {
      const y = parseInt(r.date.slice(0, 4), 10);
      if (!isNaN(y)) years.add(y);
    }
  }

  const sortedYears = [...years].sort((a, b) => b - a);
  const list: ReportPeriod[] = [];

  for (const year of sortedYears) {
    // 현재 연도는 현재 월까지만(미래 월 제외), 과거 연도는 12월부터 전체 포함
    const maxMonth = year === now.year ? now.month : 12;
    // 2025년 수거 사업은 4월(시범 운영)부터 시작됨
    const minMonth = year === 2025 ? 4 : 1;
    for (let m = maxMonth; m >= minMonth; m--) {
      list.push(makePeriod(year, m));
    }
  }

  return list;
}

/** 그 달에 속한 기록인지 */
function inPeriod(dateStr: string, period: ReportPeriod): boolean {
  return dateStr.slice(0, 7) === `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * 달력 기준 주차 구간 및 일수 산출:
 * 1주차는 1일부터 첫 번째 토요일까지, 2~4(5)주차는 일요일부터 토요일(또는 말일)까지 분할합니다.
 */
export function getWeeklyCalendarRanges(
  year: number,
  month: number,
  weekCount?: number
): { weekNumber: number; label: string; dateRange: string; days: number }[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0: 일, 6: 토
  const firstSat = firstDayOfWeek === 0 ? 7 : 1 + ((6 - firstDayOfWeek + 7) % 7);

  // 4주차 종료일 계산 (1일~첫토요일 + 21일)
  const week4EndDay = firstSat + 21;
  const remainingDays = daysInMonth - week4EndDay;

  // 4주 vs 5주 판단:
  // 명시적으로 weekCount가 지정되지 않은 경우, 남은 일수가 2일 이하이면 4주차로 통합
  const finalWeekCount = weekCount ?? (remainingDays <= 2 ? 4 : 5);
  const ranges: { weekNumber: number; label: string; dateRange: string; days: number }[] = [];

  if (finalWeekCount === 4) {
    // 4주 형식: 1~7일, 8~14일, 15~21일, 22~말일
    ranges.push({ weekNumber: 1, label: '1주차', dateRange: `${month}/1 ~ ${month}/7`, days: 7 });
    ranges.push({ weekNumber: 2, label: '2주차', dateRange: `${month}/8 ~ ${month}/14`, days: 7 });
    ranges.push({ weekNumber: 3, label: '3주차', dateRange: `${month}/15 ~ ${month}/21`, days: 7 });
    ranges.push({
      weekNumber: 4,
      label: '4주차',
      dateRange: `${month}/22 ~ ${month}/${daysInMonth}`,
      days: daysInMonth - 21,
    });
    return ranges;
  }

  // 5주 형식: 달력 기준
  ranges.push({
    weekNumber: 1,
    label: '1주차',
    dateRange: `${month}/1 ~ ${month}/${firstSat}`,
    days: firstSat,
  });

  let currentStart = firstSat + 1;
  for (let w = 2; w <= 4; w++) {
    const end = Math.min(currentStart + 6, daysInMonth);
    ranges.push({
      weekNumber: w,
      label: `${w}주차`,
      dateRange: `${month}/${currentStart} ~ ${month}/${end}`,
      days: end - currentStart + 1,
    });
    currentStart = end + 1;
  }

  if (currentStart <= daysInMonth) {
    ranges.push({
      weekNumber: 5,
      label: '5주차',
      dateRange: `${month}/${currentStart} ~ ${month}/${daysInMonth}`,
      days: daysInMonth - currentStart + 1,
    });
  }

  return ranges;
}

export function buildStandardReportFacts({
  period,
  dashboard,
  collections,
}: {
  period: ReportPeriod;
  dashboard?: DashboardData | null;
  collections?: CollectionData | null;
  records?: MeasurementRecord[];
}): StandardReportFacts {
  const year = period.year;
  const month = period.month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const isPartialMonth = dashboard?.collection.isPartialMonth ?? false;

  const totalKg = Math.round(dashboard?.collection.totalKg ?? 0);
  const weeklyKg = (dashboard?.collection.weeklyKg ?? []).map(v => Math.max(0, Math.round(v)));

  // 4주 vs 5주:
  // weeklyKg가 4개이거나, 5주차가 0이고 과거 4주로 마감된 달(2025년 6, 8, 9, 11, 12월 등)
  const is4WeekData =
    weeklyKg.length === 4 ||
    (weeklyKg.length === 5 && weeklyKg[4] === 0 && !isPartialMonth && [6, 8, 9, 11, 12].includes(month) && year === 2025);
  const calendarRanges = getWeeklyCalendarRanges(year, month, is4WeekData ? 4 : 5);

  // 경과 일수 계산 (진행 중인 월이면 수거 발생 주차 일수 합 또는 오늘 날짜까지)
  let elapsedDays = daysInMonth;
  if (isPartialMonth) {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      elapsedDays = Math.min(today.getDate(), daysInMonth);
    } else {
      const nonZeroWeeks = weeklyKg.filter(k => k > 0).length;
      const activeRanges = calendarRanges.slice(0, nonZeroWeeks);
      elapsedDays = activeRanges.reduce((sum, r) => sum + r.days, 0) || daysInMonth;
    }
  }
  const dailyAverageKg = elapsedDays > 0 ? round(totalKg / elapsedDays, 1) : 0;

  // 참여 매장 집계 (등록 매장 vs 실수거 매장 분리)
  const rawStores = collections?.stores ?? dashboard?.topStores ?? [];
  const allStores: StoreFact[] = rawStores
    .map(store => {
      const storeKg = Math.round(store.totalKg);
      return {
        rank: 0,
        storeName: store.storeName,
        totalKg: storeKg,
        sharePercent: totalKg > 0 ? round((storeKg / totalKg) * 100, 1) : 0,
        weeklyKg: store.weeklyKg || [],
        isZero: storeKg === 0,
      };
    })
    .sort((a, b) => b.totalKg - a.totalKg)
    .map((store, idx) => ({ ...store, rank: idx + 1 }));

  const registeredStoreCount = allStores.length || (dashboard ? dashboard.collection.activeStoreCount : 0);
  const activeStoreCount =
    allStores.length > 0 ? allStores.filter(s => s.totalKg > 0).length : (dashboard?.collection.activeStoreCount ?? 0);
  const topStores = allStores.slice(0, 5);
  const top5SharePercent = round(topStores.reduce((sum, s) => sum + s.sharePercent, 0), 1);
  const topStore = topStores[0]
    ? { storeName: topStores[0].storeName, totalKg: topStores[0].totalKg, sharePercent: topStores[0].sharePercent }
    : null;

  // 주차별 데이터
  const nonZeroCount = weeklyKg.filter(k => k > 0).length;
  const weekly: WeeklyFact[] = calendarRanges.map((range, idx) => {
    const kg = weeklyKg[idx] ?? 0;
    const wDailyAvg = range.days > 0 ? round(kg / range.days, 1) : 0;
    const share = totalKg > 0 ? round((kg / totalKg) * 100, 1) : 0;
    let status: WeeklyFact['status'] = 'completed';
    if (isPartialMonth && idx >= nonZeroCount) {
      status = 'in_progress';
    } else if (kg === 0) {
      status = 'no_collection';
    }
    return {
      weekNumber: range.weekNumber,
      weekLabel: range.label,
      dateRange: range.dateRange,
      days: range.days,
      totalKg: kg,
      dailyAverageKg: wDailyAvg,
      sharePercent: share,
      status,
    };
  });

  // 전월 대비
  const rawPrevKg = dashboard?.collection.previousMonthKg ?? null;
  const prevBroken = rawPrevKg !== null && isImplausiblePrevious(rawPrevKg, totalKg);
  const previousMonthKg = prevBroken ? null : rawPrevKg;
  const hasPreviousMonth = previousMonthKg !== null && previousMonthKg > 0;
  const differenceKg = hasPreviousMonth ? totalKg - (previousMonthKg as number) : null;
  const changePercent =
    hasPreviousMonth && (previousMonthKg as number) > 0
      ? round(((totalKg - (previousMonthKg as number)) / (previousMonthKg as number)) * 100, 1)
      : null;

  const prevDaysInMonth = new Date(year, month - 1, 0).getDate();
  const previousDailyAverageKg = hasPreviousMonth ? round((previousMonthKg as number) / prevDaysInMonth, 1) : null;
  const dailyAverageDifference =
    previousDailyAverageKg !== null ? round(dailyAverageKg - previousDailyAverageKg, 1) : null;

  const comparison: ComparisonFact = {
    hasPreviousMonth,
    previousMonthKg,
    currentMonthKg: totalKg,
    differenceKg,
    changePercent,
    previousActiveStores: null,
    currentActiveStores: activeStoreCount,
    activeStoreDifference: null,
    previousDailyAverageKg,
    currentDailyAverageKg: dailyAverageKg,
    dailyAverageDifference,
    isPartialMonth,
    weeklyComparison: dashboard?.collection.weeklyComparison ?? null,
    samePeriodComparison: dashboard?.collection.samePeriodComparison ?? null,
  };

  // 주요 변화 (Key Changes)
  const activeWeeks = weekly.filter(w => w.totalKg > 0);
  const highestWeek =
    activeWeeks.length > 0 ? [...activeWeeks].sort((a, b) => b.totalKg - a.totalKg)[0] : null;
  const lowestWeek =
    activeWeeks.length > 0 ? [...activeWeeks].sort((a, b) => a.totalKg - b.totalKg)[0] : null;
  const zeroStores = allStores.filter(s => s.totalKg === 0).map(s => s.storeName);
  const newStores = allStores.filter(s => s.isNew).map(s => s.storeName);

  const fluctuations: string[] = [];
  for (let i = 1; i < weekly.length; i++) {
    const prevW = weekly[i - 1];
    const currW = weekly[i];
    if (prevW.totalKg > 0 && currW.totalKg > 0) {
      const pct = round(((currW.totalKg - prevW.totalKg) / prevW.totalKg) * 100, 1);
      if (Math.abs(pct) >= 25) {
        fluctuations.push(`${currW.weekLabel}: ${prevW.weekLabel} 대비 ${pct > 0 ? '+' : ''}${pct}%`);
      }
    }
  }

  const keyChanges: KeyChangesFact = {
    highestWeek: highestWeek
      ? {
          weekNumber: highestWeek.weekNumber,
          weekLabel: highestWeek.weekLabel,
          totalKg: highestWeek.totalKg,
          dailyAverageKg: highestWeek.dailyAverageKg,
        }
      : null,
    lowestWeek: lowestWeek
      ? {
          weekNumber: lowestWeek.weekNumber,
          weekLabel: lowestWeek.weekLabel,
          totalKg: lowestWeek.totalKg,
          dailyAverageKg: lowestWeek.dailyAverageKg,
        }
      : null,
    top5SharePercent,
    top1SharePercent: topStore?.sharePercent ?? 0,
    newStores,
    zeroStores,
    fluctuations,
  };

  // 운영 이슈 (최대 3개: 이슈 -> 근거 -> 권장 행동)
  const codeIssues: OperationalIssueFact[] = [];
  if (top5SharePercent >= 40) {
    codeIssues.push({
      title: '상위 매장 수거량 집중 및 특정 매장 의존도',
      evidence: `상위 5개 매장이 전체 수거량의 ${top5SharePercent}%를 점유 (최대 매장 ${topStore?.storeName ?? '1위 매장'} 점유율 ${topStore?.sharePercent ?? 0}%)`,
      action: '상위 핵심 매장의 수거 일정과 참여 지속성 정기 확인 및 중소형 매장 참여 유도',
    });
  }
  if (zeroStores.length > 0) {
    codeIssues.push({
      title: `당월 미배출(0kg) 매장 발생 (${zeroStores.length}개소)`,
      evidence: `${zeroStores.slice(0, 3).join(', ')}${zeroStores.length > 3 ? ` 외 ${zeroStores.length - 3}곳` : ''} 당월 수거 기록 없음`,
      action: '매장별 휴업, 내부 공사 또는 수거함 관리 상태 현장 확인 및 정상 수거 재개 지원',
    });
  }
  if (fluctuations.length > 0 || (lowestWeek && highestWeek && highestWeek.totalKg > lowestWeek.totalKg * 1.4)) {
    codeIssues.push({
      title: '주차별 수거량 변동성 관리',
      evidence:
        fluctuations.length > 0
          ? fluctuations.join(', ')
          : `${highestWeek?.weekLabel}(${highestWeek?.totalKg.toLocaleString()}kg) 대비 ${lowestWeek?.weekLabel}(${lowestWeek?.totalKg.toLocaleString()}kg) 주간 편차 발생`,
      action: '공휴일·기상 요인 등 주차별 특이사항을 고려한 사전 수거 스케줄링 최적화',
    });
  }
  if (codeIssues.length === 0) {
    codeIssues.push({
      title: '전반적 수거 체계의 안정적 유지',
      evidence: `전체 ${activeStoreCount}개 실수거 매장에서 균등한 수거 활동 지속`,
      action: '정기적인 수거 동선 점검 및 매장 관계자 피드백 수렴',
    });
  }

  // 다음 달 행동 (최대 3개)
  const codeNextActions: string[] = [
    zeroStores.length > 0
      ? `미배출 매장(${zeroStores.slice(0, 2).join(', ')}) 유선/현장 방문 점검 및 수거 참여 독려`
      : '수거 참여 매장의 분리배출 품질(이물질 혼입 여부) 정기 모니터링',
    '수거량 상위 5개 핵심 매장 수거함 용량 최적화 및 안정적 수거 동선 유지',
    '휴일·연휴 포함 주차의 사전 배차 조정 및 신규 참여 카페 발굴 추진',
  ];

  const startDate = `${year}.${String(month).padStart(2, '0')}.01`;
  const endDate = `${year}.${String(month).padStart(2, '0')}.${String(daysInMonth).padStart(2, '0')}`;

  return {
    title: `제주도 커피박 수거 사업 ${year}년 ${month}월 월간 현황 보고서`,
    subtitle: '사업 운영 현황 및 자원순환 실적 종합 분석',
    period: {
      year,
      month,
      label: `${year}년 ${month}월`,
      dateRange: `${startDate} ~ ${endDate}`,
      daysInMonth,
      elapsedDays,
      status: isPartialMonth ? 'in_progress' : 'completed',
      statusLabel: isPartialMonth ? '진행 중' : '완료',
    },
    collection: {
      totalKg,
      registeredStoreCount,
      activeStoreCount,
      dailyAverageKg,
      topStore,
    },
    weekly,
    topStores,
    top5SharePercent,
    allStores,
    comparison,
    keyChanges,
    codeIssues: codeIssues.slice(0, 3),
    codeNextActions: codeNextActions.slice(0, 3),
    dataLimitations: {
      source: '제주도 커피박 수거대장 (Google Sheets)',
      periodText: `${startDate} ~ ${endDate} (총 ${daysInMonth}일간)`,
      statusText: isPartialMonth ? '진행 중 (월 마감 이전 잠정 집계)' : '마감 완료',
      verifiedTiers: {
        measured: ['매장별 주차 수거량', '실제 수거 참여 매장 목록'],
        calculated: ['총 수거량', '일평균 수거량', '주차별 일평균 및 비중', '상위 5개소 점유율', '전월 대비 증감률'],
        fieldVerified: ['현장 계량 전수 검증 기준표(VERIFIED_MONTHLY_TOTALS)'],
        fieldObserved: ['주차별 영업일수 및 임시공휴일 영향 분석'],
        aiProposed: ['Executive Summary 요약문', '주차별 추이 해설', '운영 이슈 권장 행동', '향후 추진 과제'],
      },
      environmentalNotice:
        '※ 공인된 산출 기준 및 현장 실증 자료가 확보되지 않은 CO2 감축량, 탄소 절감 효과 등의 환경 가치 수치는 AI가 임의로 생성하지 않으며 공식 검증 후 별도 제공됩니다.',
    },
  };
}

interface BuildInput {
  records: MeasurementRecord[];
  settings: CompostSettings;
  period: ReportPeriod;
  /** 수거관리 GAS 자료 (못 읽었으면 넘기지 않는다) */
  dashboard?: DashboardData | null;
  collections?: CollectionData | null;
  /** 부숙관리 GAS 주소가 설정돼 있는지 */
  compostConnected?: boolean;
  /** 목장의 현재 운영 사이클을 찾아 주는 함수 (앱에서 넘긴다) */
  getCycle?: (ranchName: string) => OperatingCycle | null;
}

/** 온도는 '내려가는 중'을 '안정화'라고 부른다 — 부숙이 끝나가는 신호이기 때문이다 */
const TEMP_TREND_KEYS: Record<string, string> = {
  decreasing: 'stabilizing',
  increasing: 'rising',
  steady: 'steady',
  unknown: 'unknown',
};

/**
 * 전월 수거량이 이번 달과 자릿수부터 다를 때가 있다 (수거 시트 집계 오류).
 * 그대로 두면 "전월 대비 -99.9%" 같은 문장이 리포트에 실리므로 비교에서 뺀다.
 */
export function isImplausiblePrevious(previousKg: number, totalKg: number): boolean {
  if (previousKg <= 0) return false;
  if (previousKg > 100_000) return true; // 한 달 100톤 초과
  return totalKg > 0 && previousKg > totalKg * 20;
}

export function buildImpactFacts({
  records,
  settings,
  period,
  dashboard,
  collections,
  compostConnected = true,
  getCycle,
}: BuildInput): ImpactFacts {
  const sources: string[] = [];
  const dataWarnings: string[] = [];

  // ── 수거량 (별도 수거 API) ──
  let collection: ImpactFacts['collection'] = null;
  if (dashboard) {
    const topStores = (collections?.stores ?? dashboard.topStores ?? [])
      .slice()
      .sort((a, b) => b.totalKg - a.totalKg)
      .slice(0, 5)
      .map(store => ({ storeName: store.storeName, totalKg: Math.round(store.totalKg) }));

    const totalKg = Math.round(dashboard.collection.totalKg);
    const rawPrevious =
      dashboard.collection.previousMonthKg === null ? null : Math.round(dashboard.collection.previousMonthKg);
    const previousBroken = rawPrevious !== null && isImplausiblePrevious(rawPrevious, totalKg);

    if (previousBroken && rawPrevious !== null) {
      dataWarnings.push(
        `전월 수거량이 ${rawPrevious.toLocaleString('ko-KR')}kg 으로 이번 달(${totalKg.toLocaleString('ko-KR')}kg)과 크게 달라 비교에서 뺐습니다. 수거 시트의 지난달 값을 확인해주세요.`
      );
    }

    collection = {
      source: 'collection-gas',
      totalKg,
      previousMonthKg: previousBroken ? null : rawPrevious,
      changePercent:
        previousBroken || dashboard.collection.changePercent === null
          ? null
          : round(dashboard.collection.changePercent),
      activeStoreCount: dashboard.collection.activeStoreCount,
      weeklyKg: dashboard.collection.weeklyKg.map(kg => Math.round(kg)),
      isPartialMonth: dashboard.collection.isPartialMonth,
      topStores,
      weeklyComparison: dashboard.collection.weeklyComparison ?? null,
      samePeriodComparison: dashboard.collection.samePeriodComparison ?? null,
    };
    sources.push('매장 수거량: 수거관리 시트 (매장별 주차 기록)');
  }

  // ── 부숙 현황 (앱의 구글 시트) ──
  // 선택된 기간까지의 기록만 반영하여 이전 월 조회 시 미래 기록이 섞이지 않게 한다
  const periodEnd = `${period.year}-${String(period.month).padStart(2, '0')}-31`;
  const periodRecords = records.filter(r => r.date <= periodEnd);
  const monthRecords = records.filter(r => inPeriod(r.date, period));
  const summaries = summarizePiles(periodRecords, settings);

  // 측정한 장소만 함수율·온도를 싣는다 (현장 점검만 있는 장소는 값이 없다)
  const piles: PileFact[] = summaries.filter(summary => summary.measured).map(summary => ({
    ranchName: summary.pile.ranchName,
    location: summary.pile.location,
    latestDate: summary.latest.date,
    moisture: summary.latest.moisture,
    coreTemp: summary.latest.coreTemp,
    verdict: summary.verdict.title,
    recordCount: summary.records.length,
    totalCollectedKg: Math.round(summary.totalCollectedKg),
  }));

  const monthCollectedKg = Math.round(monthRecords.reduce((sum, r) => sum + (r.collectedKg || 0), 0));

  const compost: ImpactFacts['compost'] = {
    source: 'compost-gas',
    monthRecordCount: monthRecords.length,
    monthCollectedKg,
    pileCount: summaries.length,
    ranchNames: [...new Set(summaries.map(s => s.pile.ranchName))],
    piles,
    usableLocations: summaries
      .filter(s => s.verdict.type === 'usable')
      .map(s => `${s.pile.ranchName} ${s.pile.location}`),
    actionNeededLocations: summaries
      .filter(s => s.verdict.type === 'action_needed')
      .map(s => `${s.pile.ranchName} ${s.pile.location}`),
    usableMoistureMin: settings.usableMoistureMin,
    usableMoistureMax: settings.usableMoistureMax,
  };
  if (periodRecords.length > 0) sources.push('부숙 현황: 부숙관리 시트 — 커피박 부숙 관리 대장 (목장별 주간 기록)');

  // ── 현장 운영 현황 (지금 모여 있는 더미) ──
  // 한 구역에 커피박을 계속 모아 섞으므로, 앞뒤 기록을 같은 커피박의 변화로 읽으면 안 된다.
  const latestRecord = [...periodRecords].sort((a, b) => a.date.localeCompare(b.date)).pop();
  let field: FieldFact | null = null;
  if (latestRecord) {
    const ranchName = normalizeName(latestRecord.ranchName);
    const cycle = summarizeCycle({
      records: periodRecords,
      ranchName,
      settings,
      cycle: getCycle ? getCycle(ranchName) : null,
    });
    field = {
      source: 'compost-gas',
      ranchName,
      cycleId: cycle.cycle?.id ?? null,
      cycleDays: cycle.cycleDays,
      visitCount: cycle.visitCount,
      daysSinceLastVisit: cycle.daysSinceLastVisit,
      currentPileKg: cycle.currentPileKg,
      addedKg: cycle.addedKg,
      beddingUsedKg: cycle.beddingUsedKg,
      targetPileKg: cycle.targetPileKg,
      progressPercent: cycle.progressPercent,
      currentMoisture: cycle.moisture,
      moistureTrend: cycle.moistureTrend,
      currentCoreTemp: cycle.coreTemp,
      temperatureTrend: TEMP_TREND_KEYS[cycle.tempTrend] ?? cycle.tempTrend,
      mixingCountLast7Days: cycle.mixingCountLast7Days,
      daysSinceLastMixing: cycle.daysSinceLastMixing,
      moldStatus: cycle.moldStatus ?? 'unknown',
      beddingStatus: cycle.stage,
      beddingStatusLabel: cycle.stageTitle,
      beddingStatusReason: cycle.stageReason,
      dataGaps: cycle.dataGaps,
      note: '한 구역에 커피박을 계속 모으고 기존 커피박과 섞습니다. 측정값은 그 시점의 전체 혼합 더미 상태이며, 특정 주차 커피박의 부숙 경과가 아닙니다.',
    };
    sources.push('현장 운영 현황: 부숙관리 시트의 방문 기록으로 앱이 계산 (더미량 = 누적 투입 - 누적 깔개 사용)');
  }

  // ── 톱밥 대체 절감 추정 ──
  // 같은 무게의 톱밥을 대신한다고 보고, 목장마다 (톤 × 그 목장의 톱밥 단가)로 셈해 더한다.
  // 매장 수거량(수거관리)은 목장별로 나뉘어 있지 않으므로, 받는 목장이 하나로 정해질 때만 그 목장 단가를 곱한다.
  const defaultPrice = settings.sawdustPricePerTon;
  const priceOf = (ranchName: string) => {
    const own = settings.sawdustPriceByRanch?.[ranchName];
    return own && own > 0
      ? { pricePerTon: own, priceSource: 'ranch' as const }
      : { pricePerTon: defaultPrice, priceSource: 'default' as const };
  };
  const saving = (ranchName: string, kg: number): RanchSaving => {
    const price = priceOf(ranchName);
    return {
      ranchName,
      tons: round(kg / 1000, 3),
      ...price,
      costKrw: Math.round((kg / 1000) * price.pricePerTon),
    };
  };

  // 이번 달 목장별 하역량
  const monthKgByRanch = new Map<string, number>();
  for (const r of monthRecords) {
    const ranch = normalizeName(r.ranchName);
    monthKgByRanch.set(ranch, (monthKgByRanch.get(ranch) ?? 0) + (r.collectedKg || 0));
  }
  const monthRanches = [...monthKgByRanch.keys()].filter(ranch => (monthKgByRanch.get(ranch) ?? 0) > 0);

  // 매장 수거량을 받는 목장 — 수거관리의 운영 목장, 없으면 이번 달 하역 목장이 한 곳일 때 그 목장
  const operatingFarm = normalizeName(dashboard?.operatingFarm?.name ?? '');
  const receivingRanch =
    operatingFarm ||
    (monthRanches.length === 1 ? monthRanches[0] : (records.length > 0 ? normalizeName(records[0].ranchName) : DEFAULT_RANCH_NAME));

  let basisKg = 0;
  let basisLabel = '';
  let basisSource: 'collection-gas' | 'compost-gas' = 'compost-gas';
  let byRanch: RanchSaving[] = [];
  if (collection && collection.totalKg > 0 && receivingRanch) {
    basisKg = collection.totalKg;
    basisLabel = `이번 달 매장 수거량 (수거관리 시트, ${receivingRanch} 투입)`;
    basisSource = 'collection-gas';
    byRanch = [saving(receivingRanch, basisKg)];
  } else {
    basisKg = monthCollectedKg;
    basisLabel = '이번 달 목장별 현장 하역량 (부숙관리 시트)';
    byRanch = monthRanches.map(ranch => saving(ranch, monthKgByRanch.get(ranch) ?? 0));
    if (collection && collection.totalKg > 0) {
      dataWarnings.push(
        '매장 수거량을 받은 목장을 하나로 정할 수 없어, 절감액을 목장별 현장 하역 기록과 목장별 톱밥 단가로 셈했습니다.'
      );
    } else if (monthCollectedKg > 0) {
      dataWarnings.push(
        '매장 수거량을 불러오지 못해 절감액을 현장 하역 기록으로 셈했습니다. 매장 수거량과 현장 하역량은 서로 다른 숫자입니다.'
      );
    }
  }

  const usesDefault = byRanch.some(item => item.priceSource === 'default');
  const priceIsDefault = usesDefault && defaultPrice === DEFAULT_SAWDUST_PRICE_PER_TON;
  const savings =
    basisKg > 0 && byRanch.length > 0
      ? {
          basisKg,
          basisLabel,
          basisSource,
          basisTons: round(basisKg / 1000, 3),
          sawdustCostKrw: byRanch.reduce((sum, item) => sum + item.costKrw, 0),
          byRanch,
          defaultPricePerTon: defaultPrice,
          priceIsDefault,
        }
      : null;
  if (savings) {
    const parts = byRanch.map(
      item =>
        `${item.ranchName} ${item.tons.toLocaleString('ko-KR')}톤 × ${item.pricePerTon.toLocaleString('ko-KR')}원/톤(${
          item.priceSource === 'ranch' ? '목장 단가' : '기본 단가'
        })`
    );
    sources.push(`절감액 추정: ${basisLabel} — ${parts.join(' + ')}`);
    if (priceIsDefault) {
      const names = byRanch.filter(item => item.priceSource === 'default').map(item => item.ranchName);
      dataWarnings.push(
        `${names.join(', ')}의 톱밥 단가가 임시 가정값(${DEFAULT_SAWDUST_PRICE_PER_TON.toLocaleString('ko-KR')}원/톤)입니다. 설정 > 판정 기준에서 목장별 실제 구매 단가를 넣어주세요.`
      );
    }
  }

  const standardReport = buildStandardReportFacts({
    period,
    dashboard,
    collections,
    records: periodRecords,
  });

  return {
    period,
    generatedAt: new Date().toISOString(),
    endpoints: {
      compostConnected,
      collectionConnected: collection !== null,
    },
    collection,
    compost,
    field,
    savings,
    sources,
    dataWarnings,
    standardReport,
  };
}

/** 리포트를 만들 만큼 자료가 있는지 — 없으면 AI 를 부르지 않는다 */
export function hasEnoughData(facts: ImpactFacts): boolean {
  return Boolean(facts.collection) || facts.compost.piles.length > 0;
}

/** 리포트를 읽는 사람 — aiReport 의 ReportAudience 와 같은 값 */
type Audience = 'farm' | 'official';

/** 목장용 리포트에 넘기는 장소 수 상한 */
const FARM_PILE_LIMIT = 8;

/**
 * 독자에 맞게 AI 에 넘길 자료를 추린다.
 * - 목장 내부용: 더미 상태·깔개 판단·혼합·곰팡이 등 현장 운영 자료 중심 (사업 성과는 합계만)
 * - 대외 보고용: 수거 실적·절감 추정·자원화 현황 중심 (혼합 횟수·곰팡이 같은 현장 세부는 뺀다)
 * 화면에는 전체 facts 를 그대로 쓰고, 이 함수는 AI 요청에만 쓴다.
 */
export function factsForAudience(facts: ImpactFacts, audience: Audience) {
  const { period, collection, compost, field, savings, dataWarnings } = facts;

  if (audience === 'farm') {
    return {
      audience,
      period,
      field,
      compost: {
        monthRecordCount: compost.monthRecordCount,
        monthCollectedKg: compost.monthCollectedKg,
        pileCount: compost.pileCount,
        ranchNames: compost.ranchNames,
        piles: compost.piles.slice(0, FARM_PILE_LIMIT),
        usableLocations: compost.usableLocations,
        actionNeededLocations: compost.actionNeededLocations,
        usableMoistureMin: compost.usableMoistureMin,
        usableMoistureMax: compost.usableMoistureMax,
      },
      collection: collection
        ? { totalKg: collection.totalKg, changePercent: collection.changePercent, isPartialMonth: collection.isPartialMonth }
        : null,
      dataWarnings,
    };
  }

  return {
    audience,
    period,
    collection,
    savings,
    compost: {
      monthRecordCount: compost.monthRecordCount,
      monthCollectedKg: compost.monthCollectedKg,
      pileCount: compost.pileCount,
      ranchNames: compost.ranchNames,
      usableLocationCount: compost.usableLocations.length,
    },
    field: field
      ? {
          ranchName: field.ranchName,
          cycleDays: field.cycleDays,
          visitCount: field.visitCount,
          currentPileKg: field.currentPileKg,
          addedKg: field.addedKg,
          beddingUsedKg: field.beddingUsedKg,
          targetPileKg: field.targetPileKg,
          progressPercent: field.progressPercent,
          beddingStatusLabel: field.beddingStatusLabel,
        }
      : null,
    sources: facts.sources,
    dataWarnings,
  };
}
