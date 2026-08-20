import { useState } from 'react';
import { logout } from './api';
import { CustomerHome } from './customer-home';
import { OwnerHome } from './owner-home';
import { Shell } from './shell';
import { SignIn } from './sign-in';
import { clearSession, isCustomer, readSession, writeCachedShifts, writeSession } from './session';
import type { AuthSession } from './types';
import './client.css';

export function ClientApp() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());

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
