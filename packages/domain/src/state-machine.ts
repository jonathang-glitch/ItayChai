export const SESSION_FLOW = ['DRAFT', 'INITIALIZING', 'PLANNING', 'COMPLETED'] as const;

export type SessionFlowStatus = (typeof SESSION_FLOW)[number];

const ALLOWED: Record<string, readonly string[]> = {
  DRAFT: ['INITIALIZING'],
  INITIALIZING: ['PLANNING'],
  PLANNING: ['COMPLETED', 'FAILED'],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal session transition ${from} -> ${to}`);
  }
}
