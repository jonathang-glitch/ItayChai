import { useEffect, useState } from 'react';
import { listRosterWorkers } from './api';
import { COPY } from './copy';
import { OwnerWeek } from './owner-week';
import { membershipOf } from './session';
import type { AuthSession, RosterWorker } from './types';

type Props = {
  session: AuthSession;
};

export function OwnerRoster({ session }: Props) {
  const membership = membershipOf(session);
  const [workers, setWorkers] = useState<RosterWorker[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!membership) {
      return;
    }
    const tenantId = membership.tenantId;
    const token = session.accessToken;
    let cancelled = false;
    async function refresh() {
      const people = await listRosterWorkers(token, tenantId);
      if (cancelled) {
        return;
      }
      if (people.status === 200) {
        setWorkers(people.body.workers);
        setLoaded(true);
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [membership, session.accessToken]);

  return (
    <div className="roster">
      {loaded && workers.length === 0 ? <p className="empty">{COPY.registerFirst}</p> : null}
      {membership ? <OwnerWeek session={session} /> : <p className="empty">{COPY.loadingShifts}</p>}
    </div>
  );
}
