import { factsForAudience, type ImpactFacts, type StandardReportFacts, type FarmReportData } from './reportData';
import { withAccessCode } from './accessCode';

/**
 * AI 문장 요청 — 키는 앱에 두지 않는다.
 * 앱은 이미 쓰고 있는 Apps Script 웹 앱으로 보내고, 거기서 Gemini 를 부른다.
 * 이 파일의 함수는 사람이 버튼을 눌렀을 때만 불린다. 화면을 여는 것만으로는 AI 를 부르지 않는다.
 */

export type ReportAudience = 'farm' | 'official';

export const AUDIENCE_LABELS: Record<ReportAudience, string> = {
  farm: '목장 내부용',
  official: '대외 보고용',
};

export interface ReportSections {
  headline: string;
  summary: string;
  meaning: string;
  recommendation: string;
  actions: string[];
}

export interface StandardAiIssue {
  title: string;
  description: string;
  action: string;
}

export interface StandardAiSections {
  executiveSummary: string;
  trendCommentary: string;
  issues: StandardAiIssue[];
  nextActions: string[];
}

/** 스크립트가 알려 주는 실패 종류 (v14 부터, no_permission 은 v15 부터) */
export type AiErrorCode = 'no_key' | 'no_permission' | 'rate_limited' | 'daily_limit' | 'outdated_script' | 'failed';

export const AI_ERROR_MESSAGES: Record<Exclude<AiErrorCode, 'failed'>, string> = {
  no_key: 'AI 설명 기능이 설정되지 않았습니다.',
  no_permission:
    'Apps Script 에 외부 서비스 연결 권한이 없습니다. 편집기에서 setupAiAccess 를 한 번 실행해 허용한 뒤 새 버전으로 배포해주세요.',
  rate_limited: 'AI 서버가 혼잡합니다. 잠시 뒤 다시 시도해주세요.',
  daily_limit: '오늘 AI 설명 사용 횟수를 모두 사용했습니다.',
  outdated_script: 'AI 기능을 쓰려면 Apps Script 를 최신본(v21)으로 재배포해주세요.',
};

export interface AiUsage {
  usedToday?: number;
  dailyLimit?: number;
}

export interface AiReportResult extends AiUsage {
  success: boolean;
  /** 실패했을 때 화면에 그대로 보여줄 말 */
  message?: string;
  code?: AiErrorCode;
  sections?: ReportSections;
  model?: string;
}

const REQUEST_TIMEOUT_MS = 90_000;

export function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface AiPostResult {
  ok: boolean;
  body?: Record<string, unknown>;
  code?: AiErrorCode;
  message?: string;
  usage?: AiUsage;
}

function fail(code: AiErrorCode, message?: string, usage: AiUsage = {}): AiPostResult {
  return {
    ok: false,
    code,
    message: code === 'failed' ? message || 'AI 요청이 실패했습니다.' : AI_ERROR_MESSAGES[code],
    usage,
  };
}

function readUsage(body: Record<string, unknown>): AiUsage {
  return {
    usedToday: typeof body.usedToday === 'number' ? body.usedToday : undefined,
    dailyLimit: typeof body.dailyLimit === 'number' ? body.dailyLimit : undefined,
  };
}

