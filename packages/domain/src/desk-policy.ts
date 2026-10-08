export type DeskAsk = 'confirm_swap' | 'pick_cover' | 'pick_swap' | 'pick_either' | 'none';

const STARTS = new Set(['start_cover', 'start_swap', 'start_either', 'need_pick']);

export function deskAskFromLastBot(text?: string): DeskAsk {
  const body = text?.trim() ?? '';
  if (body.startsWith('באיזו משמרת?')) {
    return 'pick_either';
  }
  if (body.startsWith('איזו משמרת להחליף?') || body.startsWith('איזו משמרת?')) {
    return 'pick_swap';
  }
  if (/לאשר את ההחלפה/.test(body) || (/להחליף/.test(body) && /האם מאשר/.test(body))) {
    return 'confirm_swap';
  }
  return 'none';
}

export function resolveDeskAction(input: {
  action: string;
  ask: DeskAsk;
  shiftPick: boolean;
  arrangement?: 'cover' | 'swap' | null;
  unspecified?: boolean;
}) {
  if (
    input.arrangement === 'cover' &&
    input.action !== 'cancel_search' &&
    input.action !== 'decline_offer'
  ) {
    return 'start_cover';
  }
  if (input.action === 'accept_match' && input.ask !== 'confirm_swap') {
    return 'clarify';
  }
  if (input.shiftPick && input.ask === 'pick_cover' && STARTS.has(input.action)) {
    return 'start_cover';
  }
  if (input.shiftPick && input.ask === 'pick_swap' && STARTS.has(input.action)) {
    return 'start_swap';
  }
  if (input.shiftPick && input.ask === 'pick_either' && STARTS.has(input.action)) {
    if (input.arrangement === 'cover') {
      return 'start_cover';
    }
    if (input.arrangement === 'swap') {
      return 'start_swap';
    }
    return 'start_either';
  }
  if (
    input.unspecified &&
    (input.action === 'start_cover' ||
      input.action === 'start_swap' ||
      input.action === 'need_pick')
  ) {
    return 'start_either';
  }
  return input.action;
}
