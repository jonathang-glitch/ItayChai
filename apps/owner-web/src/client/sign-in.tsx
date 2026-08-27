import { useState } from 'react';
import { login } from './api';
import { COPY, PEOPLE } from './copy';
import type { AuthSession } from './types';

type Props = {
  onSignedIn: (session: AuthSession) => void;
};

export function SignIn({ onSignedIn }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(person: (typeof PEOPLE)[number]) {
    setBusy(person.key);
    setError(null);
    try {
      const result = await login(person.email, person.password);
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
          {PEOPLE.map((person) => (
            <button key={person.key} type="button" disabled={Boolean(busy)} onClick={() => void enter(person)}>
              <span className={`avatar ${person.avatar}`}>{person.name.slice(0, 1)}</span>
              <span>
                <strong>{person.name}</strong>
                <em>
                  {person.role} · {person.place}
                </em>
              </span>
              <b>{busy === person.key ? COPY.entering : 'כניסה'}</b>
            </button>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
