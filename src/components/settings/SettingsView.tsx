import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_SETTINGS } from '../../constants/defaultData';
import { testGoogleSheetsConnection } from '../../services/googleSheetsService';
import { getCurrentDateTimeString } from '../../utils/calculations';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, googleConfig, updateGoogleConfig, setIsGoogleModalOpen, resetBatchData } = useCompost();
  const { showToast } = useToast();

  // 판정 기준 상태
  const [targetMoisture, setTargetMoisture] = useState<number>(settings.targetMoistureThreshold);
  const [probeDepth, setProbeDepth] = useState<number>(settings.coreProbeDepthCm);
  const [highMoisture, setHighMoisture] = useState<number>(settings.highMoistureThreshold);
  const [highTemp, setHighTemp] = useState<number>(settings.highTempThreshold);

  // 구글 시트 연동 상태
  const [sheetUrl, setSheetUrl] = useState<string>(googleConfig.sheetWebhookUrl);
  const [autoSync, setAutoSync] = useState<boolean>(googleConfig.autoSync);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // googleConfig 변경 시 로컬 입력창 동기화
  React.useEffect(() => {
    setSheetUrl(googleConfig.sheetWebhookUrl);
    setAutoSync(googleConfig.autoSync);
  }, [googleConfig.sheetWebhookUrl, googleConfig.autoSync]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      targetMoistureThreshold: targetMoisture,
      coreProbeDepthCm: probeDepth,
      highMoistureThreshold: highMoisture,
      highTempThreshold: highTemp,
    });
    updateGoogleConfig({
      sheetWebhookUrl: sheetUrl.trim(),
      autoSync,
    });
    showToast('설정이 성공적으로 저장되었습니다', undefined, 'success');
  };

  const handleResetDefaults = () => {
    setTargetMoisture(DEFAULT_SETTINGS.targetMoistureThreshold);
    setProbeDepth(DEFAULT_SETTINGS.coreProbeDepthCm);
    setHighMoisture(DEFAULT_SETTINGS.highMoistureThreshold);
    setHighTemp(DEFAULT_SETTINGS.highTempThreshold);
    updateSettings(DEFAULT_SETTINGS);
    showToast('기본 설정값으로 초기화되었습니다', undefined, 'info');
  };

  const handleResetBatchData = async () => {
    const confirmed = window.confirm(
      '배치와 계측 기록을 모두 삭제합니다.\n' +
      '앱과 구글 시트 양쪽에서 지워지며, 되돌릴 수 없습니다.\n\n' +
      '(연동 설정과 판정 임계값은 유지됩니다)\n\n계속할까요?'
    );
    if (!confirmed) return;

    const res = await resetBatchData();
    showToast(
      '모든 이력을 삭제했습니다',
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  const handleTestConnection = async () => {
    if (!sheetUrl.trim()) {
      showToast('구글 웹 앱 URL을 먼저 입력해주세요', undefined, 'warning');
      return;
    }
    setIsTesting(true);
    const res = await testGoogleSheetsConnection(sheetUrl.trim());
    setIsTesting(false);

    if (res.success) {
      updateGoogleConfig({
        sheetWebhookUrl: sheetUrl.trim(),
        lastSyncTime: getCurrentDateTimeString(),
        lastSyncStatus: res.verified ? 'success' : 'unverified',
        scriptVersion: res.verified ? res.scriptVersion : undefined,
        lastSyncMessage: res.message,
      });
      if (res.verified) {
        showToast('구글 시트 연동 확인!', '웹 앱이 정상 응답했습니다', 'success');
      } else {
        showToast('전송함 (응답 미확인)', res.message, 'warning');
      }
    } else {
      showToast('연동 실패', res.message, 'error');
    }
  };

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="mb-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">설정 및 현장 관리</h2>
        <p className="font-caption text-caption text-on-surface-variant mt-0.5">
          커피박 부숙도 자동 판정 임계치 및 구글 스프레드시트 연동
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4">
        {/* 1. 구글 스프레드시트 자동 동기화 설정 카드 */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">table_chart</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
                  구글 스프레드시트 자동 연동
                </h3>
                <span className="font-caption text-[11px] text-outline">
                  계측 시 실시간 자동 행(Row) 추가
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGoogleModalOpen(true)}
              className="text-xs font-bold text-secondary hover:underline flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-secondary-container/50"
            >
              <span className="material-symbols-outlined text-[15px]">settings_ethernet</span>
              <span>연동 마법사 &amp; 가이드</span>
            </button>
          </div>

          {/* 연동 상태 — 켜고 끄는 스위치가 아니라 사실 그대로의 안내.
              시트가 원본이므로 URL 이 등록돼 있으면 모든 변경이 항상 반영되어야 한다.
              (전송을 끌 수 있게 두면 앱에만 남은 기록이 다음 접속 때 사라진다) */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-container-low">
            <span className={`material-symbols-outlined text-[20px] shrink-0 ${
              googleConfig.sheetWebhookUrl ? 'text-primary' : 'text-outline'
            }`}>
              {googleConfig.sheetWebhookUrl ? 'cloud_done' : 'cloud_off'}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-xs font-bold text-on-surface">
                {googleConfig.sheetWebhookUrl
                  ? '구글 시트가 원본 저장소입니다'
                  : '아직 시트에 연결되지 않았습니다'}
              </span>
              <span className="font-caption text-[10.5px] text-outline leading-relaxed">
                {googleConfig.sheetWebhookUrl
                  ? '추가·수정·삭제가 모두 시트에 즉시 반영되고, 앱을 열면 시트에서 다시 불러옵니다.'
                  : '아래에 웹 앱 URL을 등록하면 모든 기록이 시트에 저장됩니다. 등록 전에는 이 기기에만 저장됩니다.'}
              </span>
            </div>
          </div>

          {/* Web App URL 입력창 */}
          <div>
            <label className="font-label-sm text-xs font-semibold text-on-surface block mb-1">
              Google Apps Script 웹 앱(Web App) URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="flex-1 h-11 bg-surface-container-low rounded-xl px-3 text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary placeholder:text-outline/70"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 h-11 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isTesting ? 'sync' : 'network_check'}
                </span>
                <span>{isTesting ? '테스트중' : '연결 테스트'}</span>
              </button>
            </div>
            {googleConfig.lastSyncTime && (
              <p className="font-caption text-[11px] text-outline mt-1.5 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  googleConfig.lastSyncStatus === 'success' ? 'bg-primary' : 'bg-error'
                }`}></span>
                최근 동기화: {googleConfig.lastSyncTime}
                {googleConfig.lastSyncStatus === 'success' ? ' (정상)' : ' (실패)'}
              </p>
            )}
          </div>
        </div>

        {/* 2. 완숙 판정 임계값 설정 */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
              완숙 투입 적합 기준치 설정
            </h3>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                완숙 목표 심부 함수율 한계선
              </label>
              <span className="font-label-numeric text-xs font-bold text-primary">
                ≤ {targetMoisture}%
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="55"
              step="1"
              value={targetMoisture}
              onChange={(e) => setTargetMoisture(parseInt(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="font-caption text-[11px] text-outline mt-0.5">
              축사 깔짚 투입 기준: 일반적으로 45% 이하 권장
            </p>
          </div>

          <div className="pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                심부온도 측정 깊이
              </label>
              <span className="font-label-numeric text-xs font-bold text-primary">
                {probeDepth}cm 이내
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={probeDepth}
              onChange={(e) => setProbeDepth(parseInt(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="font-caption text-[11px] text-outline mt-0.5">
              계측 화면에 안내되는 탐침 삽입 깊이입니다. 현장 기준이 바뀌면 여기서 조정하세요.
            </p>
          </div>
        </div>

        {/* 3. 과열 및 과습 주의 설정 */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-error text-[20px]">warning</span>
            <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">
              개입 필요 (뒤집기/교반) 경보 기준
            </h3>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                과열 심부 온도 경보치
              </label>
              <span className="font-label-numeric text-xs font-bold text-error">
                &gt; {highTemp}℃
              </span>
            </div>
            <input
              type="range"
              min="55"
              max="75"
              step="1"
              value={highTemp}
              onChange={(e) => setHighTemp(parseInt(e.target.value))}
              className="w-full accent-error cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                과습 함수율 경보치
              </label>
              <span className="font-label-numeric text-xs font-bold text-error">
                &gt; {highMoisture}%
              </span>
            </div>
            <input
              type="range"
              min="55"
              max="75"
              step="1"
              value={highMoisture}
              onChange={(e) => setHighMoisture(parseInt(e.target.value))}
              className="w-full accent-error cursor-pointer"
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex-1 h-12 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            기본값 복원
          </button>
          <button
            type="submit"
            className="flex-[2] h-12 bg-primary hover:bg-primary/90 text-on-primary font-headline-sm text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            모든 설정 저장
          </button>
        </div>
      </form>

      {/* 배치·계측 데이터 초기화 */}
      <div className="mt-4 bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/20">
        <h3 className="font-headline-sm text-[15px] font-bold text-on-surface">데이터 전체 삭제</h3>
        <p className="font-caption text-[11px] text-on-surface-variant mt-1 leading-relaxed">
          등록된 배치와 계측 기록을 앱과 구글 시트 양쪽에서 모두 지웁니다. 되돌릴 수 없습니다.
          <br />
          구글 시트 연동 설정과 판정 임계값은 그대로 유지되며, 이미 시트에 기록된 행은 지워지지 않습니다.
        </p>
        <button
          type="button"
          onClick={handleResetBatchData}
          className="mt-3 w-full h-11 rounded-xl border border-error/40 text-error font-label-md text-xs font-bold hover:bg-error-container/40 active:scale-99 transition-all flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
          모든 이력 삭제
        </button>
      </div>
    </div>
  );
};