/** Apps Script 로 AI 요청을 보내고, 실패는 정해진 종류로 바꿔 돌려준다 */
export async function postAiRequest(webhookUrl: string, payload: Record<string, unknown>): Promise<AiPostResult> {
  if (!webhookUrl) return fail('no_key');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Apps Script 웹 앱은 미리 요청(preflight)을 받지 못하므로 text/plain 으로 보낸다
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(withAccessCode(payload)),
      redirect: 'follow',
      signal: controller.signal,
    });

    const text = await response.text();

    if (response.status === 429) return fail('rate_limited');
    if (!response.ok) return fail('failed', `AI 요청이 실패했습니다 (HTTP ${response.status})`);
    if (/^\s*</.test(text)) {
      return fail('failed', '웹 앱이 로그인 화면을 돌려줬습니다. 배포 설정에서 [모든 사용자] 접근을 확인해주세요.');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return fail('failed', 'AI 응답을 해석할 수 없습니다. 스크립트를 최신본으로 재배포해주세요.');
    }

    if (body.status !== 'success') {
      const message = isNonEmptyText(body.message) ? body.message : '';
      const code = body.code;
      if (code === 'no_key' || code === 'no_permission' || code === 'rate_limited' || code === 'daily_limit') {
        return fail(code, undefined, readUsage(body));
      }
      // v13 이하 스크립트는 코드를 보내지 않으므로 문구로 가려낸다
      if (/처리할 수 없는 요청|알 수 없는 설명 종류/.test(message)) return fail('outdated_script');
      if (/external_request|권한이 없습니다/.test(message)) return fail('no_permission');
      if (/AI 키가 없습니다/.test(message)) return fail('no_key');
      if (/사용 횟수/.test(message)) return fail('daily_limit', undefined, readUsage(body));
      if (/바빠|혼잡/.test(message)) return fail('rate_limited');
      return fail('failed', message || 'AI 가 문장을 만들지 못했습니다.', readUsage(body));
    }

    return { ok: true, body };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return fail('failed', 'AI 응답이 너무 오래 걸립니다. 잠시 뒤 다시 시도해주세요.');
    }
    // Apps Script 가 예외로 멈추면 CORS 없는 오류 화면이 와서 여기로 떨어진다
    return fail(
      'failed',
      '통신이 되지 않아 AI 를 부르지 못했습니다. 인터넷 연결과 Apps Script 권한(setupAiAccess 실행)·배포 상태를 확인해주세요.'
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * AI 가 보낸 값을 문장으로 읽는다.
 * 모델에 따라 문장을 목록(["...", "..."])이나 객체({ text: "..." })로 보내기도 해서, 글자만 모아 잇는다.
 */
export function readAiText(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (depth > 2 || !value || typeof value !== 'object') return '';
  const parts = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return parts
    .map(part => readAiText(part, depth + 1))
    .filter(Boolean)
    .join(' ');
}

/** 목록 값 — 한 줄짜리 글이 오면 한 항목으로 본다 */
export function readAiList(value: unknown, limit: number): string[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items
    .map(item => readAiText(item))
    .filter(Boolean)
    .slice(0, limit);
}

/** 스크립트가 돌려준 문장 묶음이 쓸 만한지 확인한다 */
function parseSections(raw: unknown): ReportSections | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const summary = readAiText(value.summary);
  const meaning = readAiText(value.meaning);
  const recommendation = readAiText(value.recommendation);
  if (!summary || !meaning || !recommendation) return null;

  return {
    headline: readAiText(value.headline) || '자원순환 임팩트 리포트',
    summary,
    meaning,
    recommendation,
    actions: readAiList(value.actions, 5),
  };
}

export async function requestImpactReport(
  webhookUrl: string,
  facts: ImpactFacts,
  audience: ReportAudience
): Promise<AiReportResult> {
  // 독자마다 필요한 자료만 넘긴다 — 같은 자료를 주면 문장도 비슷해진다
  const result = await postAiRequest(webhookUrl, {
    eventType: 'ai_report',
    audience,
    facts: factsForAudience(facts, audience),
  });
  if (!result.ok || !result.body) {
    return {
      success: false,
      code: result.code || 'failed',
      message: result.message || 'AI 요청이 실패했습니다.',
      ...(result.usage || {}),
    };
  }

  const sections = parseSections(result.body.sections);
  if (!sections) {
    return {
      success: false,
      code: 'failed',
      message: 'AI 가 보낸 문장이 비어 있습니다. 다시 시도해주세요.',
      ...readUsage(result.body),
    };
  }

  return {
    success: true,
    sections,
    model: isNonEmptyText(result.body.model) ? result.body.model : undefined,
    ...readUsage(result.body),
  };
}

/* ─────────────────── 표준 월간 보고서 AI 요청 및 Fallback 생성 ─────────────────── */

export interface StandardAiReportResult extends AiUsage {
  success: boolean;
  message?: string;
  code?: AiErrorCode;
  sections?: StandardAiSections;
  model?: string;
}

/**
 * AI 없이도 즉시 고품질 보고서를 표시할 수 있도록
 * 코드에서 산출된 facts를 기반으로 표준 행정 문체 문장을 완성합니다.
 */
