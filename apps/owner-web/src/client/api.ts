import type { AuthSession, RequestItem, ShiftItem } from './types';

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export async function requestJson<T>(
  path: string,
  init: RequestInit & { token?: string; tenantId?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }
  if (init.tenantId) {
    headers.set('x-tenant-id', init.tenantId);
  }
  const response = await fetch(path, { ...init, headers });
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
  return requestJson<{ requests: RequestItem[]; shifts: ShiftItem[] }>('/api/v1/customer/requests/home', {
    token,
    tenantId,
  });
}

export function sendCustomerMessage(token: string, tenantId: string, shiftId: string) {
  return requestJson<RequestItem>('/api/v1/customer/requests', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ shiftId }),
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
