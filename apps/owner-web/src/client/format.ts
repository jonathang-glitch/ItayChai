import type { ChatMessage, RequestItem } from './types';

export function shiftLabelFromStart(startsAt: Date | string) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  })
    .format(date)
    .replace(/^יום\s+/, '');
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    }).format(date),
  );
  return `${weekday} ${hour < 15 ? 'בבוקר' : 'בערב'}`;
}

export function phraseShiftLabel(label: string) {
  const trimmed = label.trim();
  const morning = trimmed.match(/^בוקר\s+(.+)$/);
  if (morning) {
    return `${morning[1]} בבוקר`;
  }
  const evening = trimmed.match(/^ערב\s+(.+)$/);
  if (evening) {
    return `${evening[1]} בערב`;
  }
  return trimmed;
}

export function phraseShiftTalk(text: string) {
  return text
    .replace(/בבוקר\s+(?![\d(])(\S+)/g, 'ב$1 בבוקר')
    .replace(/בערב\s+(?![\d(])(\S+)/g, 'ב$1 בערב')
    .replace(/בוקר\s+(?![\d(])(\S+)/g, '$1 בבוקר')
    .replace(/ערב\s+(?![\d(])(\S+)/g, '$1 בערב');
}

export function swapRequestText(label: string) {
  return `צריך החלפה ב${phraseShiftLabel(label)}`;
}

export function shiftTalkWithDate(startsAt: Date | string) {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const when = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
  return `${shiftLabelFromStart(date)} (${when})`;
}

export function weekdayName(startsAt: Date | string) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  })
    .format(typeof startsAt === 'string' ? new Date(startsAt) : startsAt)
    .replace(/^יום\s+/, '');
}

export function shiftTitle(shift: { label: string; startsAt: string }) {
  if (shift.startsAt) {
    return weekdayName(shift.startsAt);
  }
  return phraseShiftLabel(shift.label)
    .replace(/\s+בבוקר$/, '')
    .replace(/\s+בערב$/, '');
}

const time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });

export function formatTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return time.format(date);
  }
  return day.format(date);
}

export function firstInbound(item: RequestItem) {
  return item.messages.find((message) => message.direction === 'INBOUND')?.body ?? '';
}

export function lastMessage(item: RequestItem): ChatMessage | undefined {
  return item.messages[item.messages.length - 1];
}

export function isFromLastDay(value: string) {
  const date = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

const DESK_OPEN = new Set(['OPEN', 'SEEKING', 'MATCH_PROPOSED', 'UNFILLED']);
const LIVE_REQUEST = new Set(['OPEN', 'SEEKING', 'MATCH_PROPOSED', 'UNFILLED', 'COMMITTED', 'CANCELLED']);

export function isLiveRequest(item: RequestItem) {
  if (item.shiftRequest) {
    return LIVE_REQUEST.has(item.shiftRequest.status);
  }
  return item.status !== 'COMPLETED' && item.status !== 'FAILED';
}

export function flattenMessages(items: RequestItem[]) {
  return [...items]
    .filter((item) => isFromLastDay(item.createdAt) && isLiveRequest(item))
    .reverse()
    .flatMap((item) => item.messages)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function isOpen(item: RequestItem | string) {
  if (typeof item === 'string') {
    return DESK_OPEN.has(item) || (item !== 'COMPLETED' && item !== 'FAILED' && !isDoneStatus(item));
  }
  if (item.shiftRequest) {
    return DESK_OPEN.has(item.shiftRequest.status);
  }
  return item.status !== 'COMPLETED' && item.status !== 'FAILED';
}

function isDoneStatus(status: string) {
  return ['COMMITTED', 'CANCELLED', 'APPROVED', 'REJECTED', 'NEEDS_REPLACEMENT'].includes(status);
}

export function isDone(item: RequestItem) {
  if (item.shiftRequest) {
    return isDoneStatus(item.shiftRequest.status);
  }
  return item.status === 'COMPLETED' || item.status === 'FAILED';
}

export function onOwnerDesk(item: RequestItem) {
  if (!isFromLastDay(item.createdAt)) {
    return false;
  }
  if (item.shiftRequest) {
    return true;
  }
  return item.status !== 'COMPLETED' && item.status !== 'FAILED';
}

export function formatShiftWhen(startsAt: string) {
  const start = new Date(startsAt);
  const dayName = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(start);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem',
    }).format(start),
  );
  return `${dayName} · ${hour < 15 ? 'בוקר' : 'ערב'}`;
}
