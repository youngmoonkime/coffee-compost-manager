import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Batch, MeasurementLog, CompostSettings, ActiveTab, VerdictInfo, GoogleSheetsConfig } from '../types';
import { DEFAULT_BATCHES, DEFAULT_MEASUREMENTS, DEFAULT_SETTINGS } from '../constants/defaultData';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { getBatchPeriod, evaluateFermentation, getCurrentDateString, getCurrentTimeString } from '../utils/calculations';
import {
  sendMeasurementToGoogleSheets,
  sendBatchEventToGoogleSheets,
  syncAllDataToGoogleSheets,
  deleteMeasurementFromGoogleSheets,
  loadFromGoogleSheets,
  deleteBatchFromGoogleSheets,
  clearAllFromGoogleSheets,
  REQUIRED_SCRIPT_VERSION,
} from '../services/googleSheetsService';
import type { SyncResult } from '../services/googleSheetsService';

const DEFAULT_GOOGLE_CONFIG: GoogleSheetsConfig = {
  sheetWebhookUrl: '',
  autoSync: true, // URL 등록 시 기본 실시간 동기화
  lastSyncStatus: 'idle',
  totalSyncedCount: 0,
};

/**
 * 저장돼 있던 배치 데이터를 화면에 쓰기 전에 정합성을 맞춘다.
 * - 완료 배치인데 완료일이 없으면 마지막 계측일(없으면 반입일)로 채운다.
 *   완료일이 없으면 부숙 기간이 오늘 기준으로 계속 늘어나 'D+41일차 완숙완료'
 *   같은 모순된 표시가 된다.
 * - 목록은 항상 반입일 최신순으로 정렬한다.
 */
