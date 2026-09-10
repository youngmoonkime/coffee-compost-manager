import React, { useState, useEffect, useRef } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { getRanchDisplayName } from '../../utils/calculations';

interface ActiveBatchCardProps {
  onOpenUnloadModal: () => void;
}

export const ActiveBatchCard: React.FC<ActiveBatchCardProps> = ({ onOpenUnloadModal }) => {
  const { batches, activeBatch, activeBatchId, setActiveBatchId, daysElapsed, updateBatchWeight } = useCompost();
  const { showToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 커피박 수거량 인라인 편집
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // 배치를 바꾸면 편집 중이던 입력은 닫는다
  useEffect(() => {
    setIsEditingWeight(false);
  }, [activeBatchId]);

  const startEditWeight = () => {
    setWeightInput(String(activeBatch?.initialWeightKg ?? 0));
    setIsEditingWeight(true);
    // 렌더 후 포커스 + 전체 선택 (현장에서 바로 새 값 입력)
    requestAnimationFrame(() => weightInputRef.current?.select());
  };

  const commitWeight = () => {
    if (!activeBatch) return;

    const parsed = Number(weightInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('수거량을 1kg 이상으로 입력해주세요', undefined, 'warning');
      weightInputRef.current?.select();
      return;
    }

    const next = Math.round(parsed);
    setIsEditingWeight(false);

    if (next === activeBatch.initialWeightKg) return;

    const result = updateBatchWeight(activeBatch.id, next);

    if (result.needsScriptRedeploy) {
      showToast(
        `수거량 ${next}kg 저장됨 (앱에만)`,
        '구글 시트 스크립트가 구버전이라 전송을 건너뛰었습니다. 연동 마법사에서 최신 코드로 재배포해주세요.',
        'warning'
      );
      return;
    }

    showToast('커피박 수거량이 수정되었습니다', `${activeBatch.code} · ${next}kg`, 'success');
  };

  const isCompleted = activeBatch?.status === 'completed';

  return (
    <section className="w-full mb-3">
      <div className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm relative border border-outline-variant/20">
        <div className="flex items-center justify-between mb-2.5">
          <div className="relative flex-1 min-w-0 pr-2">
            <label className="font-caption text-caption text-on-surface-variant block mb-0.5 tracking-tight whitespace-nowrap">
              작업 관리 배치
            </label>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              className="flex items-center gap-1.5 cursor-pointer text-left w-full focus:outline-none"
              type="button"
            >
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                folder_managed
              </span>
              <span className="font-headline-sm text-[15px] font-bold text-on-surface truncate tracking-tight">
                {activeBatch ? getRanchDisplayName(activeBatch.ranchName) : '배치 없음'}
              </span>
              <span className={`material-symbols-outlined text-outline text-[16px] shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {/* 배치 선택 드롭다운 */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1.5 w-64 max-w-[85vw] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 z-30 py-1.5 max-h-56 overflow-y-auto smooth-scroll">
                  {batches.map(batch => (
                    <button
                      key={batch.id}
                      onClick={() => {
                        setActiveBatchId(batch.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-surface-container-low transition-colors ${
                        batch.id === activeBatchId ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface'
                      }`}
                      type="button"
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="truncate font-semibold">{batch.code}</div>
                        <div className="text-[10.5px] text-outline truncate">{batch.ranchName} · {batch.initialWeightKg}kg</div>
                      </div>
                      {batch.status === 'completed' && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant shrink-0 font-bold">
                          완료
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onOpenUnloadModal}
            className="flex items-center gap-1 bg-secondary-container text-on-secondary-container px-2.5 py-1.5 rounded-xl font-label-sm text-[13px] font-bold shrink-0 shadow-sm active:scale-95 transition-transform whitespace-nowrap hover:opacity-95"
            id="open-unload-modal-btn"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>새 하역 등록</span>
          </button>
        </div>

        {/* 3개 메트릭 요약 그리드 */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {/* 커피박 수거량 — 탭하면 바로 수정 */}
          <div className="bg-surface-container-low rounded-xl py-2 px-1.5 flex flex-col items-center justify-center text-center">
            <span className="font-caption text-[11px] text-on-surface-variant whitespace-nowrap">
              커피박 수거량
            </span>

            {isEditingWeight ? (
              <form
                onSubmit={(e) => { e.preventDefault(); commitWeight(); }}
                className="flex items-baseline justify-center mt-0.5"
              >
                <input
                  ref={weightInputRef}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={10}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onBlur={commitWeight}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingWeight(false);
                    }
                  }}
                  className="w-12 text-center font-display-metric text-[15px] font-bold text-primary bg-surface rounded-md border border-primary/60 focus:outline-none tabular-nums"
                  aria-label="커피박 수거량(kg)"
                />
                <span className="text-[10px] font-normal text-outline ml-0.5">kg</span>
              </form>
            ) : (
              <button
                type="button"
                onClick={startEditWeight}
                title="탭하여 커피박 수거량 수정"
                className="mt-0.5 flex items-center justify-center gap-0.5 group active:scale-95 transition-transform"
              >
                <span className="font-display-metric text-[15px] font-bold text-primary whitespace-nowrap tabular-nums">
                  {activeBatch?.initialWeightKg ?? 0} <span className="text-[10px] font-normal text-outline">kg</span>
                </span>
                <span className="material-symbols-outlined text-[13px] text-outline group-hover:text-primary transition-colors">
                  edit
                </span>
              </button>
            )}
          </div>

          <div className="bg-surface-container-low rounded-xl py-2 px-1.5 flex flex-col items-center justify-center text-center">
            <span className="font-caption text-[11px] text-on-surface-variant whitespace-nowrap">경과 기간</span>
            <span className="font-display-metric text-[15px] font-bold text-secondary mt-0.5 whitespace-nowrap">
              D+{daysElapsed}<span className="text-[10px] font-normal text-outline">일차</span>
            </span>
          </div>

          <div className={`rounded-xl py-2 px-1.5 flex flex-col items-center justify-center text-center ${
            isCompleted ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary-fixed text-on-primary-fixed'
          }`}>
            <span className="font-caption text-[11px] opacity-80 whitespace-nowrap">발효 진행</span>
            <span className="font-headline-sm text-[13px] font-bold mt-0.5 flex items-center gap-1 whitespace-nowrap">
              {!isCompleted && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              )}
              {isCompleted ? '완숙완료' : '부숙중'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
