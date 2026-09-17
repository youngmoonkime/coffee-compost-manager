import type { CompostSettings, MeasurementRecord } from '../types';
import type { SourceKind } from '../components/ui/SourceBadge';
import { FIELD_OPS } from '../constants/fieldOps';
import { daysBetween } from './calculations';
import {
  getAddedKg,
  MOISTURE_TREND_LABELS,
  MOLD_LABELS,
  TEMP_TREND_LABELS,
  type CycleStatus,
} from './fieldOps';

/**
 * AI 현장 어시스턴트의 빠른 실행 카드(깔개 판단·이상 신호, 신규 목장 검토) — 전부 코드로 셈한다.
 *
 * 숫자와 판정은 여기서 정하고, AI 는 사람이 [AI 설명 보기]를 눌렀을 때
 * 여기서 만든 facts 를 문장으로 바꾸기만 한다. AI 가 없어도 모든 카드가 동작해야 한다.
 */

export type SignalLevel = 'ok' | 'caution' | 'alert' | 'unknown';

function kg(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}kg`;
}

function daysAgo(days: number | null): string {
  if (days === null) return '기록 없음';
  return days === 0 ? '오늘' : `${days}일 전`;
}

function signed(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`;
}

function measuredRecords(status: CycleStatus): MeasurementRecord[] {
  return status.records.filter(r => r.moisture > 0 || r.coreTemp > 0);
}

function lastInput(status: CycleStatus): MeasurementRecord | null {
  return [...status.records].reverse().find(r => getAddedKg(r) > 0) ?? null;
}

function moldText(status: CycleStatus): string {
  if (!status.moldStatus) return '기록 없음';
  return status.moldStatus === 'none' ? '발견 없음' : MOLD_LABELS[status.moldStatus];
}

function pileText(status: CycleStatus): string {
  if (!status.targetPileKg) return `${kg(status.currentPileKg)} (목표량 미설정)`;
  return `${kg(status.currentPileKg)} / 목표 ${kg(status.targetPileKg)} (${status.progressPercent}%)`;
}

/* ───────────────────────── 깔개 투입 판단 ───────────────────────── */

export type BeddingDecisionKey = 'accumulating' | 'managing' | 'preparing' | 'candidate' | 'hold' | 'insufficient';

export const BEDDING_DECISION_LABELS: Record<BeddingDecisionKey, string> = {
  accumulating: '축적 중',
  managing: '관리 중',
  preparing: '사용 준비',
  candidate: '사용 후보',
  hold: '사용 보류',
  insufficient: '데이터 부족',
};

export interface BeddingDecision {
  key: BeddingDecisionKey;
  label: string;
  /** 판정 이유 한 줄 (코드 템플릿) */
  reason: string;
  nextAction: string;
  /** 판정에 필요한데 빠진 자료 */
  missing: string[];
}

