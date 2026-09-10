import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Batch, MeasurementLog, CompostSettings, ActiveTab, VerdictInfo, GoogleSheetsConfig } from '../types';
import { DEFAULT_BATCHES, DEFAULT_MEASUREMENTS, DEFAULT_SETTINGS } from '../constants/defaultData';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { getBatchPeriod, evaluateFermentation, getCurrentDateString, getCurrentTimeString } from '../utils/calculations';
import {
  sendMeasurementToGoogleSheets,
  sendBatchEventToGoogleSheets,
  syncAllDataToGoogleSheets,
  deleteMeasurementFromGoogleSheets,
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
    input: { coreTemp: number; ambientTemp: number; moisture: number; ambientHum: number; notes?: string },
    onSyncSuccess?: () => void
  ) => Promise<void>;
  updateSettings: (newSettings: Partial<CompostSettings>) => void;
  updateGoogleConfig: (newConfig: Partial<GoogleSheetsConfig>) => void;
  syncLogToGoogleSheets: (log: MeasurementLog) => Promise<SyncResult>;
  syncAllToGoogleSheets: () => Promise<SyncResult & { count: number }>;
  completeBatch: (batchId: string) => CompleteBatchResult;
  deleteMeasurementLog: (logId: string) => void;
  /** 커피박 수거량(kg) 수정 — 시트의 배치 관리현황에도 수정 이력이 남는다 */
  updateBatchWeight: (batchId: string, weightKg: number) => WeightUpdateResult;
  /** 배치·계측 기록을 모두 비운다 (구글 시트 설정과 판정 임계값은 유지) */
  resetBatchData: () => void;
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

  // 현재 실시간 판정 결과
  const currentVerdict = useMemo(() => {
    const core = latestLog?.coreTemp ?? 38.0;
    const ambient = latestLog?.ambientTemp ?? 24.0;
    const moist = latestLog?.moisture ?? 49.0;
    return evaluateFermentation(core, ambient, moist, settings);
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

  // 구글 시트 동기화 단일 실행 함수
  const syncLogToGoogleSheets = useCallback(async (log: MeasurementLog): Promise<SyncResult> => {
    if (!googleConfig.sheetWebhookUrl) {
      return { success: false, verified: true, message: '설정에서 구글 웹 앱 URL을 먼저 등록해주세요.' };
    }
    if (!activeBatch) {
      return { success: false, verified: true, message: '활성 배치가 없습니다.' };
    }

    setIsSyncing(true);
    const verdictInfo = evaluateFermentation(log.coreTemp, log.ambientTemp, log.moisture, settings);
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

    // 초기 측정값 자동 등록 (DAY 1)
    const initialLog: MeasurementLog = {
      id: `log-${Date.now()}`,
      batchId: newId,
      dayNumber: 1,
      date: getCurrentDateString(),
      time: getCurrentTimeString(),
      coreTemp: 35.0,
      moisture: 65.0,
      ambientTemp: 22.0,
      ambientHum: 60.0,
      tempDiff: 13.0,
      verdict: 'ongoing',
    };
    setMeasurements(prev => [...prev, initialLog]);

    // 구글 시트에 배치 생성 이벤트 실시간 전송
    if (googleConfig.sheetWebhookUrl && googleConfig.autoSync) {
      sendBatchEventToGoogleSheets(googleConfig.sheetWebhookUrl, newBatch, 'batch_created').catch(() => {});
    }
  }, [googleConfig.sheetWebhookUrl, googleConfig.autoSync]);

  // 측정 로그 추가 (구글 시트 실시간 자동 동기화 지원)
  const addMeasurementLog = useCallback(async (
    input: {
      coreTemp: number;
      ambientTemp: number;
      moisture: number;
      ambientHum: number;
      notes?: string;
    },
    onSyncSuccess?: () => void
  ) => {
    if (!activeBatch) return;
    // 완료된 배치에 새 계측을 붙이면 '완숙 완료 이후의 계측'이라는 모순이 생긴다.
    if (activeBatch.status === 'completed') return;

    const diff = Math.max(0, input.coreTemp - input.ambientTemp);
    const verdictInfo = evaluateFermentation(input.coreTemp, input.ambientTemp, input.moisture, settings);

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
      tempDiff: parseFloat(diff.toFixed(1)),
      verdict: verdictInfo.type,
      notes: input.notes?.trim() || undefined,
    };

    setMeasurements(prev => {
      // 앱은 (배치, 경과 일차)당 1건만 보관한다. 시트도 recordKey 로 같은 행을 갱신한다.
      const filtered = prev.filter(m => !(m.batchId === activeBatch.id && m.dayNumber === daysElapsed));
      return [...filtered, newLog];
    });

    // 구글 시트 자동 동기화 활성화 시 실시간 전송
    if (googleConfig.autoSync && googleConfig.sheetWebhookUrl) {
      setIsSyncing(true);
      try {
        const res = await sendMeasurementToGoogleSheets(
          googleConfig.sheetWebhookUrl,
          newLog,
          activeBatch,
          verdictInfo.title
        );
        applySyncResult(res);
        // 응답을 확인한 진짜 성공일 때만 성공 콜백을 호출한다.
        if (res.success && res.verified && onSyncSuccess) {
          onSyncSuccess();
        }
      } catch (err) {
        console.error('구글 시트 실시간 전송 오류:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [activeBatch, daysElapsed, settings, googleConfig.autoSync, googleConfig.sheetWebhookUrl, applySyncResult]);

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
      (c, a, m) => evaluateFermentation(c, a, m, settings).title
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

    if (googleConfig.sheetWebhookUrl && googleConfig.autoSync) {
      sendBatchEventToGoogleSheets(
        googleConfig.sheetWebhookUrl,
        completed,
        'batch_completed'
      ).catch(() => {});
    }

    return { completed: true };
  }, [batches, measurements, googleConfig.sheetWebhookUrl, googleConfig.autoSync]);

  // 커피박 수거량(kg) 수정
  const updateBatchWeight = useCallback((batchId: string, weightKg: number): WeightUpdateResult => {
    const normalized = Math.max(0, Math.round(weightKg));
    const target = batches.find(b => b.id === batchId);
    if (!target || target.initialWeightKg === normalized) {
      return { changed: false, syncedToSheet: false, needsScriptRedeploy: false };
    }

    const updated: Batch = { ...target, initialWeightKg: normalized };
    setBatches(prev => prev.map(b => (b.id === batchId ? updated : b)));

    const linked = Boolean(googleConfig.sheetWebhookUrl && googleConfig.autoSync);

    // 구버전 스크립트에 보내면 부숙일지에 쓰레기 행이 생기므로 전송하지 않는다.
    if (linked && isScriptOutdated) {
      return { changed: true, syncedToSheet: false, needsScriptRedeploy: true };
    }

    if (linked) {
      sendBatchEventToGoogleSheets(googleConfig.sheetWebhookUrl, updated, 'batch_updated')
        .then(applySyncResult)
        .catch(() => {});
    }

    return { changed: true, syncedToSheet: linked, needsScriptRedeploy: false };
  }, [batches, googleConfig.sheetWebhookUrl, googleConfig.autoSync, isScriptOutdated, applySyncResult]);

  /**
   * 배치와 계측 기록을 모두 비운다.
   * 구글 시트 연동 설정과 판정 임계값은 건드리지 않으며,
   * 시트에 이미 기록된 행도 지우지 않는다.
   */
  const resetBatchData = useCallback(() => {
    setBatches([]);
    setMeasurements([]);
    setActiveBatchId('');
  }, []);

  // 측정 로그 삭제 — 시트의 해당 행도 함께 제거해야 앱 목록과 시트가 어긋나지 않는다.
  const deleteMeasurementLog = useCallback((logId: string) => {
    const target = measurements.find(m => m.id === logId);
    if (!target) return;

    setMeasurements(prev => prev.filter(m => m.id !== logId));

    if (googleConfig.sheetWebhookUrl && googleConfig.autoSync) {
      const batch = batches.find(b => b.id === target.batchId);
      if (batch) {
        deleteMeasurementFromGoogleSheets(
          googleConfig.sheetWebhookUrl,
          batch.code,
          target.dayNumber
        ).catch(() => {});
      }
    }
  }, [measurements, batches, googleConfig.sheetWebhookUrl, googleConfig.autoSync]);

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
      updateBatchWeight,
      resetBatchData,
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
      updateBatchWeight,
      resetBatchData,
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
