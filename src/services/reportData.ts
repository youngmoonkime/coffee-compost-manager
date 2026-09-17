import type { CompostSettings, MeasurementRecord, OperatingCycle } from '../types';
import { DEFAULT_RANCH_NAME } from '../constants/defaultData';
import { computeSawdustSaving } from '../utils/sawdustSaving';
import { getCurrentDateString, normalizeName, summarizePiles } from '../utils/calculations';
import { summarizeCycle, getAddedKg, getBeddingUsedKg } from '../utils/fieldOps';
import { decideBedding } from '../utils/assistantInsights';
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
  /** 실제로 줄어드는 톱밥(톤) = min(월 소요량 × 50%, 들어온 커피박) */
  tons: number;
  pricePerTon: number;
  /** ranch = 목장별로 입력한 단가, default = 기본 단가 */
  priceSource: 'ranch' | 'default';
  costKrw: number;
  /** 목장의 월 톱밥 소요량(톤) */
  monthlyTons?: number;
  /** 들어온 커피박(톤) */
  coffeeTons?: number;
  limitedBy?: 'demand' | 'coffee';
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
    /** 목장별 절감액 합계 */
    sawdustCostKrw: number;
    /** 목장별 계산 — 목장마다 톱밥 구매 단가가 다르다 */
    byRanch: RanchSaving[];
    /** 목장 단가가 없는 목장에 쓴 기본 단가 */
    defaultPricePerTon: number;
    /** 목장 단가 대신 기본 단가를 쓴 목장이 있는지 */
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

  // ── 톱밥 구매비 절감 추정 ──
  // 커피박을 섞어 쓰면 목장의 톱밥 구매가 50% 줄어든다고 본다: min(월 소요량 × 50%, 들어온 커피박) × 톱밥 단가.
  // 매장 수거량(수거관리)은 목장별로 나뉘어 있지 않으므로, 받는 목장이 하나로 정해질 때만 그 목장에 붙인다.
  const defaultPrice = settings.sawdustPricePerTon;
  const missingDemand: string[] = [];
  const saving = (ranchName: string, kg: number): RanchSaving | null => {
    const result = computeSawdustSaving(settings, ranchName, kg);
    if (result.savingKrw === null || result.savedTons === null || result.monthlyTons === null) {
      missingDemand.push(result.ranchName);
      return null;
    }
    return {
      ranchName: result.ranchName,
      tons: round(result.savedTons, 3),
      pricePerTon: result.pricePerTon,
      priceSource: result.priceSource,
      costKrw: result.savingKrw,
      monthlyTons: result.monthlyTons,
      coffeeTons: round(result.coffeeTons, 3),
      limitedBy: result.limitedBy ?? undefined,
    };
  };
  const isSaving = (item: RanchSaving | null): item is RanchSaving => item !== null;

  // 이번 달 목장별 하역량
  const monthKgByRanch = new Map<string, number>();
  for (const r of monthRecords) {
    const ranch = normalizeName(r.ranchName);
    monthKgByRanch.set(ranch, (monthKgByRanch.get(ranch) ?? 0) + (r.collectedKg || 0));
  }
  const monthRanches = [...monthKgByRanch.keys()].filter(ranch => (monthKgByRanch.get(ranch) ?? 0) > 0);

  // 매장 수거량을 받는 목장 — 수거관리의 운영 목장, 없으면 받는 목장이 한 곳으로 분명할 때만 그 목장.
  // 여러 목장 중 하나를 임의로 고르면 매장 수거량이 그 목장의 투입량처럼 보이므로 고르지 않는다.
  const operatingFarm = normalizeName(dashboard?.operatingFarm?.name ?? '');
  const recordRanches = [...new Set(periodRecords.map(r => normalizeName(r.ranchName)))];
  const receivingRanch =
    operatingFarm ||
    (monthRanches.length === 1
      ? monthRanches[0]
      : monthRanches.length === 0 && recordRanches.length === 1
        ? recordRanches[0]
        : '');

  let basisKg = 0;
  let basisLabel = '';
  let basisSource: 'collection-gas' | 'compost-gas' = 'compost-gas';
  let byRanch: RanchSaving[] = [];
  if (collection && collection.totalKg > 0 && receivingRanch) {
    basisKg = collection.totalKg;
    basisLabel = `이번 달 매장 수거량 (수거관리 시트, ${receivingRanch} 투입)`;
    basisSource = 'collection-gas';
    byRanch = [saving(receivingRanch, basisKg)].filter(isSaving);
  } else {
    basisKg = monthCollectedKg;
    basisLabel = '이번 달 목장별 현장 하역량 (부숙관리 시트)';
    byRanch = monthRanches.map(ranch => saving(ranch, monthKgByRanch.get(ranch) ?? 0)).filter(isSaving);
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

  if (missingDemand.length > 0) {
    dataWarnings.push(
      `${missingDemand.join(', ')}의 월 톱밥 소요량이 없어 톱밥 절감액을 셈하지 않았습니다. 설정 > 목장 설정에서 넣어주세요.`
    );
  }
  const priceIsDefault = byRanch.some(item => item.priceSource === 'default');
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
        `${item.ranchName} 줄어든 톱밥 ${item.tons.toLocaleString('ko-KR')}톤(월 소요량 ${item.monthlyTons}톤의 50%와 커피박 중 작은 값) × ${item.pricePerTon.toLocaleString('ko-KR')}원/톤(${
          item.priceSource === 'ranch' ? '목장 단가' : '기본 단가'
        })`
    );
    sources.push(`톱밥 절감액 추정: ${basisLabel} — ${parts.join(' + ')}`);
  }

  // 대외 보고서 숫자는 매장 수거 실적에서만 나온다 — 수거 자료가 없으면 만들지 않는다 (0kg 로 채우지 않음)
  const standardReport = dashboard
    ? buildStandardReportFacts({
        period,
        dashboard,
        collections,
        records: periodRecords,
      })
    : undefined;

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

