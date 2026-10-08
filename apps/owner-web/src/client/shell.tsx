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
  const shop = membership?.businessUnitName?.trim() ?? '';
  const person = session.name?.trim() ?? '';
  const title = customer ? personName(person, 'customer') : shop || personName(person, 'owner');
  const subtitle = customer ? storeLabel(shop) : person && person !== title ? person : '';

  return (
    <div className={customer ? 'app customer-app' : 'app owner-app'}>
      <header className="topbar">
        <p className="brand-mark small">
          <span>חי</span>
          {COPY.brand}
        </p>
        <div className="who">
          <span className="avatar tiny">{title.slice(0, 1)}</span>
          <p>
            <strong>{title}</strong>
            {subtitle ? <em>{subtitle}</em> : null}
          </p>
          <button type="button" className="sign-out" onClick={onSignOut}>
            {COPY.signOut}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
