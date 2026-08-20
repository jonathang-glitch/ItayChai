export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export type SessionRow = {
  id: string;
  status: string;
  tenantId: string;
  externalMessageId: string;
};

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
  return requestJson<AuthTokens>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function listSessions(token: string, tenantId: string) {
  return requestJson<SessionRow[]>('/api/v1/sessions', { token, tenantId });
}

export function acknowledgeSession(token: string, tenantId: string, sessionId: string) {
  return requestJson<{ ok?: boolean }>(`/api/v1/sessions/${sessionId}/acknowledge`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export function sendWhatsApp(externalMessageId: string, text: string) {
  return requestJson<{ sessionId: string; message: string }>('/api/v1/webhooks/whatsapp/mock', {
    method: 'POST',
    body: JSON.stringify({ externalMessageId, text }),
  });
}

export type SessionTrace = {
  events: { id: string }[];
  outbox: { id: string; publishedAt?: string | null }[];
  attempts: { id: string }[];
  audits: { id: string; action: string }[];
};

export type DlqItem = {
  id: string;
  status: string;
  originalError: string;
  eventId?: string | null;
};

export function sessionTrace(token: string, tenantId: string, sessionId: string) {
  return requestJson<SessionTrace>(`/api/v1/sessions/${sessionId}/trace`, { token, tenantId });
}

export function injectFailure(token: string, tenantId: string) {
  return requestJson<{ sessionId: string; eventId: string }>('/api/v1/ops/dlq/failures', {
    method: 'POST',
    token,
    tenantId,
  });
}

export function listDlq(token: string, tenantId: string) {
  return requestJson<DlqItem[]>('/api/v1/ops/dlq', { token, tenantId });
}

export function replayDlq(token: string, tenantId: string, id: string, reason: string) {
  return requestJson<{ ok?: boolean; sessionId?: string }>(`/api/v1/ops/dlq/${id}/replay`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ reason }),
  });
}

export function breakGlass(token: string, tenantId: string, reason: string) {
  return requestJson<unknown>('/api/v1/ops/break-glass', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ tenantId, reason }),
  });
}
