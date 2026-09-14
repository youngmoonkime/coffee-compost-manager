import React, { useMemo, useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import { annotateRecords, formatShortDate } from '../../utils/calculations';
import { VERDICT_BADGES } from '../../constants/verdictBadges';
import { getDriveThumbnailUrl } from '../../utils/photos';
import type { MeasurementRecord, RecordPhoto } from '../../types';

/** 드라이브 사진 썸네일 — 탭하면 원본을 새 창으로 연다. 썸네일을 못 불러오면 아이콘으로 대신한다. */
const DriveThumb: React.FC<{ photo: RecordPhoto }> = ({ photo }) => {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={photo.url}
      target="_blank"
      rel="noreferrer"
      title="드라이브에서 원본 보기"
      className="w-9 h-9 rounded-md overflow-hidden bg-surface-container-high flex items-center justify-center shrink-0"
    >
      {failed ? (
        <span className="material-symbols-outlined text-[18px] text-outline">image</span>
      ) : (
        <img
          src={getDriveThumbnailUrl(photo.fileId, 120)}
          alt="파봉 작업 사진"
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
    </a>
  );
};

function formatSigned(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/** 한 장소의 기록 목록 (최신순) — 사진 보기·기록 삭제 */
export const PileRecordList: React.FC<{ records: MeasurementRecord[] }> = ({ records }) => {
  const { settings, deleteRecord } = useCompost();
  const { showToast } = useToast();

  const rows = useMemo(() => annotateRecords(records, settings).reverse(), [records, settings]);

  const handleDelete = async (id: string, date: string) => {
    if (!window.confirm(`${formatShortDate(date)} 기록을 삭제할까요?`)) return;
    const res = await deleteRecord(id);
    showToast(
      `${formatShortDate(date)} 기록 삭제`,
      res.success ? res.message : `시트 반영 실패 — ${res.message}`,
      res.success ? 'info' : 'warning'
    );
  };

  return (
    <section className="w-full">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className="material-symbols-outlined text-primary text-[18px]">history</span>
        <h3 className="font-headline-sm text-[15px] font-bold text-on-surface tracking-tight whitespace-nowrap">
          기록
        </h3>
        <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-caption text-[10px] font-bold whitespace-nowrap">
          {rows.length}건
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl p-4 text-center text-xs text-outline border border-outline-variant/20">
          저장된 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ record, previous, verdict }, idx) => {
            const badge = VERDICT_BADGES[verdict.type];
            const moistureDelta = previous ? record.moisture - previous.moisture : null;
            const tempDelta = previous ? record.coreTemp - previous.coreTemp : null;

            return (
              <div
                key={record.id}
                className="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/20 flex items-center justify-between group hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-11 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                      idx === 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <span className="font-label-numeric text-[12.5px] font-bold leading-tight tabular-nums">
                      {Number(record.date.slice(5, 7))}/{Number(record.date.slice(8, 10))}
                    </span>
                    <span className="font-caption text-[9px] leading-none opacity-80">{record.time}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-sm text-[13px] text-on-surface font-bold whitespace-nowrap">
                        함수율 {record.moisture}%
                      </span>
                      {moistureDelta !== null && (
                        <span
                          title="직전 기록 대비 함수율 변화"
                          className={`px-1 py-0.5 rounded font-caption text-[10px] whitespace-nowrap tabular-nums ${
                            moistureDelta < 0
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : moistureDelta > 0
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {formatSigned(moistureDelta)}%p
                        </span>
                      )}
                      <span className="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-caption text-[10px] whitespace-nowrap tabular-nums">
                        심부 {record.coreTemp}℃{tempDelta !== null ? ` (${formatSigned(tempDelta)})` : ''}
                      </span>
                    </div>
                    <span className="font-caption text-[11px] text-outline block mt-0.5 truncate">
                      수거 {record.collectedKg.toLocaleString('ko-KR')}kg · 외기 {record.ambientTemp}℃ · 습도 {record.ambientHum}%
                    </span>
                    {record.notes && (
                      <span className="font-caption text-[11px] text-secondary mt-1 flex items-start gap-1" title={record.notes}>
                        <span className="material-symbols-outlined text-[13px] shrink-0 mt-px">sticky_note_2</span>
                        <span className="min-w-0 break-keep line-clamp-2">{record.notes}</span>
                      </span>
                    )}
                    {((record.photos?.length ?? 0) > 0 || (record.pendingPhotoCount ?? 0) > 0) && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {record.photos?.map(photo => <DriveThumb key={photo.fileId} photo={photo} />)}
                        {(record.pendingPhotoCount ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-caption text-[10px] whitespace-nowrap">
                            사진 {record.pendingPhotoCount}장 전송 대기
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className={`px-2 py-0.5 rounded-full font-caption text-[10.5px] font-bold whitespace-nowrap ${badge.className}`}>
                    {badge.text}
                  </span>
                  <button
                    onClick={() => handleDelete(record.id, record.date)}
                    className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 text-outline hover:text-error rounded-md active:scale-95"
                    title="기록 삭제"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
