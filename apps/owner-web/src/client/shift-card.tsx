import { Conversation } from './conversation';
import { COPY, statusLabel } from './copy';
import { firstInbound, formatShiftWhen, formatTime, shiftTitle } from './format';
import type { RequestItem } from './types';

type Props = {
  item: RequestItem;
  busy?: boolean;
  onDecide?: (action: 'approve' | 'reject' | 'needs_replacement') => void;
};

export function ShiftCard({ item, busy, onDecide }: Props) {
  const request = item.shiftRequest;
  const name = item.customerName ?? COPY.customerName;
  const status = request?.status ?? item.status;
  const open = status === 'OPEN' || status === 'UNFILLED';
  const searching = status === 'SEEKING' || status === 'MATCH_PROPOSED';
  const label = request?.shift
    ? shiftTitle(request.shift)
    : request?.requestedLabel
      ? shiftTitle({ label: request.requestedLabel, startsAt: '' })
      : firstInbound(item) || COPY.shiftFor;

  return (
    <article className="case-card">
      <header className="case-head">
        <span className="avatar customer">{name.slice(0, 1)}</span>
        <div>
          <strong>{name}</strong>
          <em>{label}</em>
          {request?.shift ? <p>{formatShiftWhen(request.shift.startsAt)}</p> : null}
          {request?.searchSummary ? <p>{request.searchSummary}</p> : null}
        </div>
        <span className="case-meta">
          <time>{formatTime(item.createdAt)}</time>
          <em className={`pill ${status.toLowerCase()}`}>{statusLabel(status)}</em>
        </span>
      </header>
      {onDecide && searching ? (
        <div className="shift-actions">
          <button type="button" className="reject" disabled={busy} onClick={() => onDecide('reject')}>
            {COPY.reject}
          </button>
        </div>
      ) : null}
      {onDecide && open ? (
        <div className="shift-actions">
          <button type="button" className="approve" disabled={busy} onClick={() => onDecide('approve')}>
            {busy ? COPY.saving : COPY.approve}
          </button>
          <button type="button" className="reject" disabled={busy} onClick={() => onDecide('reject')}>
            {COPY.reject}
          </button>
          <button type="button" className="cover" disabled={busy} onClick={() => onDecide('needs_replacement')}>
            {COPY.needCover}
          </button>
        </div>
      ) : null}
      {item.messages.length > 0 ? <Conversation messages={item.messages} mine="OUTBOUND" /> : null}
    </article>
  );
}
