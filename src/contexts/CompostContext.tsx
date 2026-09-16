import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ActiveTab, CompostSettings, CorePoint, GoogleSheetsConfig, MeasurementRecord, Pile, VerdictInfo } from '../types';
import { DEFAULT_RANCH_NAME, DEFAULT_SETTINGS, SHEET_WEBHOOK_URL } from '../constants/defaultData';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import {
  annotateRecords,
  averageCorePoints,
  buildRecordKey,
  compareRecords,
  evaluateRecord,
  getCurrentDateTimeString,
  getPileRecords,
  normalizeName,
} from '../utils/calculations';
import type { AnnotatedRecord } from '../utils/calculations';
import { addPendingPhotos, clearPendingPhotos, deletePendingPhotos, getPendingPhotos } from '../utils/photoStore';
import {
  clearAllFromGoogleSheets,
  deleteRecordFromGoogleSheets,
  loadFromGoogleSheets,
  sendRecordToGoogleSheets,
  syncRecordsToGoogleSheets,
} from '../services/googleSheetsService';
import type { SyncResult } from '../services/googleSheetsService';

const DEFAULT_GOOGLE_CONFIG: GoogleSheetsConfig = {
  sheetWebhookUrl: SHEET_WEBHOOK_URL,
  lastSyncStatus: 'idle',
  totalSyncedCount: 0,
};

/**
 * 시트 주소는 앱에 고정된 값만 쓴다.
 * 예전에 다른 주소를 저장해 둔 기기라면, 그 주소에서 받은 버전·동기화 기록은 새 주소와 무관하므로 비운다.
 */
function normalizeGoogleConfig(stored: GoogleSheetsConfig): GoogleSheetsConfig {
  if (stored.sheetWebhookUrl === SHEET_WEBHOOK_URL) return { ...DEFAULT_GOOGLE_CONFIG, ...stored };
  return DEFAULT_GOOGLE_CONFIG;
}

/** 배치 단위로 저장하던 예전 버전의 로컬 캐시 — 지금 구조와 맞지 않아 지운다 */
const LEGACY_STORAGE_KEYS = ['batches', 'measurements', 'active_batch_id'];

/** 저장된 설정에 빠지거나 잘못된 항목은 기본값으로 채운다 */
function normalizeSettings(stored: Partial<CompostSettings>): CompostSettings {
  const pick = (key: keyof CompostSettings) => {
    const v = Number(stored[key]);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_SETTINGS[key];
  };

  let usableMoistureMin = pick('usableMoistureMin');
  let usableMoistureMax = pick('usableMoistureMax');
  if (usableMoistureMin >= usableMoistureMax) {
    usableMoistureMin = DEFAULT_SETTINGS.usableMoistureMin;
    usableMoistureMax = DEFAULT_SETTINGS.usableMoistureMax;
  }

  return {
    usableMoistureMin,
    usableMoistureMax,
    highMoistureThreshold: pick('highMoistureThreshold'),
    highTempThreshold: pick('highTempThreshold'),
    coreProbeDepthCm: pick('coreProbeDepthCm'),
  };
}

export interface RecordInput {
  ranchName: string;
  location: string;
  date: string;
  time: string;
  collectedKg: number;
  /** 같은 높이에서 30cm 간격으로 잰 심부 측정값. 평균이 기록의 대푯값이 된다. */
  corePoints: CorePoint[];
  ambientTemp: number;
  ambientHum: number;
  notes?: string;
  /** 새로 찍은 파봉 작업 사진 (줄인 JPEG data URL) */
  newPhotos?: string[];
}

export interface SaveRecordResult {
  saved: boolean;
  /** 시트 반영 결과 — 'skipped' 는 시트를 연결하지 않은 경우 */
  sheet: 'synced' | 'failed' | 'unverified' | 'skipped';
  message?: string;
  record?: MeasurementRecord;
  /** 저장된 기록의 판정 — 입력을 마친 뒤 결과 화면에 보여준다 */
  verdict?: VerdictInfo;
  /** 이번에 드라이브에 올라간 사진 수 */
  photosUploaded?: number;
  /** 못 올려서 이 기기에 보관 중인 사진 수 */
  photosPending?: number;
}

