import { useEffect, useState } from 'react';
import {
  createRosterWorker,
  deleteRosterWorker,
  getShopProfile,
  listRosterWorkers,
  updateRosterWorker,
  updateShopPhone,
} from './api';
import { COPY, rosterFailure } from './copy';
import { displayPhone } from './format';
import { WorkerRow } from './owner-registration-row';
import { membershipOf } from './session';
import type { AgentNumber, AuthSession, RosterWorker } from './types';

type Props = {
  session: AuthSession;
};

export function OwnerRegistration({ session }: Props) {
  const membership = membershipOf(session);
  const [workers, setWorkers] = useState<RosterWorker[]>([]);
  const [shopName, setShopName] = useState(membership?.businessUnitName ?? '');
  const [phone, setPhone] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [name, setName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [agent, setAgent] = useState<AgentNumber>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!membership) {
      return;
    }
    const [people, shop] = await Promise.all([
      listRosterWorkers(session.accessToken, membership.tenantId),
      getShopProfile(session.accessToken, membership.tenantId),
    ]);
    if (people.status === 200) {
      setWorkers(people.body.workers);
      setAgent(people.body.agent);
    }
    if (shop.status === 200) {
      setShopName(shop.body.shopName);
      if (shop.body.whatsapp) {
        setPhone(shop.body.whatsapp);
      }
    }
  }

  useEffect(() => {
    if (!membership) {
      return;
    }
    const tenantId = membership.tenantId;
    const token = session.accessToken;
    let cancelled = false;
    async function refresh() {
      const [people, shop] = await Promise.all([
        listRosterWorkers(token, tenantId),
        getShopProfile(token, tenantId),
      ]);
      if (cancelled) {
        return;
      }
      if (people.status === 200) {
        setWorkers(people.body.workers);
        setAgent(people.body.agent);
      }
      if (shop.status === 200) {
        setShopName(shop.body.shopName);
        if (shop.body.whatsapp) {
          setPhone(shop.body.whatsapp);
        }
      }
      setLoaded(true);
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [membership, session.accessToken]);

  async function run(task: () => Promise<void>) {
    if (!membership || busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await task();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const ownerInitial = (session.name || shopName).trim().slice(0, 1);

  return (
    <div className="reg">
      <header className="reg-intro">
        <h2>{COPY.registrationTitle}</h2>
        <p>{COPY.registrationLede}</p>
      </header>
      {note ? <p className="note">{note}</p> : null}

      <section className="reg-owner">
        <span className="avatar owner">{ownerInitial}</span>
        <div>
          <strong>{shopName}</strong>
          <em>
            {COPY.ownerUpdates}
            {phone ? ` · ${displayPhone(phone)}` : ''}
          </em>
        </div>
        {editingPhone ? (
          <form
            className="reg-phone"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (!membership) {
                  return;
                }
                const result = await updateShopPhone(
                  session.accessToken,
                  membership.tenantId,
                  phone.trim(),
                );
                if (result.status !== 200) {
                  setNote(rosterFailure(result.body));
                  return;
                }
                setEditingPhone(false);
                setNote(COPY.phoneSaved);
              });
            }}
          >
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0521234567"
              required
              minLength={8}
              aria-label={COPY.ownerUpdates}
            />
            <button className="primary" type="submit" disabled={busy}>
              {COPY.savePhone}
            </button>
            <button type="button" className="text-btn" onClick={() => setEditingPhone(false)}>
              {COPY.cancelEdit}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="text-btn"
            disabled={!loaded}
            onClick={() => setEditingPhone(true)}
          >
            {COPY.changePhone}
          </button>
        )}
      </section>

      <section className="reg-card">
        <h2>
          {COPY.registeredWorkers}
          <span>{workers.length}</span>
        </h2>
        <form
          className="reg-add"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (!membership) {
                return;
              }
              const result = await createRosterWorker(session.accessToken, membership.tenantId, {
                name: name.trim(),
                whatsapp: workerPhone.trim(),
              });
              if (result.status !== 201) {
                setNote(rosterFailure(result.body));
                return;
              }
              setNote(COPY.workerSaved);
              setName('');
              setWorkerPhone('');
            });
          }}
        >
          <label>
            {COPY.workerName}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
            />
          </label>
          <label>
            {COPY.whatsapp}
            <input
              value={workerPhone}
              onChange={(event) => setWorkerPhone(event.target.value)}
              placeholder="0521234567"
              inputMode="tel"
              required
              minLength={8}
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {COPY.saveWorker}
          </button>
        </form>

        {loaded && workers.length === 0 ? <p className="empty">{COPY.noWorkers}</p> : null}
        <ul className="reg-list">
          {workers.map((worker) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              agent={agent}
              shopName={shopName}
              busy={busy}
              onSave={async (nextName, nextPhone) => {
                let saved = false;
                await run(async () => {
                  if (!membership) {
                    return;
                  }
                  const result = await updateRosterWorker(
                    session.accessToken,
                    membership.tenantId,
                    worker.id,
                    {
                      name: nextName,
                      whatsapp: nextPhone,
                    },
                  );
                  if (result.status !== 200) {
                    setNote(rosterFailure(result.body));
                    return;
                  }
                  saved = true;
                  setNote(COPY.workerUpdated);
                });
                return saved;
              }}
              onRemove={() =>
                void run(async () => {
                  if (!membership) {
                    return;
                  }
                  const result = await deleteRosterWorker(
                    session.accessToken,
                    membership.tenantId,
                    worker.id,
                  );
                  if (result.status !== 200) {
                    setNote(rosterFailure(result.body));
                  }
                })
              }
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
