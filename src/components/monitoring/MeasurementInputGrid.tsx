import React, { useMemo, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import type { SaveRecordResult } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';
import {
  buildRecordKey,
  compareRecords,
  daysBetween,
  formatShortDate,
  getCurrentDateString,
  getCurrentTimeString,
  getPileKey,
  getPileRecords,
  getWeeklyCollection,
  MIXING_GUIDE,
  normalizeName,
} from '../../utils/calculations';
import { compressImage, getDriveThumbnailUrl, MAX_PHOTOS_PER_RECORD } from '../../utils/photos';
import { MoistureChart } from '../common/MoistureChart';
import type { MeasurementRecord, VerdictInfo } from '../../types';

/** 현장에서 자주 적는 특이사항. 탭 한 번으로 넣고 뺄 수 있다. */
const QUICK_NOTES = ['교반 실시', '침출수 발생', '악취 심함', '강우', '차수막 덮음', '깔개로 사용'] as const;
const NOTE_SEPARATOR = ', ';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_LOCATION_CHIPS = 6;

const STEPS = [
  { id: 'place', title: '하역 장소' },
  { id: 'amount', title: '커피박 수거량' },
  { id: 'core', title: '심부 온도·함수율' },
  { id: 'ambient', title: '외기 온도·습도' },
  { id: 'photo', title: '파봉 작업 사진' },
  { id: 'review', title: '확인 및 저장' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
const LAST_STEP = STEPS.length - 1;

const SHEET_STATUS: Record<SaveRecordResult['sheet'], { icon: string; text: string; warn?: boolean }> = {
  synced: { icon: 'cloud_done', text: '구글 시트에 등록됨' },
  unverified: { icon: 'cloud_sync', text: '시트로 전송함 (반영 여부 미확인)', warn: true },
  failed: { icon: 'cloud_off', text: '시트 전송 실패 — 이 기기에 보관 후 다음 새로고침 때 다시 보냅니다', warn: true },
  skipped: { icon: 'smartphone', text: '이 기기에 저장됨 (구글 시트 미연결)' },
};

function splitNotes(text: string): string[] {
  return text.split(NOTE_SEPARATOR).map(t => t.trim()).filter(Boolean);
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

function formatSigned(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/** 두 값을 나란히 받는 숫자 입력 (심부·외기) */
const PairField: React.FC<{
  label: string;
  unit: string;
  value: string;
  step: number;
  autoFocus?: boolean;
  onChange: (v: string) => void;
  onEnter?: () => void;
}> = ({ label, unit, value, step, autoFocus, onChange, onEnter }) => (
  <label className="bg-surface-container-low rounded-2xl py-3 block">
    <span className="block text-center font-caption text-[12px] text-on-surface-variant mb-1">{label}</span>
    <span className="flex items-baseline justify-center gap-0.5">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        placeholder="--"
        autoFocus={autoFocus}
        aria-label={`${label}(${unit})`}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        className="w-[4ch] bg-transparent text-center font-display-metric text-[38px] leading-none font-semibold text-on-surface tabular-nums focus:outline-none caret-primary placeholder:text-outline/30"
      />
      <span className="font-display-metric text-[15px] text-outline">{unit}</span>
    </span>
  </label>
);

/** iOS 그룹 리스트 한 줄 */
const SummaryRow: React.FC<{ label: string; value: string; sub?: string; emphasis?: boolean }> = ({
  label,
  value,
  sub,
  emphasis,
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-outline-variant/20 last:border-b-0">
    <span className="font-body-sm text-[14px] text-on-surface-variant shrink-0">{label}</span>
    <span className="text-right min-w-0">
      <span
        className={`font-label-numeric text-[15px] tabular-nums break-keep ${
          emphasis ? 'text-primary font-bold' : 'text-on-surface font-semibold'
        }`}
      >
        {value}
      </span>
      {sub && <span className="ml-1.5 font-caption text-[12px] text-outline tabular-nums">{sub}</span>}
    </span>
  </div>
);

/** 결과 화면의 안내 상자 */
const GuideBox: React.FC<{ icon: string; label: string; text: string; className?: string }> = ({
  icon,
  label,
  text,
  className = '',
}) => (
  <div className={`rounded-2xl bg-surface-container-low px-4 py-3 flex items-start gap-2.5 ${className}`}>
    <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">{icon}</span>
    <div className="min-w-0">
      <span className="block font-caption text-[12px] text-on-surface-variant">{label}</span>
      <span className="block font-body-sm text-[15px] font-semibold text-on-surface break-keep leading-snug mt-0.5">
        {text}
      </span>
    </div>
  </div>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full font-caption text-[12.5px] font-semibold transition-all active:scale-95 ${
      active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'
    }`}
  >
    {children}
  </button>
);

interface SaveOutcome {
  record: MeasurementRecord;
  verdict: VerdictInfo;
  sheet: SaveRecordResult['sheet'];
  photosUploaded: number;
  photosPending: number;
}

/** 사진 미리보기 한 칸 */
const PhotoTile: React.FC<{ src: string; label?: string; onRemove?: () => void }> = ({ src, label, onRemove }) => (
  <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-high">
    <img src={src} alt="" className="w-full h-full object-cover" />
    {label && (
      <span className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white font-caption text-[10px]">
        {label}
      </span>
    )}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label="사진 빼기"
        className="absolute right-1 top-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    )}
  </div>
);

const MeasurementInputGridComponent: React.FC = () => {
  const {
    records,
    activePile,
    setActivePile,
    saveRecord,
    settings,
    isSyncing,
    isSheetBackend,
    setActiveTab,
    setHistoryPileKey,
  } = useCompost();
  const { showToast } = useToast();

  // 장소는 마지막으로 기록한 곳을 기본으로, 측정 일시는 지금으로 시작한다.
  // 측정값은 항상 빈 칸 — 지난 값을 채워두면 재보지 않고 그대로 저장되기 쉽다.
  const [ranchName, setRanchName] = useState(activePile.ranchName || DEFAULT_RANCH_NAME);
  const [location, setLocation] = useState(activePile.location);
  const [date, setDate] = useState(getCurrentDateString);
  const [time, setTime] = useState(getCurrentTimeString);
  const [collectedRaw, setCollectedRaw] = useState('');
  const [coreTempRaw, setCoreTempRaw] = useState('');
  const [moistureRaw, setMoistureRaw] = useState('');
  const [ambientTempRaw, setAmbientTempRaw] = useState('');
  const [ambientHumRaw, setAmbientHumRaw] = useState('');
  const [notes, setNotes] = useState('');
  /** 새로 찍은 사진 (줄인 JPEG data URL) */
  const [photoDrafts, setPhotoDrafts] = useState<string[]>([]);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  const collectedKg = parseValue(collectedRaw);
  const coreTemp = parseValue(coreTempRaw);
  const moisture = parseValue(moistureRaw);
  const ambientTemp = parseValue(ambientTempRaw);
  const ambientHum = parseValue(ambientHumRaw);

  const today = getCurrentDateString();
  const pile = useMemo(
    () => ({ ranchName: normalizeName(ranchName), location: normalizeName(location) }),
    [ranchName, location]
  );

  /** 이 장소의 기록 (오래된 순) */
  const pileRecords = useMemo(
    () => (pile.location ? getPileRecords(records, pile) : []),
    [records, pile]
  );
  const earlier = pileRecords.filter(r => r.date < date);
  const previous = earlier[earlier.length - 1];
  const sameDayRecord = pileRecords.find(r => r.date === date);

  // 같은 날짜 기록을 다시 저장하면 이미 올린 사진은 유지되므로, 남은 칸만큼만 더 받는다
  const keptPhotoCount = (sameDayRecord?.photos?.length ?? 0) + (sameDayRecord?.pendingPhotoCount ?? 0);
  const photoSlotsLeft = Math.max(0, MAX_PHOTOS_PER_RECORD - keptPhotoCount - photoDrafts.length);

  const handlePhotoFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).slice(0, photoSlotsLeft);
    input.value = ''; // 같은 사진을 다시 골라도 onChange 가 오도록
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

  /** 입력 칩 — 기록에 나온 목장, 그 목장에서 최근에 쓴 장소 */
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
    // 같은 장소·같은 날짜 기록을 덮어쓰는 경우 기존 수거량은 빼고 센다
    const key = pile.location ? buildRecordKey(pile, date) : '';
    return getWeeklyCollection(records.filter(r => r.id !== key), DATE_RE.test(date) ? date : today);
  }, [records, pile, date, today]);

  /** 단계별로 넘어가지 못하는 이유. null 이면 통과 */
  const issueOf = (id: StepId): string | null => {
    switch (id) {
      case 'place':
        if (!pile.ranchName) return '목장을 입력해주세요';
        if (!pile.location) return '하역 장소를 입력해주세요';
        if (!DATE_RE.test(date) || !TIME_RE.test(time)) return '측정 일시를 확인해주세요';
        if (date > today) return '미래 날짜는 기록할 수 없습니다';
        return null;
      case 'amount':
        if (collectedKg === null) return '수거량을 입력해주세요';
        if (collectedKg < 0) return '0 이상으로 입력해주세요';
        return null;
      case 'core':
        if (coreTemp === null || moisture === null) return '두 값을 모두 입력해주세요';
        if (moisture < 0 || moisture > 100) return '함수율은 0~100% 사이입니다';
        return null;
      case 'ambient':
        if (ambientTemp === null || ambientHum === null) return '두 값을 모두 입력해주세요';
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
    // 장소를 정하면 아래 추이 그래프·기록 목록도 그 장소로 바뀐다
    if (step.id === 'place') setActivePile(pile);
    setDirection('forward');
    setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    setDirection('backward');
    setStepIndex(i => Math.max(0, i - 1));
  };

  const resetForm = () => {
    // 다음 기록도 방금 저장한 장소에서 시작한다
    setRanchName(activePile.ranchName || DEFAULT_RANCH_NAME);
    setLocation(activePile.location);
    setDate(getCurrentDateString());
    setTime(getCurrentTimeString());
    setCollectedRaw('');
    setCoreTempRaw('');
    setMoistureRaw('');
    setAmbientTempRaw('');
    setAmbientHumRaw('');
    setNotes('');
    setPhotoDrafts([]);
    setOutcome(null);
    setShowCriteria(false);
    setDirection('backward');
    setStepIndex(0);
  };

  const handleSave = async () => {
    const firstIssue = STEPS.map(s => issueOf(s.id)).find(Boolean);
    if (firstIssue || collectedKg === null || coreTemp === null || moisture === null || ambientTemp === null || ambientHum === null) {
      showToast('입력이 완료되지 않았습니다', firstIssue ?? '비어 있는 항목을 채워주세요', 'warning');
      return;
    }

    const result = await saveRecord({
      ...pile,
      date,
      time,
      collectedKg,
      coreTemp,
      moisture,
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

    // 판정은 입력을 모두 마치고 저장한 뒤에만 보여준다
    setDirection('forward');
    setOutcome({
      record: result.record,
      verdict: result.verdict,
      sheet: result.sheet,
      photosUploaded: result.photosUploaded ?? 0,
      photosPending: result.photosPending ?? 0,
    });
  };

  const renderStepBody = () => {
    switch (step.id) {
      case 'place':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              커피박을 내린 목장과 세부 장소, 측정 일시를 확인해주세요.
            </p>

            {/* 측정 일시 */}
            <div className="rounded-2xl bg-surface-container-low px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-caption text-[12px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                  측정 일시
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDate(getCurrentDateString());
                    setTime(getCurrentTimeString());
                  }}
                  className="font-caption text-[12px] font-semibold text-secondary"
                >
                  지금으로
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="date"
                  value={date}
                  max={today}
                  aria-label="측정 날짜"
                  onChange={e => setDate(e.target.value)}
                  className="min-w-0 h-10 rounded-xl bg-surface-container-lowest px-2.5 text-[15px] font-semibold text-on-surface tabular-nums border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
                <input
                  type="time"
                  value={time}
                  aria-label="측정 시간"
                  onChange={e => setTime(e.target.value)}
                  className="h-10 rounded-xl bg-surface-container-lowest px-2.5 text-[15px] font-semibold text-on-surface tabular-nums border border-outline-variant/30 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* 목장 */}
            <label className="block mt-3">
              <span className="block font-label-sm text-[13px] font-semibold text-on-surface mb-1.5">목장</span>
              <input
                type="text"
                value={ranchName}
                maxLength={30}
                onChange={e => setRanchName(e.target.value)}
                className="w-full h-11 bg-surface-container-lowest rounded-xl px-3 text-[15px] text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
              />
            </label>
            {knownRanches.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {knownRanches.map(name => (
                  <Chip key={name} active={name === pile.ranchName} onClick={() => setRanchName(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            )}

            {/* 하역 장소 */}
            <label className="block mt-3">
              <span className="block font-label-sm text-[13px] font-semibold text-on-surface mb-1.5">하역 장소</span>
              <span className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">
                  location_on
                </span>
                <input
                  type="text"
                  value={location}
                  maxLength={40}
                  autoFocus={!location}
                  placeholder="실제로 커피박을 내린 곳 (예: 퇴비사 A동 앞)"
                  onChange={e => setLocation(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  className="w-full h-11 bg-surface-container-lowest rounded-xl pl-9 pr-3 text-[15px] text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                />
              </span>
            </label>
            {recentLocations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {recentLocations.map(loc => (
                  <Chip key={loc} active={loc === pile.location} onClick={() => setLocation(loc)}>
                    {loc}
                  </Chip>
                ))}
              </div>
            )}

            {pile.location && (
              <div className="mt-3 rounded-2xl bg-surface-container-low px-4 py-2.5 font-caption text-[12.5px] text-on-surface-variant break-keep soft-rise">
                {previous ? (
                  <>
                    지난 기록 <strong className="text-on-surface">{formatShortDate(previous.date)}</strong> · 함수율{' '}
                    <strong className="text-on-surface">{previous.moisture}%</strong> · 심부 {previous.coreTemp}℃ · 이전 기록{' '}
                    {earlier.length}회
                  </>
                ) : (
                  <>새 장소입니다. 이 장소의 첫 기록이 됩니다.</>
                )}
                {sameDayRecord && (
                  <span className="block mt-1 text-error">
                    이 날짜에 이미 기록이 있습니다. 저장하면 새 값으로 바뀝니다.
                  </span>
                )}
              </div>
            )}
          </>
        );

      case 'amount':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              이번에 하역한 커피박 양입니다. 추가로 내린 커피박이 없으면 0을 입력하세요.
            </p>

            <div className="flex items-baseline justify-center gap-1 py-2">
              <input
                type="number"
                inputMode="numeric"
                step={10}
                min={0}
                value={collectedRaw}
                placeholder="--"
                autoFocus
                aria-label="커피박 수거량(kg)"
                onChange={e => setCollectedRaw(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    goNext();
                  }
                }}
                className="w-[5ch] bg-transparent text-center font-display-metric text-[56px] leading-none font-semibold text-on-surface tabular-nums tracking-tight focus:outline-none caret-primary placeholder:text-outline/30"
              />
              <span className="font-display-metric text-[22px] font-medium text-outline">kg</span>
            </div>

            <p className="mt-1 text-center font-caption text-[12px] text-outline tabular-nums">
              이번 주({formatShortDate(weekly.start)}~{formatShortDate(weekly.end)}) 누적{' '}
              <strong className="text-on-surface">{weekly.totalKg.toLocaleString('ko-KR')}kg</strong>
            </p>
          </>
        );

      case 'core':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              더미 표면에서 <strong className="text-on-surface">{settings.coreProbeDepthCm}cm</strong> 깊이까지 탐침을
              꽂고 안정된 값을 읽어주세요.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <PairField label="심부 온도" unit="℃" step={0.5} value={coreTempRaw} autoFocus onChange={setCoreTempRaw} />
              <PairField label="심부 함수율" unit="%" step={1} value={moistureRaw} onChange={setMoistureRaw} onEnter={goNext} />
            </div>

            {previous ? (
              <div className="mt-3 rounded-2xl bg-surface-container-low px-4 py-3 soft-rise">
                <span className="block font-caption text-[12px] text-on-surface-variant">
                  지난 기록 {formatShortDate(previous.date)} · {daysBetween(previous.date, date)}일 전
                </span>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  {[
                    { label: '심부 온도', prev: previous.coreTemp, now: coreTemp, unit: '℃' },
                    { label: '함수율', prev: previous.moisture, now: moisture, unit: '%p' },
                  ].map(item => (
                    <div key={item.label} className="font-label-numeric tabular-nums">
                      <span className="font-caption text-[11.5px] text-outline">{item.label}</span>
                      <span className="block text-[15px] font-semibold text-on-surface">
                        {item.prev}
                        {item.unit === '℃' ? '℃' : '%'}
                        {item.now !== null && (
                          <span
                            className={`ml-1.5 text-[13px] font-bold ${
                              item.now < item.prev ? 'text-primary' : item.now > item.prev ? 'text-error' : 'text-outline'
                            }`}
                          >
                            {formatSigned(item.now - item.prev)}
                            {item.unit}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-center font-caption text-[12px] text-outline break-keep">
                이 장소의 첫 기록입니다. 다음 기록부터 이 값과 비교합니다.
              </p>
            )}

            <div className="flex justify-center mt-2.5">
              <span className="px-3 py-1 rounded-full bg-primary-fixed-dim text-on-primary-fixed font-caption text-[12px] font-semibold">
                깔개 사용 기준 함수율 {settings.usableMoistureMin}~{settings.usableMoistureMax}%
              </span>
            </div>
          </>
        );

      case 'ambient':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              더미 주변의 현재 온도와 습도입니다. 참고 기록용입니다.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <PairField label="외기 온도" unit="℃" step={0.5} value={ambientTempRaw} autoFocus onChange={setAmbientTempRaw} />
              <PairField label="외기 습도" unit="%" step={1} value={ambientHumRaw} onChange={setAmbientHumRaw} onEnter={goNext} />
            </div>
          </>
        );

      case 'photo':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              커피박 파봉 작업을 마친 뒤 더미 사진을 찍어주세요. 구글 드라이브에 저장되고 시트에서 바로 볼 수
              있습니다.
            </p>

            {!isSheetBackend ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] shrink-0">cloud_off</span>
                <span className="font-caption text-[12.5px] leading-relaxed break-keep">
                  사진은 구글 드라이브에 저장되므로 구글 시트가 연결돼 있어야 올릴 수 있습니다. [설정/관리]에서 먼저
                  연결해주세요. 지금은 사진 없이 기록만 저장됩니다.
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {(sameDayRecord?.photos ?? []).map(photo => (
                    <PhotoTile key={photo.fileId} src={getDriveThumbnailUrl(photo.fileId, 300)} label="올린 사진" />
                  ))}
                  {photoDrafts.map((src, i) => (
                    <PhotoTile
                      key={i}
                      src={src}
                      onRemove={() => setPhotoDrafts(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                  {photoSlotsLeft > 0 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={e => handlePhotoFiles(e.currentTarget)}
                      />
                      <span className={`material-symbols-outlined text-[30px] ${isPreparingPhotos ? 'animate-spin' : ''}`}>
                        {isPreparingPhotos ? 'progress_activity' : 'photo_camera'}
                      </span>
                      <span className="font-caption text-[12px] font-semibold">{isPreparingPhotos ? '준비 중' : '촬영'}</span>
                    </label>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="font-caption text-[12px] text-outline">
                    최대 {MAX_PHOTOS_PER_RECORD}장 · 자동으로 줄여서 올립니다
                  </span>
                  {photoSlotsLeft > 0 && (
                    <label className="shrink-0 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-caption text-[12.5px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={e => handlePhotoFiles(e.currentTarget)}
                      />
                      <span className="material-symbols-outlined text-[16px]">photo_library</span>
                      앨범에서 선택
                    </label>
                  )}
                </div>

                {(sameDayRecord?.pendingPhotoCount ?? 0) > 0 && (
                  <p className="mt-2 font-caption text-[12px] text-error break-keep">
                    이 날짜에 아직 못 올린 사진 {sameDayRecord?.pendingPhotoCount}장이 기기에 있습니다. 저장할 때 함께 올립니다.
                  </p>
                )}
              </>
            )}
          </>
        );

      case 'review':
        return (
          <>
            <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
              값을 확인하고, 특이사항이 있으면 함께 남겨주세요.
            </p>

            <div className="bg-surface-container-low rounded-2xl overflow-hidden soft-rise">
              <SummaryRow label="측정 일시" value={`${formatShortDate(date)} ${time}`} />
              <SummaryRow label="하역 장소" value={`${pile.ranchName} · ${pile.location}`} />
              <SummaryRow label="수거량" value={`${(collectedKg ?? 0).toLocaleString('ko-KR')} kg`} />
              <SummaryRow
                label={`심부 온도 (${settings.coreProbeDepthCm}cm)`}
                value={`${coreTempRaw} ℃`}
                sub={previous && coreTemp !== null ? `${formatSigned(coreTemp - previous.coreTemp)}℃` : undefined}
              />
              <SummaryRow
                label="심부 함수율"
                value={`${moistureRaw} %`}
                sub={previous && moisture !== null ? `${formatSigned(moisture - previous.moisture)}%p` : undefined}
                emphasis
              />
              <SummaryRow label="외기 온도·습도" value={`${ambientTempRaw} ℃ · ${ambientHumRaw} %`} />
              <SummaryRow
                label="파봉 사진"
                value={photoDrafts.length > 0 ? `새 사진 ${photoDrafts.length}장` : '없음'}
                sub={keptPhotoCount > 0 ? `기존 ${keptPhotoCount}장 유지` : undefined}
              />
            </div>

            {photoDrafts.length > 0 && (
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {photoDrafts.map((src, i) => (
                  <img key={i} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}

            {sameDayRecord && (
              <p className="mt-2 font-caption text-[12px] text-error break-keep">
                {formatShortDate(date)}에 이 장소 기록이 이미 있습니다. 저장하면 새 값으로 바뀝니다.
              </p>
            )}

            {/* 특이사항 */}
            <div className="mt-3 soft-rise stagger-1">
              <span className="block font-label-sm text-[13px] font-semibold text-on-surface mb-2">
                특이사항 <span className="font-caption text-[11px] text-outline font-normal">선택</span>
              </span>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map(preset => (
                  <Chip
                    key={preset}
                    active={splitNotes(notes).includes(preset)}
                    onClick={() => setNotes(prev => toggleNote(prev, preset))}
                  >
                    {preset}
                  </Chip>
                ))}
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

  /** 장소의 첫 기록 — 판정 대신 이번 주 수거량과 앞으로의 혼합 작업을 안내한다 */
  const renderFirstResult = (result: SaveOutcome) => {
    const week = getWeeklyCollection(records, result.record.date);
    return (
      <>
        <p className="font-body-sm text-[13.5px] text-on-surface-variant mb-3 break-keep leading-relaxed">
          {result.verdict.subtitle}
        </p>

        <div className="rounded-2xl bg-surface-container-low px-4 py-3.5 soft-rise">
          <div className="flex items-center justify-between gap-2">
            <span className="font-caption text-[12px] text-on-surface-variant">이번 주 커피박 수거량</span>
            <span className="font-caption text-[11.5px] text-outline tabular-nums whitespace-nowrap">
              {formatShortDate(week.start)} ~ {formatShortDate(week.end)}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display-metric text-[34px] leading-none font-semibold text-primary tabular-nums">
              {week.totalKg.toLocaleString('ko-KR')}
            </span>
            <span className="font-display-metric text-[16px] text-outline">kg</span>
            <span className="ml-auto font-caption text-[12px] text-on-surface-variant">하역 {week.count}건</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-outline-variant/20 font-caption text-[12px] text-on-surface-variant break-keep">
            이번 기록 <span className="font-semibold text-on-surface">{result.record.location}</span> ·{' '}
            {result.record.collectedKg.toLocaleString('ko-KR')}kg
          </div>
        </div>

        <GuideBox icon="assignment" label="앞으로의 혼합 작업" text={MIXING_GUIDE} className="mt-3 soft-rise stagger-1" />
      </>
    );
  };

  /** 두 번째 기록부터 — 판정, 깔개 사용 시점, 작업 안내 */
  const renderVerdictResult = ({ verdict, record }: SaveOutcome) => (
    <>
      <div className={`${verdict.bannerClass} mt-3 rounded-2xl px-4 py-3.5 soft-rise`}>
        <div className="flex items-center gap-2.5">
          <span className={`material-symbols-outlined text-[26px] ${verdict.iconClass}`}>{verdict.icon}</span>
          <span className={`font-headline-sm text-[18px] leading-tight ${verdict.titleClass}`}>{verdict.title}</span>
        </div>
        <p className="mt-1.5 font-body-sm text-[12.5px] opacity-90 break-keep leading-relaxed">{verdict.subtitle}</p>
      </div>

      {verdict.timing && (
        <GuideBox icon="event_available" label="깔개 사용 시점" text={verdict.timing} className="mt-3 soft-rise stagger-1" />
      )}
      <GuideBox icon="assignment" label="작업 안내" text={verdict.action} className="mt-3 soft-rise stagger-1" />

      {/* 비교가 의미 있는 순간이라 추이는 결과 화면에서만 보여준다 */}
      <div className="mt-4 soft-rise stagger-2">
        <MoistureChart records={getPileRecords(records, record)} variant="inline" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowCriteria(prev => !prev)}
          className="flex items-center gap-1 font-caption text-[12px] text-outline"
        >
          <span className="material-symbols-outlined text-[15px]">help_outline</span>
          판정 기준 {showCriteria ? '닫기' : '보기'}
        </button>
        <button
          type="button"
          onClick={() => {
            setHistoryPileKey(getPileKey(record));
            setActiveTab('history');
          }}
          className="flex items-center gap-0.5 font-caption text-[12px] font-semibold text-secondary"
        >
          이 장소 전체 기록
          <span className="material-symbols-outlined text-[15px]">chevron_right</span>
        </button>
      </div>

      {showCriteria && (
        <div className="mt-1.5 rounded-xl bg-surface-container-low px-3 py-2.5 font-caption text-[11.5px] text-on-surface-variant leading-relaxed break-keep">
          <span className="block">
            <strong className="text-on-surface">깔개 사용 가능</strong> — 심부 함수율 {settings.usableMoistureMin}~
            {settings.usableMoistureMax}%
          </span>
          <span className="block mt-1">
            <strong className="text-on-surface">혼합 필요</strong> — 심부온도 {settings.highTempThreshold}℃ 초과 또는 함수율{' '}
            {settings.highMoistureThreshold}% 초과
          </span>
          <span className="block mt-1">
            <strong className="text-on-surface">사용 시점 예상</strong> — 같은 장소에서 함수율이 줄어든 최근 기록(최대 4회)의
            감소 속도로 계산합니다.
          </span>
          <span className="block mt-1">장소의 첫 기록은 비교할 값이 없어 판정하지 않습니다.</span>
        </div>
      )}
    </>
  );

  const sheetStatus = outcome ? SHEET_STATUS[outcome.sheet] : null;
  const animClass = direction === 'forward' ? 'step-forward' : 'step-backward';
  const progress = outcome ? 100 : ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <section className="w-full mb-3">
      <div className="bg-surface-container-lowest rounded-[22px] border border-outline-variant/20 shadow-sm overflow-hidden">
        {/* 진행 표시 */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <span className="font-caption text-[11.5px] font-semibold text-outline tabular-nums shrink-0">
              {outcome ? '저장 완료' : `${stepIndex + 1} / ${STEPS.length}`}
            </span>
            <span className="font-caption text-[11.5px] text-outline truncate">
              {stepIndex > 0 || outcome ? `${pile.ranchName} · ${pile.location}` : '주간 현장 기록'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 본문 — key 를 바꿔 매 단계마다 등장 애니메이션이 다시 실행되게 한다 */}
        {outcome ? (
          <div key="result" className={`px-5 pt-5 pb-4 ${animClass}`}>
            <h3 className="font-headline-md text-[24px] font-bold text-on-surface tracking-tight">
              {outcome.verdict.type === 'first' ? '첫 기록 저장 완료' : '기록 결과'}
            </h3>

            {outcome.verdict.type === 'first' ? renderFirstResult(outcome) : renderVerdictResult(outcome)}

            {sheetStatus && (
              <p
                className={`mt-3 flex items-start gap-1 font-caption text-[11.5px] break-keep ${
                  sheetStatus.warn ? 'text-error' : 'text-outline'
                }`}
              >
                <span className="material-symbols-outlined text-[14px] mt-px">{sheetStatus.icon}</span>
                {sheetStatus.text}
              </p>
            )}
            {(outcome.photosUploaded > 0 || outcome.photosPending > 0) && (
              <p
                className={`mt-1 flex items-start gap-1 font-caption text-[11.5px] break-keep ${
                  outcome.photosPending > 0 ? 'text-error' : 'text-outline'
                }`}
              >
                <span className="material-symbols-outlined text-[14px] mt-px">
                  {outcome.photosPending > 0 ? 'hide_image' : 'photo_library'}
                </span>
                {outcome.photosPending > 0
                  ? `사진 ${outcome.photosPending}장을 아직 못 올렸습니다 — 기기에 보관 후 [장소별 현황 → 시트에서 새로고침] 때 다시 올립니다`
                  : `사진 ${outcome.photosUploaded}장을 구글 드라이브에 올렸습니다`}
              </p>
            )}
          </div>
        ) : (
          <div key={step.id} className={`px-5 pt-5 pb-4 ${animClass}`}>
            <h3 className="font-headline-md text-[24px] font-bold text-on-surface tracking-tight">{step.title}</h3>
            {renderStepBody()}
          </div>
        )}

        {/* 하단 액션 — 입력 단계는 '다음', 마지막 단계는 '저장', 결과 화면은 '확인' */}
        <div className="px-5 pb-5 pt-1 flex items-center gap-2.5">
          {outcome ? (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 h-[52px] rounded-2xl bg-primary text-on-primary font-headline-sm text-[17px] font-semibold shadow-sm active:scale-[0.98] transition-transform"
            >
              확인
            </button>
          ) : (
            <>
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
                <button
                  type="button"
                  onClick={goNext}
                  disabled={Boolean(stepIssue)}
                  className="flex-1 h-[52px] rounded-2xl bg-primary text-on-primary font-headline-sm text-[17px] font-semibold shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
                >
                  <span className="truncate">
                    {stepIssue ?? (step.id === 'photo' && photoDrafts.length === 0 ? '사진 없이 다음' : '다음')}
                  </span>
                  {!stepIssue && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSyncing}
                  className="flex-1 h-[52px] rounded-2xl bg-primary text-on-primary font-headline-sm text-[17px] font-semibold shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>
                    {isSyncing ? 'sync' : 'check_circle'}
                  </span>
                  <span className="truncate">
                    {isSyncing
                      ? photoDrafts.length > 0
                        ? '사진 올리는 중...'
                        : '기록 중...'
                      : isSheetBackend
                      ? '저장 및 시트 등록'
                      : '저장'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export const MeasurementInputGrid = React.memo(MeasurementInputGridComponent);
MeasurementInputGrid.displayName = 'MeasurementInputGrid';
