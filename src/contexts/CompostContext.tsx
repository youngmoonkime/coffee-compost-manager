import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  ActiveTab,
  CompostSettings,
  CorePoint,
  GoogleSheetsConfig,
  MeasurementRecord,
  MoldStatus,
  OperatingCycle,
  Pile,
  VerdictInfo,
} from '../types';
import {
  DEFAULT_RANCH_NAME,
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  COMPOST_GAS_API_URL,
  LEGACY_DEFAULT_SAWDUST_PRICE_PER_TON,
} from '../constants/defaultData';
import { createCycle, resolveCycle } from '../utils/fieldOps';
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
import { useAccess } from './AccessContext';

const DEFAULT_GOOGLE_CONFIG: GoogleSheetsConfig = {
  sheetWebhookUrl: COMPOST_GAS_API_URL,
  lastSyncStatus: 'idle',
  totalSyncedCount: 0,
};

/**
 * 시트 주소는 앱에 고정된 값만 쓴다.
 * 예전에 다른 주소를 저장해 둔 기기라면, 그 주소에서 받은 버전·동기화 기록은 새 주소와 무관하므로 비운다.
 */
function normalizeGoogleConfig(stored: GoogleSheetsConfig): GoogleSheetsConfig {
  if (stored.sheetWebhookUrl === COMPOST_GAS_API_URL) return { ...DEFAULT_GOOGLE_CONFIG, ...stored };
  return DEFAULT_GOOGLE_CONFIG;
}

/** 배치 단위로 저장하던 예전 버전의 로컬 캐시 — 지금 구조와 맞지 않아 지운다 */
const LEGACY_STORAGE_KEYS = ['batches', 'measurements', 'active_batch_id'];

/** 목장별 숫자 값(목표량·단가) — 숫자가 아닌 값이 섞여 들어와도 화면이 깨지지 않게 걸러낸다 */
function normalizeTargets(stored: unknown): Record<string, number> {
  if (!stored || typeof stored !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [ranch, value] of Object.entries(stored as Record<string, unknown>)) {
    const kg = Number(value);
    if (ranch.trim() && Number.isFinite(kg) && kg > 0) out[ranch.trim()] = Math.round(kg);
  }
  return out;
}

/** 목장별 소수 값(톤 등) — 소수 첫째 자리까지 남긴다 */
function normalizeAmounts(stored: unknown): Record<string, number> {
  if (!stored || typeof stored !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [ranch, value] of Object.entries(stored as Record<string, unknown>)) {
    const n = Number(value);
    if (ranch.trim() && Number.isFinite(n) && n > 0) out[ranch.trim()] = Math.round(n * 10) / 10;
  }
  return out;
}

/** 저장된 설정에 빠지거나 잘못된 항목은 기본값으로 채운다 */
function normalizeSettings(stored: Partial<CompostSettings>): CompostSettings {
  const pick = (
    key: 'usableMoistureMin' | 'usableMoistureMax' | 'highMoistureThreshold' | 'highTempThreshold' | 'coreProbeDepthCm' | 'sawdustPricePerTon'
  ) => {
    const v = Number(stored[key]);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_SETTINGS[key];
  };

  let usableMoistureMin = pick('usableMoistureMin');
  let usableMoistureMax = pick('usableMoistureMax');
  if (usableMoistureMin >= usableMoistureMax) {
    usableMoistureMin = DEFAULT_SETTINGS.usableMoistureMin;
    usableMoistureMax = DEFAULT_SETTINGS.usableMoistureMax;
  }

  // v1 까지의 30~40% 는 앱이 넣어 준 기본값이었다. 현장 관찰값(20~30%)으로 한 번만 맞춘다.
  const storedVersion = Number(stored.settingsVersion) || 1;
  if (storedVersion < SETTINGS_VERSION && usableMoistureMin === 30 && usableMoistureMax === 40) {
    usableMoistureMin = DEFAULT_SETTINGS.usableMoistureMin;
    usableMoistureMax = DEFAULT_SETTINGS.usableMoistureMax;
  }

  // v2 까지의 240,000원/톤은 앱이 넣어 준 기본값이었다. 새 기본 단가(120,000원/톤)로 한 번만 맞춘다.
  let sawdustPricePerTon = pick('sawdustPricePerTon');
  if (storedVersion < 3 && sawdustPricePerTon === LEGACY_DEFAULT_SAWDUST_PRICE_PER_TON) {
    sawdustPricePerTon = DEFAULT_SETTINGS.sawdustPricePerTon;
  }

  return {
    usableMoistureMin,
    usableMoistureMax,
    highMoistureThreshold: pick('highMoistureThreshold'),
    highTempThreshold: pick('highTempThreshold'),
    coreProbeDepthCm: pick('coreProbeDepthCm'),
    beddingTargetKg: normalizeTargets(stored.beddingTargetKg),
    sawdustPricePerTon,
    sawdustPriceByRanch: normalizeTargets(stored.sawdustPriceByRanch),
    sawdustMonthlyTonsByRanch: normalizeAmounts(stored.sawdustMonthlyTonsByRanch),
    settingsVersion: SETTINGS_VERSION,
  };
}

