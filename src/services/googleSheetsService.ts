import type { CorePoint, MeasurementRecord, RecordPhoto } from '../types';
import { buildRecordKey, getCurrentDateTimeString, normalizeName } from '../utils/calculations';
import type { AnnotatedRecord } from '../utils/calculations';
import { getDriveViewUrl } from '../utils/photos';
import { DEFAULT_RANCH_NAME } from '../constants/defaultData';

export const REQUIRED_SCRIPT_VERSION = 11;

/** 구글 드라이브 파일 ID 형식 — 이 형식이 아닌 값은 사진으로 받지 않는다 */
const DRIVE_FILE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export interface SyncResult {
  success: boolean;
  /** 웹 앱 응답을 실제로 읽어 확인했는지 여부. false 면 "전송만 함, 결과 미확인". */
  verified: boolean;
  message: string;
  /** 응답한 Apps Script 의 버전. 구버전은 이 값을 주지 않으므로 1 로 본다. */
  scriptVersion?: number;
  /** 기록 저장 응답에 담긴, 그 기록의 드라이브 사진 전체 (v7 이상) */
  photos?: RecordPhoto[];
}

function toPhotos(fileIds: unknown): RecordPhoto[] {
  if (!Array.isArray(fileIds)) return [];
  return fileIds
    .map(id => String(id || '').trim())
    .filter(id => DRIVE_FILE_ID_RE.test(id))
    .map(fileId => ({ fileId, url: getDriveViewUrl(fileId) }));
}

/** 시트 한 행 (목장별 '주간기록_목장이름' 탭) */
interface RecordPayload {
  recordKey: string;
  dateTime: string;
  ranchName: string;
  location: string;
  collectedKg: number;
  coreTemp: number;
  moisture: number;
  ambientTemp: number;
  ambientHum: number;
  /** 같은 장소 직전 기록 대비 변화. 첫 기록이면 빈 값 */
  coreTempDelta: number | '';
  moistureDelta: number | '';
  verdictTitle: string;
  notes: string;
  /** 지점별 심부 온도·함수율을 '29.5 / 30.1 / 28.8' 형태로 (평균의 근거를 시트에서도 보이게) */
  coreTempPoints: string;
  moisturePoints: string;
  /** 이미 드라이브에 올라간 사진 — 행을 갱신해도 사진 칸이 비지 않도록 함께 보낸다 */
  photoIds: string[];
}

/**
 * Apps Script 웹 앱으로 POST.
 *
 * Content-Type 이 text/plain 이면 CORS 단순 요청이라 프리플라이트가 없고,
 * Apps Script /exec 응답에는 Access-Control-Allow-Origin: * 가 붙는다.
 * 따라서 기본은 cors 모드로 보내 "응답을 읽고" 성패를 실제로 판정한다.
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
      const parsed = JSON.parse(text) as { status?: string; message?: string; scriptVersion?: number; photoIds?: unknown };
      // 구버전 스크립트는 scriptVersion 을 응답하지 않는다 -> 1 로 간주
      const scriptVersion = Number(parsed.scriptVersion) || 1;
      if (parsed.status === 'error') {
        return { success: false, verified: true, scriptVersion, message: parsed.message || '웹 앱에서 오류를 반환했습니다.' };
      }
      return {
        success: true,
        verified: true,
        scriptVersion,
        message: parsed.message || '시트에 반영되었습니다.',
        photos: Array.isArray(parsed.photoIds) ? toPhotos(parsed.photoIds) : undefined,
      };
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

const POINT_SEPARATOR = ' / ';

function pointsToText(points: CorePoint[] | undefined, pick: (p: CorePoint) => number): string {
  return (points ?? []).map(pick).join(POINT_SEPARATOR);
}

/** '29.5 / 30.1 / 28.8' → [29.5, 30.1, 28.8] */
function textToNumbers(text: unknown): number[] {
  return String(text ?? '')
    .split(/[/,·]/)
    .map(part => Number(part.trim()))
    .filter(n => Number.isFinite(n));
}

/** 시트의 지점별 온도·함수율 칸을 지점 목록으로 되돌린다 */
function toCorePoints(tempText: unknown, moistureText: unknown): CorePoint[] | undefined {
  const temps = textToNumbers(tempText);
  const moistures = textToNumbers(moistureText);
  const count = Math.min(temps.length, moistures.length);
  if (count === 0) return undefined;
  return Array.from({ length: count }, (_, i) => ({ coreTemp: temps[i], moisture: moistures[i] }));
}

function toPayload({ record, previous, verdict }: AnnotatedRecord): RecordPayload {
  const delta = (a: number, b: number) => Number((a - b).toFixed(1));
  return {
    recordKey: record.id,
    dateTime: `${record.date} ${record.time}`,
    ranchName: record.ranchName,
    location: record.location,
    collectedKg: record.collectedKg,
    coreTemp: record.coreTemp,
    moisture: record.moisture,
    ambientTemp: record.ambientTemp,
    ambientHum: record.ambientHum,
    coreTempDelta: previous ? delta(record.coreTemp, previous.coreTemp) : '',
    moistureDelta: previous ? delta(record.moisture, previous.moisture) : '',
    verdictTitle: verdict.title,
    notes: record.notes || '',
    coreTempPoints: pointsToText(record.corePoints, p => p.coreTemp),
    moisturePoints: pointsToText(record.corePoints, p => p.moisture),
    photoIds: (record.photos ?? []).map(p => p.fileId),
  };
}

/** 드라이브 파일 이름 — 폴더에서 날짜·장소 순으로 정렬되게 */
function photoFileName(record: MeasurementRecord, index: number): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
  return `${record.date}_${record.time.replace(':', '')}_${safe(record.ranchName)}_${safe(record.location)}_${index}.jpg`;
}

