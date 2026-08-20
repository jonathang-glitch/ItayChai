import { useState } from 'react';
import { login } from './api';
import { ACCOUNTS, COPY } from './copy';
import type { AuthSession } from './types';

type Props = {
  onSignedIn: (session: AuthSession) => void;
};

export function SignIn({ onSignedIn }: Props) {
  const [busy, setBusy] = useState<'owner' | 'customer' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(kind: 'owner' | 'customer') {
    setBusy(kind);
    setError(null);
    try {
      const account = ACCOUNTS[kind];
      const result = await login(account.email, account.password);
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(result.status >= 500 ? COPY.down : COPY.badLogin);
      }
      onSignedIn(result.body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.badLogin);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="signin">
      <div className="signin-glow" />
      <section className="signin-story">
        <p className="brand-mark">
          <span>חי</span>
          {COPY.brand}
        </p>
        <p className="kicker">{COPY.signInKicker}</p>
        <h1>{COPY.signInTitle}</h1>
        <p className="lede">{COPY.signInLede}</p>
      </section>

      <section className="signin-card">
        <p className="card-kicker">{COPY.continueAs}</p>
        <div className="people">
          <button type="button" disabled={Boolean(busy)} onClick={() => void enter('owner')}>
            <span className="avatar owner">נ</span>
            <span>
              <strong>{COPY.ownerName}</strong>
              <em>
                {COPY.ownerRole} · {COPY.ownerPlace}
              </em>
            </span>
            <b>{busy === 'owner' ? COPY.entering : 'כניסה'}</b>
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void enter('customer')}>
            <span className="avatar customer">א</span>
            <span>
              <strong>{COPY.customerName}</strong>
              <em>
                {COPY.customerRole} · {COPY.customerPlace}
              </em>
            </span>
            <b>{busy === 'customer' ? COPY.entering : 'כניסה'}</b>
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
