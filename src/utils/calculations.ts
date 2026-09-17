import type { CompostSettings, CorePoint, MeasurementRecord, Pile, VerdictInfo } from '../types';

/* ───────────────────────── 날짜·시간 (한국 시간 기준) ───────────────────────── */

/**
 * 현장 기준 시간대. 구글 시트(Apps Script)도 같은 시간대를 쓰므로
 * 기기 설정과 무관하게 항상 한국 시각으로 기록되도록 고정한다.
 */
export const FIELD_TIME_ZONE = 'Asia/Seoul';

const DAY_MS = 86400000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type DateTimeParts = { year: string; month: string; day: string; hour: string; minute: string };

/** 지정 시각을 한국 시간대 기준의 연/월/일/시/분으로 분해 */
function getFieldParts(date: Date = new Date()): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FIELD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // hour12:false 는 자정을 24시로 주는 환경이 있어 h23 을 명시
  }).formatToParts(date);

  const pick = (type: string) => parts.find(p => p.type === type)?.value ?? '00';

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

/** 'YYYY-MM-DD' 를 시간대 영향 없이 비교할 수 있는 UTC 자정 ms 로 변환 */
function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 두 날짜(YYYY-MM-DD) 사이의 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(dateStr: string, days: number): string {
  return fromUtcMs(toUtcMs(dateStr) + days * DAY_MS);
}

/** 날짜(YYYY-MM-DD)가 속한 주의 월요일~일요일 */
export function getWeekRange(dateStr: string): { start: string; end: string } {
  const base = toUtcMs(dateStr);
  const mondayOffset = (new Date(base).getUTCDay() + 6) % 7;
  const start = base - mondayOffset * DAY_MS;
  return { start: fromUtcMs(start), end: fromUtcMs(start + 6 * DAY_MS) };
}

