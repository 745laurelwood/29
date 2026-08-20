// rules.ts — Single source of truth for 29 game rules.

import { Card, Suit } from './types';

// ============================================================
// GAME CONFIGURATION
// ============================================================

export const NUM_PLAYERS = 4;
export const NUM_TEAMS = 2;

// 29 uses 32 cards: A, 7, 8, 9, 10, J, Q, K in each of 4 suits.
export const DECK_RANKS: readonly number[] = [1, 7, 8, 9, 10, 11, 12, 13];

// Deal structure: 4 cards before bidding, 4 more after trump chosen, 8 tricks.
export const HAND_SIZE_INITIAL = 4;
export const HAND_SIZE_FULL = 8;
export const NUM_TRICKS = 8;

// Instead of naming a suit, the bid winner may call "seventh card": the deal is
// completed and the 7th card in their hand becomes trump, sight unseen.
export const SEVENTH_CARD_INDEX = 6;

// ============================================================
// BIDDING
// ============================================================

export const MIN_BID = 16;
export const MAX_BID = 29;

// When everyone passes, the dealer is assigned this default bid.
export const DEFAULT_DEALER_BID = MIN_BID;

// ============================================================
// STAKES (double / redouble)
// ============================================================
// Settled once the auction is over and trump is set, but before the second
// deal: a defender may double, and the bidding team may answer with a
// redouble. Everyone is still holding four cards when they decide.

export const DOUBLE_MULTIPLIER = 2;
export const REDOUBLE_MULTIPLIER = 4;

/** "Four game points are the limit: the value cannot be further increased." */
export const MAX_GAME_POINT_DELTA = 4;

/** Stake agreed during the auction, known before a card is played. */
export const getStakeMultiplier = (
  opts: { doubled: boolean; redoubled: boolean },
): number => opts.redoubled ? REDOUBLE_MULTIPLIER : opts.doubled ? DOUBLE_MULTIPLIER : 1;

/** Magnitude of the round's game-point swing, before the win/loss sign. */
export const getGamePointMagnitude = (
  opts: { doubled: boolean; redoubled: boolean; swept: boolean },
): number => Math.min(
  MAX_GAME_POINT_DELTA,
  getStakeMultiplier(opts) * (opts.swept ? 2 : 1),
);

// ============================================================
// CARD POINT VALUES
// ============================================================
// Jacks = 3 each; 9s = 2; Aces/10s = 1; K, Q, 8, 7 = 0.
// Total card points = 28. The last trick gives +1 → 29 total.

export const CARD_POINTS: Record<number, number> = {
  11: 3, // J
  9: 2,
  1: 1,  // A
  10: 1,
  13: 0, // K
  12: 0, // Q
  8: 0,
  7: 0,
};

export const LAST_TRICK_POINT = 1;
export const TOTAL_ROUND_POINTS = 29;

export const getPointsForCard = (card: Card): number => CARD_POINTS[card.rank] ?? 0;

// ============================================================
// TRICK STRENGTH ORDER
// ============================================================
// High → low: J, 9, A, 10, K, Q, 8, 7
const TRICK_ORDER = [11, 9, 1, 10, 13, 12, 8, 7];

/** Returns a number where higher = stronger within a suit. */
export const getTrickStrength = (rank: number): number => {
  const idx = TRICK_ORDER.indexOf(rank);
  return idx === -1 ? -1 : TRICK_ORDER.length - idx;
};

export const compareCardStrength = (a: Card, b: Card): number =>
  getTrickStrength(a.rank) - getTrickStrength(b.rank);

// ============================================================
// ROYALS (K + Q of trump)
// ============================================================

export const ROYALS_ADJUSTMENT = 4;

/** Returns true if the hand contains both K and Q of the given suit. */
export const hasRoyals = (hand: Card[], trump: Suit): boolean => {
  const hasK = hand.some(c => c.suit === trump && c.rank === 13);
  const hasQ = hand.some(c => c.suit === trump && c.rank === 12);
  return hasK && hasQ;
};

// ============================================================
// GAME-WIN CONDITION
// ============================================================

/** First team to reach this many game points wins. Can also be triggered on negative side. */
export const WINNING_GAME_POINTS = 6;

// ============================================================
// LABELS
// ============================================================

export const SUIT_NAMES: Record<Suit, string> = {
  [Suit.Spades]: 'Spades',
  [Suit.Hearts]: 'Hearts',
  [Suit.Clubs]: 'Clubs',
  [Suit.Diamonds]: 'Diamonds',
};

// ============================================================
// HUMAN-READABLE SUMMARY
// ============================================================

export const RULES_SUMMARY = `
29 is a 4-player partnership trick-taking card game.

DECK (32 cards): A, 7, 8, 9, 10, J, Q, K in each suit.

CARD ORDER (high → low): J, 9, A, 10, K, Q, 8, 7.

POINTS: J = 3, 9 = 2, A = 1, 10 = 1, K = Q = 8 = 7 = 0. Plus +1 to the winner of the last trick. Total per round = 29.

DEAL: 4 cards each. Once the bid, the trump choice and the stakes are all settled, 4 more cards each.

BIDDING: Each player in turn (starting next to dealer) may bid (${MIN_BID}–${MAX_BID}) or pass. Each bid must exceed the previous. A pass is permanent. If everyone passes, the dealer is forced to bid ${DEFAULT_DEALER_BID}. The highest bidder chooses the trump suit (secretly).

SEVENTH CARD: instead of naming a suit, the bid winner may call "seventh card". The deal is completed once the stakes are settled, and the suit of the ${SEVENTH_CARD_INDEX + 1}th card in their hand becomes trump, whatever it is. They are shown that card once; it stays hidden from everyone else until trump is revealed, at which point it is turned face up and every player can see which card it was. It stays in their hand but cannot be played while trump is still hidden — if it becomes their only otherwise-legal card, they must reveal trump first.

DOUBLE: with trump set and before the last 4 cards are dealt, either defender may double, taking the round's game-point change to x${DOUBLE_MULTIPLIER}. Whoever doubles first commits their side; the window closes once both have declined.

REDOUBLE: answering a double, either member of the bidding team (the bid winner or their partner) may redouble, taking the round's game-point change to x${REDOUBLE_MULTIPLIER}. Whoever redoubles first commits the team; the window closes once both have declined. Both stakes decisions are made on the first four cards, with trump chosen but not shown.

PLAY: The bid winner leads the first trick. Players must follow suit if possible. If not, they may request the trump to be revealed (then play trump or any card), otherwise play any card. Once trump is revealed, highest trump wins the trick; else highest card of the led suit wins.

ROYALS: If a player holds both K and Q of the trump suit at the moment trump is revealed, they may declare Royals. If they are on the bidder's team, the team's bid drops by ${ROYALS_ADJUSTMENT}; if on the opposing team, the bid rises by ${ROYALS_ADJUSTMENT}. Adjusted bid stays within [${MIN_BID}, ${MAX_BID}].

SCORING: Count each side's card points (plus +1 to the last-trick winner). If the bidder side meets or exceeds their (adjusted) bid, they score +1 game point; otherwise -1. If either side wins all 8 tricks, the change is doubled. A double doubles it; a redouble makes it x${REDOUBLE_MULTIPLIER}. These stack, but the round can never swing more than +/-${MAX_GAME_POINT_DELTA} game points. The non-bidding side is unchanged.

GAME WIN: First side to +${WINNING_GAME_POINTS} game points wins. (Or first side to -${WINNING_GAME_POINTS} loses.)
`.trim();
