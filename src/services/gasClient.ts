import { readEnvUrl } from '../utils/env';

export interface ApiEnvelope<T> {
  ok: boolean;
  apiVersion?: string;
  action?: string;
  generatedAt?: string;
  elapsedMs?: number;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface Period {
  year: number;
  month: number;
  label: string;
}

export interface SourceInfo {
  type?: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  sheetName?: string;
  role?: string;
  [key: string]: unknown;
}

export interface StoreCollection {
  no: number;
  storeName: string;
  weeklyKg: number[];
  totalKg: number;
  joinedAt?: string | null;
  leftAt?: string | null;
  note?: string | null;
}

export interface CollectionData {
  period: Period;
  totalKg: number;
  weeklyKg: number[];
  stores: StoreCollection[];
  isPartialMonth: boolean;
  source?: SourceInfo;
}

export interface FarmMeta {
  id: string;
  name: string;
  role?: string;
  status?: string;
  activeFrom?: string;
  activeUntil?: string | null;
}

export interface WeeklyComparison {
  currentWeek: number;
  currentKg: number;
  prevWeek: number;
  prevKg: number;
  changeKg: number;
  changePercent: number | null;
}

export interface SamePeriodComparison {
  weeksCount: number;
  currentWeeksKg: number;
  prevMonthWeeksKg: number | null;
  changeKg: number | null;
  changePercent: number | null;
  achievementPercent: number | null;
}

export interface DashboardData {
  period: Period;
  collection: {
    totalKg: number;
    activeStoreCount: number;
    previousMonthKg: number | null;
    changePercent: number | null;
    weeklyKg: number[];
    isPartialMonth: boolean;
    weeklyComparison: WeeklyComparison | null;
    samePeriodComparison: SamePeriodComparison | null;
  };
  topStores: StoreCollection[];
  operatingFarm: FarmMeta | null;
  source?: SourceInfo;
}

/**
 * 수거관리 GAS 주소 (대시보드·매장별·주차별 수거량 전용).
 * 부숙관리 주소와 별개다 — 한쪽이 없어도 다른 쪽 기능은 그대로 돌아간다.
 * VITE_GAS_API_URL 은 두 주소를 나누기 전에 쓰던 이름이라 뒤에 남겨 둔다.
 */
export const COLLECTION_GAS_FALLBACK =
  'https://script.google.com/macros/s/AKfycbxOvcMux87wnUQPt4FJwKyy7UNi9ipyBxJNhEeMCRxcVEwayuBTEsPVLd1gjn2N5lz5/exec';

/** 구글 스프레드시트 원본 연도 및 월별 GID 매핑 */
export const COLLECTION_SHEET_MAPPINGS: Record<number, { docId: string; gids: Record<number, string> }> = {
  2026: {
    docId: '1wWc0AX9TpbLrDZOO63qBHOe5_kcWHc7k5HRAo85_oZA',
    gids: {
      1: '1100823930',
      2: '316232799',
      3: '1390502414',
      4: '1160283867',
      5: '1760379404',
      6: '425564362',
      7: '425993890',
      8: '676651813',
      9: '357849416',
    },
  },
  2025: {
    docId: '1PVx0dxVDfcXz-FDDXk3XaZooK_hyknBcGE1CaT8WppU',
    gids: {
      4: '535511250',
      5: '2090042876',
      6: '518532739',
      7: '826636103',
      8: '1009674424',
      9: '1617813873',
      10: '136109058',
      11: '1944224825',
      12: '1100823930',
    },
  },
};

/** 특정 연도/월의 구글 스프레드시트 원본 URL 반환 */
export function getCollectionSheetUrl(year: number, month: number): string {
  const mapping = COLLECTION_SHEET_MAPPINGS[year];
  if (!mapping) {
    return 'https://docs.google.com/spreadsheets/d/1wWc0AX9TpbLrDZOO63qBHOe5_kcWHc7k5HRAo85_oZA/edit';
  }
  const gid = mapping.gids[month];
  return gid
    ? `https://docs.google.com/spreadsheets/d/${mapping.docId}/edit#gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${mapping.docId}/edit`;
}

/** 시트 원본에서 전수 검증된 각 월별 실제 총 수거량(kg) 기준표 */
export const VERIFIED_MONTHLY_TOTALS: Record<string, number> = {
  // 2025년 (4월 시범사업 시작)
  '2025-4': 3314,
  '2025-5': 2262,
  '2025-6': 3069,
  '2025-7': 2988,
  '2025-8': 2185,
  '2025-9': 2605,
  '2025-10': 2993,
  '2025-11': 2474,
  '2025-12': 2287,
  // 2026년
  '2026-1': 2807,
  '2026-2': 2564,
  '2026-3': 3516,
  '2026-4': 5066,
  '2026-5': 3999,
  '2026-6': 3729,
  '2026-7': 4755,
  '2026-8': 3874,
  '2026-9': 2260,
};

/** 시트 원본에서 전수 검증된 각 월별 주차별 실제 수거량(kg) 기준표 */
export const VERIFIED_WEEKLY_DATA: Record<string, number[]> = {
  // 2025년
  '2025-4': [509, 675, 645, 657, 828],
  '2025-5': [0, 898, 670, 694, 0],
  '2025-6': [1041, 661, 679, 688, 0],
  '2025-7': [686, 556, 601, 563, 582],
  '2025-8': [611, 537, 522, 515, 0],
  '2025-9': [623, 685, 575, 722, 0],
  '2025-10': [732, 501, 629, 575, 556],
  '2025-11': [593, 689, 591, 601, 0],
  '2025-12': [551, 563, 586, 587, 0],
  // 2026년
  '2026-1': [575, 500, 601, 560, 571],
  '2026-2': [507, 819, 468, 770, 0],
  '2026-3': [766, 834, 923, 993, 0],
  '2026-4': [1075, 1046, 1039, 918, 988],
  '2026-5': [853, 935, 1021, 1190, 0],
  '2026-6': [959, 939, 1037, 794, 0],
  '2026-7': [866, 1006, 920, 958, 1005],
  '2026-8': [933, 869, 1064, 1008, 0],
  '2026-9': [1074, 1186, 0, 0, 0],
};

// 런타임에 읽은 정확한 월별 수거량 및 주차별 캐시
const monthlyTotalCache = new Map<string, number>();
const runtimeWeeklyCache = new Map<string, number[]>();

function getBaseUrl(): string {
  return readEnvUrl('VITE_COLLECTION_GAS_API_URL', 'VITE_GAS_API_URL') || COLLECTION_GAS_FALLBACK;
}

/**
 * 매장별 수거 데이터 정제:
 * 4주차 월(5주차 빈 열)에서 GAS 파싱 오류로 '참여일(260406 등)'이 totalKg로 잘못 들어오는 현상을
 * 매장별 주차 수거량의 실제 합계로 완벽히 보정합니다.
 */
function sanitizeStores(stores: StoreCollection[] = []): StoreCollection[] {
  return stores.map(store => {
    const weeklyKg = (store.weeklyKg || []).map(v =>
      typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.round(v)) : 0
    );
    const weeklySum = weeklyKg.reduce((acc, v) => acc + v, 0);

    // 참여일자(260406 등)로 왜곡되었거나 주차 합계가 존재하면 주차 합계가 실제 시트의 매장 합계입니다.
    const totalKg = store.totalKg > 50_000 || weeklySum > 0 ? weeklySum : Math.round(store.totalKg || 0);

    return {
      ...store,
      weeklyKg,
      totalKg,
    };
  });
}

