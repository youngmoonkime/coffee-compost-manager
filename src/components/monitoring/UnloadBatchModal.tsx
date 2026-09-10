import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { generateBatchCode, getCurrentDateString } from '../../utils/calculations';

interface UnloadBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnloadBatchModal: React.FC<UnloadBatchModalProps> = ({ isOpen, onClose }) => {
  const { addNewBatch } = useCompost();
  const { showToast } = useToast();

  const [selectedRanch, setSelectedRanch] = useState<'main' | 'sub' | 'custom'>('main');
  const [customRanchName, setCustomRanchName] = useState('');
  const [weight, setWeight] = useState<number>(850);
  const [notes, setNotes] = useState('');

  const todayStr = getCurrentDateString();
  const previewBatchCode = generateBatchCode('GJ');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (weight <= 0) {
      showToast('커피박 수거량을 1kg 이상 입력해주세요', undefined, 'warning');
      return;
    }

    const ranchName = selectedRanch === 'main'
      ? '건준목장 (본장)'
      : selectedRanch === 'sub'
      ? '건준목장 (제2축사)'
      : customRanchName.trim() || '신규 등록 목장';

    addNewBatch({
      code: previewBatchCode,
      ranchName,
      initialWeightKg: weight,
      notes: notes.trim() || undefined,
    });

    showToast('새 하역 배치가 등록되었습니다', `${previewBatchCode} (${weight}kg)`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-end justify-center transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface rounded-t-3xl p-5 shadow-2xl pb-8 animate-in slide-in-from-bottom duration-300 border-t border-outline-variant/30 max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">새 커피박 하역 등록</h3>
              <span className="font-caption text-caption text-on-surface-variant">자원화 배치 초기화 및 번호 자동 생성</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 반입 목장 선택 */}
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-1.5">
              반입 목장 선택
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRanch('main')}
                className={`h-11 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                  selectedRanch === 'main'
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {selectedRanch === 'main' && (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                )}
                건준목장 (본장)
              </button>

              <button
                type="button"
                onClick={() => setSelectedRanch('custom')}
                className={`h-11 rounded-xl font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${
                  selectedRanch === 'custom'
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                목장 직접 입력
              </button>
            </div>

            {selectedRanch === 'custom' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="목장명을 입력하세요 (예: 푸른목장 1퇴비장)"
                  value={customRanchName}
                  onChange={(e) => setCustomRanchName(e.target.value)}
                  className="w-full h-11 bg-surface-container-lowest rounded-xl px-3 text-sm text-on-surface border border-outline-variant/50 focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* 커피박 수거량 입력 */}
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-1.5">
              커피박 수거량 (kg)
            </label>
            <div className="relative flex items-center">
              <input
                className="w-full h-12 bg-surface-container-lowest rounded-xl px-4 font-display-metric text-headline-sm text-primary placeholder:text-outline focus:outline-none border border-outline-variant/30 focus:border-primary"
                id="new-batch-weight"
                placeholder="예: 850"
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              />
              <span className="absolute right-4 font-label-numeric text-outline font-semibold">kg</span>
            </div>
          </div>

          {/* 비고/특이사항 */}
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-1.5">
              배치 비고 (선택)
            </label>
            <input
              type="text"
              placeholder="예: 카페 프랜차이즈 수거분, 팽창제(왕겨) 10% 혼합 등"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 bg-surface-container-lowest rounded-xl px-3 text-sm text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            />
          </div>

          {/* 자동 날짜 및 코드 안내 카드 */}
          <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-2.5 border border-outline-variant/20">
            <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">calendar_today</span>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface">하역 일시: 오늘 ({todayStr}) 자동 적용</span>
              <span className="font-caption text-caption text-outline truncate">
                신규 채번 코드: <strong>{previewBatchCode}</strong>
              </span>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            className="w-full h-13 bg-primary active:bg-primary-container text-on-primary font-headline-sm text-headline-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer hover:bg-primary/90"
            id="submit-unload-btn"
            type="submit"
          >
            <span className="material-symbols-outlined text-[20px]">task_alt</span>
            <span>배치 등록 완료 및 계측 시작</span>
          </button>
        </form>
      </div>
    </div>
  );
};
