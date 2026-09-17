/**
 * 환경변수에서 Apps Script 웹 앱 주소를 읽는다.
 *
 * 이 앱은 서로 다른 구글 시트 두 곳을 쓴다.
 * - VITE_COMPOST_GAS_API_URL   : 부숙관리 (기록 불러오기·저장, 사진, AI 리포트)
 * - VITE_COLLECTION_GAS_API_URL: 수거관리 (대시보드, 매장별·주차별 수거량)
 * 둘은 역할이 다르므로 절대 한 값으로 합치지 않는다.
 */

/** 예시 그대로 남아 있는 주소 — 아직 채우지 않은 것으로 본다 */
const PLACEHOLDER_URL = /XXXX|YOUR_DEPLOYMENT_ID|여기에|실제배포ID/i;

type ViteEnv = Record<string, string | undefined>;

function getEnv(): ViteEnv {
  return (import.meta as ImportMeta & { env?: ViteEnv }).env ?? {};
}

/**
 * 이름을 앞에서부터 찾아 쓸 만한 주소를 돌려준다 (뒤쪽은 예전 이름 호환용).
 * 비어 있거나 예시 주소면 '설정 안 함'으로 본다.
 */
export function readEnvUrl(...names: string[]): string {
  const env = getEnv();
  for (const name of names) {
    const value = String(env[name] ?? '').trim().replace(/\/$/, '');
    if (value && !PLACEHOLDER_URL.test(value)) return value;
  }
  return '';
}
