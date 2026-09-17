import type {
  BeddingStage,
  CompostSettings,
  MeasurementRecord,
  MoldStatus,
  OperatingCycle,
  TrendDirection,
} from '../types';
import { FIELD_OPS, makeCycleId } from '../constants/fieldOps';
import { compareRecords, daysBetween, getCurrentDateString, normalizeName } from './calculations';

/**
 * 현장 방문 기록으로 "지금 모여 있는 커피박"의 상태를 셈한다.
 *
 * 여기 있는 값은 모두 코드가 계산한다. AI 는 이 값을 설명만 한다.
 * 예전 기록에는 곰팡이·혼합 같은 칸이 없으므로, 없는 값을 '없음'으로 추정하지 않고
 * null 로 두어 화면에서 "기록 없음" 으로 보이게 한다.
 */

/* ───────────────────────── 값 읽기 ───────────────────────── */

/**
 * 이번 방문에 새로 부은 커피박(kg).
 * 예전 기록에는 '수거량(kg)' 칸밖에 없는데 그 값이 곧 그날 하역한 양이라 그대로 쓴다.
 */
export function getAddedKg(record: MeasurementRecord): number {
  const value = record.addedKg ?? record.collectedKg ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** 이번 방문에 깔개로 퍼 간 커피박(kg) */
export function getBeddingUsedKg(record: MeasurementRecord): number {
  const value = record.beddingUsedKg ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** 한 방문에서 한 일 — 시트의 '작업 유형' 칸에 그대로 들어간다 */
export function describeWorkType(record: MeasurementRecord): string {
  // 측정 탭 기록은 점검이 아니라 새 커피박 투입이다. 같은 날 점검도 했으면 둘 다 적는다.
  const inspected =
    record.recordType === 'inspection' ||
    record.mixed !== undefined ||
    record.moldStatus !== undefined ||
    record.odor !== undefined;
  const parts: string[] = [];
  if (inspected) parts.push('점검');
  if (getAddedKg(record) > 0 || record.recordType === 'measurement') parts.push('투입');
  if (record.mixed) parts.push('혼합');
  if (getBeddingUsedKg(record) > 0) parts.push('깔개 사용');
  // 종류 표시가 없는 예전 기록
  return parts.length > 0 ? parts.join(' · ') : '점검';
}

export const MOLD_LABELS: Record<MoldStatus, string> = {
  none: '없음',
  some: '일부 발견',
  spreading: '확산 중',
};

/** 시트에 적힌 글자를 곰팡이 상태로 되돌린다. 빈 칸이면 '기록 없음'(undefined). */
export function parseMoldStatus(text: unknown): MoldStatus | undefined {
  const value = String(text ?? '').trim();
  if (!value) return undefined;
  if (value === MOLD_LABELS.none || value === 'none') return 'none';
  if (value === MOLD_LABELS.some || value === 'some') return 'some';
  if (value === MOLD_LABELS.spreading || value === 'spreading') return 'spreading';
  return undefined;
}

/* ───────────────────────── 운영 사이클 ───────────────────────── */

function getRanchRecords(records: MeasurementRecord[], ranchName: string): MeasurementRecord[] {
  const target = normalizeName(ranchName);
  return records.filter(r => normalizeName(r.ranchName) === target).sort(compareRecords);
}

/**
 * 지금 돌고 있는 사이클을 정한다.
 *
 * 기록에 적힌 사이클 ID 가 먼저다 — 다른 기기에서 시작한 사이클도 시트를 읽으면 그대로 이어진다.
 * 사람이 방금 [새 사이클 시작]을 눌렀는데 아직 기록이 없으면 그 값을 쓴다.
 * 둘 다 없으면 예전 기록 전체를 하나의 사이클로 본다 (ID 는 null = 기록 없음).
 */
export function resolveCycle(
  records: MeasurementRecord[],
  ranchName: string,
  saved?: OperatingCycle | null
): OperatingCycle | null {
  const ranchRecords = getRanchRecords(records, ranchName);

  const lastWithId = [...ranchRecords].reverse().find(r => r.cycleId);
  const firstOfCycle = lastWithId ? ranchRecords.find(r => r.cycleId === lastWithId.cycleId) : undefined;
  /*
   * 사이클 시작일은 ID 안에 들어 있다 (GJ-2026-09-08).
   * 그 ID 를 단 기록 중 가장 이른 날짜로 잡으면, ID 가 없는 예전 기록이 사이클 밖으로 밀려
   * 지금까지 모아 둔 커피박이 0kg 으로 보인다.
   */
  const fromRecords: OperatingCycle | null =
    lastWithId?.cycleId && firstOfCycle
      ? {
          id: lastWithId.cycleId,
          startDate: readCycleStartDate(lastWithId.cycleId) ?? firstOfCycle.date,
        }
      : null;

  // 사람이 새로 시작한 사이클이 기록보다 뒤면 그쪽이 현재 사이클이다
  if (saved && (!fromRecords || saved.startDate > fromRecords.startDate)) return saved;
  if (fromRecords) return fromRecords;
  if (ranchRecords.length === 0) return null;
  return { id: null, startDate: ranchRecords[0].date };
}

/** 사이클 ID 끝에 붙은 시작일을 읽는다 (GJ-2026-09-08 -> 2026-09-08) */
function readCycleStartDate(cycleId: string): string | null {
  const matched = /(\d{4}-\d{2}-\d{2})$/.exec(cycleId);
  return matched ? matched[1] : null;
}

/** 새 사이클 값을 만든다 (아직 기록은 없다) */
export function createCycle(ranchName: string, startDate = getCurrentDateString()): OperatingCycle {
  return { id: makeCycleId(ranchName, startDate), startDate };
}

/** 이 사이클에 속한 방문 기록 (오래된 순) */
export function getCycleRecords(
  records: MeasurementRecord[],
  ranchName: string,
  cycle: OperatingCycle | null
): MeasurementRecord[] {
  const ranchRecords = getRanchRecords(records, ranchName);
  if (!cycle) return ranchRecords;
  return ranchRecords.filter(r => {
    if (r.cycleId) return r.cycleId === cycle.id;
    // 사이클 ID 가 없는 예전 기록은 날짜로 가른다
    return r.date >= cycle.startDate;
  });
}

/* ───────────────────────── 추이 ───────────────────────── */

/**
 * 최근 몇 번의 측정값이 어느 쪽으로 움직였는지.
 *
 * 맨 앞 값 하나와 비교하면, 신규 투입으로 한 번 치솟았다 내려온 더미를 '상승 중'이라고 말하게 된다.
 * 그래서 마지막 값을 앞선 값들의 평균과 견준다.
 * 작게 오르내린 것은 '유지' 로 본다 — 측정 오차를 추세라고 부르지 않기 위해서다.
 */
export function readTrend(values: number[], steadyBand: number): TrendDirection {
  const points = values.slice(-FIELD_OPS.trendPoints);
  if (points.length < 2) return 'unknown';

  const latest = points[points.length - 1];
  const earlier = points.slice(0, -1);
  const base = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
  const delta = latest - base;

  if (delta <= -steadyBand) return 'decreasing';
  if (delta >= steadyBand) return 'increasing';
  return 'steady';
}

export const MOISTURE_TREND_LABELS: Record<TrendDirection, string> = {
  decreasing: '감소 중',
  increasing: '상승 중',
  steady: '유지',
  unknown: '자료 부족',
};

export const TEMP_TREND_LABELS: Record<TrendDirection, string> = {
  decreasing: '안정화 중',
  increasing: '상승 중',
  steady: '유지',
  unknown: '자료 부족',
};

/* ───────────────────────── 혼합 관리 ───────────────────────── */

export type MixingLevel = 'unknown' | 'none' | 'low' | 'ok';

export const MIXING_LEVEL_LABELS: Record<MixingLevel, string> = {
  unknown: '기록 없음',
  none: '관리 필요',
  low: '주의',
  ok: '정상',
};

/* ───────────────────────── 사이클 현황 ───────────────────────── */

export const STAGE_TITLES: Record<BeddingStage, string> = {
  accumulating: '축적 중',
  managing: '관리 중',
  preparing: '사용 준비',
  candidate: '깔개 사용 후보',
  attention: '관리 필요',
  hold: '사용 보류',
};

export interface CycleStatus {
  ranchName: string;
  cycle: OperatingCycle | null;
  /** 이 사이클의 방문 기록 (오래된 순) */
  records: MeasurementRecord[];
  latest: MeasurementRecord | null;
  /** 사이클을 시작하고 며칠째인지 */
  cycleDays: number | null;
  visitCount: number;
  daysSinceLastVisit: number | null;
  /** 마지막 방문 후 기준일이 지났는지 */
  visitDue: boolean;

  /** 누적 신규 투입량(kg) */
  addedKg: number;
  /** 누적 깔개 사용량(kg) */
  beddingUsedKg: number;
  /** 현재 추정 더미량 = 누적 투입 - 누적 깔개 사용 */
  currentPileKg: number;
  /** 목장별 설정값. 정하지 않았으면 null */
  targetPileKg: number | null;
  progressPercent: number | null;

  moisture: number | null;
  moistureTrend: TrendDirection;
  moisturePoints: number[];
  coreTemp: number | null;
  tempTrend: TrendDirection;
  tempPoints: number[];
  /** 추이를 본 구간에 신규 투입이 있었는지 — 값이 오른 이유일 수 있다 */
  trendHasNewInput: boolean;

  mixingCountLast7Days: number;
  daysSinceLastMixing: number | null;
  mixingLevel: MixingLevel;
  /** 혼합이 밀렸을 때만 채워지는 안내 문구 */
  mixingNotice: string | null;

  /** null 이면 기록 없음 — '없음'으로 추정하지 않는다 */
  moldStatus: MoldStatus | null;
  odor: boolean | null;

  stage: BeddingStage;
  stageTitle: string;
  stageReason: string;
  /** 판정을 막고 있는, 빠진 자료 */
  dataGaps: string[];
}

interface SummarizeInput {
  records: MeasurementRecord[];
  ranchName: string;
  settings: CompostSettings;
  cycle?: OperatingCycle | null;
  today?: string;
}

export function summarizeCycle({
  records,
  ranchName,
  settings,
  cycle = null,
  today = getCurrentDateString(),
}: SummarizeInput): CycleStatus {
  const cycleRecords = getCycleRecords(records, ranchName, cycle);
  const latest = cycleRecords[cycleRecords.length - 1] ?? null;

  // ── 더미량 ──
  const addedKg = Math.round(cycleRecords.reduce((sum, r) => sum + getAddedKg(r), 0));
  const beddingUsedKg = Math.round(cycleRecords.reduce((sum, r) => sum + getBeddingUsedKg(r), 0));
  const currentPileKg = Math.max(0, addedKg - beddingUsedKg);

  const rawTarget = settings.beddingTargetKg?.[normalizeName(ranchName)];
  const targetPileKg = Number.isFinite(rawTarget) && Number(rawTarget) > 0 ? Number(rawTarget) : null;
  const progressPercent = targetPileKg ? Math.round((currentPileKg / targetPileKg) * 100) : null;
  const progressRatio = targetPileKg ? currentPileKg / targetPileKg : null;

  // ── 추이 (측정값이 있는 기록만) ──
  const measured = cycleRecords.filter(r => r.moisture > 0 || r.coreTemp > 0);
  const window = measured.slice(-FIELD_OPS.trendPoints);
  const moisturePoints = window.map(r => r.moisture);
  const tempPoints = window.map(r => r.coreTemp);
  const moistureTrend = readTrend(moisturePoints, FIELD_OPS.moistureSteadyBand);
  const tempTrend = readTrend(tempPoints, FIELD_OPS.tempSteadyBand);
  // 첫 점은 비교 기준일 뿐이라, 그 뒤에 부은 커피박만 값이 움직인 이유가 된다
  const trendHasNewInput = window.slice(1).some(r => getAddedKg(r) > 0);

  // ── 혼합 ──
  const mixingRecords = cycleRecords.filter(r => r.mixed !== undefined);
  const mixedRecords = cycleRecords.filter(r => r.mixed === true);
  const mixingCountLast7Days = mixedRecords.filter(
    r => daysBetween(r.date, today) < FIELD_OPS.mixingWindowDays
  ).length;
  const lastMixed = mixedRecords[mixedRecords.length - 1] ?? null;
  const daysSinceLastMixing = lastMixed ? Math.max(0, daysBetween(lastMixed.date, today)) : null;

  let mixingLevel: MixingLevel;
  if (mixingRecords.length === 0) mixingLevel = 'unknown';
  else if (mixingCountLast7Days === 0) mixingLevel = 'none';
  else if (mixingCountLast7Days < FIELD_OPS.mixingWeeklyMin) mixingLevel = 'low';
  else mixingLevel = 'ok';

  const mixingNotice =
    daysSinceLastMixing !== null && daysSinceLastMixing >= FIELD_OPS.mixingStaleDays
      ? '최근 혼합 이후 ' + daysSinceLastMixing + '일이 지났습니다. 곰팡이 예방을 위해 더미 상태를 확인하고 혼합해주세요.'
      : null;

  // ── 방문 주기 ──
  const daysSinceLastVisit = latest ? Math.max(0, daysBetween(latest.date, today)) : null;
  const visitDue = daysSinceLastVisit !== null && daysSinceLastVisit >= FIELD_OPS.visitIntervalDays;
  const cycleDays = cycle ? Math.max(0, daysBetween(cycle.startDate, today)) : null;

  // 점검과 측정은 따로 저장되므로, 항목마다 그 값이 들어 있는 가장 최근 기록을 본다
  const newestFirst = [...cycleRecords].reverse();
  const moldStatus = newestFirst.find(r => r.moldStatus !== undefined)?.moldStatus ?? null;
  const odor = newestFirst.find(r => r.odor !== undefined)?.odor ?? null;
  const lastMeasured = measured[measured.length - 1] ?? null;
  const moisture = lastMeasured && lastMeasured.moisture > 0 ? lastMeasured.moisture : null;
  const coreTemp = lastMeasured && lastMeasured.coreTemp > 0 ? lastMeasured.coreTemp : null;

  // ── 빠진 자료 ──
  const dataGaps: string[] = [];
  if (!latest) dataGaps.push('현장 점검 기록이 없습니다.');
  if (latest && moldStatus === null) dataGaps.push('최근 기록에 곰팡이 상태가 없습니다.');
  if (latest && mixingLevel === 'unknown') dataGaps.push('혼합 작업 기록이 없습니다.');
  if (!targetPileKg) dataGaps.push('깔개 목표량을 설정해주세요.');

  const decided = decideStage({
    settings,
    latest,
    moisture,
    coreTemp,
    moistureTrend,
    tempTrend,
    moldStatus,
    mixingLevel,
    mixingNotice,
    progressRatio,
    targetPileKg,
    measuredCount: measured.length,
  });

  return {
    ranchName: normalizeName(ranchName),
    cycle,
    records: cycleRecords,
    latest,
    cycleDays,
    visitCount: cycleRecords.length,
    daysSinceLastVisit,
    visitDue,
    addedKg,
    beddingUsedKg,
    currentPileKg,
    targetPileKg,
    progressPercent,
    moisture,
    moistureTrend,
    moisturePoints,
    coreTemp,
    tempTrend,
    tempPoints,
    trendHasNewInput,
    mixingCountLast7Days,
    daysSinceLastMixing,
    mixingLevel,
    mixingNotice,
    moldStatus,
    odor,
    stage: decided.stage,
    stageTitle: STAGE_TITLES[decided.stage],
    stageReason: decided.stageReason,
    dataGaps,
  };
}

interface StageInput {
  settings: CompostSettings;
  latest: MeasurementRecord | null;
  moisture: number | null;
  coreTemp: number | null;
  moistureTrend: TrendDirection;
  tempTrend: TrendDirection;
  moldStatus: MoldStatus | null;
  mixingLevel: MixingLevel;
  mixingNotice: string | null;
  progressRatio: number | null;
  targetPileKg: number | null;
  measuredCount: number;
}

function remainingText(targetPileKg: number, progressRatio: number): string {
  const left = Math.max(0, Math.round(targetPileKg * (1 - progressRatio)));
  return left.toLocaleString('ko-KR') + 'kg';
}

/**
 * 깔개 사용 판단.
 *
 * 이 판정은 코드에서만 한다 — AI 에게 맡기지 않는다.
 * 곰팡이가 보이면 다른 값이 아무리 좋아도 보류가 먼저다.
 */
function decideStage(input: StageInput): { stage: BeddingStage; stageReason: string } {
  const {
    settings,
    latest,
    moisture,
    coreTemp,
    moistureTrend,
    tempTrend,
    moldStatus,
    mixingLevel,
    mixingNotice,
    progressRatio,
    targetPileKg,
    measuredCount,
  } = input;

  if (!latest) {
    return { stage: 'hold', stageReason: '아직 현장 점검 기록이 없습니다. 첫 점검을 저장해주세요.' };
  }

  // 1. 곰팡이가 먼저다
  if (moldStatus === 'spreading') {
    return {
      stage: 'hold',
      stageReason: '곰팡이가 확산 중입니다. 즉시 혼합하고 다음 방문에서 상태를 다시 확인해주세요.',
    };
  }
  if (moldStatus === 'some') {
    return {
      stage: 'hold',
      stageReason: '곰팡이가 확인되었습니다. 혼합 후 다음 방문에서 상태를 다시 확인해주세요.',
    };
  }

  // 2. 과열·과습, 혼합 밀림
  if (coreTemp !== null && coreTemp > settings.highTempThreshold) {
    return {
      stage: 'attention',
      stageReason:
        '심부 온도가 ' + coreTemp + '℃ 로 기준(' + settings.highTempThreshold + '℃)을 넘었습니다. 혼합으로 열을 빼주세요.',
    };
  }
  if (moisture !== null && moisture > settings.highMoistureThreshold) {
    return {
      stage: 'attention',
      stageReason:
        '함수율이 ' + moisture + '% 로 기준(' + settings.highMoistureThreshold + '%)을 넘었습니다. 혼합 횟수를 늘려 수분을 날려주세요.',
    };
  }
  if (mixingLevel === 'none') {
    return {
      stage: 'attention',
      stageReason: mixingNotice ?? '최근 7일간 혼합 기록이 없습니다. 곰팡이 예방을 위해 혼합해주세요.',
    };
  }

  // 3. 목표량이 없으면 남은 양을 말할 수 없다
  if (progressRatio === null || targetPileKg === null) {
    return {
      stage: measuredCount >= 2 ? 'managing' : 'accumulating',
      stageReason:
        '깔개 목표량이 설정되지 않아 남은 양을 계산할 수 없습니다. 설정에서 목장별 목표량을 정해주세요.',
    };
  }

  const max = settings.usableMoistureMax;
  const min = settings.usableMoistureMin;
  const moistureNear = moisture !== null && moisture <= max + FIELD_OPS.moistureApproachBand;
  const moistureInBand = moisture !== null && moisture >= min && moisture <= max;
  const tempSettled = tempTrend === 'decreasing' || tempTrend === 'steady';

  // 4. 사용 후보 — 목표량 도달 + 관찰 범위 접근 + 온도 안정 + 혼합 정상 + 곰팡이 없음
  if (progressRatio >= 1 && moistureNear && tempSettled && mixingLevel === 'ok') {
    if (moldStatus === null) {
      return {
        stage: 'hold',
        stageReason: '다른 조건은 갖췄지만 곰팡이 상태 기록이 없습니다. 다음 점검에서 곰팡이를 확인해주세요.',
      };
    }
    return {
      stage: 'candidate',
      stageReason: moistureInBand
        ? '목표량에 도달했고 함수율 ' + moisture + '% 가 현장 관찰 범위(' + min + '~' + max + '%) 안입니다. 더미 상태를 눈으로 확인한 뒤 깔개로 써보세요.'
        : '목표량에 도달했고 함수율 ' + moisture + '% 가 현장 관찰 범위(' + min + '~' + max + '%)에 근접했습니다. 더미 상태를 확인한 뒤 사용 여부를 정해주세요.',
    };
  }

  // 5. 사용 준비 — 목표량 근접 + 건조 방향 + 온도 안정 방향
  if (progressRatio >= FIELD_OPS.targetNearRatio && moistureTrend === 'decreasing' && tempSettled) {
    return {
      stage: 'preparing',
      stageReason: '목표량에 접근하고 있으며 함수율과 온도가 안정화 방향으로 이동하고 있습니다.',
    };
  }

  // 6. 축적 중 / 관리 중
  if (progressRatio < FIELD_OPS.targetNearRatio && measuredCount < 2) {
    return {
      stage: 'accumulating',
      stageReason: '커피박을 모으는 중입니다. 목표량까지 약 ' + remainingText(targetPileKg, progressRatio) + ' 남았습니다.',
    };
  }

  return {
    stage: 'managing',
    stageReason:
      '커피박을 모으면서 온도와 함수율을 관리하는 중입니다. 목표량까지 약 ' +
      remainingText(targetPileKg, progressRatio) +
      ' 남았습니다.',
  };
}

/* ───────────────────────── 그래프 이벤트 ───────────────────────── */

export type VisitEventType = 'input' | 'mix' | 'bedding' | 'mold';

export interface VisitEvent {
  type: VisitEventType;
  label: string;
}

/**
 * 그래프에 함께 그릴 이벤트.
 * 숫자가 갑자기 움직인 이유(신규 투입 등)를 그래프에서 바로 알 수 있어야 한다.
 */
export function getVisitEvents(record: MeasurementRecord): VisitEvent[] {
  const events: VisitEvent[] = [];
  if (getAddedKg(record) > 0) events.push({ type: 'input', label: '투입' });
  if (record.mixed) events.push({ type: 'mix', label: '혼합' });
  if (getBeddingUsedKg(record) > 0) events.push({ type: 'bedding', label: '깔개' });
  if (record.moldStatus === 'some' || record.moldStatus === 'spreading') {
    events.push({ type: 'mold', label: '곰팡이' });
  }
  return events;
}
