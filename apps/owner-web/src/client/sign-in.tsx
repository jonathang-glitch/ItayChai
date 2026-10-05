import { useState, type FormEvent } from 'react';
import { login, signup } from './api';
import { COPY, PEOPLE } from './copy';
import type { AuthSession } from './types';

type Props = {
  onSignedIn: (session: AuthSession) => void;
};

type Mode = 'people' | 'login' | 'signup';

function failureText(status: number, fallback: string) {
  if (status === 409) {
    return COPY.emailTaken;
  }
  if (status >= 500 || status === 408) {
    return COPY.down;
  }
  return fallback;
}

export function SignIn({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('people');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  async function enter(person: (typeof PEOPLE)[number]) {
    setBusy(person.key);
    setError(null);
    try {
      const result = await login(person.email, person.password);
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(failureText(result.status, COPY.badLogin));
      }
      onSignedIn(result.body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.badLogin);
    } finally {
      setBusy(null);
    }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setBusy('login');
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(failureText(result.status, COPY.badLogin));
      }
      onSignedIn(result.body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.badLogin);
    } finally {
      setBusy(null);
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    setBusy('signup');
    setError(null);
    try {
      const result = await signup({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        whatsapp: whatsapp.trim(),
      });
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(failureText(result.status, COPY.badLogin));
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
        {mode === 'people' ? (
          <>
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
            <div className="signin-links">
              <button type="button" className="text-btn" onClick={() => setMode('login')}>
                {COPY.emailEntry}
              </button>
              <button type="button" className="text-btn" onClick={() => setMode('signup')}>
                {COPY.openShop}
              </button>
            </div>
          </>
        ) : null}

        {mode === 'login' ? (
          <form onSubmit={(event) => void submitLogin(event)}>
            <p className="card-kicker">{COPY.emailEntry}</p>
            <label>
              {COPY.email}
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              {COPY.password}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={Boolean(busy)}>
              {busy ? COPY.entering : COPY.signInSubmit}
            </button>
            <div className="signin-links">
              <button type="button" className="text-btn" onClick={() => setMode('people')}>
                {COPY.backToPeople}
              </button>
              <button type="button" className="text-btn" onClick={() => setMode('signup')}>
                {COPY.openShop}
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'signup' ? (
          <form onSubmit={(event) => void submitSignup(event)}>
            <p className="card-kicker">{COPY.openShop}</p>
            <label>
              {COPY.shopName}
              <input value={shopName} onChange={(event) => setShopName(event.target.value)} required minLength={2} />
            </label>
            <label>
              {COPY.signupOwnerName}
              <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required minLength={2} />
            </label>
            <label>
              {COPY.email}
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              {COPY.password}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <label>
              {COPY.whatsapp}
              <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} required minLength={8} />
            </label>
            <button className="primary" type="submit" disabled={Boolean(busy)}>
              {busy ? COPY.saving : COPY.signUpSubmit}
            </button>
            <div className="signin-links">
              <button type="button" className="text-btn" onClick={() => setMode('people')}>
                {COPY.backToPeople}
              </button>
            </div>
          </form>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
