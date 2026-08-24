import { publishSession, readSession } from './session';
import type { AuthSession, CustomerHomeData, RequestItem, ShiftItem } from './types';

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

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
  if (result.status !== 200 || !result.body.accessToken) {
    publishSession(null);
    return null;
  }
  publishSession({ ...session, ...result.body });
  return result.body.accessToken;
}

export async function requestJson<T>(
  path: string,
  init: RequestInit & { token?: string; tenantId?: string; skipRefresh?: boolean } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = init.token ?? readSession()?.accessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.tenantId) {
    headers.set('x-tenant-id', init.tenantId);
  }
  const { token: _token, tenantId: _tenant, skipRefresh, ...fetchInit } = init;
  const response = await fetch(path, { ...fetchInit, headers });
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
