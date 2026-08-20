import { Card, Suit } from '../types';
import { DECK_RANKS } from '../rules';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
  for (const suit of suits) {
    for (const rank of DECK_RANKS) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export { getPointsForCard } from '../rules';

/**
 * Rebuilds a card from its id. Ids are `${suit}-${rank}`, so a holder of the
 * id alone can name the card without needing the hand it sits in — which is
 * what lets a spectator, whose copy of every hand is stripped, still see the
 * seventh card once trump is revealed.
 */
export const cardFromId = (id: string | null): Card | null => {
  if (!id) return null;
  const [suit, rank] = id.split('-');
  const r = Number(rank);
  if (!Number.isFinite(r)) return null;
  if (!(Object.values(Suit) as string[]).includes(suit)) return null;
  return { suit: suit as Suit, rank: r, id };
};
