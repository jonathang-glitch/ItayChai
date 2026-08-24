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
    .replace(/בבוקר\s+(\S+)/g, 'ב$1 בבוקר')
    .replace(/בערב\s+(\S+)/g, 'ב$1 בערב')
    .replace(/בוקר\s+(\S+)/g, '$1 בבוקר')
    .replace(/ערב\s+(\S+)/g, '$1 בערב');
}

export function swapRequestText(label: string) {
  return `צריך החלפה ב${phraseShiftLabel(label)}`;
}

export function shiftTitle(shift: { label: string; startsAt: string }) {
  return shift.startsAt ? shiftLabelFromStart(shift.startsAt) : phraseShiftLabel(shift.label);
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

export function flattenMessages(items: RequestItem[]) {
  return [...items]
    .filter((item) => isFromLastDay(item.createdAt))
    .reverse()
    .flatMap((item) => item.messages)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function isOpen(item: RequestItem | string) {
  if (typeof item === 'string') {
    return item === 'OPEN' || (item !== 'COMPLETED' && item !== 'FAILED');
  }
  if (item.shiftRequest) {
    return item.shiftRequest.status === 'OPEN';
  }
  return item.status !== 'COMPLETED' && item.status !== 'FAILED';
}

export function isDone(item: RequestItem) {
  if (item.shiftRequest) {
    return item.shiftRequest.status !== 'OPEN';
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

export function formatShiftWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dayName = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'short' }).format(start);
  const hours = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${dayName} · ${hours.format(start)}–${hours.format(end)}`;
}
