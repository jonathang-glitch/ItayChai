import { useState } from 'react';
import { COPY, offerPrompt } from './copy';
import { formatShiftWhen, formatTime, shiftTitle } from './format';
import type { IncomingOffer } from './types';

type Props = {
  offer: IncomingOffer;
  busy: boolean;
  onAnswer: (offer: IncomingOffer, action: 'cover' | 'swap' | 'decline', proposedShiftId?: string) => void;
};

export function OfferCard({ offer, busy, onAnswer }: Props) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(offer.swapChoices[0]?.id ?? '');
  const choices = offer.swapChoices;
  const week = offer.weekShifts ?? [];
  const canSwap = offer.allowSwap && choices.length > 0;
  const settled = Boolean(offer.result);

  return (
    <li className="chat-turn">
      <div className="bubble theirs">
        <p>{settled ? offer.result : offerPrompt(offer)}</p>
        {settled ? null : week.length > 0 ? (
          <ul className="week-shifts">
            <li>{COPY.yourWeek}</li>
            {week.map((shift) => (
              <li key={shift.id}>{formatShiftWhen(shift.startsAt)}</li>
            ))}
          </ul>
        ) : (
          <p className="offer-hint">{COPY.noWeekShifts}</p>
        )}
        <time>{formatTime(offer.createdAt)}</time>
      </div>
      {settled ? null : picking && canSwap ? (
        <>
          <div className="bubble theirs">
            <p>{COPY.pickSwapShift}</p>
            <p className="offer-hint">{COPY.swapRelevantHint}</p>
          </div>
          <div className="offer-picks">
            {choices.map((shift) => (
              <button
                key={shift.id}
                type="button"
                className={`relevant${picked === shift.id ? ' on' : ''}`}
                disabled={busy}
                onClick={() => setPicked(shift.id)}
              >
                <span>
                  <strong>{shiftTitle(shift)}</strong>
                  <em>{formatShiftWhen(shift.startsAt)}</em>
                </span>
                <b>{COPY.relevantDay}</b>
              </button>
            ))}
          </div>
          <div className="chat-replies">
            <button
              type="button"
              className="yes"
              disabled={busy || !picked}
              onClick={() => onAnswer(offer, 'swap', picked)}
            >
              {COPY.confirmMatch}
            </button>
            <button type="button" className="no" disabled={busy} onClick={() => setPicking(false)}>
              {COPY.back}
            </button>
          </div>
        </>
      ) : (
        <div className="chat-replies">
          {offer.allowCover ? (
            <button type="button" className="yes" disabled={busy} onClick={() => onAnswer(offer, 'cover')}>
              {COPY.acceptCover}
            </button>
          ) : null}
          {canSwap ? (
            <button type="button" className="swap" disabled={busy} onClick={() => setPicking(true)}>
              {COPY.acceptSwap}
            </button>
          ) : null}
          <button type="button" className="no" disabled={busy} onClick={() => onAnswer(offer, 'decline')}>
            {COPY.declineOffer}
          </button>
        </div>
      )}
    </li>
  );
}
