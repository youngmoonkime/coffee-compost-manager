import React, { useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Sliders,
  Tractor,
  Table,
  Database,
  Info,
  RotateCcw,
  Sun,
  Moon,
} from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccess } from '../../contexts/AccessContext';
import { DEFAULT_SETTINGS, COMPOST_GAS_API_URL } from '../../constants/defaultData';
import { REQUIRED_SCRIPT_VERSION, testGoogleSheetsConnection } from '../../services/googleSheetsService';
import { getCurrentDateTimeString } from '../../utils/calculations';
import { fetchAiUsage, type AiUsageStatus } from '../../services/aiExplain';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type SettingSection = 'criteria' | 'ranches' | 'sheets' | 'data' | 'app';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    googleConfig,
    updateGoogleConfig,
    setIsGoogleModalOpen,
    resetAllData,
    records,
    ranchNames,
    pendingCount,
    setActiveTab,
  } = useCompost();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  const { isManager, managerRanch, info: accessInfo, signOut } = useAccess();

  // 계층형 섹션 선택 상태 — 목장 매니저는 '화면 및 정보'만
  const [activeSection, setActiveSection] = useState<SettingSection>('criteria');
  const currentSection: SettingSection = isManager ? 'app' : activeSection;

  // AI 사용량 — 버튼을 눌렀을 때만 읽는다 (AI 를 부르지 않고 횟수도 늘지 않는다)
  const [aiUsage, setAiUsage] = useState<AiUsageStatus | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const handleCheckAiUsage = async () => {
    setIsCheckingAi(true);
    try {
      setAiUsage(await fetchAiUsage(googleConfig.sheetWebhookUrl));
    } finally {
      setIsCheckingAi(false);
    }
  };

  // 판정 기준 상태
  const [usableMin, setUsableMin] = useState<number>(settings.usableMoistureMin);
  const [usableMax, setUsableMax] = useState<number>(settings.usableMoistureMax);
  const [probeDepth, setProbeDepth] = useState<number>(settings.coreProbeDepthCm);
  const [highMoisture, setHighMoisture] = useState<number>(settings.highMoistureThreshold);
  const [highTemp, setHighTemp] = useState<number>(settings.highTempThreshold);
  const [sawdustPrice, setSawdustPrice] = useState<number>(settings.sawdustPricePerTon);
  /** 목장별 톱밥 단가 — 빈 칸이면 기본 단가를 쓴다 */
  const [ranchPrices, setRanchPrices] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [ranch, won] of Object.entries(settings.sawdustPriceByRanch ?? {})) out[ranch] = String(won);
    return out;
  });
  /** 목장별 깔개 목표량 — 빈 칸이면 "아직 정하지 않음" */
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [ranch, kg] of Object.entries(settings.beddingTargetKg ?? {})) out[ranch] = String(kg);
    return out;
  });

  /** 목장 설정 탭에서 보고 있는 목장 — 목록에서 사라졌으면 첫 목장 */
  const [selectedRanch, setSelectedRanch] = useState<string>('');
  const currentRanch = ranchNames.includes(selectedRanch) ? selectedRanch : (ranchNames[0] ?? '');

  const [isTesting, setIsTesting] = useState<boolean>(false);


  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (usableMin >= usableMax) {
      showToast('사용 후보 함수율 범위를 확인해주세요', '하한이 상한보다 작아야 합니다', 'warning');
      return;
    }
    const beddingTargetKg: Record<string, number> = {};
    for (const [ranch, raw] of Object.entries(targets)) {
      const kg = Number(raw);
      if (Number.isFinite(kg) && kg > 0) beddingTargetKg[ranch] = Math.round(kg);
    }

    const sawdustPriceByRanch: Record<string, number> = {};
    for (const [ranch, raw] of Object.entries(ranchPrices)) {
      const won = Number(raw);
      if (Number.isFinite(won) && won > 0) sawdustPriceByRanch[ranch] = Math.round(won);
    }

    updateSettings({
      usableMoistureMin: usableMin,
      usableMoistureMax: usableMax,
      coreProbeDepthCm: probeDepth,
      highMoistureThreshold: highMoisture,
      highTempThreshold: highTemp,
      beddingTargetKg,
      sawdustPricePerTon: sawdustPrice,
      sawdustPriceByRanch,
    });
    showToast('설정이 성공적으로 저장되었습니다', undefined, 'success');
  };

  const handleResetDefaults = () => {
    setUsableMin(DEFAULT_SETTINGS.usableMoistureMin);
    setUsableMax(DEFAULT_SETTINGS.usableMoistureMax);
    setProbeDepth(DEFAULT_SETTINGS.coreProbeDepthCm);
    setHighMoisture(DEFAULT_SETTINGS.highMoistureThreshold);
    setHighTemp(DEFAULT_SETTINGS.highTempThreshold);
    // 목표량·톱밥 단가는 사람이 정한 값이라 기본값 복원에서 지우지 않는다
    updateSettings({
      ...DEFAULT_SETTINGS,
      beddingTargetKg: settings.beddingTargetKg,
      sawdustPricePerTon: settings.sawdustPricePerTon,
      sawdustPriceByRanch: settings.sawdustPriceByRanch,
    });
    showToast('기본 설정값으로 복원되었습니다', '목장별 깔개 목표량과 톱밥 단가는 그대로 두었습니다', 'info');
  };

  const handleResetAllData = async () => {
    const confirmed = window.confirm(
      `기록 ${records.length}건을 모두 삭제합니다.\n` +
      '앱과 구글 시트 양쪽에서 지워지며 되돌릴 수 없습니다.\n\n' +
      '(연동 설정과 판정 기준은 유지됩니다)\n\n계속할까요?'
    );
    if (!confirmed) return;

    const res = await resetAllData();
    showToast(
      '모든 이력을 삭제했습니다',
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const res = await testGoogleSheetsConnection(COMPOST_GAS_API_URL);
    setIsTesting(false);

    if (res.success) {
      updateGoogleConfig({
        lastSyncTime: getCurrentDateTimeString(),
        lastSyncStatus: res.verified ? 'success' : 'unverified',
        scriptVersion: res.verified ? res.scriptVersion : undefined,
        lastSyncMessage: res.message,
      });
      if (res.verified && (res.scriptVersion ?? 1) < REQUIRED_SCRIPT_VERSION) {
        showToast(
          `연결은 됐지만 스크립트가 v${res.scriptVersion ?? 1}입니다`,
          `최신 v${REQUIRED_SCRIPT_VERSION} 코드를 반영해주세요.`,
          'warning'
        );
      } else if (res.verified) {
        showToast('구글 시트 연동 확인!', `웹 앱이 정상 응답했습니다 (스크립트 v${res.scriptVersion})`, 'success');
      } else {
        showToast('전송함 (응답 미확인)', res.message, 'warning');
      }
    } else {
      showToast('연동 실패', res.message, 'error');
    }
  };

  const sections: { id: SettingSection; label: string; icon: React.ElementType }[] = [
    { id: 'criteria', label: '측정·판정 기준', icon: Sliders },
    { id: 'ranches', label: '목장 설정', icon: Tractor },
    { id: 'sheets', label: 'Google Sheets', icon: Table },
    { id: 'data', label: '데이터 관리', icon: Database },
    { id: 'app', label: '화면 및 정보', icon: Info },
  ].filter(sec => !isManager || sec.id === 'app') as { id: SettingSection; label: string; icon: React.ElementType }[];

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto pb-10 space-y-5">
      {/* 1. 상단 네비게이션 헤더 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] active:scale-95 transition-all text-[#1D1D1F] dark:text-[#F5F5F7]"
          title="현장점검 화면으로 돌아가기"
          aria-label="현장점검 화면으로 돌아가기"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] dark:text-[#FFFFFF] tracking-tight">
            설정
          </h2>
          <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
            현장 부숙 기준 및 시스템 구성을 계층별로 관리합니다.
          </p>
        </div>
      </div>

      {/* 2. 계층형 카테고리 세그먼트 셀렉터 (Apple Segmented Bar) */}
      <div className="flex bg-[#E5E5EA]/60 dark:bg-[#2C2C2E] p-1 rounded-2xl gap-1">
        {sections.map(sec => {
          const isActive = currentSection === sec.id;
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs'
                  : 'text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sec.label}</span>
              <span className="sm:hidden">{sec.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* 3. 계층형 섹션 본문 */}
      {/* 3-1. 측정 및 판정 기준 섹션 */}
      {currentSection === 'criteria' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93]">
              현장 측정 및 부숙 판정 기준치
            </span>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> 기본값 복원
            </button>
          </div>

          <Card className="p-0 overflow-hidden divide-y divide-black/5 dark:divide-white/10 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm">
            {/* 깔개 사용 후보 함수율 하한 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  사용 후보 함수율 하한
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">현장 관찰 기준 · 과도 건조 방지</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={usableMin}
                  onChange={e => setUsableMin(Number(e.target.value))}
                  className="w-16 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">%</span>
              </div>
            </div>

            {/* 깔개 사용 가능 함수율 상한 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  사용 후보 함수율 상한
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">
                  현장 관찰 기준 · 확정된 사용 기준이 아닙니다
                </span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={usableMax}
                  onChange={e => setUsableMax(Number(e.target.value))}
                  className="w-16 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">%</span>
              </div>
            </div>

            {/* 과습 경보 기준 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  과습 주의 경보 기준
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">초과 시 교반 및 건조박 혼합 권장</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={highMoisture}
                  onChange={e => setHighMoisture(Number(e.target.value))}
                  className="w-16 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">%</span>
              </div>
            </div>

            {/* 과열 경보 기준 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  과열 주의 경보 기준
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">초과 시 방열 교반 권장</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={highTemp}
                  onChange={e => setHighTemp(Number(e.target.value))}
                  className="w-16 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">℃</span>
              </div>
            </div>

            {/* 탐침 깊이 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  심부온도 측정 깊이
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">현장 센서 삽입 기준 깊이</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={probeDepth}
                  onChange={e => setProbeDepth(Number(e.target.value))}
                  className="w-16 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">cm</span>
              </div>
            </div>
          </Card>

          <Button type="submit" variant="primary" size="md" className="w-full">
            판정 기준 저장하기
          </Button>
        </form>
      )}

      {/* 3-2. 목장 설정 섹션 — 목장마다 다른 값(깔개 목표량·톱밥 단가)을 탭으로 나눠 본다 */}
      {currentSection === 'ranches' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 animate-in fade-in duration-150">
          <div className="px-1">
            <span className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93]">목장별 운영 설정</span>
          </div>

          {/* 공통 — 모든 목장에 적용 */}
          <Card className="p-0 overflow-hidden bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm">
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="inline-block mb-0.5 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-bold text-[#6E6E73] dark:text-[#8E8E93]">
                  공통
                </span>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">기본 톱밥 단가</span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">
                  목장 단가를 넣지 않은 목장에 씁니다 · 리포트 절감액 = 톤 × 단가
                </span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={sawdustPrice}
                  aria-label="기본 톱밥 단가 (원/톤)"
                  onChange={e => setSawdustPrice(Number(e.target.value))}
                  className="w-24 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                />
                <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">원/톤</span>
              </div>
            </div>
          </Card>

          {/* 목장 탭 */}
          <div role="tablist" aria-label="목장 선택" className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {ranchNames.map(ranch => {
              const selected = ranch === currentRanch;
              return (
                <button
                  key={ranch}
                  type="button"
                  role="tab"
                  id={`ranch-tab-${ranch}`}
                  aria-selected={selected}
                  aria-controls="ranch-tab-panel"
                  onClick={() => setSelectedRanch(ranch)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    selected
                      ? 'bg-[#315C36] text-white dark:bg-[#34C759] dark:text-black shadow-xs'
                      : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10'
                  }`}
                >
                  {ranch}
                </button>
              );
            })}
          </div>

          {/* 고른 목장의 값 */}
          {currentRanch && (
            <Card
              id="ranch-tab-panel"
              role="tabpanel"
              aria-labelledby={`ranch-tab-${currentRanch}`}
              className="p-0 overflow-hidden divide-y divide-black/5 dark:divide-white/10 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm"
            >
              <div className="flex items-center justify-between p-3.5 sm:p-4">
                <div>
                  <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">깔개 목표량</span>
                  <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">이만큼 모이면 깔개 사용을 검토합니다</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="미설정"
                    value={targets[currentRanch] ?? ''}
                    aria-label={`${currentRanch} 깔개 목표량 (kg)`}
                    onChange={e => setTargets(prev => ({ ...prev, [currentRanch]: e.target.value }))}
                    className="w-24 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">kg</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 sm:p-4">
                <div>
                  <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">톱밥 구매 단가</span>
                  <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">
                    비워 두면 기본 단가({sawdustPrice.toLocaleString('ko-KR')}원/톤)를 씁니다
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    placeholder="기본"
                    value={ranchPrices[currentRanch] ?? ''}
                    aria-label={`${currentRanch} 톱밥 단가 (원/톤)`}
                    onChange={e => setRanchPrices(prev => ({ ...prev, [currentRanch]: e.target.value }))}
                    className="w-24 h-9 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2 text-center text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">원/톤</span>
                </div>
              </div>
            </Card>
          )}

          <Button type="submit" variant="primary" size="md" className="w-full">
            목장 설정 저장하기
          </Button>
        </form>
      )}

      {/* 3-3. Google Sheets 연동 섹션 */}
      {currentSection === 'sheets' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <Card className="p-4 sm:p-5 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#315C36]/10 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Google Sheets 동기화
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#315C36]/15 text-[#315C36] dark:text-[#34C759] text-[10px] font-bold mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                    자동 연동 가동 중
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsGoogleModalOpen(true)}
              >
                상세 설정
              </Button>
            </div>

            <div className="p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] text-xs space-y-1 font-mono break-all">
              <span className="text-[10px] font-sans font-semibold text-[#8E8E93] block">
                연동 웹앱 웹훅 주소:
              </span>
              <span className="text-[#6E6E73] dark:text-[#8E8E93]">{COMPOST_GAS_API_URL}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10 text-xs text-[#6E6E73] dark:text-[#8E8E93]">
              <span>스크립트 버전: v{googleConfig.scriptVersion ?? 1}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isTesting}
                onClick={handleTestConnection}
              >
                {isTesting ? '테스트 중…' : '연결 진단 테스트'}
              </Button>
            </div>

            {/* 관리용: AI 사용량 */}
            <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-2 text-xs text-[#6E6E73] dark:text-[#8E8E93]">
              <div className="flex items-center justify-between gap-2">
                <span>
                  AI 사용량 (오늘):{' '}
                  {aiUsage?.success
                    ? `${aiUsage.usedToday}회 / 하루 ${aiUsage.dailyLimit}회`
                    : '확인 전'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isCheckingAi}
                  onClick={handleCheckAiUsage}
                >
                  {isCheckingAi ? '확인 중…' : 'AI 사용량 확인'}
                </Button>
              </div>
              {aiUsage?.success && (
                <p>
                  모델 {aiUsage.model} · Gemini 키 {aiUsage.keyConfigured ? '설정됨' : '없음'} · 상한은 스크립트 속성
                  AI_DAILY_LIMIT 로 바꿉니다.
                </p>
              )}
              {aiUsage && !aiUsage.success && <p className="text-[#D97706] dark:text-[#FF9F0A]">{aiUsage.message}</p>}
            </div>
          </Card>
        </div>
      )}

      {/* 3-4. 데이터 관리 섹션 */}
      {currentSection === 'data' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <Card className="p-4 sm:p-5 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  로컬 및 시트 데이터 현황
                </h3>
                <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
                  총 {records.length}건의 측정 기록 보관 중
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E]">
                <span className="text-[#8E8E93] block text-[11px]">오프라인 대기 큐</span>
                <strong className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {pendingCount}건
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E]">
                <span className="text-[#8E8E93] block text-[11px]">동기화 완료 이력</span>
                <strong className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {records.length - pendingCount}건
                </strong>
              </div>
            </div>

            {/* 위험 구역: 전체 삭제 */}
            <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#FF3B30] dark:text-[#FF453A] block">
                  전체 기록 초기화
                </span>
                <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                  앱과 시트의 모든 데이터를 영구 삭제합니다.
                </span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleResetAllData}
              >
                전체 삭제
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 3-5. 화면 및 앱 정보 섹션 */}
      {currentSection === 'app' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* 접속 권한 */}
          <Card className="p-4 sm:p-5 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-[#315C36]/10 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">접속 권한</h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] truncate">
                    {isManager
                      ? `${managerRanch} 매니저 · 현장점검과 현황만 사용`
                      : accessInfo?.open
                        ? '회사 관리자 · 접속 코드 미설정'
                        : '회사 관리자 · 전체 기능'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (window.confirm('이 기기에서 접속 코드를 지우고 코드 입력 화면으로 돌아갈까요?')) signOut();
                }}
              >
                코드 변경
              </Button>
            </div>
            {!isManager && accessInfo?.open && (
              <p className="text-[11.5px] leading-relaxed text-[#B06000] dark:text-[#FF9F0A] break-keep">
                아직 접속 코드가 설정되지 않아 주소를 아는 누구나 전체 기능을 쓸 수 있습니다. Apps Script 스크립트
                속성에 ADMIN_CODE(회사용)와 RANCH_CODE_목장이름(목장 매니저용)을 넣으면 코드 확인이 켜집니다.
              </p>
            )}
          </Card>

          <Card className="p-4 sm:p-5 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm space-y-4">
            <div>
              <span className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] block mb-2">
                화면 테마 설정
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    theme === 'dark'
                      ? 'bg-[#315C36] text-white shadow-xs'
                      : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]'
                  }`}
                >
                  <Moon className="w-4 h-4" /> 다크 모드 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'bg-[#315C36] text-white shadow-xs'
                      : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93]'
                  }`}
                >
                  <Sun className="w-4 h-4" /> 라이트 모드
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-1 text-xs text-[#6E6E73] dark:text-[#8E8E93]">
              <div className="flex justify-between">
                <span>애플리케이션 버전</span>
                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">v2.4.0</span>
              </div>
              <div className="flex justify-between">
                <span>적용 목장</span>
                <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">건준목장</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