/* ─────────────────── 목장 내부용 보고서 스키마 (FarmReportData) ─────────────────── */

export type FarmOperationType = 'single_pile_continuous' | 'tonbag_batch' | 'zone_separated' | 'custom';

export type FarmBeddingStatus =
  | 'accumulating'
  | 'managing'
  | 'preparing'
  | 'candidate'
  | 'hold'
  | 'insufficient';

export type FarmTrend = 'rising' | 'falling' | 'stabilizing' | 'mixed' | 'insufficient';

export type FarmMoldStatus = 'none' | 'partial' | 'spreading' | 'unknown';

export interface FarmReportAction {
  id: string;
  title: string;
  reason: string;
  priority: 'high' | 'normal';
  actionId?: string;
}

export interface FarmReportData {
  farm: {
    id: string;
    name: string;
    operationType: FarmOperationType;
    operationTypeLabel: string;
  };

  period: {
    start: string;
    end: string;
    label: string;
    filterMode: 'current' | '7days' | '30days' | '90days' | 'all';
  };

  pile: {
    currentKg: number;
    targetKg: number | null;
    progressPct: number | null;
    latestInputKg: number | null;
    latestInputDate: string | null;
    usedKg: number;
    addedKg: number;
    accumulationBasis: string;
  };

  condition: {
    temperature: number | null;
    temperatureTrend: FarmTrend;
    temperatureTrendLabel: string;
    temperaturePoints: number[];

    moisture: number | null;
    moistureTrend: FarmTrend;
    moistureTrendLabel: string;
    moisturePoints: number[];

    moldStatus: FarmMoldStatus;
    moldStatusLabel: string;

    /** 신규 투입 후 함수율/온도 영향 설명 문구 (있을 경우) */
    recentImpactNote: string | null;
  };

  management: {
    visitCountLast7Days: number;
    daysSinceLastVisit: number | null;
    visitDue: boolean;

    mixingCountLast7Days: number;
    daysSinceLastMixing: number | null;
    mixingLevel: 'unknown' | 'none' | 'low' | 'ok';
    mixingLevelLabel: string;
    mixingNotice: string | null;
    recommendedWeeklyMixing: string;
  };

  bedding: {
    status: FarmBeddingStatus;
    statusLabel: string;
    reasons: string[];
    notice: string;
  };

  actions: FarmReportAction[];

  nextVisitChecklist: {
    text: string;
    priority: 'high' | 'normal';
  }[];

