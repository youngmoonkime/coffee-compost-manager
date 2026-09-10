import type { Batch, MeasurementLog, BatchSyncPayload } from '../types';
import { getCurrentDateTimeString } from '../utils/calculations';

export interface GoogleSyncPayload {
  /** 배치+일차 기준 고유 키. 시트에서 이 키로 행을 갱신(upsert)한다. */
  recordKey: string;
  dateTime: string;
  batchCode: string;
  ranchName: string;
  dayNumber: number;
  coreTemp: number;
  moisture: number;
  ambientTemp: number;
  ambientHum: number;
  tempDiff: number;
  verdictTitle: string;
  notes?: string;
  isTest?: boolean;
}

export interface GoogleBulkSyncPayload {
  isBulk: true;
  items: GoogleSyncPayload[];
}

export const REQUIRED_SCRIPT_VERSION = 2;

export interface SyncResult {
  success: boolean;
  /** 웹 앱 응답을 실제로 읽어 확인했는지 여부. false 면 "전송만 함, 결과 미확인". */
  verified: boolean;
  message: string;
  /** 응답한 Apps Script 의 버전. 구버전은 이 값을 주지 않으므로 1 로 본다. */
  scriptVersion?: number;
}

/**
 * 앱의 계측 기록과 시트의 행을 1:1로 맞추기 위한 키.
 * 앱은 (배치, 경과일차)당 1건만 보관하므로 시트도 같은 규칙으로 갱신되어야 한다.
 */
export function buildRecordKey(batchCode: string, dayNumber: number): string {
  return `${batchCode}|D${dayNumber}`;
}

/**
 * Apps Script 웹 앱으로 POST.
 *
 * Content-Type 이 text/plain 이면 CORS 단순 요청이라 프리플라이트가 없고,
 * Apps Script /exec 응답에는 Access-Control-Allow-Origin: * 가 붙는다.
 * 따라서 기본은 cors 모드로 보내 "응답을 읽고" 성패를 실제로 판정한다.
 * (기존 no-cors 방식은 응답이 opaque 라 실패해도 항상 성공으로 보고됐다.)
 */
async function postToWebApp(webhookUrl: string, payload: unknown): Promise<SyncResult> {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };

  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers, body, redirect: 'follow' });
    const text = await res.text();

    if (!res.ok) {
      return { success: false, verified: true, message: `웹 앱 응답 오류 (HTTP ${res.status})` };
    }

    // 배포 권한이 [모든 사용자]가 아니면 JSON 대신 구글 로그인 HTML이 돌아온다.
    if (/^\s*</.test(text) || text.includes('accounts.google.com')) {
      return {
        success: false,
        verified: true,
        message:
          '웹 앱이 로그인 화면을 반환했습니다. [배포] 설정에서 "액세스 권한이 있는 사용자"를 [모든 사용자]로 지정한 뒤 다시 배포해주세요.',
      };
    }

    try {
      const parsed = JSON.parse(text) as { status?: string; message?: string; scriptVersion?: number };
      // 구버전 스크립트는 scriptVersion 을 응답하지 않는다 -> 1 로 간주
      const scriptVersion = Number(parsed.scriptVersion) || 1;
      if (parsed.status === 'error') {
        return { success: false, verified: true, scriptVersion, message: parsed.message || '웹 앱에서 오류를 반환했습니다.' };
      }
      return { success: true, verified: true, scriptVersion, message: parsed.message || '시트에 반영되었습니다.' };
    } catch {
      return { success: false, verified: true, message: '웹 앱 응답을 해석할 수 없습니다. 스크립트 코드를 최신본으로 교체해주세요.' };
    }
  } catch {
    // CORS 차단·네트워크 오류 → no-cors 로 한 번 더 시도. 전송은 되지만 결과 확인은 불가.
    try {
      await fetch(webhookUrl, { method: 'POST', headers, body, mode: 'no-cors' });
      return {
        success: true,
        verified: false,
        message: '전송은 완료했으나 웹 앱 응답을 확인할 수 없습니다. 시트에 실제로 반영됐는지 직접 확인해주세요.',
      };
    } catch (error) {
      return {
        success: false,
        verified: true,
        message: error instanceof Error ? error.message : '구글 시트 전송 중 오류가 발생했습니다.',
      };
    }
  }
}

function assertUrl(webhookUrl: string): SyncResult | null {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, verified: true, message: '유효한 구글 웹 앱 URL이 설정되지 않았습니다.' };
  }
  return null;
}

