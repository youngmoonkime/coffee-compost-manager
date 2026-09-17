import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { InfoButton, InfoNote } from '../assistant/InfoTip';

/** 자원순환 임팩트 카드 한 장 — 근거 수준 배지 + 값 + ⓘ 근거 */
export function ImpactCard({ badge, title, value, sub, infoLabel, info, action }: {
  badge: string;
  title: string;
  value: string;
  sub: ReactNode;
  infoLabel: string;
  info: ReactNode;
  /** 카드 아래 버튼 (선택) */
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <article className="collection-impact__metric collection-impact__impact-card">
      <div className="collection-impact__metric-head">
        <span className="collection-impact__badge">{badge}</span>
        <InfoButton open={open} onToggle={() => setOpen(v => !v)} controls={noteId} label={infoLabel} />
      </div>
      <p>{title}</p>
      <strong className="collection-impact__metric-val">{value}</strong>
      <small>{sub}</small>
      {open && <InfoNote id={noteId}>{info}</InfoNote>}
      {action && <div className="collection-impact__impact-action">{action}</div>}
    </article>
  );
}

export function NoteLine({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <p className="collection-impact__impact-note-line">
      {label && <b>{label}</b>} {children}
    </p>
  );
}
