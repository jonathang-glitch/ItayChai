export type RequestKind = 'COVER' | 'SWAP' | 'EITHER';

export function requestFlags(kind: RequestKind) {
  return {
    allowCover: kind !== 'SWAP',
    allowSwap: kind !== 'COVER',
  };
}