export function generateFallbackAiSections(facts: StandardReportFacts): StandardAiSections {
  const { period, collection, comparison, keyChanges, codeIssues, codeNextActions } = facts;
  const isPartial = period.status === 'in_progress';

  // 1. Executive Summary (2~3문장 이내)
  let executiveSummary = '';
  if (isPartial) {
    const weeklyInfo =
      comparison.weeklyComparison?.changePercent != null
        ? `전주차 대비 ${comparison.weeklyComparison.changePercent > 0 ? '+' : ''}${comparison.weeklyComparison.changePercent.toFixed(1)}% 증감을 기록하고 있습니다.`
        : '주차별 집계가 순조롭게 진행되고 있습니다.';
    executiveSummary = `${period.label} 현재까지 커피박 총 ${collection.totalKg.toLocaleString('ko-KR')}kg이 수거되었으며, 등록 ${collection.registeredStoreCount}개소 중 ${collection.activeStoreCount}개소 매장이 수거에 참여하고 있습니다. 기간 내 일평균 수거량은 ${collection.dailyAverageKg.toFixed(1)}kg/일이며, ${weeklyInfo} 현재 월 데이터는 집계 중이므로 월 마감 이후 최종 수치가 확정됩니다.`;
  } else if (comparison.hasPreviousMonth && comparison.changePercent !== null) {
    const changeSign = comparison.changePercent > 0 ? '+' : '';
    executiveSummary = `${period.label} 한 달간 총 ${collection.totalKg.toLocaleString('ko-KR')}kg의 커피박이 수거되었으며, ${collection.activeStoreCount}개소(등록 ${collection.registeredStoreCount}개소) 매장이 수거에 참여하였습니다. 일평균 수거량은 ${collection.dailyAverageKg.toFixed(1)}kg/일로 전월 대비 ${changeSign}${comparison.changePercent.toFixed(1)}%의 변동을 기록하였으며, 최다 수거 매장은 ${collection.topStore?.storeName ?? '상위 매장'}(${collection.topStore?.totalKg.toLocaleString('ko-KR') ?? 0}kg)입니다.`;
  } else {
    executiveSummary = `${period.label} 사업 개시 월 동안 총 ${collection.totalKg.toLocaleString('ko-KR')}kg의 커피박이 수거되었으며, 전체 ${collection.activeStoreCount}개 매장이 자원순환 사업에 동참하였습니다. 일평균 수거량은 ${collection.dailyAverageKg.toFixed(1)}kg/일을 기록하여 수거 네트워크의 기초 거점을 안정적으로 확보하였습니다.`;
  }

  // 2. Trend Commentary (1~2문장)
  let trendCommentary = '';
  if (keyChanges.highestWeek) {
    trendCommentary = `${keyChanges.highestWeek.weekLabel}에 가장 많은 수거량(${keyChanges.highestWeek.totalKg.toLocaleString('ko-KR')}kg, 일평균 ${keyChanges.highestWeek.dailyAverageKg.toFixed(1)}kg/일)을 기록하였습니다. 주차별 일수의 편차를 반영한 일평균 지표를 기준으로 볼 때 전반적으로 균형 잡힌 수거 흐름이 유지되었습니다.`;
  } else {
    trendCommentary = '주차별 운영 일수에 따른 일평균 수거량을 바탕으로 안정적인 수거 추이가 확인되었습니다.';
  }

  // 3. Issues (최대 3개: 이슈 -> 근거 -> 권장 행동)
  const issues: StandardAiIssue[] = codeIssues.map(item => ({
    title: item.title,
    description: item.evidence,
    action: item.action,
  }));

  // 4. Next Actions (최대 3개)
  const nextActions = [...codeNextActions];

  return {
    executiveSummary,
    trendCommentary,
    issues,
    nextActions,
  };
}

