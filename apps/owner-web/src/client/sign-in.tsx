import { useState, type FormEvent } from 'react';
import { login, signup } from './api';
import { COPY } from './copy';
import type { AuthSession } from './types';

type Props = {
  onSignedIn: (session: AuthSession) => void;
};

type Mode = 'login' | 'signup';

function failureText(status: number, body: unknown, fallback: string) {
  const message =
    body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : '';
  if (message === 'Phone already used') {
    return COPY.phoneUsed;
  }
  if (message === 'Enter a phone number with country code') {
    return COPY.badPhone;
  }
  if (message === 'Email already registered' || status === 409) {
    return COPY.emailTaken;
  }
  if (status >= 500 || status === 408) {
    return COPY.down;
  }
  return fallback;
}

export function SignIn({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(failureText(result.status, result.body, COPY.badLogin));
      }
      onSignedIn(result.body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.badLogin);
    } finally {
      setBusy(false);
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signup({
        shopName: shopName.trim(),
        email: email.trim(),
        password,
        whatsapp: whatsapp.trim(),
      });
      if (result.status !== 200 || !result.body.accessToken) {
        throw new Error(failureText(result.status, result.body, COPY.badLogin));
      }
      onSignedIn(result.body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : COPY.badLogin);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin-panel">
        <h1>{COPY.signInTitle}</h1>
        <p className="signin-lede">{COPY.signInLede}</p>

        <section className="signin-card">
          <div className="signin-switch">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
              {COPY.emailEntry}
            </button>
            <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>
              {COPY.openShop}
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={(event) => void submitLogin(event)}>
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
              <button className="primary" type="submit" disabled={busy}>
                {busy ? COPY.entering : COPY.signInSubmit}
              </button>
            </form>
          ) : (
            <form onSubmit={(event) => void submitSignup(event)}>
              <p className="signin-hint">{COPY.signUpHint}</p>
              <label>
                {COPY.shopName}
                <input value={shopName} onChange={(event) => setShopName(event.target.value)} required minLength={2} />
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
                {COPY.phoneNumber}
                <input
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="0521234567"
                  inputMode="tel"
                  required
                  minLength={8}
                />
              </label>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? COPY.saving : COPY.signUpSubmit}
              </button>
            </form>
          )}
          {error ? <p className="error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
