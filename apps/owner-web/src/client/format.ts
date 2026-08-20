import type { ChatMessage, RequestItem } from './types';

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
