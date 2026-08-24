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

export type ShiftRequestKind = 'COVER' | 'SWAP' | 'EITHER';

export type ShiftRequest = {
  id: string;
  status: string;
  kind?: ShiftRequestKind | string;
  intentText: string;
  requestedLabel: string;
  employeeName: string;
  shift: ShiftItem | null;
  proposedShift?: ShiftItem | null;
  counterpartName?: string | null;
  searchSummary?: string;
  offers?: { id: string; status: string; employeeName: string; allowCover: boolean; allowSwap: boolean }[];
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

export type IncomingOffer = {
  id: string;
  status: string;
  allowCover: boolean;
  allowSwap: boolean;
  prompt: string;
  createdAt: string;
  requesterName: string;
  requestedShift: ShiftItem | null;
  proposedShift: ShiftItem | null;
  weekShifts?: ShiftItem[];
  swapChoices: ShiftItem[];
  requestStatus: string;
};

export type CustomerHomeData = {
  requests: RequestItem[];
  shifts: ShiftItem[];
  offers: IncomingOffer[];
};
