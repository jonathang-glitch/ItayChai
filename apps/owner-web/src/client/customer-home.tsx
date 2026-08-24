import { useEffect, useRef, useState } from 'react';
import { confirmShiftMatch, listCustomerHome, respondToOffer, sendCustomerMessage } from './api';
import { Conversation } from './conversation';
import { COPY, statusLabel, storeLabel } from './copy';
import { flattenMessages, formatShiftWhen, isFromLastDay, isLiveRequest, shiftTitle } from './format';
import { OfferCard } from './offer-card';
import { membershipOf, readCachedShifts, writeCachedShifts } from './session';
import type { AuthSession, IncomingOffer, RequestItem, ShiftItem, ShiftRequestKind } from './types';

type Props = {
  session: AuthSession;
};

function requestError(body: unknown) {
  const message =
    typeof body === 'object' && body && 'message' in body ? String((body as { message?: string }).message ?? '') : '';
  if (message === 'A search is already open for this shift') {
    return COPY.alreadyOpen;
  }
  if (message === 'Shift is not on this employee roster') {
    return COPY.notOnRoster;
  }
  if (message === 'Invalid token' || message === 'Invalid refresh token' || message === 'Missing bearer token') {
    return COPY.sessionExpired;
  }
  return message || COPY.down;
}

const TAKEN = new Set(['APPROVED', 'COMMITTED']);

const LIVE_OFFER = new Set(['SEEKING', 'MATCH_PROPOSED']);

function liveOffers(offers: IncomingOffer[]) {
  return offers.filter((offer) => offer.status === 'PENDING' && LIVE_OFFER.has(offer.requestStatus));
}

function withoutTaken(shifts: ShiftItem[], items: RequestItem[]) {
  const gone = new Set(
    items
      .filter((item) => item.shiftRequest && TAKEN.has(item.shiftRequest.status) && item.shiftRequest.shift)
      .map((item) => item.shiftRequest!.shift!.id),
  );
  return shifts.filter((shift) => !gone.has(shift.id));
}

function applyHome(
  body: { requests: RequestItem[]; shifts: ShiftItem[]; offers?: IncomingOffer[] },
  userId: string,
  setItems: (items: RequestItem[]) => void,
  setOffers: (offers: IncomingOffer[]) => void,
  setShifts: (shifts: ShiftItem[]) => void,
) {
  const nextItems = body.requests.filter((item) => isFromLastDay(item.createdAt));
  const visible = withoutTaken(body.shifts, nextItems);
  setItems(nextItems);
  setOffers(body.offers ?? []);
  setShifts(visible);
  writeCachedShifts(userId, visible);
}