function parseStandardAiSections(raw: unknown, fallback: StandardAiSections): StandardAiSections {
  if (!raw || typeof raw !== 'object') return fallback;
  const val = raw as Record<string, unknown>;

  const execSummary = readAiText(val.executiveSummary) || readAiText(val.summary) || fallback.executiveSummary;
  const trendCommentary = readAiText(val.trendCommentary) || readAiText(val.meaning) || fallback.trendCommentary;

  let issues: StandardAiIssue[] = fallback.issues;
  if (Array.isArray(val.issues) && val.issues.length > 0) {
    issues = val.issues
      .map((item: unknown, idx: number) => {
        const itemObj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const fb = fallback.issues[idx] || fallback.issues[0];
        return {
          title: readAiText(itemObj.title) || fb.title,
          description: readAiText(itemObj.description) || readAiText(itemObj.evidence) || fb.description,
          action: readAiText(itemObj.action) || readAiText(itemObj.recommendation) || fb.action,
        };
      })
      .slice(0, 3);
  }

  let nextActions: string[] = fallback.nextActions;
  if (Array.isArray(val.nextActions) && val.nextActions.length > 0) {
    nextActions = readAiList(val.nextActions, 3);
  } else if (Array.isArray(val.actions) && val.actions.length > 0) {
    nextActions = readAiList(val.actions, 3);
  }

  return {
    executiveSummary: execSummary,
    trendCommentary,
    issues,
    nextActions,
  };
}

export async function requestStandardImpactReport(
  webhookUrl: string,
  facts: StandardReportFacts
): Promise<StandardAiReportResult> {
  const fallback = generateFallbackAiSections(facts);

  if (!webhookUrl) {
    return {
      success: true,
      sections: fallback,
      model: '규칙 기반(Offline)',
    };
  }

  const payloadFacts = {
    period: {
      year: facts.period.year,
      month: facts.period.month,
      status: facts.period.status,
      dateRange: facts.period.dateRange,
    },
    collection: {
      totalKg: facts.collection.totalKg,
      activeStores: facts.collection.activeStoreCount,
      registeredStores: facts.collection.registeredStoreCount,
      dailyAverageKg: facts.collection.dailyAverageKg,
      topStore: facts.collection.topStore,
    },
    comparison: {
      previousMonthKg: facts.comparison.previousMonthKg,
      differenceKg: facts.comparison.differenceKg,
      changePct: facts.comparison.changePercent,
      hasPreviousMonth: facts.comparison.hasPreviousMonth,
    },
    weekly: facts.weekly.map(w => ({
      week: w.weekLabel,
      range: w.dateRange,
      days: w.days,
      kg: w.totalKg,
      dailyAvg: w.dailyAverageKg,
      share: w.sharePercent,
    })),
    topStores: facts.topStores.map(s => ({
      rank: s.rank,
      name: s.storeName,
      kg: s.totalKg,
      share: s.sharePercent,
    })),
    top5SharePercent: facts.top5SharePercent,
    keyChanges: facts.keyChanges,
    issues: facts.codeIssues,
    nextActions: facts.codeNextActions,
  };

  const result = await postAiRequest(webhookUrl, {
    eventType: 'standard_ai_report',
    audience: 'official',
    facts: payloadFacts,
  });

  if (!result.ok || !result.body) {
    // API 키 부재나 호출 실패 시 fallback 문장으로 안전 반환 (100% 무중단)
    return {
      success: true,
      sections: fallback,
      message: result.message,
      model: '규칙 기반(Fallback)',
      ...(result.usage || {}),
    };
  }

  const sections = parseStandardAiSections(result.body.sections, fallback);
  return {
    success: true,
    sections,
    model: isNonEmptyText(result.body.model) ? (result.body.model as string) : 'Gemini AI',
    ...readUsage(result.body),
  };
}

/* ─────────────────── 목장 내부용 AI 설명 (온디맨드 2~4문장) ─────────────────── */

export interface FarmAiExplanationResult extends AiUsage {
  success: boolean;
  explanation: string;
  model?: string;
  message?: string;
  code?: AiErrorCode;
}

/**
 * AI 없이도 100% 매끄럽게 동작하는 2~4문장 규칙 기반 설명 문장 생성기
 */