export interface RecordInput {
  ranchName: string;
  location: string;
  date: string;
  time: string;
  /** 이번 방문에 새로 부은 커피박(kg). 없으면 0 */
  collectedKg: number;
  /** 같은 높이에서 30cm 간격으로 잰 심부 측정값. 평균이 기록의 대푯값이 된다. */
  corePoints: CorePoint[];
  ambientTemp: number;
  ambientHum: number;
  notes?: string;
  /** 이번 방문에 깔개로 퍼 간 커피박(kg) */
  beddingUsedKg?: number;
  /** 깔개 활용 사용처 (예: 1번 우사) */
  beddingLocation?: string;
  /** 대략적인 깔개 사용량 표현 (예: 1/2, 2/1 등) */
  beddingAmountDesc?: string;
  /** 기록 종류: 현장 점검('inspection') vs 수거·파봉 측정('measurement') */
  recordType?: 'inspection' | 'measurement';
  /** 오늘 혼합 작업(기존 커피박을 삽으로 한 번씩 뒤집기)을 했는지 */
  mixed?: boolean;
  /** 곰팡이 육안 상태 (현장 점검에서는 필수로 고르게 한다) */
  moldStatus?: MoldStatus;
  /** 곰팡이 유무 (현장 점검) */
  hasMold?: boolean;
  /** 곰팡이 색상 */
  moldColor?: string;
  /** 이상 냄새가 났는지 */
  odor?: boolean;
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
  /** 측정 탭이 따로 기억하는 목장·장소 (현장점검 탭과 섞지 않는다) */
  measurePile: Pile;
  setMeasurePile: (pile: Pile) => void;
  settings: CompostSettings;
  googleConfig: GoogleSheetsConfig;
  isSyncing: boolean;
  isGoogleModalOpen: boolean;
  setIsGoogleModalOpen: (open: boolean) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  /** 현장 점검 기록 화면으로 이동 (측정 기록과 별개) */
  startInspection: () => void;
  /** 측정 탭에서 고를 수 있는 모든 목장 — 최근에 기록한 곳이 앞 */
  ranchNames: string[];
  /** 측정 탭에서 투입 기록이 저장된 목장 — 현장점검 탭에는 이 목장만 보인다 */
  measuredRanchNames: string[];
  /** 기록이 아직 없는 새 목장을 목록에 넣는다 */
  addRanch: (name: string) => string;
  /** 기록이 없는 목장만 목록에서 지운다. 기록이 있으면 false */
  removeRanch: (name: string) => boolean;
  /** 이 목장에 기록이 있어 지울 수 없는지 */
  ranchHasRecords: (name: string) => boolean;
  /** 현장점검 탭에서 목장을 골랐는지. 탭 버튼을 다시 누르면 false 로 돌아가 목장부터 고른다. */
  ranchPicked: boolean;
  setRanchPicked: (picked: boolean) => void;
  /** 장소별 현황 탭에서 상세를 열어 둔 장소 키. null 이면 장소 목록 */
  historyPileKey: string | null;
  setHistoryPileKey: (key: string | null) => void;
  /** 목장의 현재 운영 사이클. 기록도 시작 이력도 없으면 null */
  getCycle: (ranchName: string) => OperatingCycle | null;
  /** 깔개로 다 쓰고 새로 모으기 시작할 때 누른다 */
  startNewCycle: (ranchName: string) => OperatingCycle;
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
  // 목장 매니저는 자기 목장만 다룬다 (서버도 그 목장 기록만 준다)
  const { isManager, managerRanch, recheck: recheckAccess } = useAccess();
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

