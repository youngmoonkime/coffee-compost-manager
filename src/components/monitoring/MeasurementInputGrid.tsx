import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { evaluateFermentation } from '../../utils/calculations';

interface MeasurementInputGridProps {
  onLiveChange?: (coreTemp: number, ambientTemp: number, moisture: number) => void;
}

/** 현장에서 자주 적는 특이사항. 탭 한 번으로 넣고 뺄 수 있다. */
const QUICK_NOTES = ['교반 실시', '침출수 발생', '악취 심함', '강우', '차수막 덮음', '송풍 가동'] as const;

const NOTE_SEPARATOR = ', ';

/** 값을 다 입력했다고 보고 다음 단계로 넘어가기까지 기다리는 시간 */
const AUTO_ADVANCE_DELAY = 800;

function splitNotes(text: string): string[] {
  return text.split(NOTE_SEPARATOR).map(t => t.trim()).filter(Boolean);
}

function hasNote(text: string, preset: string): boolean {
  return splitNotes(text).includes(preset);
}

/** 프리셋을 토글 — 이미 있으면 빼고, 없으면 뒤에 붙인다 */
function toggleNote(text: string, preset: string): string {
  const parts = splitNotes(text);
  const idx = parts.indexOf(preset);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(preset);
  return parts.join(NOTE_SEPARATOR);
}

/** 입력 문자열이 유효한 숫자인지 (빈 값·부분 입력은 아직 아님) */
function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const STEPS = [
  { id: 'core', title: '심부 온도' },
  { id: 'moisture', title: '심부 함수율' },
  { id: 'ambient', title: '외기 환경' },
  { id: 'review', title: '확인 및 저장' },
] as const;

const LAST_STEP = STEPS.length - 1;

/** iOS 스타일 대형 숫자 입력 */
const BigNumberField: React.FC<{
  value: string;
  unit: string;
  step: number;
  placeholder: string;
  label: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}> = ({ value, unit, step, placeholder, label, onChange, onCommit }) => (
  <div className="flex items-baseline justify-center gap-1 py-2">
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      placeholder={placeholder}
      autoFocus
      aria-label={label}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit();
        }
      }}
      className="w-[4.5ch] bg-transparent text-center font-display-metric text-[56px] leading-none font-semibold text-on-surface tabular-nums tracking-tight focus:outline-none caret-primary placeholder:text-outline/30"
    />
    <span className="font-display-metric text-[22px] font-medium text-outline">{unit}</span>
  </div>
);

