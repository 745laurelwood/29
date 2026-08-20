import { sounds as shared, seq } from '@laurelwood/card-class';

/**
 * The shared cue set plus the one moment that belongs to 29. `fanfare` is the
 * package's name for the ascending triad; here it is what Royals sounds like.
 */
export const sounds = {
  ...shared,
  royals: () => seq([
    { freq: 523, dur: 0.12, type: 'sine' as const, gain: 0.1 },
    { freq: 659, dur: 0.12, type: 'sine' as const, gain: 0.1, delay: 0.10 },
    { freq: 784, dur: 0.24, type: 'sine' as const, gain: 0.1, delay: 0.20 },
  ]),
};

export { setMuted, isMuted } from '@laurelwood/card-class';
