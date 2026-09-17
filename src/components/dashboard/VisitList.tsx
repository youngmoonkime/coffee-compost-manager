import React, { useState } from 'react';
import type { MeasurementRecord } from '../../types';
import { formatShortDate } from '../../utils/calculations';
import { describeWorkType, getAddedKg, getBeddingUsedKg, MOLD_LABELS } from '../../utils/fieldOps';
import { getDriveThumbnailUrl } from '../../utils/photos';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';

/** 값이 없는 예전 기록은 '기록 없음'으로 보여 준다 — 없는 값을 추정하지 않는다 */
const NO_RECORD = '기록 없음';

const Row: React.FC<{ label: string; value: string; tone?: 'normal' | 'warn' }> = ({
  label,
  value,
  tone = 'normal',
}) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">{label}</span>
    <span
      className={`text-xs font-semibold ${
        tone === 'warn' ? 'text-[#C5221F] dark:text-[#FF453A]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
      }`}
    >
      {value}
    </span>
  </div>
);

/** 최근 현장 방문 기록. 날짜를 누르면 사진과 상세 기록이 펼쳐진다. */
export const VisitList: React.FC<{ records: MeasurementRecord[]; limit?: number }> = ({
  records,
  limit = 6,
}) => {
  const { deleteRecord } = useCompost();
  const { showToast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = [...records].reverse().slice(0, limit);

  const handleDelete = async (record: MeasurementRecord) => {
    if (!window.confirm(`${formatShortDate(record.date)} 점검 기록을 삭제할까요?`)) return;
    const res = await deleteRecord(record.id);
    showToast(
      `${formatShortDate(record.date)} 기록 삭제`,
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  if (rows.length === 0) {
    return (
      <div className="apple-card p-4 text-center text-xs text-[#6E6E73] dark:text-[#8E8E93]">
        아직 현장 점검 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(record => {
        const isOpen = openId === record.id;
        const moldWarn = record.moldStatus === 'some' || record.moldStatus === 'spreading';
        return (
          <div
            key={record.id}
            className="apple-card overflow-hidden bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : record.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 p-3.5 text-left active:opacity-70"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                    {formatShortDate(record.date)}
                  </span>
                  <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">{record.time}</span>
                </div>
                <span className="block text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5 truncate">
                  {describeWorkType(record)}
                  {record.moldStatus ? ` · 곰팡이 ${MOLD_LABELS[record.moldStatus]}` : ` · 곰팡이 ${NO_RECORD}`}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <div className="text-sm font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                    {record.moisture > 0 ? `${record.moisture}%` : '--'}
                  </div>
                  <div className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
                    심부 {record.coreTemp > 0 ? `${record.coreTemp}℃` : '--'}
                  </div>
                </div>
                <span
                  className={`material-symbols-outlined text-[18px] text-[#6E6E73] dark:text-[#8E8E93] transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="px-3.5 pb-3.5 pt-1 border-t border-black/5 dark:border-white/10">
                <Row label="신규 투입량" value={`${getAddedKg(record).toLocaleString('ko-KR')} kg`} />
                <Row
                  label="깔개 사용량"
                  value={
                    record.beddingUsedKg === undefined
                      ? NO_RECORD
                      : `${getBeddingUsedKg(record).toLocaleString('ko-KR')} kg`
                  }
                />
                <Row label="혼합 작업" value={record.mixed === undefined ? NO_RECORD : record.mixed ? '완료' : '안 함'} />
                <Row
                  label="곰팡이"
                  value={record.moldStatus ? MOLD_LABELS[record.moldStatus] : NO_RECORD}
                  tone={moldWarn ? 'warn' : 'normal'}
                />
                <Row
                  label="이상 냄새"
                  value={record.odor === undefined ? NO_RECORD : record.odor ? '있음' : '없음'}
                  tone={record.odor ? 'warn' : 'normal'}
                />
                {record.corePoints && record.corePoints.length > 0 && (
                  <Row
                    label="심부 3지점"
                    value={record.corePoints.map(p => `${p.moisture}%/${p.coreTemp}℃`).join('  ')}
                  />
                )}
                {(record.ambientTemp > 0 || record.ambientHum > 0) && (
                  <Row label="외기" value={`${record.ambientTemp}℃ · 습도 ${record.ambientHum}%`} />
                )}
                {record.cycleId && <Row label="운영 사이클" value={record.cycleId} />}
                {record.notes && <Row label="메모" value={record.notes} />}

                {((record.photos?.length ?? 0) > 0 || (record.pendingPhotoCount ?? 0) > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {record.photos?.map(photo => (
                      <a
                        key={photo.fileId}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-14 h-14 rounded-lg overflow-hidden bg-[#F2F2F7] dark:bg-[#2C2C2E] block"
                        title="드라이브에서 원본 보기"
                      >
                        <img
                          src={getDriveThumbnailUrl(photo.fileId, 160)}
                          alt="현장 사진"
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                    {(record.pendingPhotoCount ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#FF3B30]/15 text-[#C5221F] dark:text-[#FF453A] text-[10px] font-bold">
                        사진 {record.pendingPhotoCount}장 전송 대기
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(record)}
                  className="mt-3 text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#C5221F] dark:hover:text-[#FF453A] flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>이 점검 기록 삭제
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
