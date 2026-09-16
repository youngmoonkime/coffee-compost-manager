import React, { useMemo, useRef, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import type { SaveRecordResult } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';
import {
  averageCorePoints,
  compareRecords,
  getCurrentDateString,
  getCurrentTimeString,
  getPileRecords,
  getWeeklyCollection,
  CORE_POINT_COUNT,
  normalizeName,
} from '../../utils/calculations';
import { compressImage, MAX_PHOTOS_PER_RECORD } from '../../utils/photos';
import type { CorePoint, MeasurementRecord, VerdictInfo } from '../../types';

import { StepIndicator } from './StepIndicator';
import { LocationStep } from './steps/LocationStep';
import { CollectionAmountStep } from './steps/CollectionAmountStep';
import { CoreMeasurementStep } from './steps/CoreMeasurementStep';
import type { PointState } from './steps/CoreMeasurementStep';
import { EnvironmentStep } from './steps/EnvironmentStep';
import { PhotoStep } from './steps/PhotoStep';
import { ReviewStep } from './steps/ReviewStep';
import { MeasurementResult } from './MeasurementResult';
import { Button } from '../ui/Button';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_LOCATION_CHIPS = 6;

const STEPS = [
  { id: 'place', title: '하역 장소 선택', subtitle: '커피박을 하역한 목장과 장소, 측정 일시를 확인하세요.' },
  { id: 'amount', title: '커피박 수거량', subtitle: '이번에 반입·하역한 커피박의 무게를 입력하세요.' },
  { id: 'core', title: '심부 온도 및 함수율', subtitle: '동일 높이에서 30cm 간격으로 3곳의 수치를 측정합니다.' },
  { id: 'ambient', title: '외기 온도 및 습도', subtitle: '현재 농장 외부 기상 상태를 입력하세요.' },
  { id: 'photo', title: '현장 사진 첨부', subtitle: '파봉 작업 및 더미 상태 사진을 첨부할 수 있습니다.' },
  { id: 'review', title: '기록 확인 및 저장', subtitle: '입력 내용을 확인하고 특이사항이 있다면 기록하세요.' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
const LAST_STEP = STEPS.length - 1;

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

export const MeasurementFlow: React.FC = () => {
  const {
    records,
    activePile,
    setActivePile,
    saveRecord,
    isSyncing,
    setActiveTab,
    setHistoryPileKey,
  } = useCompost();
  const { showToast } = useToast();

  const [ranchName, setRanchName] = useState(activePile.ranchName || DEFAULT_RANCH_NAME);
  const [location, setLocation] = useState(activePile.location);
  const [date, setDate] = useState(getCurrentDateString);
  const [time, setTime] = useState(getCurrentTimeString);
  const [collectedRaw, setCollectedRaw] = useState('');
  const [corePointsRaw, setCorePointsRaw] = useState(() =>
    Array.from({ length: CORE_POINT_COUNT }, () => ({ temp: '', moisture: '' }))
  );
  const [ambientTempRaw, setAmbientTempRaw] = useState('');
  const [ambientHumRaw, setAmbientHumRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<string[]>([]);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);

  const collectedKg = parseValue(collectedRaw);

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
  const ambientTemp = parseValue(ambientTempRaw);
  const ambientHum = parseValue(ambientHumRaw);

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

  const knownRanches = useMemo(() => {
    const names = new Set([DEFAULT_RANCH_NAME, ...records.map(r => r.ranchName)]);
    return [...names];
  }, [records]);

  const recentLocations = useMemo(() => {
    const seen = new Set<string>();
    return [...records]
      .filter(r => r.ranchName === pile.ranchName)
      .sort((a, b) => compareRecords(b, a))
      .map(r => r.location)
      .filter(loc => loc && !seen.has(loc) && seen.add(loc))
      .slice(0, MAX_LOCATION_CHIPS);
  }, [records, pile.ranchName]);

  const weekly = useMemo(() => {
    return getWeeklyCollection(records, DATE_RE.test(date) ? date : today);
  }, [records, date, today]);

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
      case 'amount':
        if (collectedKg === null) return '수거량을 입력해주세요 (없으면 0)';
        if (collectedKg < 0) return '0 이상으로 입력해주세요';
        return null;
      case 'core':
        if (!allPointsFilled) return `${CORE_POINT_COUNT}지점 값을 모두 입력해주세요`;
        if (filledPoints.some(p => p.moisture < 0 || p.moisture > 100)) return '함수율은 0~100% 사이입니다';
        return null;
      case 'ambient':
        if (ambientTemp === null || ambientHum === null) return '외기 온도와 습도를 모두 입력해주세요';
        if (ambientHum < 0 || ambientHum > 100) return '습도는 0~100% 사이입니다';
        return null;
      case 'photo':
        return isPreparingPhotos ? '사진 준비 중…' : null;
      case 'review':
        return null;
    }
  };

  const step = STEPS[stepIndex];
  const stepIssue = issueOf(step.id);

  const goNext = () => {
    if (stepIndex >= LAST_STEP || stepIssue) return;
    if (step.id === 'place') setActivePile(pile);
    setDirection('forward');
    setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    setDirection('backward');
    setStepIndex(i => Math.max(0, i - 1));
  };

  const resetForm = () => {
    setRanchName(activePile.ranchName || DEFAULT_RANCH_NAME);
    setLocation(activePile.location);
    setDate(getCurrentDateString());
    setTime(getCurrentTimeString());
    setCollectedRaw('');
    setCorePointsRaw(Array.from({ length: CORE_POINT_COUNT }, () => ({ temp: '', moisture: '' })));
    setAmbientTempRaw('');
    setAmbientHumRaw('');
    setNotes('');
    setPhotoDrafts([]);
    setOutcome(null);
    setDirection('backward');
    setStepIndex(0);
  };


  const handleSave = async () => {
    const firstIssue = STEPS.map(s => issueOf(s.id)).find(Boolean);
    if (firstIssue || collectedKg === null || !allPointsFilled || ambientTemp === null || ambientHum === null) {
      showToast('입력이 완료되지 않았습니다', firstIssue ?? '비어 있는 항목을 채워주세요', 'warning');
      return;
    }

    const result = await saveRecord({
      ...pile,
      date,
      time,
      collectedKg,
      corePoints: filledPoints,
      ambientTemp,
      ambientHum,
      notes,
      newPhotos: photoDrafts,
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
        onMeasureAnother={resetForm}
        onViewLocationDetail={() => {
          setHistoryPileKey(`${outcome.record.ranchName}|${outcome.record.location}`);
          setActiveTab('history');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto pb-8">
      {/* 1. 상단 인디케이터 */}
      <StepIndicator
        currentStep={stepIndex}
        totalSteps={STEPS.length}
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
            knownRanches={knownRanches}
            recentLocations={recentLocations}
            onEnterNext={goNext}
          />
        )}

        {step.id === 'amount' && (
          <CollectionAmountStep
            collectedRaw={collectedRaw}
            setCollectedRaw={setCollectedRaw}
            weekly={weekly}
            onEnterNext={goNext}
          />
        )}

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

        {step.id === 'ambient' && (
          <EnvironmentStep
            ambientTempRaw={ambientTempRaw}
            setAmbientTempRaw={setAmbientTempRaw}
            ambientHumRaw={ambientHumRaw}
            setAmbientHumRaw={setAmbientHumRaw}
            onEnterNext={goNext}
          />
        )}

        {step.id === 'photo' && (
          <PhotoStep
            photoDrafts={photoDrafts}
            setPhotoDrafts={setPhotoDrafts}
            isPreparingPhotos={isPreparingPhotos}
            onPhotoFiles={handlePhotoFiles}
            photoSlotsLeft={photoSlotsLeft}
          />
        )}

        {step.id === 'review' && (
          <ReviewStep
            ranchName={ranchName}
            location={location}
            date={date}
            time={time}
            collectedKg={collectedKg}
            coreTemp={coreTemp}
            moisture={moisture}
            ambientTemp={ambientTemp}
            ambientHum={ambientHum}
            photoCount={photoDrafts.length}
            notes={notes}
            setNotes={setNotes}
          />
        )}
      </div>

      {/* 단계별 이슈 에러 메시지 */}
      {stepIssue && (
        <div className="mb-4 text-xs font-semibold text-[#D97706] bg-[#FF9F0A]/10 px-3.5 py-2 rounded-xl flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>{stepIssue}</span>
        </div>
      )}

      {/* 3. 하단 액션 버튼 바 (Primary 계속/저장 & Secondary 이전) */}
      <div className="flex items-center gap-2.5 pt-1">
        {stepIndex > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            icon="chevron_left"
            onClick={goBack}
            className="w-20 sm:w-24 shrink-0 text-xs sm:text-sm font-medium text-[#6E6E73] dark:text-[#8E8E93] !bg-[#E5E5EA]/80 dark:!bg-[#2C2C2E] hover:!bg-[#D1D1D6] dark:hover:!bg-[#3A3A3C] border border-black/5 dark:border-white/5"
          >
            이전
          </Button>
        )}

        {stepIndex < LAST_STEP ? (
          <Button
            type="button"
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            disabled={Boolean(stepIssue)}
            onClick={goNext}
            className="flex-1 text-[16px] sm:text-[17px] font-bold tracking-tight shadow-md"
          >
            {stepIssue ? '입력 확인 필요' : step.id === 'photo' && photoDrafts.length === 0 ? '사진 없이 계속' : '계속'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="lg"
            icon="cloud_upload"
            disabled={Boolean(stepIssue) || isSyncing}
            onClick={handleSave}
            className="flex-1 text-[16px] sm:text-[17px] font-bold tracking-tight shadow-md"
          >
            {isSyncing ? '저장 중…' : '기록 저장하기'}
          </Button>
        )}
      </div>
    </div>
  );
};
