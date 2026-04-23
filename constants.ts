import { Suit } from './types';

// ============================================================
// Card display constants
// ============================================================

export const CARD_RANK_LABELS: Record<number, string> = {
  1: 'A',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: 'text-black',
  [Suit.Hearts]: 'text-red-600',
  [Suit.Clubs]: 'text-black',
  [Suit.Diamonds]: 'text-red-600',
};

// Left-to-right order used when displaying the player's hand, grouped by suit.
export const HAND_SUIT_ORDER: Record<Suit, number> = {
  [Suit.Spades]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Clubs]: 2,
  [Suit.Hearts]: 3,
};

export const compareSuitForHand = (a: Suit, b: Suit): number =>
  HAND_SUIT_ORDER[a] - HAND_SUIT_ORDER[b];

export const getRankLabel = (rank: number): string => CARD_RANK_LABELS[rank] ?? '?';

// ============================================================
// AI / bot names
// ============================================================

export const BOT_NAMES = [
  'CardShark', 'VelvetFox', 'MidnightOwl', 'RiverBandit', 'LuckyLoaf',
  'SilverTongue', 'CloverKnight', 'PepperPaws', 'BananaBaron', 'MapleMaverick',
  'GingerGhost', 'TangoTiger', 'WaffleWizard', 'CosmicOtter', 'MochiMonarch',
  'NeonBadger', 'PeachPhantom', 'BiscuitBandit', 'SunnyScholar', 'JollyJester',
];

export function pickBotNames(count: number): string[] {
  const pool = [...BOT_NAMES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

// ============================================================
// UI timing (ms)
// ============================================================

export const ROYALS_ANIM_DURATION_MS = 1600;
export const AI_BID_DELAY_MS = 1200;
export const AI_TRUMP_DELAY_MS = 1400;
export const AI_PLAY_DELAY_MS = 900;
export const TRICK_REVEAL_DELAY_MS = 1100;
export const RESHUFFLE_DELAY_MS = 2000;

// ============================================================
// Team colors
// ============================================================

export const TEAM_BADGE_CLASSES: Record<0 | 1, string> = {
  0: 'bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/40',
  1: 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40',
};

export const TEAM_LABELS: Record<0 | 1, string> = {
  0: 'A',
  1: 'B',
};

export const TEAM_TEXT_COLORS: Record<0 | 1, string> = {
  0: 'text-cyan-300',
  1: 'text-rose-300',
};

// ============================================================
// UI layout
// ============================================================

export const MAX_LOG_ENTRIES = 50;

/** Maximum length of a single chat message. */
export const CHAT_MAX_LEN = 200;

/** Maximum number of chat messages kept in the game state. */
export const CHAT_MAX_HISTORY = 100;
export const PEER_ID_DISPLAY_LENGTH = 6;
export const EMPTY_SLOT_NAME = 'Waiting...';

// ============================================================
// z-index layers
// ============================================================

export const Z_CARD_SELECTED = 20;
export const Z_HUD = 40;
export const Z_ACTION_BAR = 45;
export const Z_TURN_BADGE = 50;
export const Z_OVERLAY = 60;
export const Z_MODAL = 100;

// Scoring and game-rule constants live in rules.ts
