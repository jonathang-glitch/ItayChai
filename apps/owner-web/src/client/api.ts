import { publishSession, readSession } from './session';
import type { AgentNumber, AuthSession, CustomerHomeData, RequestItem, RosterWorker, ShiftItem, ShopProfile, ShopSchedule, WeekPlan } from './types';

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

// Tenant transactions are allowed 10s to acquire a connection plus 20s to run, so giving up
// earlier than that reports failure for writes the server is still committing.
const REQUEST_TIMEOUT_MS = 45_000;

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken() {
  const session = readSession();
  if (!session?.refreshToken) {
    return null;
  }
  const result = await requestJson<AuthSession>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
    skipRefresh: true,
  });
  if (result.status === 401) {
    publishSession(null);
    return null;
  }
  if (result.status !== 200 || !result.body.accessToken) {
    return null;
  }
  publishSession({
    ...session,
    accessToken: result.body.accessToken,
    refreshToken: result.body.refreshToken,
  });
  return result.body.accessToken;
}

export async function requestJson<T>(
  path: string,
  init: RequestInit & { token?: string; tenantId?: string; skipRefresh?: boolean } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = readSession()?.accessToken ?? init.token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.tenantId) {
    headers.set('x-tenant-id', init.tenantId);
  }
  // token / tenantId are auth extras, not fetch() options
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token: _token, tenantId: _tenant, skipRefresh, ...fetchInit } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...fetchInit,
      headers,
      signal: fetchInit.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: 408, body: { message: 'Request timeout' } as T };
  }
  if (response.status === 401 && !skipRefresh && !path.startsWith('/api/v1/auth/')) {
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const next = await refreshing;
    if (next) {
      return requestJson<T>(path, { ...init, token: next, skipRefresh: true });
    }
  }
  return { status: response.status, body: await readJson<T>(response) };
}

export function login(email: string, password: string) {
  return requestJson<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signup(input: {
  shopName: string;
  email: string;
  password: string;
  whatsapp: string;
}) {
  return requestJson<AuthSession>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listRosterWorkers(token: string, tenantId: string) {
  return requestJson<{ workers: RosterWorker[]; agent: AgentNumber }>('/api/v1/roster/workers', { token, tenantId });
}

export function createRosterWorker(
  token: string,
  tenantId: string,
  input: { name: string; whatsapp: string },
) {
  return requestJson<RosterWorker>('/api/v1/roster/workers', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(input),
  });
}

export function updateRosterWorker(
  token: string,
  tenantId: string,
  id: string,
  input: { name?: string; whatsapp?: string },
) {
  return requestJson<{ id: string; name?: string; phone?: string }>(`/api/v1/roster/workers/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(input),
  });
}

export function deleteRosterWorker(token: string, tenantId: string, id: string) {
  return requestJson<{ ok?: boolean; message?: string }>(`/api/v1/roster/workers/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export function deleteRosterShift(token: string, tenantId: string, id: string) {
  return requestJson<{ ok?: boolean; message?: string }>(`/api/v1/roster/shifts/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export function getRosterWeek(token: string, tenantId: string) {
  return requestJson<WeekPlan>('/api/v1/roster/week', { token, tenantId });
}

export function saveRosterWeek(token: string, tenantId: string, schedule: ShopSchedule) {
  return requestJson<WeekPlan>('/api/v1/roster/week', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(schedule),
  });
}

export function buildRosterWeek(token: string, tenantId: string) {
  return requestJson<WeekPlan>('/api/v1/roster/week/build', { method: 'POST', token, tenantId });
}

export function askRosterWeek(token: string, tenantId: string) {
  return requestJson<{ sent: number; queued: number; skipped: number }>('/api/v1/roster/week/ask', {
    method: 'POST',
    token,
    tenantId,
  });
}

export function assignRosterSlot(token: string, tenantId: string, employeeId: string, slotId: string) {
  return requestJson<WeekPlan>('/api/v1/roster/week/assign', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ employeeId, slotId }),
  });
}

export function getShopProfile(token: string, tenantId: string) {
  return requestJson<ShopProfile>('/api/v1/roster/me', { token, tenantId });
}

export function updateShopPhone(token: string, tenantId: string, whatsapp: string) {
  return requestJson<{ whatsapp: string }>('/api/v1/roster/me', {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify({ whatsapp }),
  });
}

export function logout(refreshToken: string) {
  return requestJson<{ ok?: boolean }>('/api/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function listOwnerRequests(token: string, tenantId: string) {
  return requestJson<RequestItem[]>('/api/v1/sessions', { token, tenantId });
}

export function markRequestRead(token: string, tenantId: string, id: string) {
  return requestJson<{ ok?: boolean }>(`/api/v1/sessions/${id}/acknowledge`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export function listCustomerRequests(token: string, tenantId: string) {
  return requestJson<RequestItem[]>('/api/v1/customer/requests', { token, tenantId });
}

export function listCustomerShifts(token: string, tenantId: string) {
  return requestJson<ShiftItem[]>('/api/v1/customer/requests/shifts', { token, tenantId });
}

export function listCustomerHome(token: string, tenantId: string) {
  return requestJson<CustomerHomeData>('/api/v1/customer/requests/home', {
    token,
    tenantId,
  });
}

export function sendCustomerMessage(
  token: string,
  tenantId: string,
  shiftId: string,
  kind?: 'COVER' | 'SWAP' | 'EITHER',
) {
  return requestJson<RequestItem>('/api/v1/customer/requests', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ shiftId, ...(kind ? { kind } : {}) }),
  });
}

export function respondToOffer(
  token: string,
  tenantId: string,
  offerId: string,
  action: 'cover' | 'swap' | 'decline',
  proposedShiftId?: string,
) {
  return requestJson<CustomerHomeData>(`/api/v1/customer/offers/${offerId}`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ action, ...(proposedShiftId ? { proposedShiftId } : {}) }),
  });
}

export function confirmShiftMatch(token: string, tenantId: string, sessionId: string, action: 'accept' | 'decline') {
  return requestJson<CustomerHomeData>(`/api/v1/customer/requests/${sessionId}/match`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ action }),
  });
}

export function cancelShiftSearch(token: string, tenantId: string, sessionId: string) {
  return requestJson<CustomerHomeData>(`/api/v1/customer/requests/${sessionId}/cancel`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export function decideShiftRequest(
  token: string,
  tenantId: string,
  id: string,
  action: 'approve' | 'reject' | 'needs_replacement',
) {
  return requestJson<RequestItem>(`/api/v1/sessions/${id}/shift-decision`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ action }),
  });
}
