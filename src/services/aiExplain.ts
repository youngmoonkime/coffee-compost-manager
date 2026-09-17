import { getStorageItem, setStorageItem } from '../utils/storage';
import { getAccessCode } from './accessCode';
import { isNonEmptyText, postAiRequest, readAiList, readAiText, type AiErrorCode, type AiUsage } from './aiReport';

/**
 * [AI 설명 보기 ✦] — 코드가 이미 정한 결과를 짧은 문장으로 풀어 달라고 할 때만 쓴다.
 *
 * - 사람이 버튼을 눌렀을 때만 부른다.
 * - 넘기는 것은 코드가 셈한 최소 facts 뿐이다 (시트 원본 기록은 보내지 않는다).
 * - 같은 자료로 다시 누르면 저장해 둔 설명을 그대로 보여 준다.
 */

/** field = 깔개 사용 판단 + 이상 신호 (한 카드), farm = 신규 목장 진단 */
export type ExplainKind = 'field' | 'farm';

export interface Explanation {
  summary: string;
  actions: string[];
  model?: string;
  createdAt: string;
}

export interface ExplainResult {
  success: boolean;
  explanation?: Explanation;
  /** 저장해 둔 설명을 다시 쓴 것인지 (AI 를 부르지 않았다) */
  fromCache?: boolean;
  code?: AiErrorCode;
  message?: string;
  usage?: AiUsage;
}

/** 이보다 긴 facts 는 보내지 않는다 — 입력 토큰을 줄이기 위해 */
export const MAX_EXPLAIN_FACTS_CHARS = 3000;

/* ───────────── 캐시 ───────────── */

const CACHE_KEY = 'ai_explain_cache';

interface CacheEntry {
  key: string;
  explanation: Explanation;
}

/** 카드·목장마다 마지막 설명 하나만 둔다. 자료가 바뀌면 키가 달라져 새로 받는다. */
type CacheStore = Record<string, CacheEntry>;

/** 짧은 해시 (djb2) — 캐시 키 비교용 */
export function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function makeCacheKey(kind: ExplainKind, dataKey: string, facts: unknown): string {
  return `${kind}|${dataKey}|${hashText(JSON.stringify(facts))}`;
}

export function readCachedExplanation(slot: string, cacheKey: string): Explanation | null {
  const entry = getStorageItem<CacheStore>(CACHE_KEY, {})[slot];
  return entry && entry.key === cacheKey ? entry.explanation : null;
}

function writeCachedExplanation(slot: string, cacheKey: string, explanation: Explanation): void {
  const store = getStorageItem<CacheStore>(CACHE_KEY, {});
  store[slot] = { key: cacheKey, explanation };
  setStorageItem(CACHE_KEY, store);
}

/* ───────────── 요청 ───────────── */

function parseExplanation(raw: unknown, model: unknown): Explanation | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const summary = readAiText(value.summary);
  if (!summary) return null;
  return {
    summary,
    actions: readAiList(value.actions, 3),
    model: isNonEmptyText(model) ? model : undefined,
    createdAt: new Date().toISOString(),
  };
}

interface ExplainInput {
  webhookUrl: string;
  kind: ExplainKind;
  /** 캐시 칸 — 예: 'field:건준목장' */
  slot: string;
  /** 자료가 바뀌었는지 가르는 값 — 예: 최신 기록 키 */
  dataKey: string;
  facts: Record<string, unknown>;
  /** true 면 캐시를 건너뛰고 새로 받는다 */
  refresh?: boolean;
}

export async function requestExplanation({
  webhookUrl,
  kind,
  slot,
  dataKey,
  facts,
  refresh = false,
}: ExplainInput): Promise<ExplainResult> {
  const cacheKey = makeCacheKey(kind, dataKey, facts);
  if (!refresh) {
    const cached = readCachedExplanation(slot, cacheKey);
    if (cached) return { success: true, explanation: cached, fromCache: true };
  }

  if (JSON.stringify(facts).length > MAX_EXPLAIN_FACTS_CHARS) {
    return { success: false, code: 'failed', message: '설명에 넘길 자료가 너무 큽니다.' };
  }

  const result = await postAiRequest(webhookUrl, { eventType: 'ai_explain', kind, facts });
  if (!result.ok || !result.body) {
    return { success: false, code: result.code, message: result.message, usage: result.usage };
  }

  const explanation = parseExplanation(result.body.explanation, result.body.model);
  if (!explanation) {
    return { success: false, code: 'failed', message: 'AI 가 보낸 설명이 비어 있습니다.' };
  }

  writeCachedExplanation(slot, cacheKey, explanation);
  return {
    success: true,
    explanation,
    fromCache: false,
    usage: {
      usedToday: typeof result.body.usedToday === 'number' ? result.body.usedToday : undefined,
      dailyLimit: typeof result.body.dailyLimit === 'number' ? result.body.dailyLimit : undefined,
    },
  };
}

/* ───────────── 사용량 확인 (관리 화면용, AI 를 부르지 않는다) ───────────── */

export interface AiUsageStatus {
  success: boolean;
  message?: string;
  usedToday?: number;
  dailyLimit?: number;
  model?: string;
  keyConfigured?: boolean;
}

export async function fetchAiUsage(webhookUrl: string): Promise<AiUsageStatus> {
  if (!webhookUrl) return { success: false, message: '부숙관리 시트 주소가 없습니다.' };
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('action', 'ai_usage');
    const code = getAccessCode();
    if (code) url.searchParams.set('code', code);
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const body = (await response.json()) as Record<string, unknown>;
    if (body.status !== 'success' || typeof body.dailyLimit !== 'number') {
      return { success: false, message: 'AI 사용량을 확인하려면 Apps Script 를 최신본(v20)으로 재배포해주세요.' };
    }
    return {
      success: true,
      usedToday: Number(body.usedToday) || 0,
      dailyLimit: body.dailyLimit,
      model: isNonEmptyText(body.model) ? body.model : undefined,
      keyConfigured: body.keyConfigured === true,
    };
  } catch {
    return { success: false, message: 'AI 사용량을 불러오지 못했습니다.' };
  }
}