export function decideBedding(status: CycleStatus): BeddingDecision {
  const measured = measuredRecords(status);
  const lastVisitStale =
    status.daysSinceLastVisit !== null && status.daysSinceLastVisit >= FIELD_OPS.visitOverdueDays;

  const missing: string[] = [];
  if (!status.latest) missing.push('현장 기록이 없습니다.');
  if (status.latest && measured.length === 0) missing.push('심부 온도·함수율 측정이 없습니다.');
  if (status.latest && status.moldStatus === null) missing.push('곰팡이 상태 기록이 없습니다.');
  if (!status.targetPileKg) missing.push('목장별 깔개 목표량이 설정되지 않았습니다.');

  const build = (key: BeddingDecisionKey, reason: string, nextAction: string): BeddingDecision => ({
    key,
    label: BEDDING_DECISION_LABELS[key],
    reason,
    nextAction,
    missing,
  });

  if (!status.latest) {
    return build('insufficient', '아직 현장 기록이 없습니다.', '현장 점검을 먼저 저장해주세요.');
  }

  // 곰팡이·과열·과습·혼합 밀림은 다른 조건보다 먼저 본다 (코드 판정 그대로)
  if (status.stage === 'hold' || status.stage === 'attention') {
    const mold = status.moldStatus === 'some' || status.moldStatus === 'spreading';
    const overLimit = status.stage === 'attention' && /심부 온도|함수율이/.test(status.stageReason);
    const next = mold
      ? '바로 혼합(삽으로 뒤집기)하고 다음 방문에서 곰팡이를 다시 확인해주세요.'
      : overLimit
        ? '혼합(삽으로 뒤집기)으로 열과 수분을 빼고 다음 방문에서 다시 측정해주세요.'
        : status.stage === 'attention'
          ? '다음 방문 시 더미 상태를 확인하고 혼합해주세요.'
          : '다음 현장 점검에서 빠진 항목을 기록해주세요.';
    return build('hold', status.stageReason, next);
  }

  if (measured.length === 0) {
    return build(
      'insufficient',
      '심부 온도·함수율 측정이 없어 판정할 수 없습니다.',
      '현장 점검에서 심부 3지점 온도·함수율을 측정해주세요.'
    );
  }

  // 목표량이 없는 것은 오류가 아니다 — 상태로 판정하고(사용 후보는 되지 않음), 목표량 설정을 권한다
  if (!status.targetPileKg) {
    return build(status.stage === 'accumulating' ? 'accumulating' : 'managing', status.stageReason, '설정에서 목장별 깔개 목표량을 정해주세요.');
  }

  switch (status.stage) {
    case 'candidate':
      return build(
        'candidate',
        status.stageReason,
        lastVisitStale
          ? `마지막 점검이 ${status.daysSinceLastVisit}일 전입니다. 다시 측정한 뒤 깔개 사용을 정해주세요.`
          : '더미 상태를 눈으로 확인한 뒤 일부를 깔개로 써보세요.'
      );
    case 'preparing':
      return build('preparing', status.stageReason, '다음 신규 투입 전에 상태를 다시 측정해주세요.');
    case 'accumulating':
      return build(
        'accumulating',
        status.stageReason,
        `커피박을 계속 모으면서 주 ${FIELD_OPS.mixingWeeklyMin}~${FIELD_OPS.mixingWeeklyMax}회 혼합해주세요.`
      );
    default:
      return build(
        'managing',
        status.stageReason,
        `주 ${FIELD_OPS.mixingWeeklyMin}~${FIELD_OPS.mixingWeeklyMax}회 혼합하고, 방문 때마다 온도·함수율을 측정해주세요.`
      );
  }
}

/* ───────────────────────── 이상 신호 점검 ───────────────────────── */

export interface SignalCheck {
  key: string;
  title: string;
  level: SignalLevel;
  value: string;
  source: SourceKind;
  /** 주의·경고일 때만 */
  advice?: string;
  /** 직전 측정 대비 변화 (예: '직전 대비 +8%p') */
  change?: string;
}

export interface SignalReport {
  checks: SignalCheck[];
  cautionCount: number;
  alertCount: number;
  summary: string;
}

