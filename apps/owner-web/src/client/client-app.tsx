import { useEffect, useState } from 'react';
import { logout } from './api';
import { CustomerHome } from './customer-home';
import { OwnerHome } from './owner-home';
import { Shell } from './shell';
import { SignIn } from './sign-in';
import { SESSION_EVENT, clearSession, isCustomer, readSession, writeCachedShifts, writeSession } from './session';
import type { AuthSession } from './types';
import './client.css';
import './owner-theme.css';

export function ClientApp() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());

  useEffect(() => {
    function onSession(event: Event) {
      const next = (event as CustomEvent<AuthSession | null>).detail;
      if (!next) {
        setSession(null);
        return;
      }
      setSession((current) =>
        current && current.userId === next.userId
          ? { ...current, accessToken: next.accessToken, refreshToken: next.refreshToken }
          : next,
      );
    }
    window.addEventListener(SESSION_EVENT, onSession);
    return () => window.removeEventListener(SESSION_EVENT, onSession);
  }, []);

  function signedIn(next: AuthSession) {
    if (next.shifts) {
      writeCachedShifts(next.userId, next.shifts);
    }
    writeSession(next);
    setSession(next);
  }

  async function signOut() {
    if (session) {
      await logout(session.refreshToken);
    }
    clearSession();
    setSession(null);
  }

  if (!session) {
    return <SignIn onSignedIn={signedIn} />;
  }

  return (
    <Shell session={session} onSignOut={() => void signOut()}>
      {isCustomer(session) ? <CustomerHome session={session} /> : <OwnerHome session={session} />}
    </Shell>
  );
}
