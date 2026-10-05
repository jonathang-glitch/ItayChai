import { useEffect, useState } from 'react';
import {
  createRosterWorker,
  deleteRosterWorker,
  getShopProfile,
  listRosterShifts,
  listRosterWorkers,
  updateRosterWorker,
  updateShopPhone,
} from './api';
import { COPY } from './copy';
import { RosterWeek } from './owner-roster-week';
import { membershipOf } from './session';
import type { AuthSession, RosterShift, RosterWorker } from './types';

type Props = {
  session: AuthSession;
};

function apiMessage(body: unknown) {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return '';
  }
  const message = (body as { message: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function hebrewError(body: unknown) {
  const message = apiMessage(body);
  if (message === 'Email already registered') {
    return COPY.emailTaken;
  }
  if (message === 'Phone already used') {
    return COPY.phoneUsed;
  }
  if (message === 'Worker has an open search' || message === 'Shift is in an open search') {
    return COPY.openSearch;
  }
  if (message === 'Shift already exists that day') {
    return COPY.sameDay;
  }
  return COPY.down;
}

export function OwnerRoster({ session }: Props) {
  const membership = membershipOf(session);
  const [workers, setWorkers] = useState<RosterWorker[]>([]);
  const [shifts, setShifts] = useState<RosterShift[]>([]);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [editId, setEditId] = useState('');
  const [editPassword, setEditPassword] = useState('');

  async function load() {
    if (!membership) {
      return;
    }
    const [people, week, shop] = await Promise.all([
      listRosterWorkers(session.accessToken, membership.tenantId),
      listRosterShifts(session.accessToken, membership.tenantId),
      getShopProfile(session.accessToken, membership.tenantId),
    ]);
    if (people.status === 200) {
      setWorkers(people.body.workers);
    }
    if (week.status === 200) {
      setShifts(week.body.shifts);
    }
    if (shop.status === 200 && shop.body.whatsapp) {
      setPhone(shop.body.whatsapp);
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
      const [people, week, shop] = await Promise.all([
        listRosterWorkers(token, tenantId),
        listRosterShifts(token, tenantId),
        getShopProfile(token, tenantId),
      ]);
      if (cancelled) {
        return;
      }
      if (people.status === 200) {
        setWorkers(people.body.workers);
      }
      if (week.status === 200) {
        setShifts(week.body.shifts);
      }
      if (shop.status === 200 && shop.body.whatsapp) {
        setPhone(shop.body.whatsapp);
      }
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

  return (
    <div className="roster">
      {note ? <p className="note">{note}</p> : null}
      <section className="roster-card">
        <h2>{COPY.myWhatsapp}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (!membership) {
                return;
              }
              const result = await updateShopPhone(session.accessToken, membership.tenantId, phone.trim());
              setNote(result.status === 200 ? COPY.phoneSaved : hebrewError(result.body));
            });
          }}
        >
          <label>
            {COPY.whatsapp}
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={8} />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {COPY.savePhone}
          </button>
        </form>
      </section>

      <section className="roster-card">
        <h2>{COPY.addWorker}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (!membership) {
                return;
              }
              const result = await createRosterWorker(session.accessToken, membership.tenantId, {
                name: name.trim(),
                email: email.trim(),
                password,
                whatsapp: workerPhone.trim(),
              });
              if (result.status !== 201) {
                setNote(hebrewError(result.body));
                return;
              }
              setNote(`${COPY.workerSaved} ${result.body.email} / ${result.body.password}`);
              setName('');
              setEmail('');
              setPassword('');
              setWorkerPhone('');
            });
          }}
        >
          <label>
            {COPY.workerName}
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          </label>
          <label>
            {COPY.email}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            {COPY.password}
            <input type="text" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <label>
            {COPY.whatsapp}
            <input value={workerPhone} onChange={(event) => setWorkerPhone(event.target.value)} required minLength={8} />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {COPY.saveWorker}
          </button>
        </form>
        {workers.length === 0 ? <p className="empty">{COPY.noWorkers}</p> : null}
        <ul className="roster-list">
          {workers.map((worker) => (
            <li key={worker.id}>
              <strong>{worker.name}</strong>
              <em>
                {worker.email} · {worker.phone}
              </em>
              <button
                type="button"
                className="text-btn"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!membership) {
                      return;
                    }
                    const result = await deleteRosterWorker(session.accessToken, membership.tenantId, worker.id);
                    if (result.status !== 200) {
                      setNote(hebrewError(result.body));
                    }
                  })
                }
              >
                {COPY.remove}
              </button>
            </li>
          ))}
        </ul>
        {workers.length > 0 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (!membership || !editId || editPassword.length < 8) {
                  return;
                }
                const result = await updateRosterWorker(session.accessToken, membership.tenantId, editId, {
                  password: editPassword,
                });
                if (result.status !== 200 || !result.body.password) {
                  setNote(hebrewError(result.body));
                  return;
                }
                setNote(`${COPY.passwordShown} ${result.body.password}`);
                setEditPassword('');
              });
            }}
          >
            <label>
              {COPY.newPassword}
              <select value={editId} onChange={(event) => setEditId(event.target.value)} required>
                <option value="">{COPY.shiftWorker}</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {COPY.saveChanges}
            </button>
          </form>
        ) : null}
      </section>

      {membership ? (
        <RosterWeek
          session={session}
          tenantId={membership.tenantId}
          workers={workers}
          shifts={shifts}
          busy={busy}
          run={run}
          onNote={setNote}
          onError={hebrewError}
        />
      ) : null}
    </div>
  );
}
