import { jerusalemDayKey } from '@itay-chai/contracts';
import { Prisma, prisma, withTenantDb } from '@itay-chai/database';
import {
  addDayKey,
  jerusalemInstant,
  readSchedule,
  weekDayKeys,
  type WeekSlot,
} from '@itay-chai/domain';

export type SavedConfig = {
  schedule?: unknown;
  slots?: WeekSlot[];
};

function asConfig(value: unknown): SavedConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as SavedConfig;
}

function asSlots(value: unknown): WeekSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (slot): slot is WeekSlot =>
      Boolean(slot) &&
      typeof slot === 'object' &&
      typeof (slot as WeekSlot).id === 'string' &&
      typeof (slot as WeekSlot).startsAt === 'string' &&
      typeof (slot as WeekSlot).endsAt === 'string' &&
      typeof (slot as WeekSlot).part === 'string',
  );
}

export async function readStore(tenantId: string, storeId: string) {
  const unit = await prisma.businessUnit.findFirst({
    where: { id: storeId, tenantId },
    select: { config: true, name: true },
  });
  const config = asConfig(unit?.config);
  return {
    tenantId,
    storeId,
    shopName: unit?.name ?? '',
    config,
    schedule: readSchedule(config.schedule),
    slots: asSlots(config.slots),
  };
}

export async function writeConfig(
  tenantId: string,
  storeId: string,
  config: SavedConfig,
  patch: SavedConfig,
) {
  const next = { ...config, ...patch };
  await withTenantDb(tenantId, (tx) =>
    tx.businessUnit.update({
      where: { id: storeId },
      data: { config: next as Prisma.InputJsonValue },
    }),
  );
}

export async function weekShifts(tenantId: string, storeId: string, slots: WeekSlot[]) {
  const days = weekDayKeys(new Date(), slots.length ? 'this' : 'next');
  const fromSlots = slots.map((slot) => new Date(slot.startsAt).getTime());
  const start = fromSlots.length
    ? new Date(Math.min(...fromSlots) - 60_000)
    : new Date(jerusalemInstant(days[0] ?? jerusalemDayKey(new Date()), '00:00'));
  const end = fromSlots.length
    ? new Date(Math.max(...slots.map((slot) => new Date(slot.endsAt).getTime())) + 60_000)
    : new Date(jerusalemInstant(addDayKey(days[6] ?? jerusalemDayKey(new Date()), 1), '00:00'));
  return prisma.shift.findMany({
    where: { tenantId, businessUnitId: storeId, startsAt: { gte: start, lte: end } },
    include: { employee: { select: { id: true, displayName: true } } },
  });
}

export function sameInstant(left: Date | string, right: string) {
  return new Date(left).getTime() === new Date(right).getTime();
}
