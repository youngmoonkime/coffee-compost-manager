import React, { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressImage } from '../../../utils/photos';

interface FieldWorkStepProps {
  mixed: boolean | null;
  setMixed: (v: boolean) => void;
  // 곰팡이 상태 및 색상, 사진
  hasMold: boolean | null;
  setHasMold: (v: boolean) => void;
  moldColor: string;
  setMoldColor: (v: string) => void;
  moldPhotos: string[];
  setMoldPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  // 냄새
  odor: boolean | null;
  setOdor: (v: boolean) => void;
  // 깔개 활용
  hasBedding: boolean | null;
  setHasBedding: (v: boolean) => void;
  beddingRaw: string;
  setBeddingRaw: (v: string) => void;
  beddingLocation?: string;
  setBeddingLocation?: (v: string) => void;
  beddingAmountDesc?: string;
  setBeddingAmountDesc?: (v: string) => void;
  /** 이 사이클에 지금까지 모인 양 */
  currentPileKg: number;
  onEnterNext?: () => void;
}

const COMMON_AMOUNTS = [100, 300, 500, 1000] as const;
const QUICK_LOCATIONS = ['1번 우사', '2번 우사', '송아지방', '퇴비사', '축사 통로'] as const;
const MOLD_COLORS = [
  { label: '흰색 (유익 방선균)', value: '흰색' },
  { label: '녹색/청록색', value: '녹색' },
  { label: '검은색', value: '검은색' },
  { label: '노란/주황색', value: '노란색' },
  { label: '회색', value: '회색' },
] as const;

const cardClass =
  'rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-4 border border-black/5 dark:border-white/10';

