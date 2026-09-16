import React, { useState } from 'react';
import {
  ArrowLeft,
  Sliders,
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
import { DEFAULT_SETTINGS, SHEET_WEBHOOK_URL } from '../../constants/defaultData';
import { REQUIRED_SCRIPT_VERSION, testGoogleSheetsConnection } from '../../services/googleSheetsService';
import { getCurrentDateTimeString } from '../../utils/calculations';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type SettingSection = 'criteria' | 'sheets' | 'data' | 'app';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    googleConfig,
    updateGoogleConfig,
    setIsGoogleModalOpen,
    resetAllData,
    records,
    pendingCount,
    setActiveTab,
  } = useCompost();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  // 계층형 섹션 선택 상태
  const [activeSection, setActiveSection] = useState<SettingSection>('criteria');

  // 판정 기준 상태
  const [usableMin, setUsableMin] = useState<number>(settings.usableMoistureMin);
  const [usableMax, setUsableMax] = useState<number>(settings.usableMoistureMax);
  const [probeDepth, setProbeDepth] = useState<number>(settings.coreProbeDepthCm);
  const [highMoisture, setHighMoisture] = useState<number>(settings.highMoistureThreshold);
  const [highTemp, setHighTemp] = useState<number>(settings.highTempThreshold);

  const [isTesting, setIsTesting] = useState<boolean>(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (usableMin >= usableMax) {
      showToast('깔개 사용 함수율 범위를 확인해주세요', '하한이 상한보다 작아야 합니다', 'warning');
      return;
    }
    updateSettings({
      usableMoistureMin: usableMin,
      usableMoistureMax: usableMax,
      coreProbeDepthCm: probeDepth,
      highMoistureThreshold: highMoisture,
      highTempThreshold: highTemp,
    });
    showToast('설정이 성공적으로 저장되었습니다', undefined, 'success');
  };

  const handleResetDefaults = () => {
    setUsableMin(DEFAULT_SETTINGS.usableMoistureMin);
    setUsableMax(DEFAULT_SETTINGS.usableMoistureMax);
    setProbeDepth(DEFAULT_SETTINGS.coreProbeDepthCm);
    setHighMoisture(DEFAULT_SETTINGS.highMoistureThreshold);
    setHighTemp(DEFAULT_SETTINGS.highTempThreshold);
    updateSettings(DEFAULT_SETTINGS);
    showToast('기본 설정값으로 복원되었습니다', undefined, 'info');
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
    const res = await testGoogleSheetsConnection(SHEET_WEBHOOK_URL);
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
    { id: 'sheets', label: 'Google Sheets', icon: Table },
    { id: 'data', label: '데이터 관리', icon: Database },
    { id: 'app', label: '화면 및 정보', icon: Info },
  ];

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto pb-10 space-y-5">
      {/* 1. 상단 네비게이션 헤더 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] active:scale-95 transition-all text-[#1D1D1F] dark:text-[#F5F5F7]"
          title="오늘 화면으로 돌아가기"
          aria-label="오늘 화면으로 돌아가기"
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
          const isActive = activeSection === sec.id;
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
      {activeSection === 'criteria' && (
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
            {/* 깔개 사용 가능 함수율 하한 */}
            <div className="flex items-center justify-between p-3.5 sm:p-4">
              <div>
                <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
                  깔개 사용 함수율 하한
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">과도 건조 방지 하한 기준</span>
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
                  깔개 사용 함수율 상한
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">이하로 감량 시 우사 투입 가능</span>
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

      {/* 3-2. Google Sheets 연동 섹션 */}
      {activeSection === 'sheets' && (
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
              <span className="text-[#6E6E73] dark:text-[#8E8E93]">{SHEET_WEBHOOK_URL}</span>
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
          </Card>
        </div>
      )}

      {/* 3-3. 데이터 관리 섹션 */}
      {activeSection === 'data' && (
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

      {/* 3-4. 화면 및 앱 정보 섹션 */}
      {activeSection === 'app' && (
        <div className="space-y-4 animate-in fade-in duration-150">
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
