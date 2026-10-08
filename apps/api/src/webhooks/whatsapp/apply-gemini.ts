import { randomUUID } from 'node:crypto';
import { jerusalemDayKey, jerusalemWeekday, jerusalemWeekKey } from '@itay-chai/contracts';
import {
  fitCoworker,
  isDeskQuestion,
  isShortReply,
  matchShiftFromText,
  requestedArrangement,
  requesterDaySet,
  resolveDeskAction,
  type DeskAsk,
} from '@itay-chai/domain';
import { classifyShiftTextWithGemini, geminiShiftConfigured } from '@itay-chai/integrations';
// Gemini uses gemini-3.6-flash for AQ auth keys.
import {
  enqueueWhatsAppSendNow,
  getDeskAsk,
  listMyShifts,
  replaceOpenSearches,
  myShifts,
  pickSwapAgain,
  pickWhichShift,
  prisma,
  shiftTalkWithDate,
} from '@itay-chai/database';
import {
  createCustomerRequest,
  answerMatch,
  answerOffer,
  cancelCustomerSearch,
} from '../../customer/customer.service';

type Routed = {
  ok: true;
  handled?: 'offer' | 'match' | 'cancel' | 'new_request' | 'unparsed' | 'need_pick' | 'roster';
};

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function addDay(day: string, days: number) {
  const [year, month, date] = day.split('-').map(Number);
  return jerusalemDayKey(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days, 12)));
}

function weekdayOf(value: Date | string) {
  return WEEKDAYS[jerusalemWeekday(value)] ?? '';
}

function clock(value: Date) {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(value);
}

function partOf(startsAt: Date): 'בוקר' | 'ערב' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Jerusalem',
    }).format(startsAt),
  );
  return hour < 15 ? 'בוקר' : 'ערב';
}

function describeShift(id: string, startsAt: Date, endsAt?: Date | null) {
  const date = jerusalemDayKey(startsAt);
  return {
    id,
    date,
    weekday: weekdayOf(startsAt),
    part: partOf(startsAt),
    hours: endsAt ? `${clock(startsAt)}–${clock(endsAt)}` : clock(startsAt),
    label: shiftTalkWithDate(startsAt),
  };
}

function calendar(now: Date) {
  const today = jerusalemDayKey(now);
  const tomorrow = addDay(today, 1);
  const thisSunday = jerusalemWeekKey(now);
  const nextSunday = addDay(thisSunday, 7);
  return {
    timezone: 'Asia/Jerusalem' as const,
    now: new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jerusalem',
    }).format(now),
    today: `${today} ${weekdayOf(`${today}T12:00:00Z`)}`,
    tomorrow: `${tomorrow} ${weekdayOf(`${tomorrow}T12:00:00Z`)}`,
    thisWeek: `${thisSunday} until ${addDay(nextSunday, -1)}`,
    nextWeek: `${nextSunday} until ${addDay(nextSunday, 6)}`,
  };
}

async function deskFacts(tenantId: string, userId: string) {
  const me = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true, businessUnitId: true },
  });
  if (!me) {
    return { team: [], options: [], searches: [], finish: 'ask_coworker' as const };
  }
  const now = new Date();
  const people = await prisma.employee.findMany({
    where: { tenantId, businessUnitId: me.businessUnitId, id: { not: me.id } },
    select: {
      displayName: true,
      shifts: {
        where: { endsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true },
      },
    },
  });
  const mine = await prisma.shift.findMany({
    where: { tenantId, employeeId: me.id, endsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true },
  });
  const days = requesterDaySet(mine.map((shift) => shift.startsAt));
  const requests = await prisma.shiftSwapRequest.findMany({
    where: { tenantId, employeeId: me.id },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: { status: true, kind: true, shift: { select: { startsAt: true } } },
  });
  const labelOf = new Map(
    people.flatMap((person) =>
      person.shifts.map((shift) => [shift.id, shiftTalkWithDate(shift.startsAt)]),
    ),
  );
  return {
    team: people.map((person) => ({
      name: person.displayName,
      shifts: person.shifts.map((shift) => {
        const described = describeShift(shift.id, shift.startsAt, shift.endsAt);
        return {
          date: described.date,
          weekday: described.weekday,
          part: described.part,
          hours: described.hours,
          label: described.label,
        };
      }),
    })),
    options: mine.map((shift) => ({
      shiftId: shift.id,
      label: shiftTalkWithDate(shift.startsAt),
      who: people.map((person) => {
        const fit = fitCoworker(
          { name: person.displayName, shifts: person.shifts },
          shift.startsAt,
          days,
        );
        return {
          name: fit.name,
          canCover: fit.canCover,
          canSwap: fit.canSwap,
          swap: fit.swapShiftIds.map((id) => labelOf.get(id) ?? id),
          block: fit.block,
        };
      }),
    })),
    searches: requests.map((row) => ({
      status: row.status,
      kind: row.kind,
      shift: row.shift ? shiftTalkWithDate(row.shift.startsAt) : '',
    })),
    finish: 'ask_coworker' as const,
  };
}

