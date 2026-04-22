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