/** 'YYYY-MM-DD' → '9/14(월)' */
export function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}(${WEEKDAYS[new Date(toUtcMs(dateStr)).getUTCDay()]})`;
}

/** 현재 시간 문자열 (HH:mm) — 한국 시간 기준 */
export function getCurrentTimeString(): string {
  const { hour, minute } = getFieldParts();
  return `${hour}:${minute}`;
}

/**
 * 현재 날짜 문자열 (YYYY-MM-DD) — 한국 시간 기준.
 * toISOString() 은 UTC 라 자정~오전 9시 사이에 하루 전 날짜가 된다.
 */
export function getCurrentDateString(): string {
  const { year, month, day } = getFieldParts();
  return `${year}-${month}-${day}`;
}

/** 'YYYY-MM-DD HH:mm' (한국 시간) */
export function getCurrentDateTimeString(): string {
  return `${getCurrentDateString()} ${getCurrentTimeString()}`;
}

/* ───────────────────────── 심부 3지점 측정 ───────────────────────── */

/** 한 번 계측할 때 재는 지점 수 */
export const CORE_POINT_COUNT = 3;
/** 지점 사이 간격(cm) — 같은 높이에서 이만큼 띄워 잰다 */
export const CORE_POINT_SPACING_CM = 30;

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** 지점별 값의 평균. 한 지점만 재도 그 값이 평균이 된다. */
export function averageCorePoints(points: CorePoint[]): { coreTemp: number; moisture: number } {
  const valid = points.filter(p => Number.isFinite(p.coreTemp) && Number.isFinite(p.moisture));
  if (valid.length === 0) return { coreTemp: 0, moisture: 0 };
  return {
    coreTemp: round1(valid.reduce((sum, p) => sum + p.coreTemp, 0) / valid.length),
    moisture: round1(valid.reduce((sum, p) => sum + p.moisture, 0) / valid.length),
  };
}

/* ───────────────────────── 더미(목장 + 하역 장소) ───────────────────────── */

/** 앞뒤 공백을 없애고 연속 공백을 하나로 — '퇴비사  A동' 과 '퇴비사 A동' 을 같은 장소로 본다 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function getPileKey(pile: Pile): string {
  return `${normalizeName(pile.ranchName)}|${normalizeName(pile.location)}`;
}

/** 같은 장소·같은 날짜는 한 건만 남긴다 (시트도 이 키로 행을 갱신한다) */
export function buildRecordKey(pile: Pile, date: string): string {
  return `${getPileKey(pile)}|${date}`;
}

export function compareRecords(a: MeasurementRecord, b: MeasurementRecord): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
}

/**
 * 심부 온도·함수율을 잰 기록인지.
 * 현장 점검 기록은 이 값을 재지 않는다 (시트에서도 빈칸 → 앱에서는 0 으로 읽힌다).
 * 판정·직전 대비·그래프·측정 횟수는 측정 기록만 쓴다.
 */
export function hasMeasurement(record: { coreTemp: number; moisture: number; corePoints?: CorePoint[] }): boolean {
  return (
    record.moisture > 0 ||
    record.coreTemp > 0 ||
    (record.corePoints ?? []).some(point => point.moisture > 0 || point.coreTemp > 0)
  );
}

/** 한 장소의 기록을 오래된 순으로 */
export function getPileRecords(records: MeasurementRecord[], pile: Pile): MeasurementRecord[] {
  const key = getPileKey(pile);
  return records.filter(r => getPileKey(r) === key).sort(compareRecords);
}

/* ───────────────────────── 판정 ───────────────────────── */

/** 부숙 기간 동안 반복하는 혼합 작업 안내 */
export const MIXING_GUIDE = '1주일에 2~3회, 기존 커피박을 삽으로 한 번씩 뒤집어 섞어주세요.';

/** 사용 시점 예측에 쓰는 최근 기록 수 */
const TREND_MAX_POINTS = 4;
/** 이보다 오래 걸리는 예측은 숫자로 보여주지 않는다 */
const TIMING_MAX_WEEKS = 12;

function formatSigned(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/**
 * 최근 함수율 감소 속도(%p/주).
 * 함수율이 줄어든 최근 구간만 쓴다 — 깔개로 쓰고 새 커피박을 쌓아 함수율이 다시 오르면
 * 그 앞의 기록은 다른 더미나 마찬가지라 예측에서 뺀다.
 */
function getWeeklyDryingRate(points: { date: string; moisture: number }[]): number | null {
  const last = points.length - 1;
  let start = last;
  while (start > 0 && last - start + 1 < TREND_MAX_POINTS && points[start - 1].moisture >= points[start].moisture) {
    start--;
  }

  const days = daysBetween(points[start].date, points[last].date);
  const drop = points[start].moisture - points[last].moisture;
  if (days <= 0 || drop <= 0) return null;
  return (drop / days) * 7;
}

/**
 * 한 기록을 판정한다.
 * @param current 판정할 값
 * @param earlier 같은 장소의 더 이전 날짜 기록 (오래된 순)
 *
 * - 첫 기록은 판정하지 않는다. 막 하역한 커피박에 조치를 띄우면 오해를 산다.
 * - 과열·과습이면 혼합이 먼저다.
 * - 그 외에는 함수율이 깔개 현장 관찰 범위(기본 20~30%)에 들었는지로 본다.
 *   기준보다 높으면 최근 감소 속도로 사용 가능 시점을 예측한다.
 */
export function evaluateRecord(
  current: { date: string; coreTemp: number; moisture: number; corePoints?: CorePoint[]; recordType?: string },
  earlier: MeasurementRecord[],
  settings: CompostSettings
): VerdictInfo {
  const { coreTemp, moisture } = current;
  const min = settings.usableMoistureMin;
  const max = settings.usableMoistureMax;
  // 비교·예측은 측정 기록끼리만 — 사이에 낀 현장 점검(값 0)과 비교하면 안 된다
  const measuredEarlier = earlier.filter(hasMeasurement);
  const previous = measuredEarlier[measuredEarlier.length - 1];

  // 측정값이 없는 기록(현장 점검)은 판정하지 않는다
  if (!hasMeasurement(current)) {
    return {
      type: 'first',
      title: '현장 점검 완료',
      subtitle: '현장 육안 점검이 기록되었습니다. 혼합·곰팡이·악취 상태를 확인했습니다.',
      action: MIXING_GUIDE,
      icon: 'fact_check',
      bannerClass: 'bg-secondary-container text-on-secondary-container border border-secondary/20',
      titleClass: 'text-on-secondary-container font-bold',
      iconClass: 'text-secondary',
    };
  }

  if (!previous) {
    return {
      type: 'first',
      title: '첫 기록',
      subtitle: '이 장소의 첫 기록입니다. 다음 기록부터 지난 값과 비교해 깔개 사용 시점을 안내합니다.',
      action: MIXING_GUIDE,
      icon: 'flag',
      bannerClass: 'bg-secondary-container text-on-secondary-container border border-secondary/20',
      titleClass: 'text-on-secondary-container font-bold',
      iconClass: 'text-secondary',
    };
  }

  const trend =
    `지난 기록(${formatShortDate(previous.date)}) 대비 함수율 ${formatSigned(moisture - previous.moisture)}%p` +
    ` · 심부온도 ${formatSigned(coreTemp - previous.coreTemp)}℃`;

  const isOverheated = coreTemp > settings.highTempThreshold;
  const isOverMoist = moisture > settings.highMoistureThreshold;
  if (isOverheated || isOverMoist) {
    const reasons = [
      isOverheated && `과열 ${coreTemp}℃ (기준 ${settings.highTempThreshold}℃ 초과)`,
      isOverMoist && `과습 ${moisture}% (기준 ${settings.highMoistureThreshold}% 초과)`,
    ].filter(Boolean);

    return {
      type: 'action_needed',
      title: '혼합 필요',
      subtitle: `${reasons.join(' · ')} — ${trend}`,
      action:
        isOverheated && isOverMoist
          ? '오늘 혼합(뒤집기)으로 더미의 열과 수분을 빼주세요.'
          : isOverheated
          ? '오늘 혼합(뒤집기)으로 더미의 열을 빼주세요.'
          : '혼합(뒤집기) 횟수를 늘려 수분을 날려주세요.',
      icon: 'warning',
      bannerClass: 'bg-error-container text-on-error-container border border-error/20',
      titleClass: 'text-error font-bold',
      iconClass: 'text-error',
    };
  }

  if (moisture >= min && moisture <= max) {
    return {
      type: 'usable',
      title: '깔개 사용 후보',
      subtitle: `함수율 ${moisture}% (현장 관찰 기준 ${min}~${max}%) — ${trend}`,
      action: '더미 상태를 눈으로 확인한 뒤 깔개로 써보세요.',
      icon: 'task_alt',
      bannerClass: 'bg-primary-fixed text-on-primary-fixed border border-primary/20',
      titleClass: 'text-primary font-bold',
      iconClass: 'text-primary',
    };
  }

  if (moisture < min) {
    return {
      type: 'too_dry',
      title: '기준보다 건조',
      subtitle: `함수율 ${moisture}% (현장 관찰 기준 ${min}~${max}%) — ${trend}`,
      action: '더미 상태를 확인한 뒤 깔개로 사용해주세요.',
      icon: 'water_drop',
      bannerClass: 'bg-surface-container-high text-on-surface border border-outline-variant/40',
      titleClass: 'text-on-surface font-bold',
      iconClass: 'text-secondary',
    };
  }

  // 함수율이 사용 기준보다 높다 — 최근 감소 속도로 사용 가능 시점을 예측한다
  const rate = getWeeklyDryingRate([...measuredEarlier, current]);
  let timing: string | undefined;
  if (rate !== null) {
    const weeksNeeded = (moisture - max) / rate;
    timing =
      weeksNeeded > TIMING_MAX_WEEKS
        ? `함수율이 천천히 줄고 있어 ${TIMING_MAX_WEEKS}주 이상 걸릴 것으로 보입니다.`
        : `약 ${Math.max(1, Math.ceil(weeksNeeded))}주 후 (${formatShortDate(addDays(current.date, Math.round(weeksNeeded * 7)))} 무렵) 사용 가능 예상`;
  }

  return {
    type: 'drying',
    title: '부숙 진행 중',
    subtitle:
      `함수율 ${moisture}% (현장 관찰 기준 ${max}% 이하까지 ${Number((moisture - max).toFixed(1))}%p) — ${trend}` +
      (rate === null ? ' · 함수율이 줄지 않았습니다.' : ''),
    action: MIXING_GUIDE,
    timing,
    icon: 'heat_pump',
    bannerClass: 'bg-primary-container text-on-primary',
    titleClass: 'text-white font-bold',
    iconClass: 'text-primary-fixed-dim',
  };
}

export interface AnnotatedRecord {
  record: MeasurementRecord;
  /** 같은 장소의 직전 측정 기록 (현장 점검 기록이면 비교하지 않아 없음) */
  previous?: MeasurementRecord;
  verdict: VerdictInfo;
}

/** 모든 기록에 직전 기록과 판정을 붙인다 (오래된 순) */
export function annotateRecords(records: MeasurementRecord[], settings: CompostSettings): AnnotatedRecord[] {
  const byPile = new Map<string, MeasurementRecord[]>();
  for (const r of [...records].sort(compareRecords)) {
    const key = getPileKey(r);
    const list = byPile.get(key) ?? [];
    list.push(r);
    byPile.set(key, list);
  }

  const out: AnnotatedRecord[] = [];
  for (const list of byPile.values()) {
    list.forEach((record, i) => {
      const earlier = list.slice(0, i);
      const previous = hasMeasurement(record) ? earlier.filter(hasMeasurement).pop() : undefined;
      out.push({ record, previous, verdict: evaluateRecord(record, earlier, settings) });
    });
  }
  return out.sort((a, b) => compareRecords(a.record, b.record));
}

export interface PileSummary {
  key: string;
  pile: Pile;
  /** 측정 기록만, 오래된 순 — 그래프·측정 횟수·직전 대비에 쓴다 */
  records: MeasurementRecord[];
  /** 현장 점검까지 모든 기록, 오래된 순 — 기록 이력에 쓴다 */
  allRecords: MeasurementRecord[];
  /** 최신 측정 기록 (측정이 없으면 최신 기록) */
  latest: MeasurementRecord;
  /** 측정 기록이 하나라도 있는지 */
  measured: boolean;
  /** 마지막으로 기록(측정·점검)한 날 */
  lastVisitDate: string;
  /** 최신 측정의 판정 */
  verdict: VerdictInfo;
  totalCollectedKg: number;
}

/** 장소별 현황 — 최근에 기록한 장소부터 */
export function summarizePiles(records: MeasurementRecord[], settings: CompostSettings): PileSummary[] {
  const byPile = new Map<string, MeasurementRecord[]>();
  for (const r of records) {
    const key = getPileKey(r);
    byPile.set(key, [...(byPile.get(key) ?? []), r]);
  }

  return [...byPile.entries()]
    .map(([key, list]) => {
      const sorted = list.sort(compareRecords);
      const measuredList = sorted.filter(hasMeasurement);
      const lastVisit = sorted[sorted.length - 1];
      const latest = measuredList[measuredList.length - 1] ?? lastVisit;
      return {
        key,
        pile: { ranchName: lastVisit.ranchName, location: lastVisit.location },
        records: measuredList,
        allRecords: sorted,
        latest,
        measured: measuredList.length > 0,
        lastVisitDate: lastVisit.date,
        verdict: evaluateRecord(latest, measuredList.slice(0, -1), settings),
        totalCollectedKg: sorted.reduce((sum, r) => sum + (r.collectedKg || 0), 0),
      };
    })
    .sort((a, b) => b.lastVisitDate.localeCompare(a.lastVisitDate) || compareRecords(b.latest, a.latest));
}

/** 날짜가 속한 주(월~일)에 하역한 커피박 합계 — 모든 장소 */
export function getWeeklyCollection(records: MeasurementRecord[], dateStr: string) {
  const { start, end } = getWeekRange(dateStr);
  const thisWeek = records.filter(r => r.date >= start && r.date <= end && r.collectedKg > 0);
  return {
    start,
    end,
    count: thisWeek.length,
    totalKg: thisWeek.reduce((sum, r) => sum + r.collectedKg, 0),
  };
}
