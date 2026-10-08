import { useState } from 'react';
import { COPY } from './copy';
import { displayPhone, inviteLink } from './format';
import type { AgentNumber, RosterWorker } from './types';

type Props = {
  worker: RosterWorker;
  agent: AgentNumber;
  shopName: string;
  busy: boolean;
  onSave: (name: string, phone: string) => Promise<boolean>;
  onRemove: () => void;
};

function shiftCount(count: number) {
  if (count === 1) {
    return 'משמרת אחת';
  }
  return `${count} משמרות`;
}

export function WorkerRow({ worker, agent, shopName, busy, onSave, onRemove }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  const [name, setName] = useState(worker.name);
  const [phone, setPhone] = useState(worker.phone ?? '');

  if (mode === 'edit') {
    return (
      <li>
        <form
          className="reg-add"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(name.trim(), phone.trim()).then((saved) => saved && setMode('view'));
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={COPY.workerName}
            required
            minLength={2}
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-label={COPY.whatsapp}
            required
            minLength={8}
          />
          <span className="reg-actions">
            <button className="primary" type="submit" disabled={busy}>
              {COPY.saveChanges}
            </button>
            <button type="button" className="text-btn" onClick={() => setMode('view')}>
              {COPY.cancelEdit}
            </button>
          </span>
        </form>
      </li>
    );
  }

  return (
    <li>
      <span className="avatar customer">{worker.name.slice(0, 1)}</span>
      <div>
        <strong>
          {worker.name}
          {agent ? (
            <span className={worker.connected ? 'reg-status on' : 'reg-status'}>
              {worker.connected ? 'מחובר לוואטסאפ' : 'עוד לא התחבר'}
            </span>
          ) : null}
        </strong>
        <em>
          {displayPhone(worker.phone)}
          {worker.upcomingShifts > 0 ? ` · ${shiftCount(worker.upcomingShifts)}` : ''}
        </em>
      </div>
      {mode === 'remove' ? (
        <span className="reg-actions">
          <span>{COPY.removeAsk}</span>
          <button type="button" className="text-btn danger" disabled={busy} onClick={onRemove}>
            {COPY.confirmRemove}
          </button>
          <button type="button" className="text-btn" onClick={() => setMode('view')}>
            {COPY.cancelEdit}
          </button>
        </span>
      ) : (
        <span className="reg-actions">
          {worker.phone ? (
            <a
              className="reg-invite"
              href={inviteLink(worker, agent, shopName)}
              target="_blank"
              rel="noreferrer"
            >
              שליחה בוואטסאפ
            </a>
          ) : null}
          <button
            type="button"
            className="text-btn"
            disabled={busy}
            onClick={() => {
              setName(worker.name);
              setPhone(worker.phone ?? '');
              setMode('edit');
            }}
          >
            {COPY.editWorker}
          </button>
          <button
            type="button"
            className="text-btn"
            disabled={busy}
            onClick={() => setMode('remove')}
          >
            {COPY.remove}
          </button>
        </span>
      )}
    </li>
  );
}
