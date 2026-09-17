import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { GOOGLE_APPS_SCRIPT_CODE, GOOGLE_SHEETS_GUIDE_STEPS } from '../../constants/googleScriptTemplate';
import { COMPOST_GAS_API_URL } from '../../constants/defaultData';
import { testGoogleSheetsConnection, REQUIRED_SCRIPT_VERSION } from '../../services/googleSheetsService';
import { getCurrentDateTimeString } from '../../utils/calculations';

export const GoogleSyncModal: React.FC = () => {
  const {
    isGoogleModalOpen,
    setIsGoogleModalOpen,
    googleConfig,
    updateGoogleConfig,
    syncAllToGoogleSheets,
    records,
  } = useCompost();
  const { showToast } = useToast();

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
    setIsTesting(true);
    const res = await testGoogleSheetsConnection(COMPOST_GAS_API_URL);
    setIsTesting(false);

    if (res.success) {
      updateGoogleConfig({
        lastSyncStatus: res.verified ? 'success' : 'unverified',
        scriptVersion: res.verified ? res.scriptVersion : undefined,
        lastSyncTime: getCurrentDateTimeString(),
        lastSyncMessage: res.message,
      });
      if (res.verified && (res.scriptVersion ?? 1) < REQUIRED_SCRIPT_VERSION) {
        showToast(
          `연결은 됐지만 스크립트가 v${res.scriptVersion ?? 1}입니다`,
          `최신 v${REQUIRED_SCRIPT_VERSION} 코드를 붙여넣고 [배포 관리 → 연필 → 버전: 새 버전]으로 배포해주세요.`,
          'warning'
        );
      } else if (res.verified) {
        showToast('구글 시트 연동 성공!', `웹 앱이 정상 응답했습니다 (스크립트 v${res.scriptVersion}). 이제 기록을 저장하면 시트에 자동 등록됩니다.`, 'success');
      } else {
        showToast('전송함 (응답 미확인)', res.message, 'warning');
      }
    } else {
      showToast('연동 실패', res.message, 'error');
    }
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    const res = await syncAllToGoogleSheets();
    setIsBulkSyncing(false);

    if (res.success && res.verified) {
      showToast('일괄 동기화 완료!', `기록 ${res.count}건이 구글 시트와 일치하도록 반영되었습니다`, 'success');
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
      <div className="bg-surface-container-lowest dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 dark:border-white/10 max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* 헤더 */}
        <div className="p-4 border-b border-outline-variant/20 dark:border-white/10 flex items-center justify-between bg-surface-container-low/50 dark:bg-[#2C2C2E]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">table_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-headline-sm text-base font-bold text-on-surface dark:text-[#F5F5F7]">구글 스프레드시트 연동</h3>
                {isConnected && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-caption text-[10.5px] font-bold">
                    연동됨
                  </span>
                )}
              </div>
              <p className="font-caption text-[11px] text-outline dark:text-[#8E8E93]">
                장소별 주간 기록을 구글 시트에 자동 등록
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsGoogleModalOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high dark:hover:bg-[#3A3A3C] flex items-center justify-center text-outline dark:text-[#8E8E93] hover:text-on-surface dark:hover:text-[#F5F5F7] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 탭 세그먼트 */}
        <div className="flex border-b border-outline-variant/20 dark:border-white/10 bg-surface-container-lowest dark:bg-[#1C1C1E] px-4 pt-2">
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative ${
              activeSubTab === 'manage'
                ? 'text-primary dark:text-[#34C759] border-b-2 border-primary dark:border-[#34C759]'
                : 'text-outline dark:text-[#8E8E93] hover:text-on-surface dark:hover:text-[#F5F5F7]'
            }`}
            type="button"
          >
            연동 설정 및 동기화
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative ${
              activeSubTab === 'guide'
                ? 'text-primary dark:text-[#34C759] border-b-2 border-primary dark:border-[#34C759]'
                : 'text-outline dark:text-[#8E8E93] hover:text-on-surface dark:hover:text-[#F5F5F7]'
            }`}
            type="button"
          >
            설정 가이드 &amp; 코드 복사
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
                  최신 기능(AI 리포트·설명, 목장별 탭, 파봉 사진)이나 보안 수정이 적용되지 않습니다. 아래 [설정 가이드]에서 코드를
                  복사해 붙여넣고, <b>setupPhotoFolder · setupAiAccess 실행(권한 허용)</b> 후 <b>[배포] → [배포 관리] → 연필 → 버전
                  [새 버전]</b>으로 재배포해주세요. (기존 시트 내용은 지워지지 않습니다)
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
              <div className="p-3.5 rounded-2xl border flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-emerald-700 dark:text-emerald-400">cloud_done</span>
                  <div>
                    <span className="font-label-sm text-xs font-bold block">"커피박 부숙 관리 대장" 시트에 자동 연동</span>
                    <span className="font-caption text-[11px] opacity-80 block">
                      {googleConfig.lastSyncTime
                        ? `최근 동기화: ${googleConfig.lastSyncTime}${
                            googleConfig.scriptVersion !== undefined ? ` · 스크립트 v${googleConfig.scriptVersion}` : ''
                          }`
                        : '기록을 저장하면 시트에 자동으로 등록됩니다.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('guide')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#2C2C2E] text-xs font-bold shadow-xs hover:bg-white dark:hover:bg-[#3A3A3C] active:scale-95 transition-all text-on-surface dark:text-[#F5F5F7]"
                >
                  가이드 보기
                </button>
              </div>

              {/* 고정된 웹 앱 주소 및 연결 테스트 */}
              <div className="space-y-1.5">
                <label className="font-label-sm text-xs font-bold text-on-surface dark:text-[#F5F5F7] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-outline dark:text-[#8E8E93]">lock</span>
                  연결된 웹 앱 주소 (앱에 고정)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={COMPOST_GAS_API_URL}
                    readOnly
                    aria-readonly="true"
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 h-11 bg-surface-container-low dark:bg-[#2C2C2E] rounded-xl px-3 text-xs text-on-surface-variant dark:text-[#F5F5F7] border border-outline-variant/40 dark:border-white/10 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestPing}
                    disabled={isTesting}
                    className="px-3 h-11 bg-secondary-container dark:bg-[#7a573b]/40 text-on-secondary-container dark:text-[#ffdcc3] rounded-xl text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px] animate-spin-none">
                      {isTesting ? 'sync' : 'wifi_tethering'}
                    </span>
                    <span>{isTesting ? '테스트...' : '연결 테스트'}</span>
                  </button>
                </div>
                <p className="font-caption text-[11px] text-outline dark:text-[#8E8E93] break-keep">
                  스크립트를 고칠 때는 <strong>[배포 관리 → 연필 → 새 버전]</strong>으로 배포해야 이 주소가 그대로 유지됩니다.
                  [새 배포]를 누르면 주소가 바뀌어 앱과 연결이 끊깁니다.
                </p>
              </div>

              {/* 전체 데이터 일괄 동기화 (Bulk Sync) */}
              <div className="p-3.5 rounded-2xl bg-surface-container-low/70 dark:bg-[#2C2C2E]/60 border border-outline-variant/30 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary dark:text-[#ffdcc3] text-[20px]">sync_saved_locally</span>
                    <div>
                      <span className="font-label-sm text-xs font-bold text-on-surface dark:text-[#F5F5F7] block">
                        기존 데이터 일괄 동기화 (Bulk Sync)
                      </span>
                      <span className="font-caption text-[11px] text-outline dark:text-[#8E8E93]">
                        현재 앱에 저장된 기록 {records.length}건을 시트와 일치시킵니다
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkSync}
                  disabled={isBulkSyncing}
                  className="w-full h-10 bg-primary/10 dark:bg-[#34C759]/15 hover:bg-primary/15 dark:hover:bg-[#34C759]/25 text-primary dark:text-[#34C759] border border-primary/20 dark:border-[#34C759]/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-[17px] ${isBulkSyncing ? 'animate-spin' : ''}`}>
                    {isBulkSyncing ? 'sync' : 'upload'}
                  </span>
                  <span>
                    {isBulkSyncing ? '구글 시트로 일괄 전송 중...' : `전체 기록 (${records.length}건) 시트로 보내기`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 코드 복사 헤더 */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary-container/40 dark:bg-[#7a573b]/20 border border-secondary-container dark:border-[#7a573b]/30">
                <div>
                  <span className="font-label-md text-xs font-bold text-on-surface dark:text-[#F5F5F7] block">
                    Apps Script 연동 코드
                  </span>
                  <span className="font-caption text-[11px] text-outline dark:text-[#8E8E93]">
                    시트 헤더 생성, 판정별 색상 서식, 단건/일괄 처리가 모두 포함된 코드
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

              {/* 단계별 설정 안내 */}
              <div className="space-y-2.5">
                <h4 className="font-label-sm text-xs font-bold text-on-surface dark:text-[#F5F5F7]">
                  {GOOGLE_SHEETS_GUIDE_STEPS.length}단계 배포 순서
                </h4>
                {GOOGLE_SHEETS_GUIDE_STEPS.map((step) => (
                  <div
                    key={step.step}
                    className="p-2.5 rounded-xl bg-surface-container-low dark:bg-[#2C2C2E]/60 border border-outline-variant/20 dark:border-white/10 flex gap-2.5 items-start"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.step}
                    </div>
                    <div>
                      <span className="font-label-sm text-xs font-bold text-on-surface dark:text-[#F5F5F7] block">
                        {step.title}
                      </span>
                      <p className="font-caption text-[11.5px] text-on-surface-variant dark:text-[#8E8E93] mt-0.5 leading-relaxed">
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
        <div className="p-4 border-t border-outline-variant/20 dark:border-white/10 bg-surface-container-low/40 dark:bg-[#2C2C2E]/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsGoogleModalOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
