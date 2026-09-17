import React, { useMemo, useRef, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import type { SaveRecordResult } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { useAccess } from '../../contexts/AccessContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';
import {
  averageCorePoints,
  compareRecords,
  getCurrentDateString,
  getCurrentTimeString,
  getPileRecords,
  CORE_POINT_COUNT,
  normalizeName,
} from '../../utils/calculations';
import { summarizeCycle } from '../../utils/fieldOps';
import { compressImage, MAX_PHOTOS_PER_RECORD } from '../../utils/photos';
import type { CorePoint, MeasurementRecord, MoldStatus, VerdictInfo } from '../../types';

import { StepIndicator } from './StepIndicator';
import { LocationStep } from './steps/LocationStep';
import { FieldWorkStep } from './steps/FieldWorkStep';
import { CollectionInputStep } from './steps/CollectionInputStep';
import { CoreMeasurementStep } from './steps/CoreMeasurementStep';
import type { PointState } from './steps/CoreMeasurementStep';
import { PhotoStep } from './steps/PhotoStep';
import { ReviewStep } from './steps/ReviewStep';
import { MeasurementResult } from './MeasurementResult';
import { Button } from '../ui/Button';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_LOCATION_CHIPS = 6;

/** 1. 현장 점검 플로우 스텝 (점검 장소와 일시 → 현장 상태 점검 → 점검 내용 확인) */
const INSPECTION_STEPS = [
  { id: 'place', title: '점검 장소와 일시', subtitle: '오늘 둘러본 목장과 장소, 점검 일시를 확인하세요.' },
  { id: 'work', title: '현장 상태 점검', subtitle: '혼합 유무, 곰팡이 발생 여부(색상/사진), 이상 악취, 깔개 활용을 점검합니다.' },
  { id: 'review', title: '점검 내용 확인', subtitle: '오늘 점검한 내용을 확인하고 기록을 저장하세요.' },
] as const;

/** 2. 수거 및 파봉 측정 플로우 스텝 (수거 투입량, 심부 3지점 측정, 파봉 사진) */
const MEASUREMENT_STEPS = [
  { id: 'place', title: '수거 장소와 일시', subtitle: '커피박을 하역한 목장과 장소, 작업 일시를 확인하세요.' },
  { id: 'input', title: '신규 커피박 수거량', subtitle: '오늘 새로 수거하여 더미에 부은 커피박 양(kg)을 입력하세요.' },
  { id: 'core', title: '심부 온도 및 함수율', subtitle: '동일 높이에서 30cm 간격으로 3곳의 수치를 측정합니다.' },
  { id: 'photo', title: '파봉 작업 사진 첨부', subtitle: '파봉 작업 현장 사진을 첨부할 수 있습니다.' },
  { id: 'review', title: '측정 내용 확인', subtitle: '오늘 측정한 내용을 확인하고 기록을 저장하세요.' },
] as const;

type StepId = 'place' | 'work' | 'input' | 'core' | 'photo' | 'review';

function parseValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface SaveOutcome {
  record: MeasurementRecord;
  verdict: VerdictInfo;
  sheet: SaveRecordResult['sheet'];
  photosUploaded: number;
  photosPending: number;
}

export type FlowMode = 'inspection' | 'measurement';

interface MeasurementFlowProps {
  /** 'inspection' = 현장 점검 기록, 'measurement' = 수거·파봉 측정 기록 */
  mode: FlowMode;
}

export const MeasurementFlow: React.FC<MeasurementFlowProps> = ({ mode: flowMode }) => {
  const {
    records,
    settings,
    activePile,
    setActivePile,
    measurePile,
    setMeasurePile,
    ranchNames,
    measuredRanchNames,
    removeRanch,
    ranchHasRecords,
    getCycle,
    saveRecord,
    isSyncing,
    setActiveTab,
    setHistoryPileKey,
  } = useCompost();
  const { showToast } = useToast();
  const { isManager } = useAccess();

  // 측정 탭은 현장점검 탭과 따로 목장·장소를 기억한다
  const basePile = flowMode === 'measurement' ? measurePile : activePile;
  const setBasePile = flowMode === 'measurement' ? setMeasurePile : setActivePile;

  const [ranchName, setRanchName] = useState(basePile.ranchName || DEFAULT_RANCH_NAME);
  const [location, setLocation] = useState(basePile.location);
  const [date, setDate] = useState(getCurrentDateString);
  const [time, setTime] = useState(getCurrentTimeString);

  // 현장 점검 항목 상태
  const [mixed, setMixed] = useState<boolean | null>(null);
  const [hasMold, setHasMold] = useState<boolean | null>(null);
  const [moldColor, setMoldColor] = useState('');
  const [moldPhotos, setMoldPhotos] = useState<string[]>([]);
  const [odor, setOdor] = useState<boolean | null>(null);

  // 깔개 활용 항목 상태
  const [hasBedding, setHasBedding] = useState<boolean | null>(null);
  const [beddingRaw, setBeddingRaw] = useState('');
  const [beddingLocation, setBeddingLocation] = useState('');
  const [beddingAmountDesc, setBeddingAmountDesc] = useState('');

  // 수거 및 파봉 측정 항목 상태
  const [addedRaw, setAddedRaw] = useState('');
  const [corePointsRaw, setCorePointsRaw] = useState(() =>
    Array.from({ length: CORE_POINT_COUNT }, () => ({ temp: '', moisture: '' }))
  );
  const [notes, setNotes] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<string[]>([]);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);

  const steps = flowMode === 'inspection' ? INSPECTION_STEPS : MEASUREMENT_STEPS;
  const lastStep = steps.length - 1;

  const addedKg = parseValue(addedRaw);
  const beddingUsedKg = hasBedding ? parseValue(beddingRaw) : 0;

  const parsedPoints: (CorePoint | null)[] = corePointsRaw.map(p => {
    const coreTemp = parseValue(p.temp);
    const moisture = parseValue(p.moisture);
    return coreTemp !== null && moisture !== null ? { coreTemp, moisture } : null;
  });
  const filledPoints = parsedPoints.filter((p): p is CorePoint => p !== null);
  const allPointsFilled = filledPoints.length === CORE_POINT_COUNT;
  const average = filledPoints.length > 0 ? averageCorePoints(filledPoints) : null;
  const coreTemp = allPointsFilled ? average!.coreTemp : null;
  const moisture = allPointsFilled ? average!.moisture : null;

  const pointInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const today = getCurrentDateString();
  const pile = useMemo(
    () => ({ ranchName: normalizeName(ranchName), location: normalizeName(location) }),
    [ranchName, location]
  );

  const pileRecords = useMemo(
    () => (pile.location ? getPileRecords(records, pile) : []),
    [records, pile]
  );
  const earlier = pileRecords.filter(r => r.date < date);
  const previous = earlier[earlier.length - 1];
  const sameDayRecord = pileRecords.find(r => r.date === date);

  const keptPhotoCount = (sameDayRecord?.photos?.length ?? 0) + (sameDayRecord?.pendingPhotoCount ?? 0);
  const photoSlotsLeft = Math.max(0, MAX_PHOTOS_PER_RECORD - keptPhotoCount - photoDrafts.length);

  const handlePhotoFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).slice(0, photoSlotsLeft);
    input.value = '';
    if (files.length === 0) return;

    setIsPreparingPhotos(true);
    try {
      const prepared: string[] = [];
      for (const file of files) {
        try {
          prepared.push(await compressImage(file));
        } catch (err) {
          showToast('사진을 불러오지 못했습니다', err instanceof Error ? err.message : undefined, 'warning');
        }
      }
      setPhotoDrafts(prev => [...prev, ...prepared].slice(0, MAX_PHOTOS_PER_RECORD - keptPhotoCount));
    } finally {
      setIsPreparingPhotos(false);
    }
  };

  /** 기록이 없는 목장만 목록에서 지운다 */
  const deleteRanch = (name: string) => {
    if (!window.confirm(`'${name}' 목장을 목록에서 삭제할까요?`)) return;
    if (!removeRanch(name)) {
      showToast('삭제할 수 없습니다', '기록이 있는 목장은 삭제할 수 없습니다.', 'warning');
      return;
    }
    if (normalizeName(name) === normalizeName(ranchName)) {
      setRanchName('');
      setLocation('');
    }
    showToast('목장을 삭제했습니다', name, 'success');
  };

  /** 목장을 바꾸면 그 목장에서 마지막으로 쓴 장소를 채운다 */
  const selectRanch = (name: string) => {
    if (normalizeName(name) === normalizeName(ranchName)) return;
    const latest = records
      .filter(r => normalizeName(r.ranchName) === normalizeName(name))
      .sort(compareRecords)
      .pop();
    setRanchName(name);
    setLocation(latest?.location ?? '');
  };

  const recentLocations = useMemo(() => {
    const seen = new Set<string>();
    return [...records]
      .filter(r => r.ranchName === pile.ranchName)
      .sort((a, b) => compareRecords(b, a))
      .map(r => r.location)
      .filter(l => l && !seen.has(l) && seen.add(l))
      .slice(0, MAX_LOCATION_CHIPS);
  }, [records, pile.ranchName]);

  const cycleStatus = useMemo(
    () =>
      summarizeCycle({
        records,
        ranchName: pile.ranchName,
        settings,
        cycle: getCycle(pile.ranchName),
        today,
      }),
    [records, pile.ranchName, settings, getCycle, today]
  );

  const setPointValue = (index: number, key: 'temp' | 'moisture', value: string) =>
    setCorePointsRaw(prev => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));

  const activePointIndex = parsedPoints.findIndex(p => p === null);
  const pointStates: PointState[] = parsedPoints.map((p, i) =>
    p ? 'done' : i === activePointIndex ? 'active' : 'empty'
  );

  const issueOf = (id: StepId): string | null => {
    switch (id) {
      case 'place':
        if (!pile.ranchName) return '목장을 입력해주세요';
        if (!pile.location) return '하역 장소를 입력해주세요';
        if (!DATE_RE.test(date) || !TIME_RE.test(time)) return '측정 일시를 확인해주세요';
        if (date > today) return '미래 날짜는 기록할 수 없습니다';
        return null;

      case 'work':
        if (mixed === null) return '오늘 혼합 작업 여부를 골라주세요';
        if (hasMold === null) return '곰팡이 발생 여부를 골라주세요';
        if (hasMold && !moldColor.trim()) return '곰팡이 색상을 선택하거나 입력해주세요';
        if (odor === null) return '이상 악취 여부를 골라주세요';
        if (hasBedding === null) return '깔개 활용 여부를 골라주세요';
        if (hasBedding && !beddingLocation.trim()) return '깔개 사용처(예: 1번 우사 등)를 입력해주세요';
        if (hasBedding && (beddingUsedKg === null || beddingUsedKg <= 0)) return '깔개 사용량(kg 또는 1/2 등)을 입력해주세요';
        return null;

      case 'input':
        if (addedKg === null || addedKg <= 0) return '신규 수거/투입량을 입력해주세요';
        return null;

      case 'core':
        if (!allPointsFilled) return `${CORE_POINT_COUNT}지점 값을 모두 입력해주세요`;
        if (filledPoints.some(p => p.moisture < 0 || p.moisture > 100)) return '함수율은 0~100% 사이입니다';
        return null;

      case 'photo':
        return isPreparingPhotos ? '사진 준비 중…' : null;

      case 'review':
        return null;
    }
  };

  const step = steps[stepIndex];
  const stepIssue = issueOf(step.id as StepId);

  const goNext = () => {
    if (stepIndex >= lastStep || stepIssue) return;
    if (step.id === 'place') setBasePile(pile);
    setDirection('forward');
    setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    setDirection('backward');
    setStepIndex(i => Math.max(0, i - 1));
  };

  const resetForm = () => {
    setRanchName(basePile.ranchName || DEFAULT_RANCH_NAME);
    setLocation(basePile.location);
    setDate(getCurrentDateString());
    setTime(getCurrentTimeString());
    setMixed(null);
    setHasMold(null);
    setMoldColor('');
    setMoldPhotos([]);
    setOdor(null);
    setHasBedding(null);
    setBeddingRaw('');
    setBeddingLocation('');
    setBeddingAmountDesc('');
    setAddedRaw('');
    setCorePointsRaw(Array.from({ length: CORE_POINT_COUNT }, () => ({ temp: '', moisture: '' })));
    setNotes('');
    setPhotoDrafts([]);
    setOutcome(null);
    setDirection('backward');
    setStepIndex(0);
  };

  const handleSave = async () => {
    const firstIssue = steps.map(s => issueOf(s.id as StepId)).find(Boolean);
    if (firstIssue) {
      showToast('입력이 완료되지 않았습니다', firstIssue, 'warning');
      return;
    }

    // 곰팡이 육안 상태 산출
    const moldStatusCalc: MoldStatus | undefined =
      hasMold === false ? 'none' : hasMold === true ? 'some' : undefined;

    // 합쳐서 업로드할 사진 (파봉 사진 + 곰팡이 사진)
    const combinedPhotos = [...photoDrafts, ...moldPhotos].slice(0, MAX_PHOTOS_PER_RECORD);

    const result = await saveRecord({
      ...pile,
      date,
      time,
      collectedKg: flowMode === 'measurement' ? (addedKg ?? 0) : 0,
      beddingUsedKg: beddingUsedKg ?? 0,
      beddingLocation: hasBedding ? beddingLocation.trim() : undefined,
      beddingAmountDesc: hasBedding ? beddingAmountDesc : undefined,
      recordType: flowMode,
      mixed: mixed ?? undefined,
      moldStatus: moldStatusCalc,
      hasMold: hasMold ?? undefined,
      moldColor: moldColor.trim() || undefined,
      odor: odor ?? undefined,
      corePoints: flowMode === 'inspection' ? [] : filledPoints,
      ambientTemp: 0,
      ambientHum: 0,
      // 시트 '비고' 칸에는 확인 단계에서 적은 특이사항만 들어간다
      notes: notes.trim() || undefined,
      newPhotos: combinedPhotos,
    });

    if (!result.saved || !result.record || !result.verdict) {
      showToast('저장하지 못했습니다', result.message, 'error');
      return;
    }

    if (result.sheet === 'failed') {
      showToast('시트 전송 실패 — 기기에 보관했습니다', result.message, 'warning');
    } else if (result.photosPending) {
      showToast('사진을 드라이브에 올리지 못했습니다', result.message, 'warning');
    }

    setOutcome({
      record: result.record,
      verdict: result.verdict,
      sheet: result.sheet,
      photosUploaded: result.photosUploaded ?? 0,
      photosPending: result.photosPending ?? 0,
    });
  };

  // 결과 화면
  if (outcome) {
    return (
      <MeasurementResult
        record={outcome.record}
        verdict={outcome.verdict}
        sheet={outcome.sheet}
        photosUploaded={outcome.photosUploaded}
        photosPending={outcome.photosPending}
        previousRecord={previous}
        mode={flowMode}
        onMeasureAnother={resetForm}
        onViewLocationDetail={() => {
          if (isManager || flowMode === 'inspection') {
            setActiveTab('today');
          } else {
            setHistoryPileKey(`${outcome.record.ranchName}|${outcome.record.location}`);
            setActiveTab('history');
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto pb-8">
      {/* 1. 상단 스텝 인디케이터 */}
      <StepIndicator
        currentStep={stepIndex}
        totalSteps={steps.length}
        title={step.title}
        subtitle={step.subtitle}
      />

      {/* 2. 스텝별 바디 컴포넌트 */}
      <div
        key={stepIndex}
        className={`apple-card p-4 sm:p-5 mb-5 bg-white dark:bg-[#1C1C1E] ${
          direction === 'forward' ? 'step-enter-forward' : 'step-enter-backward'
        }`}
      >
        {step.id === 'place' && (
          <LocationStep
            ranchName={ranchName}
            setRanchName={setRanchName}
            location={location}
            setLocation={setLocation}
            date={date}
            setDate={setDate}
            time={time}
            setTime={setTime}
            today={today}
            knownRanches={flowMode === 'measurement' ? ranchNames : measuredRanchNames}
            onSelectRanch={selectRanch}
            ranchLocked={isManager}
            canDeleteRanch={flowMode === 'measurement' ? name => !ranchHasRecords(name) : undefined}
            onDeleteRanch={flowMode === 'measurement' ? deleteRanch : undefined}
            recentLocations={recentLocations}
            onEnterNext={goNext}
          />
        )}

        {/* 현장 점검 모드: 혼합, 곰팡이 유무/색상/사진, 냄새, 깔개 */}
        {step.id === 'work' && (
          <FieldWorkStep
            mixed={mixed}
            setMixed={setMixed}
            hasMold={hasMold}
            setHasMold={setHasMold}
            moldColor={moldColor}
            setMoldColor={setMoldColor}
            moldPhotos={moldPhotos}
            setMoldPhotos={setMoldPhotos}
            odor={odor}
            setOdor={setOdor}
            hasBedding={hasBedding}
            setHasBedding={setHasBedding}
            beddingRaw={beddingRaw}
            setBeddingRaw={setBeddingRaw}
            beddingLocation={beddingLocation}
            setBeddingLocation={setBeddingLocation}
            beddingAmountDesc={beddingAmountDesc}
            setBeddingAmountDesc={setBeddingAmountDesc}
            currentPileKg={cycleStatus.currentPileKg}
            onEnterNext={goNext}
          />
        )}

        {/* 수거·파봉 측정 모드: 신규 수거량 입력 */}
        {step.id === 'input' && (
          <CollectionInputStep
            addedRaw={addedRaw}
            setAddedRaw={setAddedRaw}
            currentPileKg={cycleStatus.currentPileKg}
            onEnterNext={goNext}
          />
        )}

        {/* 심부 3지점 측정 (현장 점검·수거·파봉 측정 공통) */}
        {step.id === 'core' && (
          <CoreMeasurementStep
            corePointsRaw={corePointsRaw}
            setPointValue={setPointValue}
            pointStates={pointStates}
            filledCount={filledPoints.length}
            average={average}
            pointInputRefs={pointInputRefs}
            onEnterNext={goNext}
          />
        )}

        {/* 수거·파봉 측정 모드: 파봉 작업 사진 */}
        {step.id === 'photo' && (
          <PhotoStep
            photoDrafts={photoDrafts}
            setPhotoDrafts={setPhotoDrafts}
            isPreparingPhotos={isPreparingPhotos}
            onPhotoFiles={handlePhotoFiles}
            photoSlotsLeft={photoSlotsLeft}
          />
        )}

        {/* 확인 및 저장 단계 */}
        {step.id === 'review' && (
          <ReviewStep
            mode={flowMode}
            ranchName={pile.ranchName}
            location={pile.location}
            date={date}
            time={time}
            mixed={mixed}
            collectedKg={flowMode === 'measurement' ? addedKg : null}
            beddingUsedKg={hasBedding ? beddingUsedKg : null}
            coreTemp={coreTemp}
            moisture={moisture}
            moldStatus={hasMold ? 'some' : hasMold === false ? 'none' : null}
            odor={odor}
            ambientTemp={null}
            ambientHum={null}
            photoCount={photoDrafts.length + moldPhotos.length}
            notes={notes}
            setNotes={setNotes}
          />
        )}
      </div>

      {/* 3. 하단 네비게이션 버튼 (이전 / 다음 / 저장) */}
      <div className="flex gap-2 items-center">
        {stepIndex > 0 ? (
          <Button
            variant="secondary"
            size="lg"
            icon="arrow_back"
            onClick={goBack}
            className="w-20 sm:w-24 shrink-0 !px-2 text-sm"
          >
            이전
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            icon="close"
            // 측정 탭은 현장점검과 별개라 다른 탭으로 보내지 않고 입력만 비운다
            onClick={flowMode === 'measurement' ? resetForm : () => setActiveTab('today')}
            className="w-20 sm:w-24 shrink-0 !px-2 text-sm"
          >
            {flowMode === 'measurement' ? '초기화' : '취소'}
          </Button>
        )}

        {stepIndex < lastStep ? (
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            onClick={goNext}
            disabled={Boolean(stepIssue)}
            className="flex-1"
          >
            다음
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            icon="check"
            onClick={handleSave}
            disabled={isSyncing}
            className="flex-1"
          >
            {isSyncing ? '저장 중…' : flowMode === 'inspection' ? '점검 완료 및 저장' : '측정 완료 및 저장'}
          </Button>
        )}
      </div>
    </div>
  );
};