/**
 * CollectionData 정제 및 무결성 보정
 */
function sanitizeCollectionData(data: CollectionData): CollectionData {
  const stores = sanitizeStores(data.stores);
  const weeklyKg = (data.weeklyKg || []).map(v =>
    typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.round(v)) : 0
  );
  const weeklySum = weeklyKg.reduce((acc, v) => acc + v, 0);
  const storesSum = stores.reduce((acc, s) => acc + s.totalKg, 0);

  let totalKg = data.totalKg;
  if (totalKg > 50_000 || weeklySum > 0) {
    totalKg = weeklySum > 0 ? weeklySum : storesSum;
  } else if (totalKg <= 0 && storesSum > 0) {
    totalKg = storesSum;
  }

  // 캐시 저장
  const cacheKey = `${data.period.year}-${data.period.month}`;
  if (totalKg > 0) {
    monthlyTotalCache.set(cacheKey, totalKg);
    runtimeWeeklyCache.set(cacheKey, weeklyKg);
  }

  return {
    ...data,
    totalKg: Math.round(totalKg),
    weeklyKg,
    stores,
  };
}

/**
 * DashboardData 정제 및 무결성 보정
 */
function sanitizeDashboardData(data: DashboardData, year: number, month: number): DashboardData {
  const weeklyKg = (data.collection.weeklyKg || []).map(v =>
    typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.round(v)) : 0
  );
  const weeklySum = weeklyKg.reduce((acc, v) => acc + v, 0);

  let totalKg = data.collection.totalKg;
  if (totalKg > 50_000 || weeklySum > 0) {
    totalKg = weeklySum > 0 ? weeklySum : totalKg;
  }

  const cacheKey = `${year}-${month}`;
  if (totalKg > 0) {
    monthlyTotalCache.set(cacheKey, totalKg);
    runtimeWeeklyCache.set(cacheKey, weeklyKg);
  }

  // 매장별 주차 수거량으로 순위 재계산 및 정렬
  const topStores = sanitizeStores(data.topStores)
    .slice()
    .sort((a, b) => b.totalKg - a.totalKg);

  // 1. 주차별 대비 계산 (전주차 대비)
  const nonZeroIndices: number[] = [];
  weeklyKg.forEach((kg, idx) => {
    if (kg > 0) nonZeroIndices.push(idx);
  });

  let weeklyComparison: WeeklyComparison | null = null;
  if (nonZeroIndices.length >= 2) {
    const currIdx = nonZeroIndices[nonZeroIndices.length - 1];
    const prevIdx = nonZeroIndices[nonZeroIndices.length - 2];
    const currentKg = weeklyKg[currIdx];
    const prevKg = weeklyKg[prevIdx];
    const changeKg = currentKg - prevKg;
    const changePercent = prevKg > 0 ? Math.round(((currentKg - prevKg) / prevKg) * 1000) / 10 : null;
    weeklyComparison = {
      currentWeek: currIdx + 1,
      currentKg,
      prevWeek: prevIdx + 1,
      prevKg,
      changeKg,
      changePercent,
    };
  } else if (nonZeroIndices.length === 1) {
    const currIdx = nonZeroIndices[0];
    weeklyComparison = {
      currentWeek: currIdx + 1,
      currentKg: weeklyKg[currIdx],
      prevWeek: 0,
      prevKg: 0,
      changeKg: weeklyKg[currIdx],
      changePercent: null,
    };
  }

  // 2. 전월 대비 & 전월 동기간 대비 계산
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevKey = `${prevYear}-${prevMonth}`;

  let previousMonthKg = data.collection.previousMonthKg;
  if (previousMonthKg !== null && (previousMonthKg > 50_000 || previousMonthKg <= 0)) {
    previousMonthKg = monthlyTotalCache.get(prevKey) ?? VERIFIED_MONTHLY_TOTALS[prevKey] ?? null;
  }

  let changePercent = data.collection.changePercent;
  if (previousMonthKg !== null && previousMonthKg > 0 && totalKg > 0) {
    changePercent = Math.round(((totalKg - previousMonthKg) / previousMonthKg) * 1000) / 10;
  } else if (!previousMonthKg) {
    changePercent = null;
  }

  // 3. 전월 동기간 대비 (예: 9월 1~2주 vs 8월 1~2주)
  const activeWeeksCount = nonZeroIndices.length;
  let samePeriodComparison: SamePeriodComparison | null = null;

  if (activeWeeksCount > 0) {
    const currentWeeksKg = nonZeroIndices.reduce((sum, idx) => sum + weeklyKg[idx], 0);
    const prevMonthWeekly = runtimeWeeklyCache.get(prevKey) ?? VERIFIED_WEEKLY_DATA[prevKey];
    const prevMonthTotal = monthlyTotalCache.get(prevKey) ?? VERIFIED_MONTHLY_TOTALS[prevKey];

    if (prevMonthWeekly && prevMonthWeekly.length >= activeWeeksCount) {
      const prevMonthWeeksKg = prevMonthWeekly.slice(0, activeWeeksCount).reduce((a, b) => a + b, 0);
      const changeKg = currentWeeksKg - prevMonthWeeksKg;
      const sameChangePercent =
        prevMonthWeeksKg > 0 ? Math.round(((currentWeeksKg - prevMonthWeeksKg) / prevMonthWeeksKg) * 1000) / 10 : null;
      const achievementPercent =
        prevMonthTotal && prevMonthTotal > 0 ? Math.round((currentWeeksKg / prevMonthTotal) * 1000) / 10 : null;

      samePeriodComparison = {
        weeksCount: activeWeeksCount,
        currentWeeksKg,
        prevMonthWeeksKg,
        changeKg,
        changePercent: sameChangePercent,
        achievementPercent,
      };
    }
  }

  return {
    ...data,
    collection: {
      ...data.collection,
      totalKg: Math.round(totalKg),
      weeklyKg,
      previousMonthKg: previousMonthKg !== null ? Math.round(previousMonthKg) : null,
      changePercent,
      weeklyComparison,
      samePeriodComparison,
    },
    topStores,
  };
}

async function request<T>(action: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error(
      '수거관리 주소가 없습니다. .env.local 에 VITE_COLLECTION_GAS_API_URL 을 넣고 개발 서버를 다시 시작해주세요.'
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GAS 요청 실패 (${response.status})`);
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  if (!body.ok || !body.data) {
    throw new Error(body.error?.message || body.error?.code || 'GAS API 응답 오류');
  }
  return body.data;
}

export const gasApi = {
  async dashboard(year: number, month: number): Promise<DashboardData> {
    const raw = await request<DashboardData>('dashboard', { year, month });
    return sanitizeDashboardData(raw, year, month);
  },
  async collections(year: number, month: number): Promise<CollectionData> {
    const raw = await request<CollectionData>('collections', { year, month });
    return sanitizeCollectionData(raw);
  },
};