export function detectSignals(status: CycleStatus, settings: CompostSettings, today: string): SignalReport {
  const checks: SignalCheck[] = [];
  const measured = measuredRecords(status);
  const last = measured[measured.length - 1] ?? null;
  const prev = measured[measured.length - 2] ?? null;

  // 1·2. 곰팡이
  checks.push(
    status.moldStatus === 'spreading'
      ? {
          key: 'mold',
          title: '곰팡이',
          level: 'alert',
          value: '확산 중',
          source: 'measured',
          advice: '즉시 혼합하고 다음 방문에서 상태를 다시 확인해주세요. 깔개 사용은 보류합니다.',
        }
      : status.moldStatus === 'some'
        ? {
            key: 'mold',
            title: '곰팡이',
            level: 'caution',
            value: '일부 발견',
            source: 'measured',
            advice: '혼합 후 다음 방문에서 퍼졌는지 확인해주세요.',
          }
        : {
            key: 'mold',
            title: '곰팡이',
            level: status.moldStatus === 'none' ? 'ok' : 'unknown',
            value: moldText(status),
            source: 'measured',
          }
  );

  // 3. 혼합 횟수
  const mixingValue = `최근 ${FIELD_OPS.mixingWindowDays}일 ${status.mixingCountLast7Days}회`;
  checks.push({
    key: 'mixing',
    title: '혼합 관리',
    level:
      status.mixingLevel === 'none'
        ? 'alert'
        : status.mixingLevel === 'low'
          ? 'caution'
          : status.mixingLevel === 'ok'
            ? 'ok'
            : 'unknown',
    value: status.mixingLevel === 'unknown' ? '혼합 기록 없음' : mixingValue,
    source: 'computed',
    advice:
      status.mixingLevel === 'none' || status.mixingLevel === 'low'
        ? '다음 방문 시 더미 상태를 확인하고 혼합해주세요.'
        : undefined,
  });

  // 4. 마지막 혼합 후 경과
  const mixStale =
    status.daysSinceLastMixing !== null && status.daysSinceLastMixing >= FIELD_OPS.mixingStaleDays;
  checks.push({
    key: 'mixing_gap',
    title: '마지막 혼합 후',
    level: status.daysSinceLastMixing === null ? 'unknown' : mixStale ? 'caution' : 'ok',
    value: daysAgo(status.daysSinceLastMixing),
    source: 'computed',
    advice: mixStale ? '곰팡이 예방을 위해 기존 커피박을 삽으로 한 번씩 뒤집어주세요.' : undefined,
  });

  // 5·6. 함수율·온도 급상승 (직전 측정 대비)
  const lastHadInput = last ? getAddedKg(last) > 0 : false;
  const inputNote = lastHadInput ? ' 같은 날 신규 투입이 있어 그 영향일 수 있습니다.' : '';
  if (last && prev) {
    const moistureDelta = last.moisture - prev.moisture;
    const overMoisture = last.moisture > settings.highMoistureThreshold;
    const moistureJump = moistureDelta >= FIELD_OPS.moistureJumpPoint;
    checks.push({
      key: 'moisture_jump',
      title: '함수율 변화',
      level: overMoisture ? 'alert' : moistureJump ? 'caution' : 'ok',
      value: `${last.moisture}% (직전 대비 ${signed(moistureDelta, '%p')})`,
      change: `직전 대비 ${signed(moistureDelta, '%p')}`,
      source: 'computed',
      advice: overMoisture
        ? `기준(${settings.highMoistureThreshold}%)을 넘었습니다. 혼합 횟수를 늘려 수분을 날려주세요.`
        : moistureJump
          ? `직전보다 ${FIELD_OPS.moistureJumpPoint}%p 이상 올랐습니다. 침출수·빗물 유입을 확인해주세요.${inputNote}`
          : undefined,
    });

    const tempDelta = last.coreTemp - prev.coreTemp;
    const overTemp = last.coreTemp > settings.highTempThreshold;
    const tempJump = tempDelta >= FIELD_OPS.tempJumpDeg;
    checks.push({
      key: 'temp_jump',
      title: '온도 변화',
      level: overTemp ? 'alert' : tempJump ? 'caution' : 'ok',
      value: overTemp || tempJump ? `${last.coreTemp}℃ (직전 대비 ${signed(tempDelta, '℃')})` : '특이 변화 없음',
      change: `직전 대비 ${signed(tempDelta, '℃')}`,
      source: 'computed',
      advice: overTemp
        ? `기준(${settings.highTempThreshold}℃)을 넘었습니다. 혼합으로 열을 빼주세요.`
        : tempJump
          ? `직전보다 ${FIELD_OPS.tempJumpDeg}℃ 이상 올랐습니다. 다음 방문에서 다시 측정해주세요.${inputNote}`
          : undefined,
    });
  } else {
    checks.push(
      { key: 'moisture_jump', title: '함수율 변화', level: 'unknown', value: '비교할 측정이 2건 미만', source: 'computed' },
      { key: 'temp_jump', title: '온도 변화', level: 'unknown', value: '비교할 측정이 2건 미만', source: 'computed' }
    );
  }

  // 7. 최근 방문 기록
  const visitDays = status.daysSinceLastVisit;
  checks.push({
    key: 'visit',
    title: '최근 방문',
    level:
      visitDays === null
        ? 'alert'
        : visitDays >= FIELD_OPS.visitOverdueDays
          ? 'alert'
          : visitDays >= FIELD_OPS.visitIntervalDays
            ? 'caution'
            : 'ok',
    value: daysAgo(visitDays),
    source: 'computed',
    advice:
      visitDays === null || visitDays >= FIELD_OPS.visitIntervalDays
        ? '현장 점검을 기록해주세요.'
        : undefined,
  });

  // 8. 신규 투입 이후 이상 변화
  const input = lastInput(status);
  const inputRecent = input ? daysBetween(input.date, today) <= FIELD_OPS.recentInputDays : false;
  if (input && inputRecent) {
    const before = measured.filter(r => r.date < input.date).pop() ?? null;
    const after = measured.filter(r => r.date >= input.date).pop() ?? null;
    if (before && after) {
      const dm = after.moisture - before.moisture;
      const dt = after.coreTemp - before.coreTemp;
      const over = after.moisture > settings.highMoistureThreshold || after.coreTemp > settings.highTempThreshold;
      const jump = dm >= FIELD_OPS.moistureJumpPoint || dt >= FIELD_OPS.tempJumpDeg;
      checks.push({
        key: 'after_input',
        title: '신규 투입 이후',
        level: over ? 'alert' : jump ? 'caution' : 'ok',
        value: `${input.date} 투입 후 함수율 ${signed(dm, '%p')} · 온도 ${signed(dt, '℃')}`,
        source: 'computed',
        advice:
          over || jump
            ? '새 커피박이 섞이며 값이 올랐을 수 있습니다. 혼합 후 다음 방문에서 다시 측정해주세요.'
            : undefined,
      });
    } else {
      checks.push({
        key: 'after_input',
        title: '신규 투입 이후',
        level: 'unknown',
        value: `${input.date} 투입 · 앞뒤 비교할 측정 없음`,
        source: 'computed',
      });
    }
  } else {
    checks.push({
      key: 'after_input',
      title: '신규 투입 이후',
      level: 'ok',
      value: `최근 ${FIELD_OPS.recentInputDays}일 투입 없음`,
      source: 'computed',
    });
  }

  const cautionCount = checks.filter(c => c.level === 'caution').length;
  const alertCount = checks.filter(c => c.level === 'alert').length;
  const summary =
    alertCount + cautionCount === 0
      ? '이상 신호 없음'
      : [alertCount ? `경고 ${alertCount}건` : '', cautionCount ? `주의 ${cautionCount}건` : '']
          .filter(Boolean)
          .join(' · ');

  // 경고 → 주의 → 기록 없음 → 정상 순으로 보여 준다
  const order: Record<SignalLevel, number> = { alert: 0, caution: 1, unknown: 2, ok: 3 };
  checks.sort((a, b) => order[a.level] - order[b.level]);

  return { checks, cautionCount, alertCount, summary };
}