export function CustomerHome({ session }: Props) {
  const membership = membershipOf(session);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [offers, setOffers] = useState<IncomingOffer[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>(
    () => session.shifts ?? readCachedShifts(session.userId),
  );
  const [shiftId, setShiftId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(
    () => (session.shifts ?? readCachedShifts(session.userId)).length === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const inflight = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!membership) {
      return;
    }
    const tenantId = membership.tenantId;
    let cancelled = false;
    async function refresh() {
      if (inflight.current || document.hidden) {
        return;
      }
      inflight.current = true;
      try {
        const home = await listCustomerHome(session.accessToken, tenantId);
        if (cancelled || home.status !== 200) {
          return;
        }
        applyHome(home.body, session.userId, setItems, setOffers, setShifts);
        setLoadingShifts(false);
      } finally {
        inflight.current = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 12000);
    const onVisible = () => {
      if (!document.hidden) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [membership, session.accessToken, session.userId]);

  async function sendKind(shift: ShiftItem, kind: ShiftRequestKind) {
    if (!membership || busy) {
      return;
    }
    setShiftId(shift.id);
    setBusy(true);
    setError(null);
    try {
      const result = await sendCustomerMessage(session.accessToken, membership.tenantId, shift.id, kind);
      if (result.status !== 201 && result.status !== 200) {
        throw new Error(requestError(result.body));
      }
      const home = await listCustomerHome(session.accessToken, membership.tenantId);
      if (home.status === 200) {
        applyHome(home.body, session.userId, setItems, setOffers, setShifts);
      } else {
        setItems((current) => [result.body, ...current.filter((item) => !item.id.startsWith('pending:'))]);
      }
      setShiftId('');
      setCompose(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.down);
      const home = await listCustomerHome(session.accessToken, membership.tenantId);
      if (home.status === 200) {
        applyHome(home.body, session.userId, setItems, setOffers, setShifts);
      }
    } finally {
      setBusy(false);
    }
  }

  async function answerOffer(offer: IncomingOffer, action: 'cover' | 'swap' | 'decline', proposedShiftId?: string) {
    if (!membership || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await respondToOffer(
        session.accessToken,
        membership.tenantId,
        offer.id,
        action,
        proposedShiftId,
      );
      if (result.status < 200 || result.status >= 300) {
        throw new Error(requestError(result.body));
      }
      applyHome(result.body, session.userId, setItems, setOffers, setShifts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.down);
    } finally {
      setBusy(false);
    }
  }

  async function takeOffer(offer: IncomingOffer, action: 'cover' | 'swap' | 'decline', proposedShiftId?: string) {
    setOffers((current) =>
      action === 'decline'
        ? current.filter((row) => row.id !== offer.id)
        : current.filter((row) => row.requestedShift?.id !== offer.requestedShift?.id),
    );
    await answerOffer(offer, action, proposedShiftId);
  }

  async function answerMatch(item: RequestItem, action: 'accept' | 'decline') {
    if (!membership || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await confirmShiftMatch(session.accessToken, membership.tenantId, item.id, action);
      if (result.status < 200 || result.status >= 300) {
        throw new Error(COPY.down);
      }
      if (action === 'accept') {
        setItems((current) =>
          current.map((row) =>
            row.id === item.id && row.shiftRequest
              ? { ...row, shiftRequest: { ...row.shiftRequest, status: 'COMMITTED' } }
              : row,
          ),
        );
      }
      applyHome(result.body, session.userId, setItems, setOffers, setShifts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.down);
    } finally {
      setBusy(false);
    }
  }

  const visibleShifts = withoutTaken(shifts, items);
  const selected = visibleShifts.find((shift) => shift.id === shiftId);
  const liveItems = items.filter(isLiveRequest);
  const messages = flattenMessages(liveItems);
  const latest = liveItems[0];
  const store = storeLabel(membership?.businessUnitName);
  const pendingOffers = liveOffers(offers);
  const proposed = liveItems.find((item) => item.shiftRequest?.status === 'MATCH_PROPOSED');
  const inChat = messages.length > 0 || pendingOffers.length > 0;
  const showComposer = compose || !inChat;

  useEffect(() => {
    const box = scroller.current;
    if (!box) {
      return;
    }
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pendingOffers.length, proposed?.id]);

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
        <div className="chat-body" ref={scroller}>
          {!inChat ? <p className="hello">{COPY.customerHello}</p> : null}
          {inChat ? (
            <Conversation messages={messages} mine="INBOUND">
              {pendingOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  busy={busy}
                  onAnswer={(row, action, shift) => void takeOffer(row, action, shift)}
                />
              ))}
              {proposed ? (
                <li className="chat-replies">
                  <button type="button" className="yes" disabled={busy} onClick={() => void answerMatch(proposed, 'accept')}>
                    {COPY.confirmMatch}
                  </button>
                  <button type="button" className="no" disabled={busy} onClick={() => void answerMatch(proposed, 'decline')}>
                    {COPY.refuseMatch}
                  </button>
                </li>
              ) : null}
            </Conversation>
          ) : null}
        </div>
        {showComposer ? (
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
                  onClick={() => setShiftId(shift.id === shiftId ? '' : shift.id)}
                >
                  <span>
                    <strong>{shiftTitle(shift)}</strong>
                    <em>{formatShiftWhen(shift.startsAt)}</em>
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="shift-actions">
                <button type="button" className="intent-cover" disabled={busy} onClick={() => void sendKind(selected, 'COVER')}>
                  {COPY.coverIntent}
                </button>
                <button type="button" className="approve" disabled={busy} onClick={() => void sendKind(selected, 'SWAP')}>
                  {COPY.swapIntent}
                </button>
                <button type="button" className="either" disabled={busy} onClick={() => void sendKind(selected, 'EITHER')}>
                  {COPY.eitherIntent}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" className="composer-toggle" onClick={() => setCompose(true)}>
            {COPY.newRequest}
          </button>
        )}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