function normalizeBatches(rawBatches: Batch[], rawMeasurements: MeasurementLog[]): Batch[] {
  const lastMeasuredDate = new Map<string, string>();
  for (const m of rawMeasurements) {
    const prev = lastMeasuredDate.get(m.batchId);
    if (!prev || m.date > prev) lastMeasuredDate.set(m.batchId, m.date);
  }

  return [...rawBatches]
    .map(b => {
      if (b.status !== 'completed' || b.completedDate) return b;
      return { ...b, completedDate: lastMeasuredDate.get(b.id) || b.startDate };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export interface SaveMeasurementResult {
  saved: boolean;
  /** 시트 반영 결과 — 'skipped' 는 연동을 안 했거나 자동 전송이 꺼진 경우 */
  sheet: 'synced' | 'failed' | 'unverified' | 'skipped';
  message?: string;
}

export interface CompleteBatchResult {
  completed: boolean;
  reason?: 'not_found' | 'already_completed' | 'no_measurements';
}

export interface WeightUpdateResult {
  /** 값이 실제로 바뀌었는지 */
  changed: boolean;
  /** 구글 시트로 전송을 시도했는지 */
  syncedToSheet: boolean;
  /** 배포된 스크립트가 구버전이라 전송을 건너뛰었는지 */
  needsScriptRedeploy: boolean;
}

interface CompostContextValue {
  batches: Batch[];
  activeBatchId: string;
  activeBatch: Batch | undefined;
  measurements: MeasurementLog[];
  activeBatchMeasurements: MeasurementLog[];
  settings: CompostSettings;
  googleConfig: GoogleSheetsConfig;
  isSyncing: boolean;
  isGoogleModalOpen: boolean;
  setIsGoogleModalOpen: (open: boolean) => void;
  activeTab: ActiveTab;
  daysElapsed: number;
  /** 완료된 배치가 선택돼 있어 새 계측을 기록할 수 없는 상태인지 */
  isActiveBatchCompleted: boolean;
  latestLog: MeasurementLog | undefined;
  currentVerdict: VerdictInfo;
  setActiveBatchId: (id: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  addNewBatch: (batch: { code: string; ranchName: string; initialWeightKg: number; notes?: string }) => void;
  addMeasurementLog: (
    input: { coreTemp: number; ambientTemp: number; moisture: number; ambientHum: number; notes?: string }
  ) => Promise<SaveMeasurementResult>;
  /** 구글 시트(백엔드)에서 배치·계측 기록을 다시 읽어온다 */
  reloadFromSheet: () => Promise<SyncResult>;
  /** 시트에서 불러오는 중인지 */
  isLoadingFromSheet: boolean;
  /** 시트를 원본으로 쓰는 상태인지 (웹 앱 URL이 등록돼 있음) */
  isSheetBackend: boolean;
  updateSettings: (newSettings: Partial<CompostSettings>) => void;
  updateGoogleConfig: (newConfig: Partial<GoogleSheetsConfig>) => void;
  syncLogToGoogleSheets: (log: MeasurementLog) => Promise<SyncResult>;
  syncAllToGoogleSheets: () => Promise<SyncResult & { count: number }>;
  completeBatch: (batchId: string) => CompleteBatchResult;
  /** 계측 기록 삭제 — 시트에서도 제거 */
  deleteMeasurementLog: (logId: string) => Promise<SyncResult>;
  /** 배치 삭제 — 계측 기록까지 함께, 시트에서도 제거 */
  deleteBatch: (batchId: string) => Promise<SyncResult>;
  /** 커피박 수거량(kg) 수정 — 시트의 배치 관리현황에도 수정 이력이 남는다 */
  updateBatchWeight: (batchId: string, weightKg: number) => WeightUpdateResult;
  /** 배치·계측 기록을 모두 비운다. 시트에서도 비운다 (연동 설정·임계값은 유지) */
  resetBatchData: () => Promise<SyncResult>;
}

const CompostContext = createContext<CompostContextValue | null>(null);

export const CompostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [measurements, setMeasurements] = useState<MeasurementLog[]>(() =>
    getStorageItem<MeasurementLog[]>('measurements', DEFAULT_MEASUREMENTS)
  );

  const [batches, setBatches] = useState<Batch[]>(() =>
    normalizeBatches(
      getStorageItem<Batch[]>('batches', DEFAULT_BATCHES),
      getStorageItem<MeasurementLog[]>('measurements', DEFAULT_MEASUREMENTS)
    )
  );

  const [activeBatchId, setActiveBatchId] = useState<string>(() => {
    const saved = getStorageItem<string>('active_batch_id', '');
    if (saved && batches.some(b => b.id === saved)) return saved;
    // 완료된 배치를 기본 모니터링 대상으로 잡으면 맥락이 어긋난다.
    // 부숙 진행 중인 배치를 우선 고르고, 없을 때만 최신 배치로 떨어진다.
    const fermenting = batches.find(b => b.status === 'fermenting');
    return fermenting?.id || batches[0]?.id || '';
  });

  const [settings, setSettings] = useState<CompostSettings>(() =>
    getStorageItem<CompostSettings>('settings', DEFAULT_SETTINGS)
  );

  const [googleConfig, setGoogleConfig] = useState<GoogleSheetsConfig>(() =>
    getStorageItem<GoogleSheetsConfig>('google_config', DEFAULT_GOOGLE_CONFIG)
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('monitoring');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [isLoadingFromSheet, setIsLoadingFromSheet] = useState<boolean>(false);

  // localStorage 동기화
  useEffect(() => {
    setStorageItem('batches', batches);
  }, [batches]);

  useEffect(() => {
    setStorageItem('active_batch_id', activeBatchId);
  }, [activeBatchId]);

  useEffect(() => {
    setStorageItem('measurements', measurements);
  }, [measurements]);

  useEffect(() => {
    setStorageItem('settings', settings);
  }, [settings]);

  useEffect(() => {
    setStorageItem('google_config', googleConfig);
  }, [googleConfig]);

  // 활성 배치 객체
  const activeBatch = useMemo(() => {
    return batches.find(b => b.id === activeBatchId) || batches[0];
  }, [batches, activeBatchId]);

  // 활성 배치의 측정 기록 (일자순 정렬)
  const activeBatchMeasurements = useMemo(() => {
    if (!activeBatch) return [];
    return measurements
      .filter(m => m.batchId === activeBatch.id)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [measurements, activeBatch]);

  // 가장 최근 측정 기록
  const latestLog = useMemo(() => {
    if (activeBatchMeasurements.length === 0) return undefined;
    return activeBatchMeasurements[activeBatchMeasurements.length - 1];
  }, [activeBatchMeasurements]);

  // 부숙 경과 일수 — 완료된 배치는 완료일에서 멈춘다
  const daysElapsed = useMemo(() => {
    if (!activeBatch) return 1;
    return getBatchPeriod(activeBatch).days;
  }, [activeBatch]);

  /** 완료된 배치는 읽기 전용 — 새 계측을 기록할 수 없다 */
  const isActiveBatchCompleted = activeBatch?.status === 'completed';

  /** 구글 시트를 원본으로 쓰는 상태 */
  const isSheetBackend = Boolean(googleConfig.sheetWebhookUrl);

  // 현재 실시간 판정 결과
  const currentVerdict = useMemo(() => {
    const core = latestLog?.coreTemp ?? 38.0;
    const moist = latestLog?.moisture ?? 49.0;
    return evaluateFermentation(core, moist, settings);
  }, [latestLog, settings]);

  /**
   * 전송 결과를 상태에 반영.
   * 응답을 실제로 확인하지 못한 경우(verified === false)는 성공으로 집계하지 않는다.
   * 예전에는 no-cors 특성상 실패해도 무조건 성공으로 기록돼 "N건 기록됨" 숫자가
   * 실제 시트 내용과 어긋났다.
   */
  const applySyncResult = useCallback((result: SyncResult, syncedCount = 1) => {
    setGoogleConfig(prev => ({
      ...prev,
      lastSyncTime: `${getCurrentDateString()} ${getCurrentTimeString()}`,
      lastSyncStatus: !result.success ? 'error' : result.verified ? 'success' : 'unverified',
      lastSyncMessage: result.message,
      // 응답을 읽은 경우에만 스크립트 버전을 갱신한다 (no-cors 로 떨어졌을 땐 알 수 없음)
      scriptVersion: result.verified && result.scriptVersion ? result.scriptVersion : prev.scriptVersion,
      totalSyncedCount:
        (prev.totalSyncedCount || 0) + (result.success && result.verified ? syncedCount : 0),
    }));
  }, []);

  /**
   * 배포된 Apps Script 가 구버전이면 batch_updated 같은 새 이벤트를 처리하지 못하고
   * 계측 일지에 D+0 / 값 0 인 쓰레기 행을 만든다. 버전을 확인했고 낮다면 전송을 막는다.
   * (아직 한 번도 응답을 못 읽어 버전을 모르면 낙관적으로 보낸다 — 그 응답으로 버전을 학습한다.)
   */
  const isScriptOutdated =
    googleConfig.scriptVersion !== undefined && googleConfig.scriptVersion < REQUIRED_SCRIPT_VERSION;

  /**
   * 구글 시트를 원본으로 삼아 배치·계측 기록을 통째로 갈아끼운다.
   * localStorage 는 오프라인 캐시 역할만 한다 — 시트를 읽을 수 있으면 시트가 이긴다.
   */
  const reloadFromSheet = useCallback(async (): Promise<SyncResult> => {
    if (!googleConfig.sheetWebhookUrl) {
      return { success: false, verified: true, message: '구글 웹 앱 URL이 설정되지 않았습니다.' };
    }

    setIsLoadingFromSheet(true);
    try {
      const result = await loadFromGoogleSheets(
        googleConfig.sheetWebhookUrl,
        (core, moist) => evaluateFermentation(core, moist, settings).type
      );

      if (result.success && result.snapshot) {
        const { batches: sheetBatches, measurements: sheetMeasurements } = result.snapshot;
        setMeasurements(sheetMeasurements);
        setBatches(normalizeBatches(sheetBatches, sheetMeasurements));
        // 시트 기준으로 갈아끼웠으니 활성 배치도 다시 고른다
        setActiveBatchId(prev => {
          if (prev && sheetBatches.some(b => b.id === prev)) return prev;
          const fermenting = sheetBatches.find(b => b.status === 'fermenting');
          return fermenting?.id || sheetBatches[0]?.id || '';
        });
      }

      if (result.scriptVersion) {
        setGoogleConfig(prev => ({ ...prev, scriptVersion: result.scriptVersion }));
      }

      return result;
    } finally {
      setIsLoadingFromSheet(false);
    }
  }, [googleConfig.sheetWebhookUrl, settings]);

  /**
   * 앱을 열면 시트에서 자동으로 불러온다.
   * URL 이 바뀌었을 때도 다시 읽는다. 실패하면 캐시된 로컬 데이터를 그대로 쓴다.
   */
  const hydratedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const url = googleConfig.sheetWebhookUrl;
    if (!url || hydratedUrlRef.current === url) return;

    hydratedUrlRef.current = url;
    reloadFromSheet().catch(() => {});
  }, [googleConfig.sheetWebhookUrl, reloadFromSheet]);

  // 구글 시트 동기화 단일 실행 함수
  const syncLogToGoogleSheets = useCallback(async (log: MeasurementLog): Promise<SyncResult> => {
    if (!googleConfig.sheetWebhookUrl) {
      return { success: false, verified: true, message: '설정에서 구글 웹 앱 URL을 먼저 등록해주세요.' };
    }
    if (!activeBatch) {
      return { success: false, verified: true, message: '활성 배치가 없습니다.' };
    }

    setIsSyncing(true);
    const verdictInfo = evaluateFermentation(log.coreTemp, log.moisture, settings);
    const result = await sendMeasurementToGoogleSheets(
      googleConfig.sheetWebhookUrl,
      log,
      activeBatch,
      verdictInfo.title
    );
    setIsSyncing(false);
    applySyncResult(result);

    return result;
  }, [googleConfig.sheetWebhookUrl, activeBatch, settings, applySyncResult]);

  // 새 하역 배치 등록 (구글 시트 연동)
  const addNewBatch = useCallback((batchData: {
    code: string;
    ranchName: string;
    initialWeightKg: number;
    notes?: string;
  }) => {
    const newId = `batch-${Date.now()}`;
    const newBatch: Batch = {
      id: newId,
      code: batchData.code,
      ranchName: batchData.ranchName,
      startDate: getCurrentDateString(),
      initialWeightKg: batchData.initialWeightKg,
      status: 'fermenting',
      notes: batchData.notes || '신규 커피박 하역 배치',
    };

    setBatches(prev => [newBatch, ...prev]);
    setActiveBatchId(newId);

    // 계측 기록은 실제로 측정했을 때만 생긴다.
    // 예전에는 하역 등록 시 35℃/65% 같은 임의값으로 DAY 1 기록을 자동 생성해서,
    // 재본 적 없는 값이 이력과 구글 시트에 남았다.

    // 구글 시트에 배치 생성 이벤트 실시간 전송
    if (googleConfig.sheetWebhookUrl) {
      sendBatchEventToGoogleSheets(googleConfig.sheetWebhookUrl, newBatch, 'batch_created')
        .then(res => applySyncResult(res, 0))
        .catch(() => {});
    }
  }, [googleConfig.sheetWebhookUrl, applySyncResult]);

  // 측정 로그 추가 (구글 시트 실시간 자동 동기화 지원)
  const addMeasurementLog = useCallback(async (
    input: {
      coreTemp: number;
      ambientTemp: number;
      moisture: number;
      ambientHum: number;
      notes?: string;
    }
  ): Promise<SaveMeasurementResult> => {
    if (!activeBatch) return { saved: false, sheet: 'skipped', message: '활성 배치가 없습니다.' };
    // 완료된 배치에 새 계측을 붙이면 '완숙 완료 이후의 계측'이라는 모순이 생긴다.
    if (activeBatch.status === 'completed') {
      return { saved: false, sheet: 'skipped', message: '완숙 완료된 배치입니다.' };
    }

    const verdictInfo = evaluateFermentation(input.coreTemp, input.moisture, settings);

    // 심부온도는 외기와 비교하는 값이 아니라, 같은 더미를 기간을 두고 다시 재서
    // 추이를 보는 값이다. 직전 계측(이번 일차를 덮어쓰는 경우는 제외) 대비 변화를 남긴다.
    const previous = measurements
      .filter(m => m.batchId === activeBatch.id && m.dayNumber < daysElapsed)
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .pop();

    const newLog: MeasurementLog = {
      id: `log-${Date.now()}`,
      batchId: activeBatch.id,
      dayNumber: daysElapsed,
      date: getCurrentDateString(),
      time: getCurrentTimeString(),
      coreTemp: input.coreTemp,
      moisture: input.moisture,
      ambientTemp: input.ambientTemp,
      ambientHum: input.ambientHum,
      coreTempDelta: previous
        ? parseFloat((input.coreTemp - previous.coreTemp).toFixed(1))
        : undefined,
      verdict: verdictInfo.type,
      notes: input.notes?.trim() || undefined,
    };

    setMeasurements(prev => {
      // 앱은 (배치, 경과 일차)당 1건만 보관한다. 시트도 recordKey 로 같은 행을 갱신한다.
      const filtered = prev.filter(m => !(m.batchId === activeBatch.id && m.dayNumber === daysElapsed));
      return [...filtered, newLog];
    });

    // 구글 시트 자동 동기화 활성화 시 실시간 전송
    if (!googleConfig.sheetWebhookUrl) {
      return { saved: true, sheet: 'skipped' };
    }

    setIsSyncing(true);
    try {
      const res = await sendMeasurementToGoogleSheets(
        googleConfig.sheetWebhookUrl,
        newLog,
        activeBatch,
        verdictInfo.title
      );
      applySyncResult(res);

      return {
        saved: true,
        sheet: !res.success ? 'failed' : res.verified ? 'synced' : 'unverified',
        message: res.message,
      };
    } catch (err) {
      console.error('구글 시트 실시간 전송 오류:', err);
      return {
        saved: true,
        sheet: 'failed',
        message: err instanceof Error ? err.message : '시트 전송 중 오류가 발생했습니다.',
      };
    } finally {
      setIsSyncing(false);
    }
  }, [activeBatch, daysElapsed, settings, measurements, googleConfig.sheetWebhookUrl, applySyncResult]);

  // 전체 데이터 구글 시트 일괄 동기화 (Bulk Sync)
  const syncAllToGoogleSheets = useCallback(async () => {
    if (!googleConfig.sheetWebhookUrl) {
      return { success: false, verified: true, count: 0, message: '구글 웹 앱 URL이 설정되지 않았습니다.' };
    }

    setIsSyncing(true);
    const result = await syncAllDataToGoogleSheets(
      googleConfig.sheetWebhookUrl,
      batches,
      measurements,
      (c, m) => evaluateFermentation(c, m, settings).title
    );
    setIsSyncing(false);

    // 일괄 동기화는 시트를 앱 기준으로 맞추는 작업이므로 누적이 아니라 "덮어쓰기"가 맞다.
    setGoogleConfig(prev => ({
      ...prev,
      lastSyncTime: `${getCurrentDateString()} ${getCurrentTimeString()}`,
      lastSyncStatus: !result.success ? 'error' : result.verified ? 'success' : 'unverified',
      lastSyncMessage: result.message,
      totalSyncedCount: result.success && result.verified ? result.count : prev.totalSyncedCount || 0,
    }));

    return result;
  }, [googleConfig.sheetWebhookUrl, batches, measurements, settings]);

  // 설정 업데이트
  const updateSettings = useCallback((newSettings: Partial<CompostSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // 구글 시트 설정 업데이트
  const updateGoogleConfig = useCallback((newConfig: Partial<GoogleSheetsConfig>) => {
    setGoogleConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  /**
   * ⚠️ 아래 세 함수의 전송 호출은 반드시 set*() 업데이터 "바깥"에 두어야 한다.
   * 업데이터 함수는 순수해야 하며, StrictMode(개발 모드)에서는 일부러 두 번 호출된다.
   * 업데이터 안에서 fetch 를 하면 시트에 같은 행이 두 번 기록된다.
   */

  // 배치 완료 처리 (구글 시트에 완료 이벤트 반영)
  const completeBatch = useCallback((batchId: string): CompleteBatchResult => {
    const target = batches.find(b => b.id === batchId);
    if (!target) return { completed: false, reason: 'not_found' };
    if (target.status === 'completed') return { completed: false, reason: 'already_completed' };

    // 계측 기록이 하나도 없는 배치를 완숙 완료로 넘기면 '완숙완료 · 계측 0회'라는
    // 근거 없는 이력이 남는다. 최소 1건은 있어야 한다.
    const hasMeasurements = measurements.some(m => m.batchId === batchId);
    if (!hasMeasurements) return { completed: false, reason: 'no_measurements' };

    const completed: Batch = {
      ...target,
      status: 'completed',
      completedDate: getCurrentDateString(),
    };

    setBatches(prev => prev.map(b => (b.id === batchId ? completed : b)));

    if (googleConfig.sheetWebhookUrl) {
      sendBatchEventToGoogleSheets(
        googleConfig.sheetWebhookUrl,
        completed,
        'batch_completed'
      )
        .then(res => applySyncResult(res, 0))
        .catch(() => {});
    }

    return { completed: true };
  }, [batches, measurements, googleConfig.sheetWebhookUrl, applySyncResult]);

  // 커피박 수거량(kg) 수정
  const updateBatchWeight = useCallback((batchId: string, weightKg: number): WeightUpdateResult => {
    const normalized = Math.max(0, Math.round(weightKg));
    const target = batches.find(b => b.id === batchId);
    if (!target || target.initialWeightKg === normalized) {
      return { changed: false, syncedToSheet: false, needsScriptRedeploy: false };
    }

    const updated: Batch = { ...target, initialWeightKg: normalized };
    setBatches(prev => prev.map(b => (b.id === batchId ? updated : b)));

    const linked = Boolean(googleConfig.sheetWebhookUrl);

    // 구버전 스크립트에 보내면 부숙일지에 쓰레기 행이 생기므로 전송하지 않는다.
    if (linked && isScriptOutdated) {
      return { changed: true, syncedToSheet: false, needsScriptRedeploy: true };
    }

    if (linked) {
      sendBatchEventToGoogleSheets(googleConfig.sheetWebhookUrl, updated, 'batch_updated')
        .then(res => applySyncResult(res, 0))
        .catch(() => {});
    }

    return { changed: true, syncedToSheet: linked, needsScriptRedeploy: false };
  }, [batches, googleConfig.sheetWebhookUrl, isScriptOutdated, applySyncResult]);

  /**
   * 배치와 계측 기록을 모두 비운다. 시트에서도 함께 비운다.
   * 시트만 남겨두면 다음 접속 때 지운 데이터가 그대로 되살아난다.
   * (연동 설정과 판정 임계값은 건드리지 않는다)
   */
  const resetBatchData = useCallback(async (): Promise<SyncResult> => {
    setBatches([]);
    setMeasurements([]);
    setActiveBatchId('');

    if (!googleConfig.sheetWebhookUrl) {
      return { success: true, verified: true, message: '앱의 기록을 모두 삭제했습니다.' };
    }

    const result = await clearAllFromGoogleSheets(googleConfig.sheetWebhookUrl);
    applySyncResult(result, 0);
    return result;
  }, [googleConfig.sheetWebhookUrl, applySyncResult]);

  /** 배치 삭제 — 그 배치의 계측 기록까지 함께, 시트에서도 제거 */
  const deleteBatch = useCallback(async (batchId: string): Promise<SyncResult> => {
    const target = batches.find(b => b.id === batchId);
    if (!target) {
      return { success: false, verified: true, message: '삭제할 배치를 찾지 못했습니다.' };
    }

    setMeasurements(prev => prev.filter(m => m.batchId !== batchId));
    setBatches(prev => {
      const remaining = prev.filter(b => b.id !== batchId);
      setActiveBatchId(current => {
        if (current !== batchId) return current;
        const fermenting = remaining.find(b => b.status === 'fermenting');
        return fermenting?.id || remaining[0]?.id || '';
      });
      return remaining;
    });

    if (!googleConfig.sheetWebhookUrl) {
      return { success: true, verified: true, message: `${target.code} 를 앱에서 삭제했습니다.` };
    }

    const result = await deleteBatchFromGoogleSheets(googleConfig.sheetWebhookUrl, target.code);
    applySyncResult(result, 0);
    return result;
  }, [batches, googleConfig.sheetWebhookUrl, applySyncResult]);

  // 측정 로그 삭제 — 시트의 해당 행도 함께 제거해야 앱 목록과 시트가 어긋나지 않는다.
  const deleteMeasurementLog = useCallback(async (logId: string): Promise<SyncResult> => {
    const target = measurements.find(m => m.id === logId);
    if (!target) {
      return { success: false, verified: true, message: '삭제할 기록을 찾지 못했습니다.' };
    }

    setMeasurements(prev => prev.filter(m => m.id !== logId));

    const batch = batches.find(b => b.id === target.batchId);
    if (!googleConfig.sheetWebhookUrl || !batch) {
      return { success: true, verified: true, message: '앱에서 삭제했습니다.' };
    }

    const result = await deleteMeasurementFromGoogleSheets(
      googleConfig.sheetWebhookUrl,
      batch.code,
      target.dayNumber
    );
    applySyncResult(result, 0);
    return result;
  }, [measurements, batches, googleConfig.sheetWebhookUrl, applySyncResult]);

  // 컨텍스트 값을 메모이즈해야 Provider 리렌더마다 모든 소비자가 재렌더되는 것을 막을 수 있다.
  const value = useMemo<CompostContextValue>(
    () => ({
      batches,
      activeBatchId,
      activeBatch,
      measurements,
      activeBatchMeasurements,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      setIsGoogleModalOpen,
      activeTab,
      daysElapsed,
      isActiveBatchCompleted,
      latestLog,
      currentVerdict,
      setActiveBatchId,
      setActiveTab,
      addNewBatch,
      addMeasurementLog,
      updateSettings,
      updateGoogleConfig,
      syncLogToGoogleSheets,
      syncAllToGoogleSheets,
      completeBatch,
      deleteMeasurementLog,
      deleteBatch,
      updateBatchWeight,
      resetBatchData,
      reloadFromSheet,
      isLoadingFromSheet,
      isSheetBackend,
    }),
    [
      batches,
      activeBatchId,
      activeBatch,
      measurements,
      activeBatchMeasurements,
      settings,
      googleConfig,
      isSyncing,
      isGoogleModalOpen,
      activeTab,
      daysElapsed,
      isActiveBatchCompleted,
      latestLog,
      currentVerdict,
      addNewBatch,
      addMeasurementLog,
      updateSettings,
      updateGoogleConfig,
      syncLogToGoogleSheets,
      syncAllToGoogleSheets,
      completeBatch,
      deleteMeasurementLog,
      deleteBatch,
      updateBatchWeight,
      resetBatchData,
      reloadFromSheet,
      isLoadingFromSheet,
      isSheetBackend,
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