/* ───────────────────────── 깔개 판단 · 이상 신호 (한 카드) ───────────────────────── */

/** 판정 근거와 이상 신호를 한 줄에 합친 항목 */
export interface FieldCheckRow {
  label: string;
  value: string;
  sources: SourceKind[];
  /** 신호를 따지지 않는 항목(더미량)은 비워 둔다 */
  level?: SignalLevel;
  advice?: string;
}

export interface FieldCheck {
  decision: BeddingDecision;
  signals: SignalReport;
  rows: FieldCheckRow[];
}

const LEVEL_RANK: Record<SignalLevel, number> = { ok: 0, unknown: 1, caution: 2, alert: 3 };

function worst(...checks: (SignalCheck | undefined)[]): SignalCheck | undefined {
  let top: SignalCheck | undefined;
  for (const c of checks) if (c && (!top || LEVEL_RANK[c.level] > LEVEL_RANK[top.level])) top = c;
  return top;
}

export function buildFieldCheck(status: CycleStatus, settings: CompostSettings, today: string): FieldCheck {
  const decision = decideBedding(status);
  const signals = detectSignals(status, settings, today);
  const find = (key: string) => signals.checks.find(c => c.key === key);

  const moistureJump = find('moisture_jump');
  const tempJump = find('temp_jump');
  const mixing = find('mixing');
  const mixingGap = find('mixing_gap');
  const mold = find('mold');
  const visit = find('visit');
  const afterInput = find('after_input');

  // 기준을 넘거나 급상승했을 때만 '직전 대비'를 붙이고, 평소에는 추세만 보여 준다
  const jumpText = (check?: SignalCheck) =>
    check?.change && (check.level === 'caution' || check.level === 'alert') ? ` · ${check.change}` : '';

  const rows: FieldCheckRow[] = [
    { label: '현재 추정 더미량', value: pileText(status), sources: ['computed'] },
    {
      label: '함수율',
      value:
        status.moisture !== null
          ? `${status.moisture}% · ${MOISTURE_TREND_LABELS[status.moistureTrend]}${jumpText(moistureJump)}`
          : '측정 없음',
      sources: ['measured', 'computed'],
      level: status.moisture !== null ? moistureJump?.level : 'unknown',
      advice: moistureJump?.advice,
    },
    {
      label: '심부 온도',
      value:
        status.coreTemp !== null
          ? `${status.coreTemp}℃ · ${TEMP_TREND_LABELS[status.tempTrend]}${jumpText(tempJump)}`
          : '측정 없음',
      sources: ['measured', 'computed'],
      level: status.coreTemp !== null ? tempJump?.level : 'unknown',
      advice: tempJump?.advice,
    },
    {
      label: '혼합',
      value:
        status.mixingLevel === 'unknown'
          ? '기록 없음'
          : `최근 ${FIELD_OPS.mixingWindowDays}일 ${status.mixingCountLast7Days}회 · 마지막 ${daysAgo(status.daysSinceLastMixing)}`,
      sources: ['computed'],
      level: worst(mixing, mixingGap)?.level,
      advice: mixing?.advice ?? mixingGap?.advice,
    },
    { label: '곰팡이', value: moldText(status), sources: ['measured'], level: mold?.level, advice: mold?.advice },
    {
      label: '최근 현장 점검',
      value: daysAgo(status.daysSinceLastVisit),
      sources: ['computed'],
      level: visit?.level,
      advice: visit?.advice,
    },
    {
      label: '신규 투입 이후',
      value: afterInput?.value ?? '—',
      sources: ['computed'],
      level: afterInput?.level,
      advice: afterInput?.advice,
    },
  ];

  return { decision, signals, rows };
}

