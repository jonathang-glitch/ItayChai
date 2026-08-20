import { useEffect, useState } from 'react';
import { listCustomerHome, sendCustomerMessage } from './api';
import { Conversation } from './conversation';
import { COPY, statusLabel, storeLabel } from './copy';
import { flattenMessages, formatShiftWhen, isFromLastDay } from './format';
import { membershipOf, readCachedShifts, writeCachedShifts } from './session';
import type { AuthSession, RequestItem, ShiftItem } from './types';

type Props = {
  session: AuthSession;
};

function pendingRequest(shift: ShiftItem, tenantId: string, name: string | null): RequestItem {
  const createdAt = new Date();
  const replyAt = new Date(createdAt.getTime() + 1);
  const now = createdAt.toISOString();
  const text = `צריך החלפה ב${shift.label}`;
  return {
    id: `pending:${shift.id}:${now}`,
    status: 'OPEN',
    tenantId,
    createdAt: now,
    customerUserId: null,
    customerName: name,
    messages: [
      { id: `pending-in:${now}`, direction: 'INBOUND', body: text, createdAt: now },
      {
        id: `pending-out:${now}`,
        direction: 'OUTBOUND',
        body: 'Your request was received.',
        createdAt: replyAt.toISOString(),
      },
    ],
    shiftRequest: {
      id: `pending-swap:${shift.id}`,
      status: 'OPEN',
      intentText: text,
      requestedLabel: shift.label,
      employeeName: name ?? COPY.customerName,
      shift,
    },
  };
}

function withoutApproved(shifts: ShiftItem[], items: RequestItem[]) {
  const gone = new Set(
    items
      .filter((item) => item.shiftRequest?.status === 'APPROVED' && item.shiftRequest.shift)
      .map((item) => item.shiftRequest!.shift!.id),
  );
  return shifts.filter((shift) => !gone.has(shift.id));
}

export function CustomerHome({ session }: Props) {
  const membership = membershipOf(session);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>(
    () => session.shifts ?? readCachedShifts(session.userId),
  );
  const [shiftId, setShiftId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(
    () => (session.shifts ?? readCachedShifts(session.userId)).length === 0,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!membership) {
      return;
    }
    const tenantId = membership.tenantId;
    let cancelled = false;
    async function refresh() {
      const home = await listCustomerHome(session.accessToken, tenantId);
      if (cancelled || home.status !== 200) {
        return;
      }
      const nextItems = home.body.requests.filter((item) => isFromLastDay(item.createdAt));
      const nextShifts = home.body.shifts;
      setItems((current) => (current.some((item) => item.id.startsWith('pending:')) ? current : nextItems));
      const visible = withoutApproved(nextShifts, nextItems);
      setShifts(visible);
      writeCachedShifts(session.userId, visible);
      setLoadingShifts(false);
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [membership, session.accessToken, session.userId]);

  async function sendShift(shift: ShiftItem) {
    if (!membership || busy) {
      return;
    }
    const optimistic = pendingRequest(shift, membership.tenantId, session.name);
    setShiftId(shift.id);
    setBusy(true);
    setError(null);
    setItems((current) => [optimistic, ...current]);
    try {
      const result = await sendCustomerMessage(session.accessToken, membership.tenantId, shift.id);
      if (result.status !== 201) {
        throw new Error(COPY.down);
      }
      setItems((current) => [result.body, ...current.filter((item) => item.id !== optimistic.id)]);
    } catch (reason) {
      setItems((current) => current.filter((item) => item.id !== optimistic.id));
      setError(reason instanceof Error ? reason.message : COPY.down);
    } finally {
      setBusy(false);
    }
  }

  const visibleShifts = withoutApproved(shifts, items);
  const messages = flattenMessages(items);
  const latest = items[0];
  const store = storeLabel(membership?.businessUnitName);

  return (
    <main className="chat-shell">
      <section className="phone-card request-card">
        <header className="chat-head">
          <span className="avatar owner">ח</span>
          <div>
            <strong>{store}</strong>
            <em>{latest ? statusLabel(latest.shiftRequest?.status ?? latest.status) : COPY.pickShift}</em>
          </div>
        </header>
        <div className="chat-body">
          {messages.length === 0 ? <p className="hello">{COPY.customerHello}</p> : null}
          {messages.length > 0 ? <Conversation messages={messages} mine="INBOUND" /> : null}
        </div>
        <div className="shift-composer">
          <p className="shift-kicker">{COPY.pickShift}</p>
          {loadingShifts && visibleShifts.length === 0 ? <p className="hello">{COPY.loadingShifts}</p> : null}
          {!loadingShifts && visibleShifts.length === 0 ? <p className="hello">{COPY.noShifts}</p> : null}
          <div className="shift-picks">
            {visibleShifts.map((shift) => (
              <button
                key={shift.id}
                type="button"
                className={shiftId === shift.id ? 'on' : ''}
                disabled={busy}
                onClick={() => void sendShift(shift)}
              >
                <span>
                  <strong>{shift.label}</strong>
                  <em>{formatShiftWhen(shift.startsAt, shift.endsAt)}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
