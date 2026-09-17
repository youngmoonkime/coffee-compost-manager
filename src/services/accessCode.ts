import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';

/**
 * 접속 코드 — 회사 관리자와 목장 매니저를 가른다.
 *
 * 코드 확인은 Apps Script(서버)가 한다. 앱은 코드를 기기에 보관해 모든 요청에 붙이고,
 * 서버가 알려 준 권한에 맞춰 화면을 줄일 뿐이다 (화면을 줄이는 것만으로 막는 것이 아니다).
 */

export type AccessRole = 'admin' | 'manager';

export interface AccessInfo {
  role: AccessRole;
  /** 목장 매니저의 목장 */
  ranch?: string;
  /** 서버에 ADMIN_CODE 가 없어 누구나 전체 기능을 쓰는 상태 (코드 설정 전) */
  open: boolean;
}

const CODE_KEY = 'access_code';
const INFO_KEY = 'access_info';

export function getAccessCode(): string {
  return getStorageItem<string>(CODE_KEY, '');
}

export function saveAccess(code: string, info: AccessInfo): void {
  setStorageItem(CODE_KEY, code);
  setStorageItem(INFO_KEY, info);
}

export function clearAccess(): void {
  removeStorageItem(CODE_KEY);
  removeStorageItem(INFO_KEY);
}

/** 마지막으로 확인된 권한 — 인터넷이 안 될 때 이어서 쓰기 위해 보관한다 */
export function readCachedAccess(): AccessInfo | null {
  const info = getStorageItem<AccessInfo | null>(INFO_KEY, null);
  if (!info || (info.role !== 'admin' && info.role !== 'manager')) return null;
  if (info.role === 'manager' && !info.ranch) return null;
  return info;
}

/** POST 본문에 코드를 붙인다 */
export function withAccessCode<T extends object>(payload: T): T & { accessCode?: string } {
  const accessCode = getAccessCode();
  return accessCode ? { ...payload, accessCode } : payload;
}

/** GET 주소에 코드를 붙인다 */
export function appendAccessCode(url: string): string {
  const code = getAccessCode();
  if (!code) return url;
  return `${url}${url.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`;
}

export type AccessCheck =
  | { kind: 'ok'; info: AccessInfo }
  | { kind: 'denied'; message: string }
  | { kind: 'offline'; message: string };

/** 코드가 어떤 권한인지 서버에 묻는다 (기록은 받지 않는다) */
export async function checkAccessCode(webhookUrl: string, code: string): Promise<AccessCheck> {
  if (!webhookUrl) return { kind: 'offline', message: '부숙관리 시트 주소가 없습니다.' };
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('action', 'whoami');
    if (code) url.searchParams.set('code', code);
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const body = (await response.json()) as Record<string, unknown>;

    if (body.status !== 'success') {
      return { kind: 'offline', message: typeof body.message === 'string' ? body.message : '권한을 확인하지 못했습니다.' };
    }
    // v18 이하 스크립트는 whoami 를 모른다 — 코드 확인이 없던 때처럼 전체 기능
    if (typeof body.role !== 'string') return { kind: 'ok', info: { role: 'admin', open: true } };

    if (body.role === 'admin') return { kind: 'ok', info: { role: 'admin', open: body.open === true } };
    if (body.role === 'manager' && typeof body.ranch === 'string' && body.ranch.trim()) {
      return { kind: 'ok', info: { role: 'manager', ranch: body.ranch.trim(), open: false } };
    }
    return {
      kind: 'denied',
      message: code ? '코드가 맞지 않습니다. 다시 확인해주세요.' : '접속 코드를 입력해주세요.',
    };
  } catch {
    return { kind: 'offline', message: '인터넷에 연결되지 않아 코드를 확인하지 못했습니다.' };
  }
}

/** 링크(?code=...)로 받은 코드를 꺼내고 주소창에서는 지운다 */
export function takeCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return null;
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url.toString());
  return code.trim() || null;
}