/* ───────────────────────── 신규 목장 적용 검토 ───────────────────────── */

export interface FarmQuestion {
  key: keyof FarmAnswers;
  question: string;
  options: { value: string; label: string }[];
}

export interface FarmAnswers {
  pileMode: 'single' | 'batch' | 'undecided';
  visitCapacity: 'three' | 'two' | 'one';
  mixingTool: 'loader' | 'shovel' | 'none';
  probe: 'both' | 'temp' | 'none';
  cover: 'roof' | 'tarp' | 'none';
  beddingUse: 'regular' | 'occasional' | 'undecided';
}

export const FARM_QUESTIONS: FarmQuestion[] = [
  {
    key: 'pileMode',
    question: '커피박을 어떻게 쌓을 계획인가요?',
    options: [
      { value: 'single', label: '한 구역에 계속 모아 섞기' },
      { value: 'batch', label: '들어온 순서대로 구역을 나눠 쌓기' },
      { value: 'undecided', label: '아직 정하지 않음' },
    ],
  },
  {
    key: 'visitCapacity',
    question: '관리자가 일주일에 몇 번 둘러볼 수 있나요?',
    options: [
      { value: 'three', label: '주 3회 이상' },
      { value: 'two', label: '주 2회' },
      { value: 'one', label: '주 1회 이하' },
    ],
  },
  {
    key: 'mixingTool',
    question: '혼합(뒤집기)은 무엇으로 하나요?',
    options: [
      { value: 'loader', label: '로더·장비' },
      { value: 'shovel', label: '삽 (사람)' },
      { value: 'none', label: '수단 없음' },
    ],
  },
  {
    key: 'probe',
    question: '온도계·함수율계가 있나요?',
    options: [
      { value: 'both', label: '둘 다 있음' },
      { value: 'temp', label: '온도계만' },
      { value: 'none', label: '없음' },
    ],
  },
  {
    key: 'cover',
    question: '비·눈을 막을 시설이 있나요?',
    options: [
      { value: 'roof', label: '지붕 있음' },
      { value: 'tarp', label: '덮개(차수막)만' },
      { value: 'none', label: '없음' },
    ],
  },
  {
    key: 'beddingUse',
    question: '다 된 커피박을 깔개로 어떻게 쓸 계획인가요?',
    options: [
      { value: 'regular', label: '정기적으로 사용' },
      { value: 'occasional', label: '필요할 때 사용' },
      { value: 'undecided', label: '아직 미정' },
    ],
  },
];

export interface FarmDiagnosis {
  operationType: string;
  managementLevel: string;
  recommendations: string[];
  measurements: string[];
  gaps: string[];
}