export function generateFallbackFarmAiExplanation(data: FarmReportData): string {
  const sentences: string[] = [];

  // 1. 수분 및 온도 상태
  if (data.condition.moisture !== null && data.condition.temperature !== null) {
    const moisturePart =
      data.condition.moistureTrend === 'falling'
        ? `현재 함수율은 ${data.condition.moisture}%로 감소 추세를 보이고 있으며`
        : `현재 함수율은 ${data.condition.moisture}% 수준이며`;
    const tempPart =
      data.condition.temperatureTrend === 'stabilizing'
        ? `심부 온도(${data.condition.temperature}℃)도 안정화 방향을 유지하고 있습니다.`
        : `심부 온도는 ${data.condition.temperature}℃입니다.`;
    sentences.push(`${moisturePart} ${tempPart}`);
  } else {
    sentences.push('현재 더미의 부숙 상태 및 환경 지표가 관리 중입니다.');
  }

  // 2. 관리 및 곰팡이
  if (data.condition.moldStatus === 'partial' || data.condition.moldStatus === 'spreading') {
    sentences.push('더미에서 곰팡이가 확인되었으므로 추가 혼합을 통한 통기 작업이 시급합니다.');
  } else {
    const mixPart =
      data.management.mixingCountLast7Days >= 2
        ? `최근 7일간 혼합 작업도 ${data.management.mixingCountLast7Days}회 진행되어 관리 기준을 충족하고 있으며`
        : `최근 7일간 혼합 작업은 ${data.management.mixingCountLast7Days}회로 추가 혼합을 권장하며`;
    sentences.push(`${mixPart} 곰팡이 발견 기록은 없습니다.`);
  }

  // 3. 결론 및 다음 조치
  if (data.bedding.status === 'candidate') {
    sentences.push('더미 상태가 전반적으로 안정화되었으므로 신규 투입 전 축사 깔개로 일부 사용을 검토할 수 있습니다.');
  } else if (data.bedding.status === 'preparing') {
    sentences.push('다음 방문에서 상태를 재확인한 뒤 깔개 사용 여부를 검토하는 것이 좋습니다.');
  } else {
    sentences.push('정기적인 혼합과 수분 조절을 유지하며 부숙 경과를 지속 관찰하시기 바랍니다.');
  }

  return sentences.join(' ');
}

/**
 * 목장 내부용 AI 설명 온디맨드 요청
 * - 사용자가 [AI 설명 보기 ✦]를 눌렀을 때만 최소 facts로 호출
 * - 2~4문장 요약으로 엄격 제한
 */
export async function requestFarmAiExplanation(
  webhookUrl: string,
  data: FarmReportData
): Promise<FarmAiExplanationResult> {
  const fallback = generateFallbackFarmAiExplanation(data);

  if (!webhookUrl) {
    return {
      success: true,
      explanation: fallback,
      model: '규칙 기반(Offline)',
    };
  }

  // 최소 facts만 추림 (사용자 명세 26번 기준)
  const payloadFacts = {
    farmName: data.farm.name,
    pile: {
      currentKg: data.pile.currentKg,
      targetKg: data.pile.targetKg,
    },
    condition: {
      temperature: data.condition.temperature,
      temperatureTrend: data.condition.temperatureTrend,
      moisture: data.condition.moisture,
      moistureTrend: data.condition.moistureTrend,
      moldStatus: data.condition.moldStatus,
    },
    management: {
      mixingCountLast7Days: data.management.mixingCountLast7Days,
      daysSinceLastMixing: data.management.daysSinceLastMixing,
      visitCountLast7Days: data.management.visitCountLast7Days,
    },
    beddingStatus: data.bedding.status,
    recommendedActions: data.actions.map(a => a.title),
  };

  const result = await postAiRequest(webhookUrl, {
    eventType: 'farm_ai_explanation',
    audience: 'farm',
    facts: payloadFacts,
  });

  if (!result.ok || !result.body) {
    return {
      success: true,
      explanation: fallback,
      message: result.message,
      model: '규칙 기반(Fallback)',
      ...(result.usage || {}),
    };
  }

  const rawText = readAiText(
    (result.body.sections as Record<string, unknown>)?.summary ||
      (result.body.sections as Record<string, unknown>)?.meaning ||
      result.body.explanation ||
      result.body.text
  );

  return {
    success: true,
    explanation: rawText || fallback,
    model: isNonEmptyText(result.body.model) ? (result.body.model as string) : 'Gemini AI',
    ...readUsage(result.body),
  };
}
