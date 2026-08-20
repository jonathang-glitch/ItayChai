import type { AuthSession, Membership, RequestItem, ShiftItem } from './types';

const KEY = 'itay-chai.client';
const SHIFTS_KEY = 'itay-chai.shifts';
const INBOX_KEY = 'itay-chai.inbox';

export function readSession(): AuthSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function writeSession(session: AuthSession) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export function membershipOf(session: AuthSession): Membership | undefined {
  return session.memberships[0];
}

export function isCustomer(session: AuthSession) {
  return membershipOf(session)?.roleName === 'customer';
}

export function readCachedShifts(userId: string): ShiftItem[] {
  const raw = sessionStorage.getItem(`${SHIFTS_KEY}.${userId}`);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as ShiftItem[];
  } catch {
    return [];
  }
}

export function writeCachedShifts(userId: string, shifts: ShiftItem[]) {
  sessionStorage.setItem(`${SHIFTS_KEY}.${userId}`, JSON.stringify(shifts));
}

export function readCachedInbox(userId: string): RequestItem[] {
  const raw = sessionStorage.getItem(`${INBOX_KEY}.${userId}`);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as RequestItem[];
  } catch {
    return [];
  }
}

export function writeCachedInbox(userId: string, items: RequestItem[]) {
  sessionStorage.setItem(`${INBOX_KEY}.${userId}`, JSON.stringify(items));
}