/**
 * 기록 한 건 전송 (같은 레코드 키면 시트에서 행이 갱신됨).
 * 새 사진이 있으면 함께 보내고, 스크립트가 드라이브에 저장한 뒤 사진 목록을 돌려준다.
 */
export async function sendRecordToGoogleSheets(
  webhookUrl: string,
  annotated: AnnotatedRecord,
  newPhotoDataUrls: string[] = []
): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  const payload = toPayload(annotated);
  const newPhotos = newPhotoDataUrls.map((dataUrl, i) => ({
    fileName: photoFileName(annotated.record, payload.photoIds.length + i + 1),
    mimeType: 'image/jpeg',
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
  }));

  return postToWebApp(webhookUrl, { eventType: 'record_saved', ...payload, newPhotos });
}

/**
 * 앱의 기록을 시트와 일치시킨다.
 * 시트는 레코드 키로 upsert 하므로 몇 번을 보내도 행이 중복되지 않는다.
 * 직전 대비 변화·판정도 다시 계산해 보내므로, 지난 날짜 기록을 끼워 넣은 뒤에도 값이 맞춰진다.
 */
export async function syncRecordsToGoogleSheets(
  webhookUrl: string,
  annotated: AnnotatedRecord[]
): Promise<SyncResult & { count: number }> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return { ...invalid, count: 0 };

  const items = annotated.map(toPayload);
  const result = await postToWebApp(webhookUrl, { eventType: 'bulk_records', items });

  return {
    ...result,
    count: result.success ? items.length : 0,
    message: result.verified && result.success ? `기록 ${items.length}건을 시트와 일치시켰습니다.` : result.message,
  };
}

/** 기록 삭제 — 시트의 해당 행도 제거 */
export async function deleteRecordFromGoogleSheets(webhookUrl: string, recordKey: string): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  return postToWebApp(webhookUrl, { eventType: 'record_deleted', recordKey });
}

/** 전체 삭제 — 기록 시트를 헤더만 남기고 비운다 */
export async function clearAllFromGoogleSheets(webhookUrl: string): Promise<SyncResult> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  return postToWebApp(webhookUrl, { eventType: 'clear_all' });
}

interface RawSheetRecord {
  recordKey?: string;
  date?: string;
  time?: string;
  ranchName?: string;
  location?: string;
  collectedKg?: number;
  coreTemp?: number;
  moisture?: number;
  ambientTemp?: number;
  ambientHum?: number;
  notes?: string;
  photoIds?: string[];
  coreTempPoints?: string;
  moisturePoints?: string;
}

/**
 * 구글 시트를 원본으로 삼아 기록을 통째로 읽어온다.
 * 앱은 이 결과를 화면에 그리고 localStorage 에는 오프라인 캐시로만 보관한다.
 */
export async function loadFromGoogleSheets(
  webhookUrl: string
): Promise<SyncResult & { records?: MeasurementRecord[] }> {
  const invalid = assertUrl(webhookUrl);
  if (invalid) return invalid;

  const url = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=load`;

  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await res.text();

    if (!res.ok) {
      return { success: false, verified: true, message: `시트를 읽지 못했습니다 (HTTP ${res.status})` };
    }

    if (/^\s*</.test(text) || text.includes('accounts.google.com')) {
      return {
        success: false,
        verified: true,
        message:
          '웹 앱이 로그인 화면을 반환했습니다. 배포 시 "액세스 권한이 있는 사용자"를 [모든 사용자]로 지정했는지 확인해주세요.',
      };
    }

    let parsed: { status?: string; message?: string; scriptVersion?: number; records?: RawSheetRecord[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, verified: true, message: '시트 응답을 해석할 수 없습니다. 스크립트를 최신본으로 교체해주세요.' };
    }

    const scriptVersion = Number(parsed.scriptVersion) || 1;

    if (parsed.status === 'error') {
      return { success: false, verified: true, scriptVersion, message: parsed.message || '시트에서 오류를 반환했습니다.' };
    }

    // v5 이하 스크립트는 records 를 주지 않는다
    if (!Array.isArray(parsed.records)) {
      return {
        success: false,
        verified: true,
        scriptVersion,
        message: `스크립트 v${REQUIRED_SCRIPT_VERSION} 이상이 필요합니다. 연동 마법사에서 최신 코드로 재배포해주세요.`,
      };
    }

    const records: MeasurementRecord[] = parsed.records
      .filter(r => r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .map(r => {
        const pile = {
          ranchName: normalizeName(r.ranchName || '') || DEFAULT_RANCH_NAME,
          location: normalizeName(r.location || ''),
        };
        const date = r.date as string;
        return {
          // 시트의 레코드 키가 곧 고유 id. 같은 행은 언제 읽어도 같은 id 가 된다.
          id: r.recordKey || buildRecordKey(pile, date),
          ...pile,
          date,
          time: r.time || '00:00',
          collectedKg: Number(r.collectedKg) || 0,
          coreTemp: Number(r.coreTemp) || 0,
          moisture: Number(r.moisture) || 0,
          ambientTemp: Number(r.ambientTemp) || 0,
          ambientHum: Number(r.ambientHum) || 0,
          notes: r.notes || undefined,
          photos: toPhotos(r.photoIds),
          corePoints: toCorePoints(r.coreTempPoints, r.moisturePoints),
        };
      });

    return {
      success: true,
      verified: true,
      scriptVersion,
      message: `시트에서 기록 ${records.length}건을 불러왔습니다.`,
      records,
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      message:
        error instanceof Error ? `시트에 연결하지 못했습니다: ${error.message}` : '시트에 연결하지 못했습니다.',
    };
  }
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

  return postToWebApp(url, { isTest: true, dateTime: getCurrentDateTimeString() });
}
