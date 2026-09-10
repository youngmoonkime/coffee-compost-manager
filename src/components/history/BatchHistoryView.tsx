import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import type { Batch } from '../../types';
import { getBatchPeriod } from '../../utils/calculations';

export const BatchHistoryView: React.FC = () => {
  const { batches, measurements, activeBatchId, setActiveBatchId, setActiveTab, completeBatch, setIsGoogleModalOpen, resetBatchData, reloadFromSheet, isLoadingFromSheet, isSheetBackend, deleteBatch } = useCompost();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<'all' | 'fermenting' | 'completed'>('all');

  const filteredBatches = batches.filter(b => {
    if (filter === 'fermenting') return b.status === 'fermenting';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  const handleSelectBatch = (batch: Batch) => {
    setActiveBatchId(batch.id);
    setActiveTab('monitoring');
    showToast(
      `${batch.code} 배치를 열었습니다`,
      batch.status === 'completed'
        ? '완숙 완료된 배치입니다 — 기록 조회만 가능합니다'
        : '측정 & 모니터링 화면으로 전환되었습니다',
      'info'
    );
  };

  const handleReload = async () => {
    const res = await reloadFromSheet();
    if (res.success) {
      showToast('구글 시트에서 불러왔습니다', res.message, 'success');
    } else {
      showToast('시트를 읽지 못했습니다', res.message, 'error');
    }
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      `배치 ${batches.length}건과 계측 기록 ${measurements.length}건을 모두 삭제합니다.\n` +
      (isSheetBackend
        ? '구글 시트의 기록도 함께 지워집니다.\n'
        : '') +
      '되돌릴 수 없습니다.\n\n' +
      '(구글 시트 연동 설정과 판정 임계값은 유지됩니다)\n\n계속할까요?'
    );
    if (!confirmed) return;

    const res = await resetBatchData();
    setFilter('all');
    showToast(
      '모든 이력을 삭제했습니다',
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  const handleDeleteBatch = async (e: React.MouseEvent, batch: Batch) => {
    e.stopPropagation();

    const logCount = measurements.filter(m => m.batchId === batch.id).length;
    const confirmed = window.confirm(
      `${batch.code} 배치를 삭제합니다.\n` +
      `이 배치의 계측 기록 ${logCount}건도 함께 지워집니다.\n` +
      (isSheetBackend ? '구글 시트에서도 제거됩니다.\n' : '') +
      '\n되돌릴 수 없습니다. 계속할까요?'
    );
    if (!confirmed) return;

    const res = await deleteBatch(batch.id);
    showToast(
      `${batch.code} 삭제됨`,
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  const handleComplete = (e: React.MouseEvent, batchId: string, code: string) => {
    e.stopPropagation();
    const result = completeBatch(batchId);

    if (result.completed) {
      showToast('완숙 완료 처리되었습니다', `${code} 깔짚 투입 승인`, 'success');
      return;
    }

    if (result.reason === 'no_measurements') {
      showToast(
        '완숙 완료로 넘길 수 없습니다',
        '계측 기록이 한 건도 없습니다. 부숙도를 확인할 근거가 필요합니다.',
        'warning'
      );
    }
  };

  return (
    <div className="flex flex-col w-full pb-8">
      {/* 상단 탭 헤더 */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">커피박 배치 이력 관리</h2>
            <p className="font-caption text-caption text-on-surface-variant mt-0.5">
              반입된 커피박의 부숙 이력 및 축사 깔짚 자원화 완료 기록
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isSheetBackend && (
              <button
                type="button"
                onClick={handleReload}
                disabled={isLoadingFromSheet}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant/40 text-xs font-bold hover:bg-surface-container-high active:scale-95 transition-all disabled:opacity-60"
                title="구글 시트에서 최신 내용 다시 불러오기"
              >
                <span className={`material-symbols-outlined text-[16px] ${isLoadingFromSheet ? 'animate-spin' : ''}`}>
                  {isLoadingFromSheet ? 'progress_activity' : 'refresh'}
                </span>
                <span className="hidden sm:inline">{isLoadingFromSheet ? '불러오는 중' : '시트에서 새로고침'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsGoogleModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300/80 text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all shadow-xs"
              title="구글 스프레드시트 연동 설정"
            >
              <span className="material-symbols-outlined text-[16px]">table_chart</span>
              <span className="hidden sm:inline">시트 설정</span>
            </button>
          </div>
        </div>

        {/* 필터 세그먼트 버튼 */}
        <div className="flex items-center gap-1.5 mt-3 bg-surface-container-low p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            전체 ({batches.length})
          </button>
          <button
            onClick={() => setFilter('fermenting')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'fermenting' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            부숙 진행 ({batches.filter(b => b.status === 'fermenting').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'completed' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            완숙 완료 ({batches.filter(b => b.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* 배치 카드 목록 */}
      {filteredBatches.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/20 shadow-sm">
          <span className="material-symbols-outlined text-[40px] text-outline/60">inventory_2</span>
          <p className="font-label-md text-sm font-bold text-on-surface mt-2">
            {batches.length === 0 ? '등록된 배치가 없습니다' : '이 조건에 해당하는 배치가 없습니다'}
          </p>
          <p className="font-caption text-[11.5px] text-outline mt-1 leading-relaxed">
            {batches.length === 0
              ? '[측정 & 모니터링] 탭의 [새 하역 등록]으로 첫 배치를 만들어주세요.'
              : '위 필터를 [전체]로 바꾸면 모든 배치를 볼 수 있습니다.'}
          </p>
          {batches.length === 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('monitoring')}
              className="mt-4 px-4 h-10 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              새 하역 등록하러 가기
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filteredBatches.map(batch => {
          const isActive = batch.id === activeBatchId;
          const isCompleted = batch.status === 'completed';

          // 계측 요약 — 마지막 계측일과 판정까지 함께 보여야 이력이 맥락을 갖는다
          const batchMeasurements = measurements
            .filter(m => m.batchId === batch.id)
            .sort((a, b) => a.date.localeCompare(b.date));
          const lastLog = batchMeasurements[batchMeasurements.length - 1];
          const period = getBatchPeriod(batch);

          return (
            <div
              key={batch.id}
              onClick={() => handleSelectBatch(batch)}
              className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm border transition-all cursor-pointer hover:border-primary/50 relative overflow-hidden ${
                isActive ? 'border-primary ring-1 ring-primary/40' : 'border-outline-variant/20'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg">
                  {isCompleted ? '조회 중' : '현재 모니터링 중'}
                </div>
              )}

              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-caption text-caption text-secondary font-bold block">
                    {batch.ranchName}
                  </span>
                  <h3 className="font-headline-sm text-[16px] font-bold text-on-surface mt-0.5">
                    {batch.code}
                  </h3>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isCompleted
                    ? 'bg-primary-fixed text-on-primary-fixed'
                    : 'bg-secondary-container text-on-secondary-container'
                }`}>
                  {isCompleted ? '완숙완료' : '부숙진행중'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 my-1 border-y border-outline-variant/20 text-center">
                <div>
                  <span className="font-caption text-[10.5px] text-outline block">커피박 수거량</span>
                  <span className="font-label-numeric text-[13px] font-bold text-primary">
                    {batch.initialWeightKg} kg
                  </span>
                </div>
                <div>
                  <span className="font-caption text-[10.5px] text-outline block">
                    {isCompleted ? '부숙 기간' : '부숙 경과'}
                  </span>
                  <span className="font-label-numeric text-[13px] font-bold text-on-surface">
                    {period.days}일
                    {!isCompleted && <span className="text-[10px] font-normal text-outline"> 째</span>}
                  </span>
                </div>
                <div>
                  <span className="font-caption text-[10.5px] text-outline block">계측 기록</span>
                  <span className={`font-label-numeric text-[13px] font-bold ${
                    batchMeasurements.length === 0 ? 'text-outline' : 'text-secondary'
                  }`}>
                    {batchMeasurements.length === 0 ? '없음' : `${batchMeasurements.length} 회`}
                  </span>
                </div>
              </div>

              {/* 기간을 날짜로 한 번 더 풀어써서 '언제부터 언제까지'가 바로 읽히게 한다 */}
              <p className="font-caption text-[11px] text-on-surface-variant flex items-center gap-1 flex-wrap">
                <span className="material-symbols-outlined text-[14px] text-outline">event</span>
                <span className="font-label-numeric">{batch.startDate}</span>
                <span className="text-outline">→</span>
                <span className="font-label-numeric">
                  {isCompleted ? batch.completedDate : '진행 중'}
                </span>
                {lastLog && (
                  <span className="text-outline">
                    · 최근 계측 {lastLog.date} (D+{lastLog.dayNumber})
                  </span>
                )}
              </p>

              {batch.notes && (
                <p className="font-caption text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                  📌 {batch.notes}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 gap-2">
                <span className="font-caption text-[11px] text-primary flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[15px]">analytics</span>
                  {isCompleted ? '기록 조회' : '계측 데이터 보기'}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleDeleteBatch(e, batch)}
                    title="이 배치와 계측 기록을 모두 삭제"
                    className="px-2 py-1 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors flex items-center gap-0.5 text-xs font-bold"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span className="hidden sm:inline">삭제</span>
                  </button>

                  {!isCompleted && (
                    <button
                      onClick={(e) => handleComplete(e, batch.id, batch.code)}
                      disabled={batchMeasurements.length === 0}
                      title={
                        batchMeasurements.length === 0
                          ? '계측 기록이 있어야 완숙 완료로 넘길 수 있습니다'
                          : '완숙 완료로 전환'
                      }
                      className="px-2.5 py-1 bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface-variant rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-container-high disabled:hover:text-on-surface-variant"
                      type="button"
                    >
                      완숙 완료 전환
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 전체 삭제 — 실수로 누르기 어렵도록 목록 맨 아래에 둔다 */}
      {batches.length > 0 && (
        <div className="mt-5 pt-4 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={handleResetData}
            className="w-full h-11 rounded-xl border border-error/40 text-error font-label-md text-xs font-bold hover:bg-error-container/40 active:scale-99 transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
            모든 이력 삭제 (배치 {batches.length}건 · 계측 {measurements.length}건)
          </button>
          <p className="font-caption text-[10.5px] text-outline text-center mt-1.5 leading-relaxed">
            앱을 빈 상태로 만듭니다. 되돌릴 수 없습니다.
            <br />
            구글 시트 연동 설정은 유지되며, 시트에 이미 기록된 행은 지워지지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
};
