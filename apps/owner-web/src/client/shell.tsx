import type { ReactNode } from 'react';
import { COPY, personName, storeLabel } from './copy';
import { membershipOf } from './session';
import type { AuthSession } from './types';

type Props = {
  session: AuthSession;
  children: ReactNode;
  onSignOut: () => void;
};

export function Shell({ session, children, onSignOut }: Props) {
  const membership = membershipOf(session);
  const customer = membership?.roleName === 'customer';
  const name = personName(session.name, membership?.roleName ?? 'owner');

  return (
    <div className={customer ? 'app customer-app' : 'app'}>
      <header className="topbar">
        <p className="brand-mark small">
          <span>חי</span>
          {COPY.brand}
        </p>
        <div className="who">
          <p>
            <strong>{name}</strong>
            <em>{storeLabel(membership?.businessUnitName)}</em>
          </p>
          <span className="avatar tiny">{name.slice(0, 1)}</span>
          <button type="button" className="text-btn" onClick={onSignOut}>
            {COPY.signOut}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