/** 두 갈래 선택 버튼 */
const Choice: React.FC<{
  value: boolean | null;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
  label: string;
  description?: string;
}> = ({ value, onChange, yes, no, label, description }) => (
  <div>
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{label}</span>
      <div className="flex gap-1.5" role="group" aria-label={label}>
        {[
          { on: false, text: no },
          { on: true, text: yes },
        ].map(option => (
          <button
            key={option.text}
            type="button"
            aria-pressed={value === option.on}
            onClick={() => onChange(option.on)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
              value === option.on
                ? 'bg-[#315C36] text-white'
                : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/10 dark:border-white/10'
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
    {description && (
      <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-1.5 break-keep leading-relaxed">
        {description}
      </p>
    )}
  </div>
);

/** 분수/비율 문자열 파싱 */
function parseFractionRatio(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
      if (parts[0] > parts[1] && parts[1] === 1) {
        return 1 / parts[0];
      }
      return parts[0] / parts[1];
    }
  }

  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    if (num > 0 && num <= 1) return num;
    if (num > 1 && num <= 100) return num / 100;
  }
  return null;
}

/** 깔개 사용 상세 입력 컴포넌트 */
const BeddingUsageInput: React.FC<{
  beddingRaw: string;
  setBeddingRaw: (v: string) => void;
  beddingLocation: string;
  setBeddingLocation: (v: string) => void;
  beddingAmountDesc: string;
  setBeddingAmountDesc: (v: string) => void;
  currentPileKg: number;
  onEnterNext?: () => void;
}> = ({
  beddingRaw,
  setBeddingRaw,
  beddingLocation,
  setBeddingLocation,
  beddingAmountDesc,
  setBeddingAmountDesc,
  currentPileKg,
  onEnterNext,
}) => {
  const [inputMode, setInputMode] = useState<'fraction' | 'kg'>(() => {
    return beddingAmountDesc ? 'fraction' : 'kg';
  });

  const [fractionText, setFractionText] = useState(beddingAmountDesc || '1/2');

  const handleFractionChange = (text: string, label?: string) => {
    setFractionText(text);
    const desc = label || text;
    setBeddingAmountDesc(desc);

    const ratio = parseFractionRatio(text);
    if (ratio !== null && currentPileKg > 0) {
      const calculatedKg = Math.round(currentPileKg * ratio);
      setBeddingRaw(String(calculatedKg));
    } else if (ratio !== null && currentPileKg <= 0) {
      setBeddingRaw(String(Math.round(500 * ratio)));
    }
  };

  const calculatedRatio = parseFractionRatio(fractionText);
  const calculatedEstimateKg =
    calculatedRatio !== null && currentPileKg > 0
      ? Math.round(currentPileKg * calculatedRatio)
      : beddingRaw
      ? parseInt(beddingRaw, 10)
      : 0;

  return (
    <div className="mt-3.5 pt-3.5 border-t border-black/5 dark:border-white/10 space-y-3">
      {/* 1. 사용처 입력 */}
      <div>
        <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
          깔개 사용처 <span className="text-[#315C36] dark:text-[#34C759]">*</span>
        </label>
        <input
          type="text"
          value={beddingLocation}
          onChange={e => setBeddingLocation(e.target.value)}
          placeholder="예: 1번 우사, 송아지방, 퇴비사 등"
          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#315C36]/30 placeholder:text-[#8E8E93]"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {QUICK_LOCATIONS.map(loc => (
            <button
              key={loc}
              type="button"
              onClick={() => setBeddingLocation(loc)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                beddingLocation === loc
                  ? 'bg-[#315C36] text-white font-bold'
                  : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* 2. 사용량 입력 방식 선택 탭 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            사용량 입력 방식 <span className="text-[#315C36] dark:text-[#34C759]">*</span>
          </label>
          <div className="flex p-0.5 rounded-lg bg-black/5 dark:bg-white/10 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setInputMode('fraction');
                handleFractionChange(fractionText || '1/2');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                inputMode === 'fraction'
                  ? 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#6E6E73] dark:text-[#8E8E93]'
              }`}
            >
              대략적인 양 (1/2 등)
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('kg');
                setBeddingAmountDesc('');
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                inputMode === 'kg'
                  ? 'bg-white dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                  : 'text-[#6E6E73] dark:text-[#8E8E93]'
              }`}
            >
              정확한 무게 (kg)
            </button>
          </div>
        </div>

        {/* 모드 A: 대략적인 양 */}
        {inputMode === 'fraction' && (
          <div className="p-3 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#6E6E73] dark:text-[#8E8E93]">
                비율 / 분수 직접 입력:
              </span>
              <input
                type="text"
                value={fractionText}
                onChange={e => handleFractionChange(e.target.value)}
                placeholder="1/2 또는 2/1"
                className="w-24 px-2 py-1 text-center font-display-metric text-sm font-bold rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/10 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '절반 (1/2)', val: '1/2' },
                { label: '1/3 더미', val: '1/3' },
                { label: '1/4 더미', val: '1/4' },
                { label: '소량 (1/10)', val: '1/10' },
                { label: '전체 (1/1)', val: '1/1' },
              ].map(f => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => handleFractionChange(f.val, f.label)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    fractionText === f.val
                      ? 'bg-[#315C36] text-white font-bold'
                      : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#315C36]/10 text-xs text-[#315C36] dark:text-[#34C759]">
              <span className="font-medium">
                더미량 ({currentPileKg.toLocaleString('ko-KR')}kg) 기준 환산
              </span>
              <span className="font-bold tabular-nums">
                약 {calculatedEstimateKg.toLocaleString('ko-KR')} kg 적용
              </span>
            </div>
          </div>
        )}

        {/* 모드 B: 정확한 무게 (kg) */}
        {inputMode === 'kg' && (
          <div className="p-3 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10">
            <div className="flex items-baseline justify-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={beddingRaw}
                placeholder="0"
                autoFocus
                aria-label="깔개 사용량 (kg)"
                onChange={e => setBeddingRaw(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && onEnterNext) {
                    e.preventDefault();
                    onEnterNext();
                  }
                }}
                className="w-[5ch] bg-transparent text-center font-display-metric text-[32px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] placeholder:text-black/20 dark:placeholder:text-white/20"
              />
              <span className="font-display-metric text-base text-[#6E6E73] dark:text-[#8E8E93] font-semibold">
                kg
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {COMMON_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBeddingRaw(String(amount))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    beddingRaw === String(amount)
                      ? 'bg-[#315C36] text-white'
                      : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/5'
                  }`}
                >
                  {amount.toLocaleString('ko-KR')}kg
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 현장 점검 화면 (Field Work & Inspection Step):
 * 1. 오늘 혼합 작업 유무 (기존 커피박을 삽으로 한 번씩 뒤집어 주었는지)
 * 2. 곰팡이 유무 확인 (있다면 색상 선택 및 현장 사진 첨부)
 * 3. 이상 냄새 유무
 * 4. 깔개 활용 유무 (사용처 및 대략적 양 1/2 또는 kg)
 */
export const FieldWorkStep: React.FC<FieldWorkStepProps> = ({
  mixed,
  setMixed,
  hasMold,
  setHasMold,
  moldColor,
  setMoldColor,
  moldPhotos,
  setMoldPhotos,
  odor,
  setOdor,
  hasBedding,
  setHasBedding,
  beddingRaw,
  setBeddingRaw,
  beddingLocation = '',
  setBeddingLocation = () => {},
  beddingAmountDesc = '',
  setBeddingAmountDesc = () => {},
  currentPileKg,
  onEnterNext,
}) => {
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // 곰팡이 사진 추가 핸들러
  const handleMoldPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsProcessingPhoto(true);
    try {
      const compressedList: string[] = [];
      for (const file of files) {
        compressedList.push(await compressImage(file));
      }
      setMoldPhotos(prev => [...prev, ...compressedList].slice(0, 3));
    } catch (err) {
      console.error('곰팡이 사진 압축 오류:', err);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const removeMoldPhoto = (index: number) => {
    setMoldPhotos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* 1. 오늘 혼합 작업 — 기존 커피박을 삽으로 한 번씩 뒤집어 주는 작업 */}
      <div className={cardClass}>
        <Choice
          label="오늘 혼합 작업"
          value={mixed}
          onChange={setMixed}
          yes="완료"
          no="안 함"
          description="기존 커피박을 삽으로 한 번씩 뒤집어 주었나요? 곰팡이 예방과 부숙 촉진을 위해 1주일에 2~3회 권장합니다."
        />
      </div>

      {/* 2. 곰팡이 발생 여부 확인 (있다면 색상 및 사진 첨부) */}
      <div className={cardClass}>
        <Choice
          label="곰팡이 발생 여부"
          value={hasMold}
          onChange={setHasMold}
          yes="있음"
          no="없음"
          description="더미 표면이나 내부에 곰팡이가 피었는지 눈으로 확인하세요."
        />

        {hasMold && (
          <div className="mt-3.5 pt-3.5 border-t border-black/5 dark:border-white/10 space-y-3">
            {/* 곰팡이 색상 선택 */}
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                곰팡이 색상 선택 <span className="text-[#315C36] dark:text-[#34C759]">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MOLD_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setMoldColor(c.value)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                      moldColor === c.value
                        ? 'bg-[#315C36] text-white font-bold'
                        : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/10 dark:border-white/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={moldColor}
                onChange={e => setMoldColor(e.target.value)}
                placeholder="기타 색상 직접 입력 (예: 회갈색, 점박이 등)"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#315C36]/30 placeholder:text-[#8E8E93]"
              />
              <p className="text-[10.5px] text-[#6E6E73] dark:text-[#8E8E93] mt-1">
                💡 <strong className="text-[#315C36] dark:text-[#34C759]">흰색</strong>은 유익한 고온 방선균일 가능성이 높으며, <strong className="text-[#D97706] dark:text-[#FF9F0A]">녹색/검은색</strong>은 과습·혼합 필요 신호입니다. <strong className="text-[#C5221F] dark:text-[#FF453A]">노란/주황색</strong>도 위험 신호이니 바로 혼합하고 다음 방문에서 다시 확인해주세요.
              </p>
            </div>

            {/* 곰팡이 사진 첨부 */}
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                곰팡이 현장 사진 첨부 (선택, 최대 3장)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {moldPhotos.map((photo, index) => (
                  <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-black/10 dark:border-white/15 shadow-xs">
                    <img src={photo} alt={`곰팡이 사진 ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeMoldPhoto(index)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                      aria-label="사진 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {moldPhotos.length < 3 && (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-black/15 dark:border-white/20 hover:border-[#315C36] dark:hover:border-[#34C759] flex flex-col items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] cursor-pointer transition-colors bg-white/50 dark:bg-[#1C1C1E]/50">
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[9.5px] font-medium">
                      {isProcessingPhoto ? '처리중' : '사진 추가'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleMoldPhotoUpload}
                      disabled={isProcessingPhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. 이상 냄새 유무 */}
      <div className={cardClass}>
        <Choice
          label="이상 악취 여부"
          value={odor}
          onChange={setOdor}
          yes="이상 악취"
          no="정상 (흙냄새/무취)"
          description="시큼하거나 썩은 냄새가 나면 산소 부족(혐기화) 상태일 수 있습니다."
        />
      </div>

      {/* 4. 깔개 활용 여부 (사용처 및 사용량) */}
      <div className={cardClass}>
        <Choice
          label="깔개 활용"
          value={hasBedding}
          onChange={setHasBedding}
          yes="있음"
          no="없음"
          description="더미에서 커피박을 퍼서 축사 깔개로 사용했는지 확인합니다."
        />
        {hasBedding && (
          <BeddingUsageInput
            beddingRaw={beddingRaw}
            setBeddingRaw={setBeddingRaw}
            beddingLocation={beddingLocation}
            setBeddingLocation={setBeddingLocation}
            beddingAmountDesc={beddingAmountDesc}
            setBeddingAmountDesc={setBeddingAmountDesc}
            currentPileKg={currentPileKg}
            onEnterNext={onEnterNext}
          />
        )}
      </div>

      {/* 현재 더미량 상태 요약 */}
      <div className="apple-card p-3 flex items-center justify-between text-xs">
        <span className="text-[#6E6E73] dark:text-[#8E8E93]">현재 운영 사이클 더미량</span>
        <span className="font-display-metric text-base font-bold text-[#315C36] dark:text-[#34C759] tabular-nums">
          {currentPileKg.toLocaleString('ko-KR')} kg
        </span>
      </div>
    </div>
  );
};
