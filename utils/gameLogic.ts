import { Card, Suit, TrickPlay } from '../types';
import { getTrickStrength, getPointsForCard } from '../rules';

/**
 * Returns the subset of the hand that is legal to play given the led suit
 * and current trick constraints.
 *
 * - If no suit led yet (leading a trick): every card is legal.
 * - If the player holds the led suit: they must follow suit.
 * - Otherwise: every card is legal — UNLESS this player is the one who just
 *   revealed trump on this very turn and holds at least one trump, in which
 *   case they must play a trump.
 */
export const getPlayableCards = (
  hand: Card[],
  ledSuit: Suit | null,
  mustPlayTrump: boolean = false,
  trumpSuit: Suit | null = null,
): Card[] => {
  if (!ledSuit) return [...hand];
  const sameSuit = hand.filter(c => c.suit === ledSuit);
  if (sameSuit.length > 0) return sameSuit;
  if (mustPlayTrump && trumpSuit) {
    const trumps = hand.filter(c => c.suit === trumpSuit);
    if (trumps.length > 0) return trumps;
  }
  return [...hand];
};

export const canFollowSuit = (hand: Card[], suit: Suit): boolean =>
  hand.some(c => c.suit === suit);

/**
 * Determines the winner of a completed trick.
 *
 * @param plays       The 4 plays in turn order.
 * @param ledSuit     Suit of the first card played.
 * @param trumpSuit   The trump suit (null if unknown/not chosen).
 * @param trumpActive Whether trump has been revealed at or before this trick.
 *                    If false, trumps do not beat the led suit.
 */
export const getTrickWinner = (
  plays: TrickPlay[],
  ledSuit: Suit,
  trumpSuit: Suit | null,
  trumpActive: boolean,
): TrickPlay => {
  if (trumpActive && trumpSuit && plays.some(p => p.card.suit === trumpSuit)) {
    const trumps = plays.filter(p => p.card.suit === trumpSuit);
    return trumps.reduce((best, p) =>
      getTrickStrength(p.card.rank) > getTrickStrength(best.card.rank) ? p : best
    );
  }
  const sameSuit = plays.filter(p => p.card.suit === ledSuit);
  if (sameSuit.length === 0) {
    // Shouldn't happen in normal play (the leader always plays the led suit),
    // but defensively fall back to the strongest card overall.
    return plays.reduce((best, p) =>
      getTrickStrength(p.card.rank) > getTrickStrength(best.card.rank) ? p : best
    );
  }
  return sameSuit.reduce((best, p) =>
    getTrickStrength(p.card.rank) > getTrickStrength(best.card.rank) ? p : best
  );
};

/** Sum of point values across a set of cards. */
export const cardPoints = (cards: Card[]): number =>
  cards.reduce((s, c) => s + getPointsForCard(c), 0);