export function diagnoseFarm(answers: FarmAnswers): FarmDiagnosis {
  const operationType =
    answers.pileMode === 'single'
      ? '단일 더미 연속혼합형'
      : answers.pileMode === 'batch'
        ? '구획별 순차 부숙형'
        : '운영 방식 미정 (단일 더미 연속혼합형 권장)';

  const gaps: string[] = [];
  if (answers.visitCapacity === 'one') {
    gaps.push(`방문이 주 1회 이하라 혼합·점검 주기(주 ${FIELD_OPS.mixingWeeklyMin}~${FIELD_OPS.mixingWeeklyMax}회)를 맞추기 어렵습니다.`);
  }
  if (answers.mixingTool === 'none') gaps.push('혼합(뒤집기) 수단이 없습니다. 삽이라도 준비해주세요.');
  if (answers.probe === 'none') gaps.push('심부 온도계와 함수율계가 필요합니다.');
  if (answers.probe === 'temp') gaps.push('함수율계가 필요합니다. 깔개 사용 판단에 함수율이 꼭 들어갑니다.');
  if (answers.cover === 'none') gaps.push('비·눈을 막을 지붕이나 덮개가 필요합니다. 빗물이 들면 함수율이 급히 오릅니다.');

  const managementLevel =
    gaps.length === 0
      ? '표준형'
      : gaps.length <= 2
        ? '보완 필요형'
        : '준비 단계';

  const recommendations = [
    `주 ${FIELD_OPS.mixingWeeklyMin}~${FIELD_OPS.mixingWeeklyMax}회 방문`,
    '온도·함수율 측정 (같은 높이 30cm 간격 3지점)',
    '곰팡이 확인 (색상·사진)',
    `정기 혼합 (주 ${FIELD_OPS.mixingWeeklyMin}~${FIELD_OPS.mixingWeeklyMax}회, 삽으로 한 번씩 뒤집기)`,
  ];
  if (answers.mixingTool === 'loader') recommendations.push('장비로 혼합할 때 더미 전체를 고르게 뒤집기');
  if (answers.pileMode === 'batch') recommendations.push('구획마다 투입일을 표시해 두기');
  if (answers.beddingUse === 'regular') recommendations.push('깔개로 쓸 목표량을 정하고 사용량 기록하기');

  const measurements = ['심부 온도 3지점', '심부 함수율 3지점', '곰팡이 유무·색상', '혼합 여부', '신규 투입량(kg)'];
  if (answers.cover !== 'roof') measurements.push('외기 온도·습도');
  if (answers.beddingUse !== 'undecided') measurements.push('깔개 사용량·사용처');

  return { operationType, managementLevel, recommendations, measurements, gaps };
}

export function farmAnswerLabels(answers: FarmAnswers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of FARM_QUESTIONS) {
    out[q.question] = q.options.find(o => o.value === answers[q.key])?.label ?? '';
  }
  return out;
}

/* ───────────────────────── AI 설명에 넘길 최소 facts ───────────────────────── */

/** 시간 순서가 필요할 때만 최근 측정 몇 건 */
const RECENT_MEASUREMENTS = 4;

function recentMeasurements(status: CycleStatus) {
  return measuredRecords(status)
    .slice(-RECENT_MEASUREMENTS)
    .map(r => ({
      date: r.date,
      temp: r.coreTemp,
      moisture: r.moisture,
      addedKg: getAddedKg(r) || undefined,
    }));
}

/** 깔개 판정 + 주의·경고 신호만 — 원본 기록은 넘기지 않는다 */
export function fieldExplainFacts(status: CycleStatus, check: FieldCheck) {
  const { decision, signals } = check;
  const measured = measuredRecords(status);
  const prev = measured[measured.length - 2] ?? null;
  return {
    ranchName: status.ranchName,
    status: decision.key,
    statusLabel: decision.label,
    statusReason: decision.reason,
    nextAction: decision.nextAction,
    currentPileKg: status.currentPileKg,
    targetPileKg: status.targetPileKg,
    progressPercent: status.progressPercent,
    currentMoisture: status.moisture,
    previousMoisture: prev ? prev.moisture : null,
    moistureTrend: status.moistureTrend,
    currentCoreTemp: status.coreTemp,
    temperatureTrend: status.tempTrend === 'decreasing' ? 'stabilizing' : status.tempTrend,
    mixingCountLast7Days: status.mixingCountLast7Days,
    daysSinceLastMixing: status.daysSinceLastMixing,
    moldStatus: status.moldStatus ?? 'unknown',
    daysSinceLastVisit: status.daysSinceLastVisit,
    missing: decision.missing,
    signalSummary: signals.summary,
    signals: signals.checks
      .filter(c => c.level === 'caution' || c.level === 'alert')
      .map(c => ({ item: c.title, level: c.level, value: c.value })),
    recentMeasurements: recentMeasurements(status),
  };
}

export function farmExplainFacts(answers: FarmAnswers, diagnosis: FarmDiagnosis) {
  return {
    answers: farmAnswerLabels(answers),
    ...diagnosis,
  };
}

/** 같은 자료면 같은 캐시 키 — 최신 기록이 바뀌면 키도 바뀐다 */
export function latestRecordKey(status: CycleStatus): string {
  const latest = status.latest;
  return latest ? `${latest.id}@${latest.date} ${latest.time}` : 'none';
}