interface PushOutcome {
  res: SyncResult;
  uploadedPhotos: number;
  /** 기록과 사진이 모두 시트에 올라갔는지 */
  done: boolean;
}

/** 열어 둔 채로 두었을 때 시트를 다시 읽는 간격 */
const AUTO_RELOAD_POLL_MS = 3 * 60 * 1000;
/** 자동 새로고침 최소 간격 — 화면을 자주 오갈 때 시트를 연달아 부르지 않도록 */
const AUTO_RELOAD_MIN_GAP_MS = 20 * 1000;

interface CompostContextValue {
  records: MeasurementRecord[];
  /** 지금 보고 있는 더미 (목장 + 하역 장소) */
  activePile: Pile;
  setActivePile: (pile: Pile) => void;
  settings: CompostSettings;
  googleConfig: GoogleSheetsConfig;
  isSyncing: boolean;
  isGoogleModalOpen: boolean;
  setIsGoogleModalOpen: (open: boolean) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  /** 장소별 현황 탭에서 상세를 열어 둔 장소 키. null 이면 장소 목록 */
  historyPileKey: string | null;
  setHistoryPileKey: (key: string | null) => void;
  saveRecord: (input: RecordInput) => Promise<SaveRecordResult>;
  /** 기록 삭제 — 시트에서도 제거 */
  deleteRecord: (id: string) => Promise<SyncResult>;
  /** 구글 시트에서 기록을 다시 읽어온다 */
  reloadFromSheet: () => Promise<SyncResult>;
  isLoadingFromSheet: boolean;
  /** 시트를 마지막으로 읽어온 시각 (ms). 아직 못 읽었으면 null */
  lastSheetLoadAt: number | null;
  /** 시트를 원본으로 쓰는 상태인지 (웹 앱 URL이 등록돼 있음) */
  isSheetBackend: boolean;
  /** 시트로 보내지 못해 이 기기에만 있는 기록 수 */
  pendingCount: number;
  updateSettings: (newSettings: Partial<CompostSettings>) => void;
  updateGoogleConfig: (newConfig: Partial<GoogleSheetsConfig>) => void;
  syncAllToGoogleSheets: () => Promise<SyncResult & { count: number }>;
  /** 기록을 모두 비운다. 시트에서도 비운다 (연동 설정·기준값은 유지) */
  resetAllData: () => Promise<SyncResult>;
}

const CompostContext = createContext<CompostContextValue | null>(null);

