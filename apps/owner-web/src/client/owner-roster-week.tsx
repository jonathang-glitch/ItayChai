import { useState } from 'react';
import { createRosterShift, deleteRosterShift } from './api';
import { COPY } from './copy';
import type { AuthSession, RosterShift, RosterWorker } from './types';

type Props = {
  session: AuthSession;
  tenantId: string;
  workers: RosterWorker[];
  shifts: RosterShift[];
  busy: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  onNote: (note: string | null) => void;
  onError: (body: unknown) => string;
};

function jerusalemInstant(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let utc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  for (let step = 0; step < 3; step += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const actual = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'));
    const wanted = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
    utc += wanted - actual;
  }
  return new Date(utc).toISOString();
}

function when(shift: RosterShift) {
  const start = new Date(shift.startsAt);
  const end = new Date(shift.endsAt);
  const day = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(start);
  const clock = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
  return `${shift.employeeName} · ${day} ${clock.format(start)}–${clock.format(end)}`;
}

export function RosterWeek({ session, tenantId, workers, shifts, busy, run, onNote, onError }: Props) {
  const [shiftWorker, setShiftWorker] = useState(workers[0]?.id ?? '');
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('14:00');
  const employeeId = shiftWorker || workers[0]?.id || '';

  return (
    <section className="roster-card">
      <h2>{COPY.addShift}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (!employeeId) {
              return;
            }
            const result = await createRosterShift(session.accessToken, tenantId, {
              employeeId,
              startsAt: jerusalemInstant(shiftDate, shiftStart),
              endsAt: jerusalemInstant(shiftDate, shiftEnd),
            });
            onNote(result.status === 201 ? null : onError(result.body));
          });
        }}
      >
        <label>
          {COPY.shiftWorker}
          <select value={employeeId} onChange={(event) => setShiftWorker(event.target.value)} required>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {COPY.shiftDate}
          <input type="date" value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} required />
        </label>
        <label>
          {COPY.shiftStart}
          <input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} required />
        </label>
        <label>
          {COPY.shiftEnd}
          <input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} required />
        </label>
        <button className="primary" type="submit" disabled={busy || workers.length === 0}>
          {COPY.saveShift}
        </button>
      </form>
      {shifts.length === 0 ? <p className="empty">{COPY.noRosterShifts}</p> : null}
      <ul className="roster-list">
        {shifts.map((shift) => (
          <li key={shift.id}>
            <span>{when(shift)}</span>
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await deleteRosterShift(session.accessToken, tenantId, shift.id);
                  if (result.status !== 200) {
                    onNote(onError(result.body));
                  }
                })
              }
            >
              {COPY.remove}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