  const [measurePile, setMeasurePileState] = useState<Pile>(() => {
    const saved = getStorageItem<Pile | null>('measure_pile', null);
    if (saved?.ranchName) return saved;
    const latest = [...getStorageItem<MeasurementRecord[]>('records', [])]
      .filter(r => r.recordType !== 'inspection')
      .sort(compareRecords)
      .pop();
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

  /** 목장별로 사람이 시작한 운영 사이클 */
  const [cycles, setCycles] = useState<Record<string, OperatingCycle>>(() =>
    getStorageItem<Record<string, OperatingCycle>>('cycles', {})
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');

  const startInspection = useCallback(() => {
    setActiveTab('inspection');
  }, []);

  const [ranchPicked, setRanchPicked] = useState(false);
  /** 사람이 추가한 목장 이름 (기록이 생기기 전에도 목록에 보이도록) */
  const [savedRanches, setSavedRanches] = useState<string[]>(() => getStorageItem<string[]>('ranch_names', []));
  const addRanch = useCallback((name: string) => {
    const ranch = normalizeName(name);
    if (ranch) setSavedRanches(prev => (prev.includes(ranch) ? prev : [...prev, ranch]));
    return ranch;
  }, []);

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
  useEffect(() => setStorageItem('measure_pile', measurePile), [measurePile]);
  useEffect(() => setStorageItem('pending_record_keys', pendingKeys), [pendingKeys]);
  useEffect(() => setStorageItem('settings', settings), [settings]);
  useEffect(() => setStorageItem('cycles', cycles), [cycles]);
  useEffect(() => setStorageItem('ranch_names', savedRanches), [savedRanches]);
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

  const setMeasurePile = useCallback((pile: Pile) => {
    setMeasurePileState({
      ranchName: normalizeName(pile.ranchName) || DEFAULT_RANCH_NAME,
      location: normalizeName(pile.location),
    });
  }, []);

  /**
   * 목장의 현재 사이클.
   * 기록에 적힌 사이클 ID 가 먼저다 — 다른 기기에서 시작한 사이클도 시트를 읽으면 그대로 이어진다.
   */
  const getCycle = useCallback(
    (ranchName: string) => resolveCycle(records, ranchName, cycles[normalizeName(ranchName)] ?? null),
    [records, cycles]
  );

  /** 기록 → 사람이 추가한 목장 → 목표량·사이클만 있는 목장 → 기본 목장 순 */
  const ranchNames = useMemo(() => {
    const byRecent = [...records]
      .sort((a, b) => compareRecords(b, a))
      .map(r => normalizeName(r.ranchName));
    const all = [
      ...byRecent,
      ...savedRanches,
      ...Object.keys(settings.beddingTargetKg ?? {}),
      ...Object.keys(settings.sawdustPriceByRanch ?? {}),
      ...Object.keys(cycles),
    ].map(normalizeName);
    const list = [...new Set(all.filter(Boolean))];
    // 아무 목장도 없을 때만 기본 목장을 보여 준다
    return list.length > 0 ? list : [DEFAULT_RANCH_NAME];
  }, [records, savedRanches, settings.beddingTargetKg, settings.sawdustPriceByRanch, cycles]);

  const measuredRanchNames = useMemo(() => {
    const names = [...records]
      .filter(r => r.recordType !== 'inspection')
      .sort((a, b) => compareRecords(b, a))
      .map(r => normalizeName(r.ranchName))
      .filter(Boolean);
    return [...new Set(names)];
  }, [records]);

  const ranchHasRecords = useCallback(
    (name: string) => {
      const ranch = normalizeName(name);
      return records.some(r => normalizeName(r.ranchName) === ranch);
    },
    [records]
  );

  const removeRanch = useCallback(
    (name: string) => {
      const ranch = normalizeName(name);
      if (!ranch || ranchHasRecords(ranch)) return false;
      setSavedRanches(prev => prev.filter(n => n !== ranch));
      // 측정 탭이 지운 목장을 마지막 목장으로 기억하고 있으면 비운다
      setMeasurePileState(prev =>
        normalizeName(prev.ranchName) === ranch ? { ranchName: DEFAULT_RANCH_NAME, location: '' } : prev
      );
      setCycles(prev => {
        if (!(ranch in prev)) return prev;
        const next = { ...prev };
        delete next[ranch];
        return next;
      });
      setSettings(prev => {
        const hasTarget = ranch in (prev.beddingTargetKg ?? {});
        const hasPrice = ranch in (prev.sawdustPriceByRanch ?? {});
        const hasMonthly = ranch in (prev.sawdustMonthlyTonsByRanch ?? {});
        if (!hasTarget && !hasPrice && !hasMonthly) return prev;
        const targets = { ...prev.beddingTargetKg };
        const prices = { ...prev.sawdustPriceByRanch };
        const monthly = { ...prev.sawdustMonthlyTonsByRanch };
        delete targets[ranch];
        delete prices[ranch];
        delete monthly[ranch];
        return { ...prev, beddingTargetKg: targets, sawdustPriceByRanch: prices, sawdustMonthlyTonsByRanch: monthly };
      });
      return true;
    },
    [ranchHasRecords]
  );

  /** 깔개로 다 쓰고 새로 모으기 시작할 때. 오늘부터 새 사이클이 된다. */
  const startNewCycle = useCallback((ranchName: string) => {
    const name = normalizeName(ranchName) || DEFAULT_RANCH_NAME;
    const next = createCycle(name);
    setCycles(prev => ({ ...prev, [name]: next }));
    return next;
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
      if (result.denied) recheckAccess();

      if (result.scriptVersion) {
        setGoogleConfig(prev => ({ ...prev, scriptVersion: result.scriptVersion }));
      }
      if (result.success) setLastSheetLoadAt(Date.now());
      if (!result.success || !result.records) return result;

      const sheetIds = new Set(result.records.map(r => r.id));
      const pendingSet = new Set(pendingRef.current);
      // 시트에 없거나, 올리지 못한 사진이 남은 기록만 이 기기 쪽 값을 살려서 다시 보낸다
      const toPush = recordsRef.current.filter(
        r =>
          pendingSet.has(r.id) &&
          (!sheetIds.has(r.id) || r.pendingPhotoCount) &&
          (!isManager || normalizeName(r.ranchName) === managerRanch)
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
  }, [webhookUrl, markPending, applySyncResult, pushRecord, recheckAccess, isManager, managerRanch]);

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

    /*
     * 현장 점검과 수거·파봉 측정은 따로 저장하지만 같은 장소·같은 날짜면 한 기록으로 합친다.
     * 이번에 입력하지 않은 항목은 먼저 저장한 값을 그대로 둔다 —
     * 점검 뒤에 측정을 저장해도 혼합·곰팡이·악취·깔개 기록이 지워지지 않도록.
     */
    const isInspection = input.recordType === 'inspection';
    const hasCore = input.corePoints.length > 0;
    const corePoints = hasCore ? input.corePoints : existing?.corePoints ?? [];
    // 지점별로 잰 값의 평균을 기록의 심부 온도·함수율로 쓴다
    const average = hasCore
      ? averageCorePoints(input.corePoints)
      : { coreTemp: existing?.coreTemp ?? 0, moisture: existing?.moisture ?? 0 };
    const bedding = isInspection || !existing
      ? input
      : {
          beddingUsedKg: existing.beddingUsedKg,
          beddingLocation: existing.beddingLocation,
          beddingAmountDesc: existing.beddingAmountDesc,
        };
    // 비고는 사람이 적은 특이사항만 — 예전 버전이 자동으로 붙이던 [혼합 작업] 같은 줄은 걸러낸다
    const noteLines = [
      ...(existing?.notes?.split('\n') ?? []).filter(
        line => !/^\[(혼합 작업|곰팡이 관찰|깔개 활용)\]/.test(line.trim())
      ),
      ...(input.notes?.split('\n') ?? []),
    ].map(line => line.trim()).filter(Boolean);
    const notes = [...new Set(noteLines)].join('\n');

    /*
     * 이 기록이 속한 운영 사이클.
     * 예전 기록만 있어 ID 가 없던 더미에는 그 더미의 첫 날로 ID 를 만들어 붙인다 —
     * 지금 쌓여 있는 커피박과 새 기록이 한 사이클로 이어지게 하기 위해서다.
     */
    const resolved = getCycle(pile.ranchName);
    const cycle: OperatingCycle =
      resolved?.id ? resolved : createCycle(pile.ranchName, resolved?.startDate ?? input.date);
    if (!resolved?.id) setCycles(prev => ({ ...prev, [pile.ranchName]: cycle }));

    const addedKg =
      isInspection && existing
        ? existing.addedKg ?? existing.collectedKg
        : Math.max(0, Math.round(input.collectedKg));

    const record: MeasurementRecord = {
      id,
      ...pile,
      date: input.date,
      time: input.time,
      // 예전 '수거량' 칸과 새 '신규 투입량' 칸에 같은 값을 넣는다 (지난 기록도 계속 읽히도록)
      collectedKg: addedKg,
      addedKg,
      beddingUsedKg: Math.max(0, Math.round(bedding.beddingUsedKg ?? 0)) || undefined,
      beddingLocation: bedding.beddingLocation?.trim() || undefined,
      beddingAmountDesc: bedding.beddingAmountDesc?.trim() || undefined,
      recordType: input.recordType || 'measurement',
      mixed: input.mixed ?? existing?.mixed,
      moldStatus: input.moldStatus ?? existing?.moldStatus,
      hasMold: input.hasMold ?? existing?.hasMold,
      moldColor: isInspection ? input.moldColor?.trim() || undefined : existing?.moldColor,
      odor: input.odor ?? existing?.odor,
      cycleId: cycle.id ?? undefined,
      coreTemp: average.coreTemp,
      moisture: average.moisture,
      corePoints,
      ambientTemp: input.ambientTemp || existing?.ambientTemp || 0,
      ambientHum: input.ambientHum || existing?.ambientHum || 0,
      notes: notes || undefined,
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
    addRanch(pile.ranchName);
    // 측정 탭과 현장점검 탭은 각자 고른 목장을 기억한다
    if (record.recordType === 'inspection') setActivePile(pile);
    else setMeasurePile(pile);

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
  }, [records, settings, webhookUrl, setActivePile, setMeasurePile, addRanch, pushRecord, markPending, getCycle]);

  const deleteRecord = useCallback(async (id: string): Promise<SyncResult> => {
    // 기록 삭제는 회사 관리자만 (서버도 막는다 — 여기서 먼저 막아 기기 기록만 지워지는 일을 없앤다)
    if (isManager) {
      return { success: false, verified: true, message: '기록 삭제는 회사 관리자만 할 수 있습니다.' };
    }
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
  }, [records, settings, webhookUrl, applySyncResult, markPending, isManager]);

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
    if (isManager) {
      return { success: false, verified: true, message: '전체 초기화는 회사 관리자만 할 수 있습니다.' };
    }
    setRecords([]);
    setPendingKeys([]);
    clearPendingPhotos().catch(() => {});
    setActivePileState({ ranchName: DEFAULT_RANCH_NAME, location: '' });
    setMeasurePileState({ ranchName: DEFAULT_RANCH_NAME, location: '' });

    if (!webhookUrl) {
      return { success: true, verified: true, message: '앱의 기록을 모두 삭제했습니다.' };
    }

    const result = await clearAllFromGoogleSheets(webhookUrl);
    applySyncResult(result, 0);
    return result;
  }, [webhookUrl, applySyncResult, isManager]);

  const updateSettings = useCallback((newSettings: Partial<CompostSettings>) => {
    setSettings(prev => normalizeSettings({ ...prev, ...newSettings }));
  }, []);

  const updateGoogleConfig = useCallback((newConfig: Partial<GoogleSheetsConfig>) => {
    // 주소는 고정 — 화면에서 무엇을 넘겨도 바뀌지 않는다
    setGoogleConfig(prev => ({ ...prev, ...newConfig, sheetWebhookUrl: COMPOST_GAS_API_URL }));
  }, []);

  // 목장 매니저에게 보이는 기록·목장 — 같은 기기에서 관리자로 쓰던 다른 목장 기록이 남아 있어도 보이지 않게
  const visibleRecords = useMemo(
    () => (isManager ? records.filter(r => normalizeName(r.ranchName) === managerRanch) : records),
    [records, isManager, managerRanch]
  );
  const visibleRanchNames = useMemo(
    () => (isManager && managerRanch ? [managerRanch] : ranchNames),
    [isManager, managerRanch, ranchNames]
  );
  const visibleMeasuredRanchNames = useMemo(
    () => (isManager && managerRanch ? measuredRanchNames.filter(name => name === managerRanch) : measuredRanchNames),
    [isManager, managerRanch, measuredRanchNames]
  );
  const visiblePendingCount = useMemo(() => {
    if (!isManager) return pendingKeys.length;
    const ids = new Set(visibleRecords.map(r => r.id));
    return pendingKeys.filter(key => ids.has(key)).length;
  }, [isManager, pendingKeys, visibleRecords]);

  // 매니저의 현장점검은 늘 자기 목장
  useEffect(() => {
    if (!isManager || !managerRanch || normalizeName(activePile.ranchName) === managerRanch) return;
    const latest = [...records]
      .filter(r => normalizeName(r.ranchName) === managerRanch)
      .sort(compareRecords)
      .pop();
    setActivePile({ ranchName: managerRanch, location: latest?.location ?? '' });
  }, [isManager, managerRanch, activePile.ranchName, records, setActivePile]);

  // 컨텍스트 값을 메모이즈해야 Provider 리렌더마다 모든 소비자가 재렌더되는 것을 막을 수 있다.
  const value = useMemo<CompostContextValue>(
    () => ({
      records: visibleRecords,
      activePile,
      setActivePile,
      measurePile,
      setMeasurePile,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      setIsGoogleModalOpen,
      activeTab,
      setActiveTab,
      startInspection,
      ranchNames: visibleRanchNames,
      measuredRanchNames: visibleMeasuredRanchNames,
      addRanch,
      removeRanch,
      ranchHasRecords,
      // 매니저는 목장을 고를 필요가 없다
      ranchPicked: isManager ? true : ranchPicked,
      setRanchPicked,
      historyPileKey,
      setHistoryPileKey,
      getCycle,
      startNewCycle,
      saveRecord,
      deleteRecord,
      reloadFromSheet,
      isLoadingFromSheet,
      lastSheetLoadAt,
      isSheetBackend,
      pendingCount: visiblePendingCount,
      updateSettings,
      updateGoogleConfig,
      syncAllToGoogleSheets,
      resetAllData,
    }),
    [
      visibleRecords,
      activePile,
      setActivePile,
      measurePile,
      setMeasurePile,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      activeTab,
      startInspection,
      visibleRanchNames,
      visibleMeasuredRanchNames,
      addRanch,
      removeRanch,
      ranchHasRecords,
      isManager,
      ranchPicked,
      historyPileKey,
      getCycle,
      startNewCycle,
      saveRecord,
      deleteRecord,
      reloadFromSheet,
      isLoadingFromSheet,
      lastSheetLoadAt,
      isSheetBackend,
      visiblePendingCount,
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