function toPayload(log: MeasurementLog, batch: Batch, verdictTitle: string): GoogleSyncPayload {
  return {
    recordKey: buildRecordKey(batch.code, log.dayNumber),
    dateTime: `${log.date} ${log.time}`,
    batchCode: batch.code,
    ranchName: batch.ranchName,
    dayNumber: log.dayNumber,
    coreTemp: log.coreTemp,
    moisture: log.moisture,
    ambientTemp: log.ambientTemp,
    ambientHum: log.ambientHum,
    tempDiff: log.tempDiff,
    verdictTitle,
    // 비고 열에는 그 계측의 특이사항을 넣는다.
    // 예전에는 배치 메모를 매 행 반복해 넣어서 열이 사실상 무의미했다.
    notes: log.notes || '',
  };
}

/** 단일 계측 데이터 실시간 전송 (같은 배치·일차면 시트에서 행이 갱신됨) */
export async function sendMeasurementToGoogleSheets(
  webhookUrl: string,
  log: MeasurementLog,
  batch: Batch,
  verdictTitle: string
): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  const result = await postToWebApp(webhookUrl, toPayload(log, batch, verdictTitle));
  if (result.success && result.verified) {
    return { ...result, message: `구글 시트에 반영되었습니다 (${batch.code} D+${log.dayNumber})` };
  }
  return result;
}

/** 앱에서 계측 기록을 삭제했을 때 시트의 해당 행도 제거 */
export async function deleteMeasurementFromGoogleSheets(
  webhookUrl: string,
  batchCode: string,
  dayNumber: number
): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  return postToWebApp(webhookUrl, {
    eventType: 'measurement_deleted',
    recordKey: buildRecordKey(batchCode, dayNumber),
    batchCode,
    dayNumber,
  });
}

/** 하역 신규 등록 / 완숙 완료 배치 이벤트 전송 */
export async function sendBatchEventToGoogleSheets(
  webhookUrl: string,
  batch: Batch,
  eventType: 'batch_created' | 'batch_completed' | 'batch_updated'
): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  const payload: BatchSyncPayload = {
    eventType,
    timestamp: getCurrentDateTimeString(),
    batchCode: batch.code,
    ranchName: batch.ranchName,
    startDate: batch.startDate,
    initialWeightKg: batch.initialWeightKg,
    status: batch.status,
    notes: batch.notes,
  };

  return postToWebApp(webhookUrl, payload);
}

/**
 * 앱에 있는 모든 계측 기록을 시트와 일치시킨다.
 * 시트는 recordKey 로 upsert 하므로 몇 번을 눌러도 행이 중복되지 않는다.
 */
export async function syncAllDataToGoogleSheets(
  webhookUrl: string,
  batches: Batch[],
  measurements: MeasurementLog[],
  getVerdictTitle: (core: number, amb: number, moist: number) => string
): Promise<SyncResult & { count: number }> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return { ...invalid, count: 0 };

  const batchMap = new Map<string, Batch>();
  batches.forEach(b => batchMap.set(b.id, b));

  // 배치가 사라진 고아 계측은 건너뛴다. (예전에는 batches[0] 로 대체해
  // 엉뚱한 배치 코드로 기록됐고, 배치가 하나도 없으면 예외가 났다)
  const items: GoogleSyncPayload[] = measurements.flatMap(m => {
    const b = batchMap.get(m.batchId);
    if (!b) return [];
    return [toPayload(m, b, getVerdictTitle(m.coreTemp, m.ambientTemp, m.moisture))];
  });

  const payload: GoogleBulkSyncPayload = { isBulk: true, items };
  const result = await postToWebApp(webhookUrl, payload);

  return {
    ...result,
    count: result.success ? items.length : 0,
    message: result.verified && result.success
      ? `계측 기록 ${items.length}건을 시트와 일치시켰습니다.`
      : result.message,
  };
}

/** 웹 앱 URL 연결 테스트 */
export async function testGoogleSheetsConnection(webhookUrl: string): Promise<SyncResult> {
  const url = webhookUrl.trim();
  if (!url || !url.startsWith('http')) {
    return { success: false, verified: true, message: '올바른 웹 앱 URL(https://script.google.com/...)을 입력해주세요.' };
  }

  if (url.includes('/edit')) {
    return {
      success: false,
      verified: true,
      message: '입력하신 URL은 편집기 화면 주소입니다. [배포] > [웹 앱] 배포 후 발급되는 /exec 주소를 복사해 입력해주세요.',
    };
  }

  if (!url.includes('script.google.com/macros/s/')) {
    return {
      success: false,
      verified: true,
      message: '구글 웹 앱 배포 URL 형식이 아닙니다 (https://script.google.com/macros/s/.../exec).',
    };
  }

  return postToWebApp(url, {
    isTest: true,
    dateTime: getCurrentDateTimeString(),
    batchCode: 'TEST-PING',
    ranchName: '연결 테스트',
  });
}
