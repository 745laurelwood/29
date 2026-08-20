import { Card, GameState, Suit, TrickPlay } from '../types';
import {
  getTrickStrength, getPointsForCard,
  LAST_TRICK_POINT, NUM_TRICKS, TOTAL_ROUND_POINTS,
} from '../rules';

/**
 * Returns the subset of the hand that is legal to play given the led suit
 * and current trick constraints.
 *
 * - If no suit led yet (leading a trick): every card is legal.
 * - If the player holds the led suit: they must follow suit.
 * - Otherwise: every card is legal — UNLESS this player is the one who just
 *   revealed trump on this very turn and holds at least one trump, in which
 *   case they must play a trump.
 *
 * Given a non-empty hand this always returns at least one card.
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

/**
 * Legal cards, additionally honouring the ban on playing the "seventh card"
 * (trump taken sight unseen — see DECLARE_SEVENTH_CARD) before trump is
 * revealed. It stands in for a face-down trump, so its holder may not table it
 * while the suit is still secret.
 *
 * The ban is applied AFTER the ordinary filtering, never before: the hidden
 * card still counts as a card of its suit for the follow-suit test, so removing
 * it early would let the bidder renege on a suit they actually hold.
 *
 * Unlike getPlayableCards, an EMPTY result is meaningful and reachable: the
 * holder has no playable card and must reveal trump before they can move.
 */
export const getPlayableCardsHidingTrump = (
  hand: Card[],
  ledSuit: Suit | null,
  mustPlayTrump: boolean,
  trumpSuit: Suit | null,
  hiddenTrumpCardId: string | null,
): Card[] => {
  const legal = getPlayableCards(hand, ledSuit, mustPlayTrump, trumpSuit);
  return hiddenTrumpCardId ? legal.filter(c => c.id !== hiddenTrumpCardId) : legal;
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

/**
 * Whether the bidding side can still reach its target. Counts every point
 * left on the table as if they took all of it: the remaining card points
 * plus the last-trick bonus while tricks remain.
 *
 * Used to decide whether a bot agrees to give a round up. It answers "is this
 * already decided", not "is this going badly".
 */
export function bidderCanStillMakeIt(state: GameState): boolean {
  if (state.bidWinner < 0) return true;
  const bidderTeam = state.players[state.bidWinner].team;
  const captured = state.players.reduce((sum, p) => sum + cardPoints(p.capturedCards), 0);
  const bidderPoints = state.players
    .filter(p => p.team === bidderTeam)
    .reduce((sum, p) => sum + cardPoints(p.capturedCards), 0);

  const tricksLeft = NUM_TRICKS - state.completedTricks.length;
  const stillOut = (TOTAL_ROUND_POINTS - LAST_TRICK_POINT) - captured
    + (tricksLeft > 0 ? LAST_TRICK_POINT : 0);

  return bidderPoints + stillOut >= state.bidValue + state.bidAdjustment;
}

/** Whether the bidding side has already captured its target outright. */
export function bidderAlreadyHome(state: GameState): boolean {
  if (state.bidWinner < 0) return false;
  const bidderTeam = state.players[state.bidWinner].team;
  const bidderPoints = state.players
    .filter(p => p.team === bidderTeam)
    .reduce((sum, p) => sum + cardPoints(p.capturedCards), 0);
  return bidderPoints >= state.bidValue + state.bidAdjustment;
}
