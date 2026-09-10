import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { evaluateFermentation } from '../../utils/calculations';

interface MeasurementInputGridProps {
  onLiveChange?: (coreTemp: number, ambientTemp: number, moisture: number) => void;
}

/** 현장에서 자주 적는 특이사항. 탭 한 번으로 넣고 뺄 수 있다. */
const QUICK_NOTES = ['교반 실시', '침출수 발생', '악취 심함', '강우', '차수막 덮음', '송풍 가동'] as const;

const NOTE_SEPARATOR = ', ';

/** 특이사항 문구를 항목 단위로 분해 */
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

const MeasurementInputGridComponent: React.FC<MeasurementInputGridProps> = ({ onLiveChange }) => {
  const { latestLog, addMeasurementLog, settings, activeBatch, googleConfig, isSyncing, isActiveBatchCompleted, daysElapsed } = useCompost();
  const { showToast } = useToast();

  const [coreTemp, setCoreTemp] = useState<number>(latestLog?.coreTemp ?? 38.0);
  const [moisture, setMoisture] = useState<number>(latestLog?.moisture ?? 49.0);
  const [ambientTemp, setAmbientTemp] = useState<number>(latestLog?.ambientTemp ?? 24.0);
  const [ambientHum, setAmbientHum] = useState<number>(latestLog?.ambientHum ?? 62.0);
  const [notes, setNotes] = useState<string>('');

  // 활성 배치나 최신 로그가 변경될 때 기본값 동기화 (로그 자체가 교체될 때만)
  useEffect(() => {
    if (!latestLog) return;
    setCoreTemp(latestLog.coreTemp);
    setMoisture(latestLog.moisture);
    setAmbientTemp(latestLog.ambientTemp);
    setAmbientHum(latestLog.ambientHum);
  }, [latestLog?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 특이사항은 계측 시점의 사건이므로 다른 값처럼 무조건 이어받으면 안 된다.
   * 오늘자 기록을 다시 저장하는 경우(같은 일차)에만 기존 문구를 불러오고,
   * 새 날짜의 계측에서는 비운다. 안 그러면 어제의 '교반 실시'가 오늘 기록에 그대로 복사된다.
   */
  useEffect(() => {
    const isEditingSameDay = latestLog?.dayNumber === daysElapsed;
    setNotes(isEditingSameDay ? latestLog?.notes ?? '' : '');
  }, [latestLog?.id, daysElapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 부모가 콜백을 memo 하지 않아도 무한 루프가 나지 않도록 ref 로 최신 콜백만 보관한다.
  const onLiveChangeRef = useRef(onLiveChange);
  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  });

  // 실시간 변경 콜백 — 의존성은 "값"만. 콜백 참조는 의존성에서 제외.
  useEffect(() => {
    onLiveChangeRef.current?.(coreTemp, ambientTemp, moisture);
  }, [coreTemp, ambientTemp, moisture]);

  const tempDiff = Math.max(0, coreTemp - ambientTemp);

  const isGoogleLinked = useMemo(
    () => Boolean(googleConfig.autoSync && googleConfig.sheetWebhookUrl),
    [googleConfig.autoSync, googleConfig.sheetWebhookUrl]
  );

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

    await addMeasurementLog(
      {
        coreTemp,
        moisture,
        ambientTemp,
        ambientHum,
        notes,
      },
      () => {
        showToast('구글 시트 실시간 반영 성공!', `${activeBatch.code} 행이 스프레드시트에 추가되었습니다`, 'success');
      }
    );

    const verdict = evaluateFermentation(coreTemp, ambientTemp, moisture, settings);
    const subMsg = isGoogleLinked
      ? `구글 스프레드시트에 실시간 자동 기록됨 · ${verdict.title}`
      : `D일차 동기화 완료 · ${verdict.title}`;

    showToast('측정 데이터가 안전하게 저장되었습니다', subMsg, 'success');
    setNotes('');
  };

  return (
    <section className="w-full mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
          <h3 className="font-headline-sm text-[15px] font-bold text-on-surface tracking-tight whitespace-nowrap">
            현장 실측값 입력
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* 1. 심부 온도 */}
        <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-label-sm text-[12px] font-semibold text-on-surface whitespace-nowrap">심부 온도</span>
            <span className="px-1.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-caption text-[10px] font-bold whitespace-nowrap">
              권장 40~60℃
            </span>
          </div>

          <div className="my-1 text-center">
            <div className="flex items-center justify-center">
              <input
                className="w-16 sm:w-20 text-center font-display-metric text-[22px] sm:text-[24px] font-bold text-primary bg-transparent focus:outline-none selection:bg-primary-fixed tabular-nums"
                id="input-core-temp"
                step="0.5"
                type="number"
                value={coreTemp}
                onChange={(e) => setCoreTemp(parseFloat(e.target.value) || 0)}
              />
              <span className="font-display-metric text-[14px] text-outline ml-0.5">℃</span>
            </div>
          </div>
        </div>

        {/* 2. 심부 함수율 */}
        <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-label-sm text-[12px] font-semibold text-on-surface whitespace-nowrap">심부 함수율</span>
            <span className="px-1.5 py-0.5 rounded-full bg-primary-fixed-dim text-on-primary-fixed font-caption text-[10px] font-bold whitespace-nowrap">
              기준 ≤{settings.targetMoistureThreshold}%
            </span>
          </div>

          <div className="my-1 text-center">
            <div className="flex items-center justify-center">
              <input
                className="w-16 sm:w-20 text-center font-display-metric text-[22px] sm:text-[24px] font-bold text-secondary bg-transparent focus:outline-none selection:bg-secondary-fixed tabular-nums"
                id="input-moisture"
                step="1"
                type="number"
                value={moisture}
                onChange={(e) => setMoisture(parseFloat(e.target.value) || 0)}
              />
              <span className="font-display-metric text-[14px] text-outline ml-0.5">%</span>
            </div>
          </div>
        </div>

        {/* 3. 현재 외기온 */}
        <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-label-sm text-[12px] font-semibold text-on-surface whitespace-nowrap">현재 외기온</span>
            <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-[10px] whitespace-nowrap">
              축사 내부
            </span>
          </div>

          <div className="my-1 text-center">
            <div className="flex items-center justify-center">
              <input
                className="w-16 sm:w-20 text-center font-display-metric text-[22px] sm:text-[24px] font-bold text-on-surface bg-transparent focus:outline-none tabular-nums"
                id="input-ambient-temp"
                step="0.5"
                type="number"
                value={ambientTemp}
                onChange={(e) => setAmbientTemp(parseFloat(e.target.value) || 0)}
              />
              <span className="font-display-metric text-[14px] text-outline ml-0.5">℃</span>
            </div>
          </div>
        </div>

        {/* 4. 현재 외기습도 */}
        <div className="bg-surface-container-lowest p-2.5 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="font-label-sm text-[12px] font-semibold text-on-surface whitespace-nowrap">현재 외기습도</span>
            <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-[10px] whitespace-nowrap">
              상대습도
            </span>
          </div>

          <div className="my-1 text-center">
            <div className="flex items-center justify-center">
              <input
                className="w-16 sm:w-20 text-center font-display-metric text-[22px] sm:text-[24px] font-bold text-on-surface bg-transparent focus:outline-none tabular-nums"
                id="input-ambient-hum"
                step="1"
                type="number"
                value={ambientHum}
                onChange={(e) => setAmbientHum(parseFloat(e.target.value) || 0)}
              />
              <span className="font-display-metric text-[14px] text-outline ml-0.5">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 외기-심부 온도차 자동 산출 바 */}
      <div className="mt-1.5 bg-surface-container-high/60 rounded-xl px-3 py-1.5 flex items-center justify-between border border-outline-variant/20">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-secondary">difference</span>
          <span className="font-body-sm text-[12px] text-on-surface-variant whitespace-nowrap">
            외기-심부 온도차 산출
          </span>
        </div>
        <div className="font-label-numeric text-[13px] font-bold text-primary" id="temp-diff-display">
          {tempDiff.toFixed(1)} ℃
        </div>
      </div>

      {/* 특이사항 입력 — 시트의 비고 열에 그대로 기록된다 */}
      <div className="mt-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-secondary">sticky_note_2</span>
            <span className="font-label-sm text-[12px] font-semibold text-on-surface whitespace-nowrap">
              특이사항
            </span>
            <span className="font-caption text-[10px] text-outline whitespace-nowrap">선택</span>
          </div>
          {notes.trim() && (
            <button
              type="button"
              onClick={() => setNotes('')}
              className="font-caption text-[10.5px] text-outline hover:text-error"
            >
              지우기
            </button>
          )}
        </div>

        {/* 자주 쓰는 항목 — 장갑 낀 손으로도 한 번에 입력 */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {QUICK_NOTES.map(preset => {
            const active = hasNote(notes, preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setNotes(prev => toggleNote(prev, preset))}
                className={`px-2 py-1 rounded-lg font-caption text-[11px] font-semibold transition-all active:scale-95 ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container ring-1 ring-secondary/40'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="예) 우측 더미 하단 침출수 고임, 송풍기 1시간 가동"
          className="w-full bg-surface-container-low rounded-lg px-2.5 py-2 text-[12px] text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary placeholder:text-outline/70 resize-none leading-relaxed"
        />
        <div className="flex justify-end mt-0.5">
          <span className="font-caption text-[10px] text-outline tabular-nums">{notes.length}/200</span>
        </div>
      </div>

      {/* 데이터 저장 및 상태 갱신 버튼 */}
      <button
        onClick={handleSaveData}
        disabled={isSyncing || isActiveBatchCompleted}
        className="w-full mt-2 h-12 bg-primary hover:bg-primary/90 active:bg-primary-container text-on-primary font-headline-sm text-[14px] font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer disabled:opacity-75"
        id="save-data-btn"
        type="button"
      >
        <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>
          {isActiveBatchCompleted ? 'lock' : isSyncing ? 'sync' : 'cloud_upload'}
        </span>
        <span>
          {isActiveBatchCompleted
            ? '완숙 완료된 배치 — 계측 추가 불가'
            : isSyncing
            ? '구글 시트에 실시간 기록 중...'
            : googleConfig.sheetWebhookUrl
            ? '현장 데이터 저장 및 구글 시트 실시간 전송'
            : '현장 데이터 저장 및 판정 반영'}
        </span>
      </button>
    </section>
  );
};

export const MeasurementInputGrid = React.memo(MeasurementInputGridComponent);
MeasurementInputGrid.displayName = 'MeasurementInputGrid';
