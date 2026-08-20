export type Membership = {
  tenantId: string;
  tenantName: string;
  roleName: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
};

export type ShiftItem = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
  name: string | null;
  memberships: Membership[];
  shifts?: ShiftItem[];
};

export type ChatMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
};

export type ShiftRequest = {
  id: string;
  status: 'OPEN' | 'APPROVED' | 'REJECTED' | 'NEEDS_REPLACEMENT' | string;
  intentText: string;
  requestedLabel: string;
  employeeName: string;
  shift: ShiftItem | null;
};

export type RequestItem = {
  id: string;
  status: string;
  tenantId: string;
  createdAt: string;
  customerUserId: string | null;
  customerName: string | null;
  messages: ChatMessage[];
  shiftRequest: ShiftRequest | null;
};
