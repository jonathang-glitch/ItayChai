import { COPY, offerPrompt } from './copy';
import { formatTime } from './format';
import type { IncomingOffer } from './types';

type Props = {
  offer: IncomingOffer;
  busy: boolean;
  picking?: boolean;
  onSwap?: (offer: IncomingOffer) => void;
  onAnswer: (offer: IncomingOffer, action: 'cover' | 'swap' | 'decline', proposedShiftId?: string) => void;
};

export function OfferCard({ offer, busy, picking, onSwap, onAnswer }: Props) {
  const canSwap = offer.allowSwap && offer.swapChoices.length > 0;
  const settled = Boolean(offer.result);

  return (
    <li className="chat-turn">
      <div className="bubble theirs">
        <p>{settled ? offer.result : offerPrompt(offer)}</p>
        <time>{formatTime(offer.createdAt)}</time>
      </div>
      {settled || picking ? null : (
        <div className="chat-replies">
          {offer.allowCover ? (
            <button type="button" className="yes" disabled={busy} onClick={() => onAnswer(offer, 'cover')}>
              {COPY.acceptCover}
            </button>
          ) : null}
          {canSwap ? (
            <button type="button" className="swap" disabled={busy} onClick={() => onSwap?.(offer)}>
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