type PendingOffer = {
  id: string;
  allowCover: boolean;
  allowSwap: boolean;
  swapChoices?: { id: string }[];
};

export async function applyGeminiIntent(input: {
  tenantId: string;
  userId: string;
  text: string;
  pending?: PendingOffer;
  matchSessionId?: string;
  openSearchId?: string;
}): Promise<Routed | null> {
  if (!geminiShiftConfigured()) {
    return null;
  }
  const mine = await listMyShifts(input.userId);
  const now = new Date();
  const shifts = mine.map((shift) =>
    describeShift(shift.id, new Date(shift.startsAt), shift.endsAt ? new Date(shift.endsAt) : null),
  );
  const facts = await deskFacts(input.tenantId, input.userId);
  const recentRows = await prisma.message.findMany({
    where: { tenantId: input.tenantId, session: { customerUserId: input.userId } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { direction: true, body: true },
  });
  const recent = recentRows.reverse().map((row) => ({
    from: row.direction === 'INBOUND' ? ('user' as const) : ('bot' as const),
    text: row.body.slice(0, 240),
  }));
  const ask = await getDeskAsk(input.tenantId, input.userId);
  const question = isDeskQuestion(input.text);
  const decision = await classifyShiftTextWithGemini(
    question
      ? { text: input.text, calendar: calendar(now), shifts, team: facts.team }
      : {
          text: input.text,
          calendar: calendar(now),
          shifts,
          team: facts.team,
          options: facts.options,
          searches: facts.searches,
          finish: facts.finish,
          waitingConfirm: Boolean(input.matchSessionId),
          awaitingConfirmSwap: ask === 'confirm_swap',
          awaitingAsk: ask,
          openSearch: Boolean(input.openSearchId),
          recent,
          ...(input.pending
            ? {
                pendingOffer: {
                  allowCover: input.pending.allowCover,
                  allowSwap: input.pending.allowSwap,
                  swapShiftIds: (input.pending.swapChoices ?? []).map((shift) => shift.id),
                },
              }
            : {}),
        },
  );
  if (!decision) {
    return null;
  }

  const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
  const soleShiftId = upcoming.length === 1 ? upcoming[0]?.id : undefined;
  const shiftPick = Boolean(matchShiftFromText(input.text, mine)) && isShortReply(input.text);
  const arrangement = requestedArrangement(input.text);
  const action = resolveDeskAction({
    action: decision.action,
    ask,
    shiftPick,
    arrangement,
    unspecified: arrangement == null && !/כיסוי|לכסות|החלפה|להחליף/u.test(input.text),
  });
  const reply = action === decision.action ? decision.reply : undefined;

  const openMatch = input.matchSessionId
    ? await prisma.shiftSwapRequest.findFirst({
        where: { sessionId: input.matchSessionId, status: { in: ['SEEKING', 'MATCH_PROPOSED'] } },
        select: { employeeId: true, kind: true, shiftId: true },
      })
    : null;
  const shiftId =
    decision.shiftId ??
    (action === 'start_cover' || action === 'start_swap' || action === 'start_either'
      ? (openMatch?.shiftId ?? undefined)
      : undefined) ??
    soleShiftId;
  const startAction =
    action === 'need_pick' && soleShiftId
      ? ask === 'pick_cover'
        ? 'start_cover'
        : ask === 'pick_swap'
          ? 'start_swap'
          : 'start_either'
      : action;

  const send = (body: string, deskAsk: DeskAsk = 'none') =>
    enqueueWhatsAppSendNow({
      tenantId: input.tenantId,
      userId: input.userId,
      body,
      aggregateType: 'WhatsAppInbound',
      aggregateId: randomUUID(),
      deskAsk,
    });

  if (isDeskQuestion(input.text)) {
    if (reply) {
      await send(reply);
      return { ok: true, handled: 'unparsed' };
    }
    return null;
  }

  if (action === 'show_roster') {
    const upcoming = mine.filter((shift) => new Date(shift.endsAt).getTime() > Date.now());
    const labels = (upcoming.length ? upcoming : mine).map((shift) =>
      shift.startsAt ? shiftTalkWithDate(new Date(shift.startsAt)) : shift.label,
    );
    await send(myShifts(labels));
    return { ok: true, handled: 'roster' };
  }
  if (action === 'accept_match' && input.matchSessionId) {
    await answerMatch(input.matchSessionId, 'accept');
    return { ok: true, handled: 'match' };
  }
  if (action === 'decline_match' && input.matchSessionId) {
    await answerMatch(input.matchSessionId, 'decline');
    return { ok: true, handled: 'match' };
  }
  if (action === 'cancel_search' && input.openSearchId) {
    await cancelCustomerSearch(input.openSearchId);
    return { ok: true, handled: 'cancel' };
  }
  if (input.pending && action === 'decline_offer') {
    await answerOffer(input.pending.id, 'decline');
    return { ok: true, handled: 'offer' };
  }
  if (input.pending && action === 'accept_cover' && input.pending.allowCover) {
    await answerOffer(input.pending.id, 'cover');
    return { ok: true, handled: 'offer' };
  }
  if (input.pending && (action === 'accept_swap' || action === 'start_swap')) {
    const proposed =
      decision.shiftId ??
      (input.pending.swapChoices?.length === 1 ? input.pending.swapChoices[0]?.id : undefined);
    if (!proposed) {
      await send(reply || pickSwapAgain(shifts.map((shift) => shift.label)), 'pick_swap');
      return { ok: true, handled: 'need_pick' };
    }
    await answerOffer(input.pending.id, 'swap', proposed);
    return { ok: true, handled: 'offer' };
  }

  const kind =
    startAction === 'start_cover' ? 'COVER' : startAction === 'start_either' ? 'EITHER' : 'SWAP';
  if (
    startAction === 'start_cover' ||
    startAction === 'start_swap' ||
    startAction === 'start_either'
  ) {
    if (!shiftId) {
      await send(
        reply ||
          (startAction === 'start_swap'
            ? pickSwapAgain(shifts.map((shift) => shift.label))
            : pickWhichShift(shifts.map((shift) => shift.label))),
        startAction === 'start_swap'
          ? 'pick_swap'
          : startAction === 'start_cover'
            ? 'pick_cover'
            : 'pick_either',
      );
      return { ok: true, handled: 'need_pick' };
    }
    if (openMatch && openMatch.kind !== kind) {
      await replaceOpenSearches(openMatch.employeeId);
    }
    await createCustomerRequest({ shiftId, kind, text: input.text });
    return { ok: true, handled: 'new_request' };
  }

  if (action === 'need_pick' || action === 'clarify') {
    await send(
      action === 'need_pick'
        ? pickWhichShift(shifts.map((shift) => shift.label))
        : reply || pickWhichShift(shifts.map((shift) => shift.label)),
      action === 'need_pick' ? 'pick_either' : 'none',
    );
    return { ok: true, handled: action === 'need_pick' ? 'need_pick' : 'unparsed' };
  }
  return null;
}
