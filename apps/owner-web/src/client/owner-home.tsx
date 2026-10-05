import { useEffect, useMemo, useState } from 'react';
import { decideShiftRequest, listOwnerRequests } from './api';
import { COPY } from './copy';
import { isDone, isOpen, onOwnerDesk } from './format';
import { membershipOf, readCachedInbox, writeCachedInbox } from './session';
import { OwnerRoster } from './owner-roster';
import { ShiftCard } from './shift-card';
import type { AuthSession, RequestItem } from './types';

type Filter = 'all' | 'open' | 'done';
type View = 'desk' | 'roster';

type Props = {
  session: AuthSession;
};

export function OwnerHome({ session }: Props) {
  const membership = membershipOf(session);
  const [items, setItems] = useState<RequestItem[]>(() => readCachedInbox(session.userId));
  const [view, setView] = useState<View>('desk');
  const [filter, setFilter] = useState<Filter>('open');
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => readCachedInbox(session.userId).length === 0);

  useEffect(() => {
    if (!membership) {
      return;
    }
    const tenantId = membership.tenantId;
    let cancelled = false;
    async function refresh() {
      const result = await listOwnerRequests(session.accessToken, tenantId);
      if (cancelled || result.status !== 200) {
        return;
      }
      const desk = result.body.filter(onOwnerDesk);
      setItems(desk);
      writeCachedInbox(session.userId, desk);
      setLoading(false);
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [membership, session.accessToken, session.userId]);

  const visible = useMemo(() => {
    if (filter === 'open') {
      return items.filter((item) => isOpen(item));
    }
    if (filter === 'done') {
      return items.filter((item) => isDone(item));
    }
    return items;
  }, [filter, items]);

  const open = items.filter((item) => isOpen(item)).length;
  const done = items.filter((item) => isDone(item)).length;

  async function decide(item: RequestItem, action: 'approve' | 'reject' | 'needs_replacement') {
    if (!membership || busyId) {
      return;
    }
    setBusyId(item.id);
    setNote(null);
    try {
      const result = await decideShiftRequest(session.accessToken, membership.tenantId, item.id, action);
      if (result.status < 200 || result.status >= 300) {
        setNote(COPY.down);
        return;
      }
      setItems((current) => {
        const next = current.map((row) => (row.id === result.body.id ? result.body : row));
        writeCachedInbox(session.userId, next);
        return next;
      });
      setNote(COPY.decided);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="workspace owner-desk">
      <div className="filters">
        <button type="button" className={view === 'desk' ? 'on' : ''} onClick={() => setView('desk')}>
          {COPY.desk}
        </button>
        <button type="button" className={view === 'roster' ? 'on' : ''} onClick={() => setView('roster')}>
          {COPY.roster}
        </button>
      </div>
      {view === 'roster' ? <OwnerRoster session={session} /> : null}
      {view === 'desk' ? (
      <>
      <div className="filters">
        {(['open', 'done', 'all'] as const).map((key) => (
          <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>
            {key === 'all' ? COPY.all : key === 'open' ? `${COPY.open} (${open})` : `${COPY.done} (${done})`}
          </button>
        ))}
      </div>
      {note ? <p className="note">{note}</p> : null}
      {loading && visible.length === 0 ? <p className="empty">{COPY.loadingDesk}</p> : null}
      {!loading && visible.length === 0 ? <p className="empty">{COPY.ownerEmpty}</p> : null}
      <ol className="queue">
        {visible.map((item) => (
          <li key={item.id}>
            <ShiftCard
              item={item}
              busy={busyId === item.id}
              onDecide={(action) => void decide(item, action)}
            />
          </li>
        ))}
      </ol>
      </>
      ) : null}
    </main>
  );
}
