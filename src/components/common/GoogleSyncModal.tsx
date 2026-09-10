import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { GOOGLE_APPS_SCRIPT_CODE, GOOGLE_SHEETS_GUIDE_STEPS } from '../../constants/googleScriptTemplate';
import { testGoogleSheetsConnection, REQUIRED_SCRIPT_VERSION } from '../../services/googleSheetsService';
import { getCurrentDateTimeString } from '../../utils/calculations';

export const GoogleSyncModal: React.FC = () => {
  const {
    isGoogleModalOpen,
    setIsGoogleModalOpen,
    googleConfig,
    updateGoogleConfig,
    syncAllToGoogleSheets,
    measurements,
    batches,
  } = useCompost();
  const { showToast } = useToast();

  const [urlInput, setUrlInput] = useState(googleConfig.sheetWebhookUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'guide' | 'manage'>('manage');

  if (!isGoogleModalOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    showToast('Apps Script 코드가 복사되었습니다!', '스프레드시트 [확장 프로그램 > Apps Script]에 붙여넣으세요', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestPing = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      showToast('웹 앱 URL을 입력해주세요', undefined, 'warning');
      return;
    }

    setIsTesting(true);
    const res = await testGoogleSheetsConnection(trimmed);
    setIsTesting(false);

    if (res.success) {
      updateGoogleConfig({
        sheetWebhookUrl: trimmed,
        autoSync: true,
        lastSyncStatus: res.verified ? 'success' : 'unverified',
        scriptVersion: res.verified ? res.scriptVersion : undefined,
        lastSyncTime: getCurrentDateTimeString(),
        lastSyncMessage: res.message,
      });
      if (res.verified) {
        showToast('구글 시트 연동 성공!', '웹 앱이 정상 응답했습니다. 이제 실시간으로 자동 기록됩니다.', 'success');
      } else {
        showToast('전송함 (응답 미확인)', res.message, 'warning');
      }
    } else {
      showToast('연동 실패', res.message, 'error');
    }
  };

  const handleSaveUrl = () => {
    const trimmed = urlInput.trim();
    updateGoogleConfig({
      sheetWebhookUrl: trimmed,
      autoSync: trimmed.length > 0,
    });
    showToast('구글 시트 설정이 저장되었습니다', trimmed ? '실시간 동기화 활성화됨' : '동기화 비활성화됨', 'info');
    setIsGoogleModalOpen(false);
  };

  const handleBulkSync = async () => {
    if (!googleConfig.sheetWebhookUrl && !urlInput.trim()) {
      showToast('구글 웹 앱 URL을 먼저 등록해주세요', undefined, 'warning');
      return;
    }

    // URL 임시 저장
    if (urlInput.trim() !== googleConfig.sheetWebhookUrl) {
      updateGoogleConfig({ sheetWebhookUrl: urlInput.trim(), autoSync: true });
    }

    setIsBulkSyncing(true);
    const res = await syncAllToGoogleSheets();
    setIsBulkSyncing(false);

    if (res.success && res.verified) {
      showToast('일괄 동기화 완료!', `${res.count}건의 계측 기록이 구글 시트와 일치하도록 반영되었습니다`, 'success');
    } else if (res.success) {
      showToast('전송함 (결과 미확인)', res.message, 'warning');
    } else {
      showToast('일괄 동기화 실패', res.message, 'error');
    }
  };

  const isConnected = Boolean(googleConfig.sheetWebhookUrl && googleConfig.lastSyncStatus === 'success');
  const isScriptOutdated =
    googleConfig.scriptVersion !== undefined && googleConfig.scriptVersion < REQUIRED_SCRIPT_VERSION;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* 헤더 */}
        <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">table_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-headline-sm text-base font-bold text-on-surface">구글 스프레드시트 실시간 연동</h3>
                {isConnected && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 font-caption text-[10.5px] font-bold">
                    연동됨
                  </span>
                )}
              </div>
              <p className="font-caption text-[11px] text-outline">
                현장 계측 및 배치 데이터를 구글 시트에 실시간 자동 기록
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsGoogleModalOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 탭 세그먼트 */}
        <div className="flex border-b border-outline-variant/20 bg-surface-container-lowest px-4 pt-2">
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative ${
              activeSubTab === 'manage'
                ? 'text-primary border-b-2 border-primary'
                : 'text-outline hover:text-on-surface'
            }`}
            type="button"
          >
            연동 설정 및 동기화
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative ${
              activeSubTab === 'guide'
                ? 'text-primary border-b-2 border-primary'
                : 'text-outline hover:text-on-surface'
            }`}
            type="button"
          >
            1분 설정 가이드 &amp; 코드 복사
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {isScriptOutdated && (
            <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0">update</span>
              <div className="min-w-0">
                <span className="font-label-sm text-xs font-bold block">
                  배포된 스크립트가 구버전입니다 (v{googleConfig.scriptVersion} → v{REQUIRED_SCRIPT_VERSION} 필요)
                </span>
                <span className="font-caption text-[11px] block mt-0.5 leading-relaxed">
                  중복 행 방지와 수거량 수정 기록이 동작하지 않습니다. 아래 [1분 설정 가이드]에서 코드를
                  복사해 붙여넣고 <b>[배포] → [배포 관리] → 연필 → 버전 [새 버전]</b>으로 재배포해주세요.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('guide')}
                  className="mt-1.5 text-[11px] font-bold text-amber-900 underline"
                >
                  최신 스크립트 코드 보기
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'manage' ? (
            <>
              {/* 연동 상태 요약 박스 */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                googleConfig.sheetWebhookUrl
                  ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900'
                  : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[24px] ${
                    googleConfig.sheetWebhookUrl ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {googleConfig.sheetWebhookUrl ? 'cloud_done' : 'cloud_off'}
                  </span>
                  <div>
                    <span className="font-label-sm text-xs font-bold block">
                      {googleConfig.sheetWebhookUrl ? '실시간 자동 연동 활성화' : '구글 시트 미연동 상태'}
                    </span>
                    <span className="font-caption text-[11px] opacity-80 block">
                      {googleConfig.lastSyncTime
                        ? `최근 동기화: ${googleConfig.lastSyncTime} (${googleConfig.totalSyncedCount || 0}건 기록됨)`
                        : 'Web App URL을 등록하면 측정 시 자동 기록됩니다.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('guide')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/80 text-xs font-bold shadow-xs hover:bg-white active:scale-95 transition-all text-on-surface"
                >
                  가이드 보기
                </button>
              </div>

              {/* Web App URL 입력 및 테스트 */}
              <div className="space-y-1.5">
                <label className="font-label-sm text-xs font-bold text-on-surface flex items-center justify-between">
                  <span>Google Apps Script 웹 앱(Web App) URL</span>
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-secondary hover:underline flex items-center gap-0.5"
                  >
                    <span>새 구글 시트 열기</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 h-11 bg-surface-container-low rounded-xl px-3 text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary placeholder:text-outline/60 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestPing}
                    disabled={isTesting || !urlInput.trim()}
                    className="px-3 h-11 bg-secondary-container text-on-secondary-container rounded-xl text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px] animate-spin-none">
                      {isTesting ? 'sync' : 'wifi_tethering'}
                    </span>
                    <span>{isTesting ? '테스트...' : '연결 테스트'}</span>
                  </button>
                </div>
                <p className="font-caption text-[11px] text-outline">
                  구글 시트 배포 시 복사한 <strong>/exec</strong> 로 끝나는 웹 앱 URL을 붙여넣으세요.
                </p>
              </div>

              {/* 실시간 자동 전송 토글 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div>
                  <span className="font-label-md text-xs font-bold text-on-surface block">
                    계측 저장 시 실시간 자동 전송
                  </span>
                  <span className="font-caption text-[11px] text-outline">
                    모니터링 화면에서 [현장 데이터 저장] 클릭 시 시트에 즉시 행 추가
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={googleConfig.autoSync}
                    onChange={(e) => updateGoogleConfig({ autoSync: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* 전체 데이터 일괄 동기화 (Bulk Sync) */}
              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 border border-outline-variant/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">sync_saved_locally</span>
                    <div>
                      <span className="font-label-sm text-xs font-bold text-on-surface block">
                        기존 데이터 일괄 동기화 (Bulk Sync)
                      </span>
                      <span className="font-caption text-[11px] text-outline">
                        현재 앱에 저장된 모든 배치({batches.length}개) 및 계측 로그({measurements.length}개)
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkSync}
                  disabled={isBulkSyncing || (!googleConfig.sheetWebhookUrl && !urlInput.trim())}
                  className="w-full h-10 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-[17px] ${isBulkSyncing ? 'animate-spin' : ''}`}>
                    {isBulkSyncing ? 'sync' : 'upload'}
                  </span>
                  <span>
                    {isBulkSyncing ? '구글 시트로 일괄 전송 중...' : `전체 계측 이력 (${measurements.length}건) 시트로 보내기`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 코드 복사 헤더 */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary-container/40 border border-secondary-container">
                <div>
                  <span className="font-label-md text-xs font-bold text-on-surface block">
                    Apps Script 연동 코드
                  </span>
                  <span className="font-caption text-[11px] text-outline">
                    시트 헤더 생성, 판정별 색상 서식, 실시간/일괄 처리가 모두 포함된 코드
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? '복사됨!' : '코드 복사'}</span>
                </button>
              </div>

              {/* 5단계 설정 안내 */}
              <div className="space-y-2.5">
                <h4 className="font-label-sm text-xs font-bold text-on-surface">5단계 간편 배포 순서</h4>
                {GOOGLE_SHEETS_GUIDE_STEPS.map((step) => (
                  <div
                    key={step.step}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex gap-2.5 items-start"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.step}
                    </div>
                    <div>
                      <span className="font-label-sm text-xs font-bold text-on-surface block">
                        {step.title}
                      </span>
                      <p className="font-caption text-[11.5px] text-on-surface-variant mt-0.5 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsGoogleModalOpen(false)}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSaveUrl}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            설정 저장
          </button>
        </div>

      </div>
    </div>
  );
};