  recentRecords: MeasurementRecord[];

  dataQuality: {
    missingFields: string[];
    warnings: string[];
  };

  generatedAt: string;
}

/**
 * 목장 내부용 보고서 전용 데이터 빌더
 * - 100% 순수 TypeScript 코드로 계산 (AI 미호출)
 * - 부숙관리 실측 데이터만 사용 (카페 수거량 합산 금지)
 * - 건준목장 단일 더미 연속 혼합 방식 및 신규 투입 이벤트 정밀 반영
 */
export function buildFarmReportData({
  records,
  ranchName = DEFAULT_RANCH_NAME,
  settings,
  filterMode = 'current',
  today = getCurrentDateString(),
  cycle = null,
}: {
  records: MeasurementRecord[];
  ranchName?: string;
  settings: CompostSettings;
  filterMode?: 'current' | '7days' | '30days' | '90days' | 'all';
  today?: string;
  /** 빠른 실행(깔개 사용·이상 신호 점검)과 같은 운영 사이클로 판정하기 위해 받는다 */
  cycle?: OperatingCycle | null;
}): FarmReportData {
  const normName = normalizeName(ranchName);

  // 1. 해당 목장의 기록 필터링 & 날짜 정렬
  const ranchRecords = records
    .filter(r => normalizeName(r.ranchName) === normName)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 날짜 범위 필터링 계산
  let filteredRecords = ranchRecords;
  let periodStart = ranchRecords[0]?.date ?? today;
  const periodEnd = today;
  let periodLabel = '현재 상태';

  if (filterMode === '7days') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    periodStart = d.toISOString().slice(0, 10);
    periodLabel = '최근 7일';
    filteredRecords = ranchRecords.filter(r => r.date >= periodStart);
  } else if (filterMode === '30days') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    periodStart = d.toISOString().slice(0, 10);
    periodLabel = '최근 30일';
    filteredRecords = ranchRecords.filter(r => r.date >= periodStart);
  } else if (filterMode === '90days') {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    periodStart = d.toISOString().slice(0, 10);
    periodLabel = '최근 3개월';
    filteredRecords = ranchRecords.filter(r => r.date >= periodStart);
  } else if (filterMode === 'all') {
    periodLabel = '전체 기간';
  }

  // 2. 더미량 계산: 누적 투입량 - 누적 깔개 사용량
  const addedKg = Math.round(ranchRecords.reduce((sum, r) => sum + getAddedKg(r), 0));
  const usedKg = Math.round(ranchRecords.reduce((sum, r) => sum + getBeddingUsedKg(r), 0));
  const currentKg = Math.max(0, addedKg - usedKg);

  // 가장 최근 투입 기록
  const lastInputRecord = [...ranchRecords].reverse().find(r => getAddedKg(r) > 0);
  const latestInputKg = lastInputRecord ? getAddedKg(lastInputRecord) : null;
  const latestInputDate = lastInputRecord ? lastInputRecord.date : null;

  // 목표량 설정 여부 확인
  const rawTarget = settings.beddingTargetKg?.[normName];
  const targetKg = Number.isFinite(rawTarget) && Number(rawTarget) > 0 ? Number(rawTarget) : null;
  const progressPct = targetKg ? Math.round((currentKg / targetKg) * 100) : null;

  // 3. 측정 기록 및 추세 계산
  const measuredRecords = ranchRecords.filter(r => r.moisture > 0 || r.coreTemp > 0);
  const recentMeasured = measuredRecords.slice(-5);
  const latestMeasured = measuredRecords[measuredRecords.length - 1] ?? null;

  const currentTemp = latestMeasured && latestMeasured.coreTemp > 0 ? latestMeasured.coreTemp : null;
  const currentMoisture = latestMeasured && latestMeasured.moisture > 0 ? latestMeasured.moisture : null;

  const tempPoints = recentMeasured.map(r => r.coreTemp).filter(v => v > 0);
  const moisturePoints = recentMeasured.map(r => r.moisture).filter(v => v > 0);

  // 온도 추세
  let temperatureTrend: FarmTrend = 'insufficient';
  let temperatureTrendLabel = '자료 부족';
  if (tempPoints.length >= 2) {
    const latest = tempPoints[tempPoints.length - 1];
    const prev = tempPoints.slice(0, -1);
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    const delta = latest - avg;
    if (delta <= -3.0) {
      temperatureTrend = 'stabilizing';
      temperatureTrendLabel = '안정화 방향';
    } else if (delta >= 3.0) {
      temperatureTrend = 'rising';
      temperatureTrendLabel = '상승 중';
    } else {
      temperatureTrend = 'stabilizing';
      temperatureTrendLabel = '안정화 유지';
    }
  }

  // 함수율 추세
  let moistureTrend: FarmTrend = 'insufficient';
  let moistureTrendLabel = '자료 부족';
  if (moisturePoints.length >= 2) {
    const latest = moisturePoints[moisturePoints.length - 1];
    const prev = moisturePoints.slice(0, -1);
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    const delta = latest - avg;
    if (delta <= -2.5) {
      moistureTrend = 'falling';
      moistureTrendLabel = '감소 중';
    } else if (delta >= 2.5) {
      moistureTrend = 'rising';
      moistureTrendLabel = '상승 중';
    } else {
      moistureTrend = 'stabilizing';
      moistureTrendLabel = '유지';
    }
  }

  // 4. 신규 투입 이벤트 영향 분석
  let recentImpactNote: string | null = null;
  if (recentMeasured.length >= 2 && lastInputRecord) {
    const prevMeasured = recentMeasured[recentMeasured.length - 2];
    if (
      latestMeasured &&
      prevMeasured &&
      lastInputRecord.date >= prevMeasured.date &&
      lastInputRecord.date <= latestMeasured.date
    ) {
      if (latestMeasured.moisture > prevMeasured.moisture || latestMeasured.coreTemp > prevMeasured.coreTemp) {
        recentImpactNote = `최근 신규 커피박 투입(${latestInputKg?.toLocaleString()}kg, ${latestInputDate}) 이후 함수율/온도가 일시적으로 상승했습니다. 전체 더미 혼합에 따른 자연스러운 현상입니다.`;
      }
    }
  }

  // 5. 혼합 및 방문 관리 (최근 7일 기준)
  const d7 = new Date();
  d7.setDate(d7.getDate() - 7);
  const d7Str = d7.toISOString().slice(0, 10);

  const visitsLast7 = ranchRecords.filter(r => r.date >= d7Str);
  const visitCountLast7Days = visitsLast7.length;

  const latestVisit = ranchRecords[ranchRecords.length - 1] ?? null;
  const daysSinceLastVisit = latestVisit
    ? Math.max(0, Math.round((new Date(today).getTime() - new Date(latestVisit.date).getTime()) / (1000 * 3600 * 24)))
    : null;
  const visitDue = daysSinceLastVisit !== null && daysSinceLastVisit >= 3;

  const mixedRecords = ranchRecords.filter(r => r.mixed === true);
  const mixingCountLast7Days = mixedRecords.filter(r => r.date >= d7Str).length;
  const lastMixedRecord = mixedRecords[mixedRecords.length - 1] ?? null;
  const daysSinceLastMixing = lastMixedRecord
    ? Math.max(0, Math.round((new Date(today).getTime() - new Date(lastMixedRecord.date).getTime()) / (1000 * 3600 * 24)))
    : null;

  const mixingRecords = ranchRecords.filter(r => r.mixed !== undefined);
  let mixingLevel: 'unknown' | 'none' | 'low' | 'ok' = 'unknown';
  let mixingLevelLabel = '기록 없음';
  if (mixingRecords.length > 0) {
    if (mixingCountLast7Days === 0) {
      mixingLevel = 'none';
      mixingLevelLabel = '관리 필요 (0회)';
    } else if (mixingCountLast7Days === 1) {
      mixingLevel = 'low';
      mixingLevelLabel = '확인 필요 (1회)';
    } else {
      mixingLevel = 'ok';
      mixingLevelLabel = `정상 (${mixingCountLast7Days}회)`;
    }
  }

  const mixingNotice =
    daysSinceLastMixing !== null && daysSinceLastMixing >= 4
      ? `최근 혼합 이후 ${daysSinceLastMixing}일이 지났습니다. 곰팡이 예방 및 통기를 위해 혼합이 필요합니다.`
      : null;

  // 6. 곰팡이 관리
  const latestWithMold = [...ranchRecords].reverse().find(r => r.moldStatus !== undefined);
  let moldStatus: FarmMoldStatus = 'unknown';
  let moldStatusLabel = '기록 없음';

  if (latestWithMold && latestWithMold.moldStatus) {
    if (latestWithMold.moldStatus === 'none') {
      moldStatus = 'none';
      moldStatusLabel = '발견 없음';
    } else if (latestWithMold.moldStatus === 'some') {
      moldStatus = 'partial';
      moldStatusLabel = '일부 발견';
    } else if (latestWithMold.moldStatus === 'spreading') {
      moldStatus = 'spreading';
      moldStatusLabel = '확산 중';
    }
  }

  // 7. 깔개 사용 판단 (AI 없이 100% 코드 연산)
  let beddingStatus: FarmBeddingStatus = 'managing';
  let beddingStatusLabel = '관리 중';
  const reasons: string[] = [];
  let beddingNotice = '';

  const minM = settings.usableMoistureMin ?? 20;
  const maxM = settings.usableMoistureMax ?? 30;

  // 곰팡이가 있으면 다른 조건과 무관하게 무조건 보류
  if (moldStatus === 'partial' || moldStatus === 'spreading') {
    beddingStatus = 'hold';
    beddingStatusLabel = '사용 보류';
    reasons.push(moldStatus === 'spreading' ? '⚠ 곰팡이 확산 중' : '⚠ 곰팡이 일부 발견');
    beddingNotice = '곰팡이가 확인되어 깔개 사용이 보류되었습니다. 즉시 전체 더미를 혼합하고 다음 방문에서 상태를 재확인하세요.';
  } else if (!latestVisit || measuredRecords.length === 0) {
    beddingStatus = 'insufficient';
    beddingStatusLabel = '데이터 부족';
    reasons.push('현장 측정 기록 부족');
    beddingNotice = '현장 점검 및 측정 기록이 없어 깔개 판단을 내릴 수 없습니다.';
  } else {
    // 곰팡이 없음 or 기록 없음
    if (moldStatus === 'none') {
      reasons.push('✓ 곰팡이 발견 없음');
    } else {
      reasons.push('△ 곰팡이 기록 없음');
    }

    // 함수율 조건
    if (currentMoisture !== null) {
      if (currentMoisture <= maxM && currentMoisture >= minM) {
        reasons.push(`✓ 함수율 ${currentMoisture}% (현장 관찰 범위 ${minM}~${maxM}% 충족)`);
      } else if (currentMoisture <= maxM + 5) {
        reasons.push(`✓ 함수율 ${currentMoisture}% (관찰 범위 접근 중)`);
      } else {
        reasons.push(`△ 함수율 ${currentMoisture}% (아직 건조 필요)`);
      }
    }

    if (moistureTrend === 'falling') {
      reasons.push('✓ 함수율 지속 감소 중');
    }

    // 온도 조건
    if (currentTemp !== null) {
      if (currentTemp <= 45) {
        reasons.push(`✓ 심부 온도 ${currentTemp}℃ (안정화 완료)`);
      } else if (currentTemp > 65) {
        reasons.push(`△ 심부 온도 ${currentTemp}℃ (발열 진행 중)`);
      } else {
        reasons.push(`✓ 심부 온도 ${currentTemp}℃ (발효 안정화 단계)`);
      }
    }

    // 혼합 조건
    if (mixingLevel === 'ok') {
      reasons.push(`✓ 최근 7일 혼합 ${mixingCountLast7Days}회 (정상 관리)`);
    } else if (mixingLevel === 'none') {
      reasons.push('△ 최근 7일간 혼합 기록 없음');
    }

    // 목표량 조건
    if (targetKg) {
      if (progressPct !== null && progressPct >= 100) {
        reasons.push(`✓ 목표량 ${targetKg.toLocaleString()}kg 도달 (${progressPct}%)`);
      } else {
        reasons.push(`△ 목표량 ${targetKg.toLocaleString()}kg 중 ${currentKg.toLocaleString()}kg (${progressPct}%)`);
      }
    } else {
      reasons.push('△ 깔개 목표량 미설정 (상태 지표 우선 판단)');
    }

    // 종합 판단
    const moistureOk = currentMoisture !== null && currentMoisture <= maxM + 3;
    const tempOk = currentTemp !== null && currentTemp <= 48;
    const targetOk = !targetKg || (progressPct !== null && progressPct >= 90);

    if (moistureOk && tempOk && targetOk && moldStatus === 'none' && mixingLevel === 'ok') {
      beddingStatus = 'candidate';
      beddingStatusLabel = '사용 후보';
      beddingNotice = '현재 더미는 함수율, 심부 온도, 혼합 관리가 모두 양호합니다. 신규 커피박을 추가하기 전 축사 깔개로 일부 사용을 검토할 수 있습니다.';
    } else if ((moistureTrend === 'falling' || moistureOk) && (temperatureTrend === 'stabilizing' || tempOk)) {
      beddingStatus = 'preparing';
      beddingStatusLabel = '사용 준비';
      beddingNotice = '함수율이 낮아지고 심부 온도가 안정화되는 방향입니다. 주기적인 혼합을 유지하며 관리해주세요.';
    } else if (targetKg && progressPct !== null && progressPct < 60) {
      beddingStatus = 'accumulating';
      beddingStatusLabel = '축적 중';
      beddingNotice = `현재 커피박을 모으는 중입니다. 목표량까지 약 ${Math.max(0, targetKg - currentKg).toLocaleString()}kg 남았습니다.`;
    } else {
      beddingStatus = 'managing';
      beddingStatusLabel = '관리 중';
      beddingNotice = '현재 더미의 부숙 및 건조 상태를 관리 중입니다. 다음 방문 시 온도와 함수율을 체크해주세요.';
    }
  }

  // 깔개 판정은 빠른 실행과 같은 코드(decideBedding)로 정한다 — 화면마다 판정이 달라지지 않도록.
  // 위의 reasons 는 판정 근거를 보여 주는 설명으로만 쓴다.
  const decision = decideBedding(summarizeCycle({ records, ranchName: normName, settings, cycle, today }));
  beddingStatus = decision.key;
  beddingStatusLabel = decision.label;
  // 판정 이유에 이미 할 일이 담겨 있다 — nextAction 까지 붙이면 같은 안내가 두 번 나온다
  beddingNotice = decision.reason;

  // 8. 지금 해야 할 일 TOP 3 (우선순위 기반 자동 생성)
  const actions: FarmReportAction[] = [];

  if (moldStatus === 'partial' || moldStatus === 'spreading') {
    actions.push({
      id: 'act-mold',
      title: '곰팡이 관리 및 전면 혼합',
      reason: '더미에서 곰팡이가 확인되었습니다. 호기성 발효를 위해 전체 더미를 뒤집어 혼합해주세요.',
      priority: 'high',
      actionId: 'mix',
    });
  }

  if (daysSinceLastMixing === null || daysSinceLastMixing >= 3 || mixingLevel === 'none') {
    if (actions.length < 3) {
      actions.push({
        id: 'act-mix',
        title: '전체 더미 혼합 작업',
        reason:
          daysSinceLastMixing !== null
            ? `최근 혼합 이후 ${daysSinceLastMixing}일이 지났습니다. 내부 열과 수분을 분산시켜주세요.`
            : '최근 7일간 혼합 기록이 없습니다. 균일한 부숙을 위해 혼합해주세요.',
        priority: 'high',
        actionId: 'mix',
      });
    }
  }

  if (daysSinceLastVisit === null || daysSinceLastVisit >= 3) {
    if (actions.length < 3) {
      actions.push({
        id: 'act-visit',
        title: '현장 점검 (심부온도·함수율 측정)',
        reason:
          daysSinceLastVisit !== null
            ? `최근 점검 이후 ${daysSinceLastVisit}일이 지났습니다. 상태 변화를 측정해주세요.`
            : '최근 현장 점검 기록이 없습니다. 현장 상태를 확인해주세요.',
        priority: 'high',
        actionId: 'measure',
      });
    }
  }

  if (moldStatus === 'unknown' && actions.length < 3) {
    actions.push({
      id: 'act-mold-check',
      title: '곰팡이 상태 육안 확인',
      reason: '깔개 사용 판단 전에 더미 표면과 내부에 백색/녹색 곰팡이가 피었는지 확인이 필요합니다.',
      priority: 'normal',
      actionId: 'inspect',
    });
  }

  if (beddingStatus === 'candidate' && actions.length < 3) {
    actions.push({
      id: 'act-bedding',
      title: '신규 투입 전 깔개 사용 검토',
      reason: '현재 더미의 부숙 상태가 양호합니다. 신규 커피박을 추가하기 전 깔개 사용을 검토하세요.',
      priority: 'normal',
      actionId: 'bedding',
    });
  }

  if (!targetKg && actions.length < 3) {
    actions.push({
      id: 'act-target',
      title: '깔개 목표량 설정 검토',
      reason: '축사에서 한 번에 교체할 깔개 목표량을 설정하면 적정 사용 시점을 더 명확히 알 수 있습니다.',
      priority: 'normal',
      actionId: 'settings',
    });
  }

  // 9. 다음 방문 체크리스트 자동 생성
  const nextVisitChecklist = [
    { text: '심부 온도 측정 (중앙 및 측면)', priority: 'high' as const },
    { text: '함수율 실측 (상·중·하단)', priority: 'high' as const },
    { text: '곰팡이 발생 여부 육안 확인', priority: 'high' as const },
    { text: '더미 혼합 여부 판단 및 작업', priority: (daysSinceLastMixing ?? 0) >= 2 ? ('high' as const) : ('normal' as const) },
    { text: '신규 커피박 투입 시 하역량(kg) 기록', priority: 'normal' as const },
    { text: '축사 깔개로 반출 시 사용량(kg) 기록', priority: 'normal' as const },
    { text: '더미 상태 사진 촬영 (표면/단면)', priority: 'normal' as const },
    { text: '이상 악취(부패취) 발생 여부 점검', priority: 'normal' as const },
  ];

  // 10. 결측치 및 데이터 품질
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (currentTemp === null) missingFields.push('심부 온도 측정값 없음');
  if (currentMoisture === null) missingFields.push('함수율 측정값 없음');
  if (moldStatus === 'unknown') missingFields.push('곰팡이 상태 미기록');
  if (mixingLevel === 'unknown') missingFields.push('혼합 작업 내역 미기록');
  if (!targetKg) warnings.push('목장 깔개 목표량이 설정되지 않았습니다 (설정 > 목표량).');

  return {
    farm: {
      id: normName,
      name: ranchName,
      operationType: 'single_pile_continuous',
      operationTypeLabel: '단일 더미 연속혼합형 (한 구역에 지속 추가 및 혼합)',
    },
    period: {
      start: periodStart,
      end: periodEnd,
      label: periodLabel,
      filterMode,
    },
    pile: {
      currentKg,
      targetKg,
      progressPct,
      latestInputKg,
      latestInputDate,
      usedKg,
      addedKg,
      accumulationBasis: '부숙관리 시트 현장 실측 기록 기준 (누적 투입량 - 누적 깔개 사용량)',
    },
    condition: {
      temperature: currentTemp,
      temperatureTrend,
      temperatureTrendLabel,
      temperaturePoints: tempPoints,
      moisture: currentMoisture,
      moistureTrend,
      moistureTrendLabel,
      moisturePoints,
      moldStatus,
      moldStatusLabel,
      recentImpactNote,
    },
    management: {
      visitCountLast7Days,
      daysSinceLastVisit,
      visitDue,
      mixingCountLast7Days,
      daysSinceLastMixing,
      mixingLevel,
      mixingLevelLabel,
      mixingNotice,
      recommendedWeeklyMixing: '주 2~3회 권장',
    },
    bedding: {
      status: beddingStatus,
      statusLabel: beddingStatusLabel,
      reasons,
      notice: beddingNotice,
    },
    actions: actions.slice(0, 3),
    nextVisitChecklist,
    recentRecords: filteredRecords.slice(-5).reverse(),
    dataQuality: {
      missingFields,
      warnings,
    },
    generatedAt: new Date().toISOString(),
  };
}