export const CompostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<MeasurementRecord[]>(() =>
    getStorageItem<MeasurementRecord[]>('records', [])
  );

  const [activePile, setActivePileState] = useState<Pile>(() => {
    const saved = getStorageItem<Pile | null>('active_pile', null);
    if (saved?.location) return saved;
    const latest = [...getStorageItem<MeasurementRecord[]>('records', [])].sort(compareRecords).pop();
    return latest
      ? { ranchName: latest.ranchName, location: latest.location }
      : { ranchName: DEFAULT_RANCH_NAME, location: '' };
  });

  /** 시트로 보내지 못한 기록의 키. 다음에 시트를 읽을 때 지우지 않고 다시 보낸다. */
  const [pendingKeys, setPendingKeys] = useState<string[]>(() =>
    getStorageItem<string[]>('pending_record_keys', [])
  );

  const [settings, setSettings] = useState<CompostSettings>(() =>
    normalizeSettings(getStorageItem<Partial<CompostSettings>>('settings', DEFAULT_SETTINGS))
  );

  const [googleConfig, setGoogleConfig] = useState<GoogleSheetsConfig>(() =>
    normalizeGoogleConfig(getStorageItem<GoogleSheetsConfig>('google_config', DEFAULT_GOOGLE_CONFIG))
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('monitoring');
  const [historyPileKey, setHistoryPileKey] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isLoadingFromSheet, setIsLoadingFromSheet] = useState(false);
  const [lastSheetLoadAt, setLastSheetLoadAt] = useState<number | null>(null);

  // localStorage 동기화
  useEffect(() => {
    LEGACY_STORAGE_KEYS.forEach(removeStorageItem);
  }, []);
  useEffect(() => setStorageItem('records', records), [records]);
  useEffect(() => setStorageItem('active_pile', activePile), [activePile]);
  useEffect(() => setStorageItem('pending_record_keys', pendingKeys), [pendingKeys]);
  useEffect(() => setStorageItem('settings', settings), [settings]);
  useEffect(() => setStorageItem('google_config', googleConfig), [googleConfig]);

  // 시트 새로고침은 앱을 열 때 자동으로 돈다. 콜백이 매번 바뀌지 않도록 최신 값은 ref 로 읽는다.
  const recordsRef = useRef(records);
  const pendingRef = useRef(pendingKeys);
  const settingsRef = useRef(settings);
  // 저장·불러오기가 도는 중에는 자동 새로고침을 쉬게 한다
  const busyRef = useRef(false);
  /** 마지막으로 시트를 부른 시각 — 자동 새로고침이 몰리지 않도록 */
  const lastLoadStartedRef = useRef(0);
  useEffect(() => {
    recordsRef.current = records;
    pendingRef.current = pendingKeys;
    settingsRef.current = settings;
    busyRef.current = isSyncing || isLoadingFromSheet;
  });

  const setActivePile = useCallback((pile: Pile) => {
    setActivePileState({
      ranchName: normalizeName(pile.ranchName) || DEFAULT_RANCH_NAME,
      location: normalizeName(pile.location),
    });
  }, []);

  const isSheetBackend = Boolean(googleConfig.sheetWebhookUrl);
  const webhookUrl = googleConfig.sheetWebhookUrl;

  const markPending = useCallback((keys: string[], pending: boolean) => {
    setPendingKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => (pending ? next.add(k) : next.delete(k)));
      // 바뀐 게 없으면 같은 배열을 돌려줘 불필요한 저장·렌더를 막는다
      return next.size === prev.length && prev.every(k => next.has(k)) ? prev : [...next];
    });
  }, []);

  /**
   * 전송 결과를 상태에 반영.
   * 응답을 실제로 확인하지 못한 경우(verified === false)는 성공으로 집계하지 않는다.
   */
  const applySyncResult = useCallback((result: SyncResult, syncedCount = 1) => {
    setGoogleConfig(prev => ({
      ...prev,
      lastSyncTime: getCurrentDateTimeString(),
      lastSyncStatus: !result.success ? 'error' : result.verified ? 'success' : 'unverified',
      lastSyncMessage: result.message,
      scriptVersion: result.verified && result.scriptVersion ? result.scriptVersion : prev.scriptVersion,
      totalSyncedCount: (prev.totalSyncedCount || 0) + (result.success && result.verified ? syncedCount : 0),
    }));
  }, []);

  /**
   * 기록 한 건을 시트로 보낸다. 이 기기에 보관 중인 사진이 있으면 함께 올리고,
   * 드라이브에 올라간 사진 목록으로 기록을 갱신한다.
   */
  const pushRecord = useCallback(async (annotated: AnnotatedRecord): Promise<PushOutcome> => {
    const { record } = annotated;
    const photos = record.pendingPhotoCount ? await getPendingPhotos(record.id) : [];

    let res: SyncResult;
    try {
      res = await sendRecordToGoogleSheets(webhookUrl, annotated, photos);
    } catch (err) {
      res = { success: false, verified: true, message: err instanceof Error ? err.message : '시트 전송 중 오류가 발생했습니다.' };
    }
    applySyncResult(res);

    if (!res.success || !res.verified) {
      markPending([record.id], true);
      return { res, uploadedPhotos: 0, done: false };
    }

    if (photos.length === 0) {
      markPending([record.id], false);
      return { res, uploadedPhotos: 0, done: true };
    }

    const sheetPhotos = res.photos;
    if (!sheetPhotos) {
      // 구버전 스크립트 — 기록 행은 올라갔지만 사진은 무시됐다. 사진은 계속 보관한다.
      markPending([record.id], true);
      return {
        res: { ...res, message: '기록은 시트에 올렸지만 사진은 올리지 못했습니다. 스크립트를 최신 버전으로 재배포해주세요.' },
        uploadedPhotos: 0,
        done: false,
      };
    }

    await deletePendingPhotos(record.id);
    setRecords(prev =>
      prev.map(r => (r.id === record.id ? { ...r, photos: sheetPhotos, pendingPhotoCount: undefined } : r))
    );
    markPending([record.id], false);
    return { res, uploadedPhotos: photos.length, done: true };
  }, [webhookUrl, applySyncResult, markPending]);

  /**
   * 구글 시트를 원본으로 삼아 기록을 갈아끼운다.
   * 단, 통신 불량 등으로 시트에 못 보낸 기록·사진은 지우지 않고 남긴 뒤 다시 보낸다.
   */
  const reloadFromSheet = useCallback(async (): Promise<SyncResult> => {
    if (!webhookUrl) {
      return { success: false, verified: true, message: '구글 웹 앱 URL이 설정되지 않았습니다.' };
    }

    setIsLoadingFromSheet(true);
    lastLoadStartedRef.current = Date.now();
    try {
      const result = await loadFromGoogleSheets(webhookUrl);

      if (result.scriptVersion) {
        setGoogleConfig(prev => ({ ...prev, scriptVersion: result.scriptVersion }));
      }
      if (result.success) setLastSheetLoadAt(Date.now());
      if (!result.success || !result.records) return result;

      const sheetIds = new Set(result.records.map(r => r.id));
      const pendingSet = new Set(pendingRef.current);
      // 시트에 없거나, 올리지 못한 사진이 남은 기록만 이 기기 쪽 값을 살려서 다시 보낸다
      const toPush = recordsRef.current.filter(
        r => pendingSet.has(r.id) && (!sheetIds.has(r.id) || r.pendingPhotoCount)
      );
      const pushIds = new Set(toPush.map(r => r.id));
      const merged = [...result.records.filter(r => !pushIds.has(r.id)), ...toPush];
      setRecords(merged);
      markPending(pendingRef.current.filter(k => !pushIds.has(k)), false);

      if (toPush.length === 0) return result;

      const annotated = annotateRecords(merged, settingsRef.current).filter(a => pushIds.has(a.record.id));
      const plain = annotated.filter(a => !a.record.pendingPhotoCount);
      let failed = 0;

      if (plain.length > 0) {
        const push = await syncRecordsToGoogleSheets(webhookUrl, plain);
        applySyncResult(push, push.count);
        const ok = push.success && push.verified;
        markPending(plain.map(a => a.record.id), !ok);
        if (!ok) failed += plain.length;
      }
      for (const item of annotated.filter(a => a.record.pendingPhotoCount)) {
        if (!(await pushRecord(item)).done) failed++;
      }

      return {
        ...result,
        message:
          failed === 0
            ? `${result.message} 보내지 못했던 기록 ${toPush.length}건도 시트에 올렸습니다.`
            : `${result.message} 기록 ${failed}건은 아직 보내지 못해 이 기기에 남겨 두었습니다.`,
      };
    } finally {
      setIsLoadingFromSheet(false);
    }
  }, [webhookUrl, markPending, applySyncResult, pushRecord]);

  /** 앱을 열면(또는 URL 이 바뀌면) 시트에서 자동으로 불러온다. 실패하면 캐시된 기록을 그대로 쓴다. */
  const hydratedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!webhookUrl || hydratedUrlRef.current === webhookUrl) return;
    hydratedUrlRef.current = webhookUrl;
    reloadFromSheet().catch(() => {});
  }, [webhookUrl, reloadFromSheet]);

  /**
   * 원본은 구글 시트다. 시트에서 직접 고치거나 다른 기기에서 올린 내용도 앱에 나타나야 하므로
   * 화면으로 돌아왔을 때·통신이 돌아왔을 때·앱을 열어 둔 채로 시간이 지났을 때 다시 읽는다.
   */
  const autoReload = useCallback(() => {
    if (!webhookUrl || busyRef.current) return;
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastLoadStartedRef.current < AUTO_RELOAD_MIN_GAP_MS) return;
    reloadFromSheet().catch(() => {});
  }, [webhookUrl, reloadFromSheet]);

  useEffect(() => {
    if (!webhookUrl) return;

    const onBack = () => {
      if (document.visibilityState === 'visible') autoReload();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('online', autoReload);
    const timer = window.setInterval(autoReload, AUTO_RELOAD_POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener('online', autoReload);
      window.clearInterval(timer);
    };
  }, [webhookUrl, autoReload]);

  const saveRecord = useCallback(async (input: RecordInput): Promise<SaveRecordResult> => {
    const pile: Pile = {
      ranchName: normalizeName(input.ranchName) || DEFAULT_RANCH_NAME,
      location: normalizeName(input.location),
    };
    if (!pile.location) {
      return { saved: false, sheet: 'skipped', message: '하역 장소를 입력해주세요.' };
    }

    const id = buildRecordKey(pile, input.date);
    const existing = records.find(r => r.id === id);
    // 사진은 드라이브에 올리므로 시트가 연결돼 있을 때만 받는다
    const newPhotos = webhookUrl ? input.newPhotos ?? [] : [];

    // 지점별로 잰 값의 평균을 기록의 심부 온도·함수율로 쓴다
    const average = averageCorePoints(input.corePoints);

    const record: MeasurementRecord = {
      id,
      ...pile,
      date: input.date,
      time: input.time,
      collectedKg: Math.max(0, Math.round(input.collectedKg)),
      coreTemp: average.coreTemp,
      moisture: average.moisture,
      corePoints: input.corePoints,
      ambientTemp: input.ambientTemp,
      ambientHum: input.ambientHum,
      notes: input.notes?.trim() || undefined,
      // 같은 날짜를 다시 저장해도 이미 올린 사진·보관 중인 사진은 유지하고 새 사진을 더한다
      photos: existing?.photos,
      pendingPhotoCount: (existing?.pendingPhotoCount ?? 0) + newPhotos.length || undefined,
    };

    // 업로드 도중 앱이 닫혀도 사진을 잃지 않도록 먼저 기기에 보관한다
    if (newPhotos.length > 0) await addPendingPhotos(id, newPhotos);

    // 같은 장소·같은 날짜 기록은 새 값으로 바꾼다
    const nextRecords = [...records.filter(r => r.id !== id), record];
    const pileRecords = getPileRecords(nextRecords, pile);
    const verdict = evaluateRecord(record, pileRecords.filter(r => r.date < record.date), settings);

    setRecords(nextRecords);
    setActivePile(pile);

    if (!webhookUrl) {
      return { saved: true, sheet: 'skipped', record, verdict };
    }

    // 지난 날짜로 끼워 넣었다면 뒤 기록들의 '직전 대비' 값도 바뀌므로 함께 보낸다 (첫 항목이 이번 기록)
    const [main, ...later] = annotateRecords(pileRecords, settings).filter(a => a.record.date >= record.date);

    setIsSyncing(true);
    try {
      const { res, uploadedPhotos } = await pushRecord(main);

      if (later.length > 0) {
        const laterRes = await syncRecordsToGoogleSheets(webhookUrl, later);
        markPending(later.map(a => a.record.id), !(laterRes.success && laterRes.verified));
      }

      return {
        saved: true,
        sheet: !res.success ? 'failed' : res.verified ? 'synced' : 'unverified',
        message: res.message,
        record,
        verdict,
        photosUploaded: uploadedPhotos,
        photosPending: (record.pendingPhotoCount ?? 0) - uploadedPhotos,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [records, settings, webhookUrl, setActivePile, pushRecord, markPending]);

  const deleteRecord = useCallback(async (id: string): Promise<SyncResult> => {
    const target = records.find(r => r.id === id);
    if (!target) {
      return { success: false, verified: true, message: '삭제할 기록을 찾지 못했습니다.' };
    }

    const remaining = records.filter(r => r.id !== id);
    setRecords(remaining);
    markPending([id], false);
    deletePendingPhotos(id).catch(() => {});

    if (!webhookUrl) {
      return { success: true, verified: true, message: '기록을 삭제했습니다.' };
    }

    const result = await deleteRecordFromGoogleSheets(webhookUrl, id);
    applySyncResult(result, 0);

    // 바로 뒤 기록의 '직전 대비' 값이 바뀌므로 시트에도 다시 맞춘다
    const later = annotateRecords(getPileRecords(remaining, target), settings).filter(a => a.record.date > target.date);
    if (result.success && later.length > 0) {
      syncRecordsToGoogleSheets(webhookUrl, later).catch(() => {});
    }

    return result;
  }, [records, settings, webhookUrl, applySyncResult, markPending]);

  /** 앱의 모든 기록을 시트와 일치시킨다 */
  const syncAllToGoogleSheets = useCallback(async () => {
    if (!webhookUrl) {
      return { success: false, verified: true, count: 0, message: '구글 웹 앱 URL이 설정되지 않았습니다.' };
    }

    setIsSyncing(true);
    const annotated = annotateRecords(records, settings);
    const result = await syncRecordsToGoogleSheets(webhookUrl, annotated);

    // 일괄 동기화는 시트를 앱 기준으로 맞추는 작업이므로 누적이 아니라 "덮어쓰기"가 맞다.
    setGoogleConfig(prev => ({
      ...prev,
      lastSyncTime: getCurrentDateTimeString(),
      lastSyncStatus: !result.success ? 'error' : result.verified ? 'success' : 'unverified',
      lastSyncMessage: result.message,
      scriptVersion: result.verified && result.scriptVersion ? result.scriptVersion : prev.scriptVersion,
      totalSyncedCount: result.success && result.verified ? result.count : prev.totalSyncedCount || 0,
    }));
    if (result.success && result.verified) {
      // 기록 행은 모두 맞췄다. 보관 중인 사진이 있는 기록만 사진과 함께 다시 보낸다.
      const withPhotos = annotated.filter(a => a.record.pendingPhotoCount);
      setPendingKeys(withPhotos.map(a => a.record.id));
      for (const item of withPhotos) await pushRecord(item);
    }
    setIsSyncing(false);

    return result;
  }, [webhookUrl, records, settings, pushRecord]);

  const resetAllData = useCallback(async (): Promise<SyncResult> => {
    setRecords([]);
    setPendingKeys([]);
    clearPendingPhotos().catch(() => {});
    setActivePileState({ ranchName: DEFAULT_RANCH_NAME, location: '' });

    if (!webhookUrl) {
      return { success: true, verified: true, message: '앱의 기록을 모두 삭제했습니다.' };
    }

    const result = await clearAllFromGoogleSheets(webhookUrl);
    applySyncResult(result, 0);
    return result;
  }, [webhookUrl, applySyncResult]);

  const updateSettings = useCallback((newSettings: Partial<CompostSettings>) => {
    setSettings(prev => normalizeSettings({ ...prev, ...newSettings }));
  }, []);

  const updateGoogleConfig = useCallback((newConfig: Partial<GoogleSheetsConfig>) => {
    // 주소는 고정 — 화면에서 무엇을 넘겨도 바뀌지 않는다
    setGoogleConfig(prev => ({ ...prev, ...newConfig, sheetWebhookUrl: SHEET_WEBHOOK_URL }));
  }, []);

  // 컨텍스트 값을 메모이즈해야 Provider 리렌더마다 모든 소비자가 재렌더되는 것을 막을 수 있다.
  const value = useMemo<CompostContextValue>(
    () => ({
      records,
      activePile,
      setActivePile,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      setIsGoogleModalOpen,
      activeTab,
      setActiveTab,
      historyPileKey,
      setHistoryPileKey,
      saveRecord,
      deleteRecord,
      reloadFromSheet,
      isLoadingFromSheet,
      lastSheetLoadAt,
      isSheetBackend,
      pendingCount: pendingKeys.length,
      updateSettings,
      updateGoogleConfig,
      syncAllToGoogleSheets,
      resetAllData,
    }),
    [
      records,
      activePile,
      setActivePile,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      activeTab,
      historyPileKey,
      saveRecord,
      deleteRecord,
      reloadFromSheet,
      isLoadingFromSheet,
      lastSheetLoadAt,
      isSheetBackend,
      pendingKeys.length,
      updateSettings,
      updateGoogleConfig,
      syncAllToGoogleSheets,
      resetAllData,
    ]
  );

  return <CompostContext.Provider value={value}>{children}</CompostContext.Provider>;
};

export const useCompost = (): CompostContextValue => {
  const context = useContext(CompostContext);
  if (!context) {
    throw new Error('useCompost must be used within a CompostProvider');
  }
  return context;
};
