// The seventh card is the bidder's secret until trump is revealed, and public
// knowledge from that moment: it is the card that set the suit.

import { describe, expect, it } from 'vitest';
import { gameReducer, INITIAL_STATE, Action } from '../gameReducer';
import { GameState, Suit } from '../types';
import { cardFromId } from '../utils/deck';
import { getRankLabel, SUIT_SYMBOLS } from '../constants';
import { MIN_BID, SEVENTH_CARD_INDEX } from '../rules';

const run = (state: GameState, ...actions: Action[]): GameState =>
  actions.reduce(gameReducer, state);

const BIDDER = 0;
const DEFENDERS = [1, 3] as const;

/** Seat 0 wins the bid, calls seventh card, and the stakes window closes. */
function inPlayOnSeventhCard(): GameState {
  const dealt = run(
    INITIAL_STATE,
    { type: 'INIT_LOBBY', payload: { isHost: true } },
    { type: 'START_ROUND' },
  );
  const bid = run(
    dealt,
    { type: 'PLACE_BID', payload: { playerIndex: BIDDER, amount: MIN_BID } },
    { type: 'PASS_BID', payload: { playerIndex: 1 } },
    { type: 'PASS_BID', payload: { playerIndex: 2 } },
    { type: 'PASS_BID', payload: { playerIndex: 3 } },
  );
  return run(
    bid,
    { type: 'DECLARE_SEVENTH_CARD', payload: { playerIndex: BIDDER } },
    ...DEFENDERS.map(i => ({ type: 'DECLINE_DOUBLE' as const, payload: { playerIndex: i } })),
  );
}

describe('cardFromId', () => {
  it('rebuilds a card without needing the hand it sits in', () => {
    const state = inPlayOnSeventhCard();
    const inHand = state.players[BIDDER].hand[SEVENTH_CARD_INDEX];
    const rebuilt = cardFromId(inHand.id);
    expect(rebuilt).toEqual({ suit: inHand.suit, rank: inHand.rank, id: inHand.id });
  });

  it('returns null for anything that is not a card id', () => {
    expect(cardFromId(null)).toBeNull();
    expect(cardFromId('')).toBeNull();
    expect(cardFromId('not-a-card')).toBeNull();
    expect(cardFromId('Z-9')).toBeNull();
  });
});

describe('revealing trump', () => {
  it('names the seventh card in the log, so every player learns which card it was', () => {
    const state = inPlayOnSeventhCard();
    const seventh = state.players[BIDDER].hand[SEVENTH_CARD_INDEX];
    const revealed = gameReducer(state, { type: 'REVEAL_TRUMP', payload: { playerIndex: DEFENDERS[0] } });

    const line = revealed.gameLog[revealed.gameLog.length - 1];
    expect(line).toContain('seventh card');
    expect(line).toContain(`${getRankLabel(seventh.rank)}${SUIT_SYMBOLS[seventh.suit]}`);
  });

  it('says nothing about a seventh card when trump was named outright', () => {
    const dealt = run(
      INITIAL_STATE,
      { type: 'INIT_LOBBY', payload: { isHost: true } },
      { type: 'START_ROUND' },
    );
    const state = run(
      dealt,
      { type: 'PLACE_BID', payload: { playerIndex: BIDDER, amount: MIN_BID } },
      { type: 'PASS_BID', payload: { playerIndex: 1 } },
      { type: 'PASS_BID', payload: { playerIndex: 2 } },
      { type: 'PASS_BID', payload: { playerIndex: 3 } },
      { type: 'CHOOSE_TRUMP', payload: { suit: Suit.Spades } },
      ...DEFENDERS.map(i => ({ type: 'DECLINE_DOUBLE' as const, payload: { playerIndex: i } })),
    );
    const revealed = gameReducer(state, { type: 'REVEAL_TRUMP', payload: { playerIndex: DEFENDERS[0] } });
    expect(revealed.gameLog[revealed.gameLog.length - 1]).not.toContain('seventh card');
  });

  it('keeps the seventh card identifiable after the reveal', () => {
    const state = inPlayOnSeventhCard();
    const revealed = gameReducer(state, { type: 'REVEAL_TRUMP', payload: { playerIndex: DEFENDERS[0] } });
    // The id survives the reveal, which is what the hands render against.
    expect(revealed.trumpRevealed).toBe(true);
    expect(revealed.seventhCardId).toBe(state.seventhCardId);
    expect(cardFromId(revealed.seventhCardId)!.suit).toBe(revealed.trumpSuit);
  });
});
