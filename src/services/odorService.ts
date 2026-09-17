import { appendAccessCode, withAccessCode } from './accessCode';
import { getStorageItem, setStorageItem } from '../utils/storage';

/**
 * 악취 측정 기록 — 부숙관리 시트의 "악취측정" 탭 (Apps Script v22 이상).
 * 회사 관리자만 읽고 쓴다. 인터넷이 안 될 때를 위해 마지막으로 받은 목록을 기기에 둔다.
 */

export type OdorGas = 'NH3' | 'H2S' | 'OU';

export interface OdorMeasurement {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  ranchName: string;
  location: string;
  gas: OdorGas;
  /** 커피박 깔짚 사용 전 */
  before: number;
  /** 사용 후 */
  after: number;
  bedding: string;
  method: string;
  notes: string;
}

export const ODOR_GAS_META: Record<OdorGas, { label: string; unit: string }> = {
  NH3: { label: '암모니아(NH₃)', unit: 'ppm' },
  H2S: { label: '황화수소(H₂S)', unit: 'ppm' },
  OU: { label: '복합악취', unit: '희석배수' },
};

/** 앱이 필요로 하는 스크립트 판 */
export const ODOR_SCRIPT_VERSION = 22;

export type OdorLoadResult =
  | { ok: true; items: OdorMeasurement[] }
  | { ok: false; reason: 'outdated' | 'denied' | 'offline' | 'failed'; message: string; cached: OdorMeasurement[] };

export type OdorSaveResult = { ok: true; message: string } | { ok: false; message: string };

const CACHE_KEY = 'odor_measurements';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OUTDATED_MESSAGE = `악취 측정 기록을 쓰려면 Apps Script 를 v${ODOR_SCRIPT_VERSION} 으로 새 버전 배포해주세요.`;

/** 저감률(%) — 사용 전보다 늘었으면 음수 */
export function odorReduction(m: Pick<OdorMeasurement, 'before' | 'after'>): number {
  return m.before > 0 ? Math.round(((m.before - m.after) / m.before) * 1000) / 10 : 0;
}

export function newOdorId(): string {
  return `odor-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function readCachedOdor(): OdorMeasurement[] {
  const list = getStorageItem<OdorMeasurement[]>(CACHE_KEY, []);
  return Array.isArray(list) ? list.filter(isMeasurement) : [];
}

function isMeasurement(v: unknown): v is OdorMeasurement {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.date === 'string' &&
    DATE_RE.test(m.date) &&
    typeof m.gas === 'string' &&
    m.gas in ODOR_GAS_META &&
    typeof m.before === 'number' &&
    m.before > 0 &&
    typeof m.after === 'number' &&
    m.after >= 0
  );
}

function toMeasurement(raw: Record<string, unknown>): OdorMeasurement | null {
  const m = {
    id: String(raw.id ?? ''),
    date: String(raw.date ?? ''),
    ranchName: String(raw.ranchName ?? '').trim(),
    location: String(raw.location ?? ''),
    gas: String(raw.gas ?? '') as OdorGas,
    before: Number(raw.before),
    after: Number(raw.after),
    bedding: String(raw.bedding ?? ''),
    method: String(raw.method ?? ''),
    notes: String(raw.notes ?? ''),
  };
  return isMeasurement(m) ? m : null;
}

export async function loadOdorMeasurements(webhookUrl: string): Promise<OdorLoadResult> {
  const cached = readCachedOdor();
  if (!webhookUrl) return { ok: false, reason: 'failed', message: '부숙관리 시트 주소가 없습니다.', cached };
  try {
    const url = appendAccessCode(`${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=odor_load`);
    const res = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const body = (await res.json()) as Record<string, unknown>;
    if (body.status === 'error') {
      return body.code === 'forbidden'
        ? { ok: false, reason: 'denied', message: '회사 관리자만 볼 수 있습니다.', cached }
        : { ok: false, reason: 'failed', message: String(body.message || '악취 측정 기록을 읽지 못했습니다.'), cached };
    }
    // v21 이하는 이 요청을 모르고 연결 확인 응답만 돌려준다
    if (!Array.isArray(body.measurements) || Number(body.scriptVersion) < ODOR_SCRIPT_VERSION) {
      return { ok: false, reason: 'outdated', message: OUTDATED_MESSAGE, cached };
    }
    const items = body.measurements
      .map(item => (item && typeof item === 'object' ? toMeasurement(item as Record<string, unknown>) : null))
      .filter((m): m is OdorMeasurement => m !== null);
    setStorageItem(CACHE_KEY, items);
    return { ok: true, items };
  } catch {
    return { ok: false, reason: 'offline', message: '인터넷에 연결되지 않아 저장된 목록을 보여 드립니다.', cached };
  }
}

async function post(webhookUrl: string, payload: Record<string, unknown>): Promise<OdorSaveResult> {
  if (!webhookUrl) return { ok: false, message: '부숙관리 시트 주소가 없습니다.' };
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(withAccessCode(payload)),
      redirect: 'follow',
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (body.status === 'success') return { ok: true, message: String(body.message || '저장했습니다.') };
    if (/처리할 수 없는 요청/.test(String(body.message))) return { ok: false, message: OUTDATED_MESSAGE };
    if (body.code === 'forbidden') return { ok: false, message: '회사 관리자만 기록할 수 있습니다.' };
    return { ok: false, message: String(body.message || '저장하지 못했습니다.') };
  } catch {
    return { ok: false, message: '인터넷 연결을 확인한 뒤 다시 시도해주세요.' };
  }
}

export function saveOdorMeasurement(webhookUrl: string, measurement: OdorMeasurement): Promise<OdorSaveResult> {
  return post(webhookUrl, { eventType: 'odor_saved', measurement });
}

export function deleteOdorMeasurement(webhookUrl: string, id: string): Promise<OdorSaveResult> {
  return post(webhookUrl, { eventType: 'odor_deleted', key: id });
}