/** iOS 그룹 리스트 한 줄 */
const SummaryRow: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({
  label,
  value,
  emphasis,
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 last:border-b-0">
    <span className="font-body-sm text-[15px] text-on-surface-variant">{label}</span>
    <span
      className={`font-label-numeric text-[15px] tabular-nums ${
        emphasis ? 'text-primary font-bold' : 'text-on-surface font-semibold'
      }`}
    >
      {value}
    </span>
  </div>
);

const MeasurementInputGridComponent: React.FC<MeasurementInputGridProps> = ({ onLiveChange }) => {
  const {
    activeBatchMeasurements,
    addMeasurementLog,
    settings,
    activeBatch,
    googleConfig,
    isSyncing,
    isActiveBatchCompleted,
    daysElapsed,
  } = useCompost();
  const { showToast } = useToast();

  // 입력은 항상 빈 칸에서 시작한다. 이전 값을 채워두면 재보지 않고 그대로 저장되기 쉽다.
  const [coreTempRaw, setCoreTempRaw] = useState('');
  const [moistureRaw, setMoistureRaw] = useState('');
  const [ambientTempRaw, setAmbientTempRaw] = useState('');
  const [ambientHumRaw, setAmbientHumRaw] = useState('');
  const [notes, setNotes] = useState('');

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const coreTemp = parseValue(coreTempRaw);
  const moisture = parseValue(moistureRaw);
  const ambientTemp = parseValue(ambientTempRaw);
  const ambientHum = parseValue(ambientHumRaw);

  /** 직전 계측 — 심부온도는 이 값과 비교해서 추이를 본다 */
  const previousLog = useMemo(() => {
    const earlier = activeBatchMeasurements.filter(m => m.dayNumber < daysElapsed);
    return earlier[earlier.length - 1];
  }, [activeBatchMeasurements, daysElapsed]);

  const resetForm = useCallback(() => {
    setCoreTempRaw('');
    setMoistureRaw('');
    setAmbientTempRaw('');
    setAmbientHumRaw('');
    setNotes('');
    setDirection('backward');
    setStepIndex(0);
  }, []);

  // 배치를 바꾸면 입력을 처음부터 다시 받는다
  useEffect(() => {
    resetForm();
  }, [activeBatch?.id, resetForm]);

  // 부모가 콜백을 memo 하지 않아도 무한 루프가 나지 않도록 ref 로 최신 콜백만 보관한다.
  const onLiveChangeRef = useRef(onLiveChange);
  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  });

  // 실시간 판정 미리보기 — 값이 다 들어온 뒤에만 의미가 있다
  useEffect(() => {
    if (coreTemp === null || moisture === null) return;
    onLiveChangeRef.current?.(coreTemp, ambientTemp ?? 0, moisture);
  }, [coreTemp, ambientTemp, moisture]);

  const goNext = useCallback(() => {
    setDirection('forward');
    setStepIndex(i => Math.min(LAST_STEP, i + 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection('backward');
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  /**
   * 값 입력이 끝나면 버튼 없이 다음 단계로 넘어간다.
   * 타이핑 도중(예: '4' 를 치고 '5' 를 칠 참)에 넘어가지 않도록 잠깐 기다린다.
   */
  const currentStepReady =
    stepIndex === 0 ? coreTemp !== null
    : stepIndex === 1 ? moisture !== null
    : stepIndex === 2 ? ambientTemp !== null && ambientHum !== null
    : false;

  useEffect(() => {
    if (stepIndex >= LAST_STEP || !currentStepReady) return;
    const timer = setTimeout(goNext, AUTO_ADVANCE_DELAY);
    return () => clearTimeout(timer);
  }, [stepIndex, currentStepReady, coreTempRaw, moistureRaw, ambientTempRaw, ambientHumRaw, goNext]);

  const isGoogleLinked = useMemo(
    () => Boolean(googleConfig.autoSync && googleConfig.sheetWebhookUrl),
    [googleConfig.autoSync, googleConfig.sheetWebhookUrl]
  );

  const verdict = useMemo(
    () => evaluateFermentation(coreTemp ?? 0, moisture ?? 0, settings),
    [coreTemp, moisture, settings]
  );

  const coreTempDelta =
    coreTemp !== null && previousLog ? coreTemp - previousLog.coreTemp : null;

  const handleSaveData = async () => {
    if (!activeBatch) {
      showToast('작업 관리 배치가 없습니다', '새 하역 등록을 먼저 진행해주세요', 'warning');
      return;
    }

    if (isActiveBatchCompleted) {
      showToast(
        '완숙 완료된 배치입니다',
        '이미 종료된 배치에는 계측을 추가할 수 없습니다. 진행 중인 배치를 선택해주세요.',
        'warning'
      );
      return;
    }

    if (coreTemp === null || moisture === null || ambientTemp === null || ambientHum === null) {
      showToast('입력이 완료되지 않았습니다', '비어 있는 항목을 채워주세요', 'warning');
      return;
    }

    const result = await addMeasurementLog({ coreTemp, moisture, ambientTemp, ambientHum, notes });

    if (!result.saved) {
      showToast('저장하지 못했습니다', result.message, 'error');
      return;
    }

    // 알림은 한 번만. 시트 반영 여부는 부제목으로 알린다.
    const sheetNote =
      result.sheet === 'synced' ? '구글 시트에 반영됨'
      : result.sheet === 'unverified' ? '시트 전송함 (반영 여부 미확인)'
      : result.sheet === 'failed' ? '시트 전송 실패 — 앱에는 저장됨'
      : '앱에 저장됨';

    showToast(
      `D+${daysElapsed}일차 계측 저장 완료`,
      `${verdict.title} · ${sheetNote}`,
      result.sheet === 'failed' ? 'warning' : 'success'
    );
    resetForm();
  };

  const step = STEPS[stepIndex];
  const animClass = direction === 'forward' ? 'step-forward' : 'step-backward';
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const renderStepBody = () => {
    switch (step.id) {
      case 'core':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-4 break-keep leading-relaxed">
              더미 표면에서 <strong className="text-on-surface">{settings.coreProbeDepthCm}cm 이내</strong> 깊이에
              탐침을 꽂고 안정된 값을 읽어주세요.
            </p>

            <BigNumberField
              label="심부 온도(℃)"
              value={coreTempRaw}
              unit="℃"
              step={0.5}
              placeholder="--"
              onChange={setCoreTempRaw}
              onCommit={goNext}
            />

            {previousLog ? (
              <div className="mt-2 rounded-2xl bg-surface-container-low px-4 py-3 soft-rise">
                <div className="flex items-center justify-between">
                  <span className="font-caption text-[12px] text-on-surface-variant">
                    직전 계측 (D+{previousLog.dayNumber} · {previousLog.date})
                  </span>
                  <span className="font-label-numeric text-[14px] font-semibold text-on-surface tabular-nums">
                    {previousLog.coreTemp} ℃
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-caption text-[12px] text-on-surface-variant">측정 간격</span>
                  <span className="font-label-numeric text-[13px] font-semibold text-secondary tabular-nums">
                    {daysElapsed - previousLog.dayNumber}일 만
                  </span>
                </div>
                {previousLog && (
                <SummaryRow label="직전 계측 간격" value={`${daysElapsed - previousLog.dayNumber}일`} />
              )}
              {coreTempDelta !== null && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/20">
                    <span className="font-caption text-[12px] text-on-surface-variant">변화</span>
                    <span
                      className={`font-label-numeric text-[14px] font-bold tabular-nums ${
                        coreTempDelta < 0 ? 'text-primary' : coreTempDelta > 0 ? 'text-error' : 'text-outline'
                      }`}
                    >
                      {coreTempDelta > 0 ? '+' : ''}
                      {coreTempDelta.toFixed(1)} ℃
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-center font-caption text-[12px] text-outline break-keep">
                첫 계측입니다. 기준값이 되며, 다음 계측 때 이 값과 비교합니다.
              </p>
            )}
          </>
        );

      case 'moisture':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-4 break-keep leading-relaxed">
              심부 시료의 수분 함량입니다. 완숙 판정의 기준이 됩니다.
            </p>

            <BigNumberField
              label="심부 함수율(%)"
              value={moistureRaw}
              unit="%"
              step={1}
              placeholder="--"
              onChange={setMoistureRaw}
              onCommit={goNext}
            />

            <div className="flex justify-center mt-1">
              <span className="px-3 py-1 rounded-full bg-primary-fixed-dim text-on-primary-fixed font-caption text-[12px] font-semibold">
                완숙 기준 ≤ {settings.targetMoistureThreshold}%
              </span>
            </div>
          </>
        );

      case 'ambient':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-4 break-keep leading-relaxed">
              축사 내부의 현재 온도와 습도입니다. 참고 기록용입니다.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low rounded-2xl py-3">
                <span className="block text-center font-caption text-[12px] text-on-surface-variant mb-1">
                  외기 온도
                </span>
                <div className="flex items-baseline justify-center gap-0.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    value={ambientTempRaw}
                    placeholder="--"
                    autoFocus
                    aria-label="외기 온도(℃)"
                    onChange={e => setAmbientTempRaw(e.target.value)}
                    className="w-[4ch] bg-transparent text-center font-display-metric text-[34px] leading-none font-semibold text-on-surface tabular-nums focus:outline-none caret-primary placeholder:text-outline/30"
                  />
                  <span className="font-display-metric text-[15px] text-outline">℃</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl py-3">
                <span className="block text-center font-caption text-[12px] text-on-surface-variant mb-1">
                  외기 습도
                </span>
                <div className="flex items-baseline justify-center gap-0.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={1}
                    value={ambientHumRaw}
                    placeholder="--"
                    aria-label="외기 습도(%)"
                    onChange={e => setAmbientHumRaw(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (ambientTemp !== null && ambientHum !== null) goNext();
                      }
                    }}
                    className="w-[4ch] bg-transparent text-center font-display-metric text-[34px] leading-none font-semibold text-on-surface tabular-nums focus:outline-none caret-primary placeholder:text-outline/30"
                  />
                  <span className="font-display-metric text-[15px] text-outline">%</span>
                </div>
              </div>
            </div>
          </>
        );

      case 'review':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-4 break-keep leading-relaxed">
              저장 전 값을 확인하고, 특이사항이 있으면 함께 남겨주세요.
            </p>

            <div className={`${verdict.bannerClass} rounded-2xl px-4 py-3 flex items-center gap-3 soft-rise`}>
              <span className={`material-symbols-outlined text-[24px] ${verdict.iconClass}`}>
                {verdict.icon}
              </span>
              <div className="min-w-0">
                <span className={`block font-headline-sm text-[15px] ${verdict.titleClass}`}>
                  {verdict.title}
                </span>
                <span className="block font-caption text-[11.5px] opacity-90 break-keep">
                  {verdict.subtitle}
                </span>
              </div>
            </div>

            <div className="mt-3 bg-surface-container-low rounded-2xl overflow-hidden soft-rise stagger-1">
              <SummaryRow label={`심부 온도 (${settings.coreProbeDepthCm}cm)`} value={`${coreTempRaw || '--'} ℃`} />
              {coreTempDelta !== null && (
                <SummaryRow
                  label="직전 계측 대비"
                  value={`${coreTempDelta > 0 ? '+' : ''}${coreTempDelta.toFixed(1)} ℃`}
                />
              )}
              <SummaryRow label="심부 함수율" value={`${moistureRaw || '--'} %`} emphasis />
              <SummaryRow label="외기 온도" value={`${ambientTempRaw || '--'} ℃`} />
              <SummaryRow label="외기 습도" value={`${ambientHumRaw || '--'} %`} />
              <SummaryRow label="기록 일차" value={`D+${daysElapsed}`} />
            </div>

            {/* 특이사항 */}
            <div className="mt-3 soft-rise stagger-2">
              <span className="block font-label-sm text-[13px] font-semibold text-on-surface mb-2">
                특이사항 <span className="font-caption text-[11px] text-outline font-normal">선택</span>
              </span>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map(preset => {
                  const active = hasNote(notes, preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNotes(prev => toggleNote(prev, preset))}
                      className={`px-3 py-1.5 rounded-full font-caption text-[12.5px] font-semibold transition-all active:scale-95 ${
                        active
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="예) 우측 더미 하단 침출수 고임, 송풍기 1시간 가동"
                className="mt-2 w-full bg-surface-container-low rounded-2xl px-3.5 py-3 text-[14px] text-on-surface border border-transparent focus:outline-none focus:border-primary/50 placeholder:text-outline/70 resize-none leading-relaxed"
              />
            </div>
          </>
        );
    }
  };

  return (
    <section className="w-full mb-3">
      <div className="bg-surface-container-lowest rounded-[22px] border border-outline-variant/20 shadow-sm overflow-hidden">
        {/* 진행 표시 */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-caption text-[11.5px] font-semibold text-outline tabular-nums">
              {stepIndex + 1} / {STEPS.length}
            </span>
            <span className="font-caption text-[11.5px] text-outline">현장 실측값 입력</span>
          </div>
          <div className="h-1 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 단계 본문 — key 를 바꿔 매 단계마다 등장 애니메이션이 다시 실행되게 한다 */}
        <div key={step.id} className={`px-5 pt-5 pb-4 ${animClass}`}>
          <h3 className="font-headline-md text-[24px] font-bold text-on-surface tracking-tight">
            {step.title}
          </h3>
          {renderStepBody()}
        </div>

        {/* 하단 액션 — 값 입력 단계는 자동으로 넘어가므로 '다음' 버튼이 없다 */}
        <div className="px-5 pb-5 pt-1 flex items-center gap-2.5">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="h-[52px] px-5 rounded-2xl bg-surface-container text-on-surface-variant font-headline-sm text-[16px] font-semibold active:scale-[0.97] transition-transform shrink-0"
            >
              이전
            </button>
          )}

          {stepIndex < LAST_STEP ? (
            <div className="flex-1 h-[52px] flex items-center justify-center">
              <span className="font-caption text-[12.5px] text-outline break-keep text-center">
                {currentStepReady ? '다음 단계로 넘어갑니다…' : '값을 입력하면 자동으로 넘어갑니다'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSaveData}
              disabled={isSyncing || isActiveBatchCompleted}
              className="flex-1 h-[52px] rounded-2xl bg-primary text-on-primary font-headline-sm text-[17px] font-semibold shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>
                {isActiveBatchCompleted ? 'lock' : isSyncing ? 'sync' : 'check_circle'}
              </span>
              <span className="truncate">
                {isActiveBatchCompleted
                  ? '완료된 배치'
                  : isSyncing
                  ? '기록 중...'
                  : isGoogleLinked
                  ? '저장 및 시트 전송'
                  : '계측 저장'}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export const MeasurementInputGrid = React.memo(MeasurementInputGridComponent);
MeasurementInputGrid.displayName = 'MeasurementInputGrid';
