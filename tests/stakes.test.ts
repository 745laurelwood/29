// Covers the stakes window: the double and redouble that sit between trump
// selection and the second deal.

import { describe, expect, it } from 'vitest';
import { gameReducer, INITIAL_STATE, Action } from '../gameReducer';
import { Card, GameState, Suit } from '../types';
import {
  HAND_SIZE_FULL, HAND_SIZE_INITIAL, MIN_BID, NUM_PLAYERS, SEVENTH_CARD_INDEX,
  getStakeMultiplier,
} from '../rules';

const run = (state: GameState, ...actions: Action[]): GameState =>
  actions.reduce(gameReducer, state);

/** A four-bot table with the auction won by seat 0 at the minimum bid. */
function afterAuction(): GameState {
  const dealt = run(
    INITIAL_STATE,
    { type: 'INIT_LOBBY', payload: { isHost: true } },
    { type: 'START_ROUND' },
  );
  return run(
    dealt,
    { type: 'PLACE_BID', payload: { playerIndex: 0, amount: MIN_BID } },
    { type: 'PASS_BID', payload: { playerIndex: 1 } },
    { type: 'PASS_BID', payload: { playerIndex: 2 } },
    { type: 'PASS_BID', payload: { playerIndex: 3 } },
  );
}

/** Seat 0 wins the bid, so seats 1 and 3 defend and seat 2 is the partner. */
const BIDDER = 0;
const PARTNER = 2;
const DEFENDERS = [1, 3] as const;

const namedTrump = (state: GameState): GameState =>
  gameReducer(state, { type: 'CHOOSE_TRUMP', payload: { suit: Suit.Spades } });

const calledSeventh = (state: GameState): GameState =>
  gameReducer(state, { type: 'DECLARE_SEVENTH_CARD', payload: { playerIndex: BIDDER } });

const declineDoubles = (state: GameState): GameState =>
  run(state, ...DEFENDERS.map(i => ({
    type: 'DECLINE_DOUBLE' as const, payload: { playerIndex: i },
  })));

const handSizes = (state: GameState): number[] => state.players.map(p => p.hand.length);

const stake = (state: GameState): number => getStakeMultiplier({
  doubled: state.doubledBy >= 0,
  redoubled: state.redoubledBy >= 0,
});

describe('the auction', () => {
  it('hands the contract to trump selection rather than to a stakes window', () => {
    const state = afterAuction();
    expect(state.gamePhase).toBe('CHOOSING_TRUMP');
    expect(state.bidWinner).toBe(BIDDER);
    expect(state.bidValue).toBe(MIN_BID);
    expect(state.doubledBy).toBe(-1);
  });

  it('reaches trump selection when everyone passes and the dealer is forced in', () => {
    const dealt = run(
      INITIAL_STATE,
      { type: 'INIT_LOBBY', payload: { isHost: true } },
      { type: 'START_ROUND' },
    );
    const state = run(
      dealt,
      { type: 'PASS_BID', payload: { playerIndex: 0 } },
      { type: 'PASS_BID', payload: { playerIndex: 1 } },
      { type: 'PASS_BID', payload: { playerIndex: 2 } },
    );
    expect(state.gamePhase).toBe('CHOOSING_TRUMP');
    expect(state.bidWinner).toBe(state.dealerIndex);
    expect(state.bidValue).toBe(MIN_BID);
  });

  it('ignores a double while bidding is still open', () => {
    const dealt = run(
      INITIAL_STATE,
      { type: 'INIT_LOBBY', payload: { isHost: true } },
      { type: 'START_ROUND' },
    );
    const bid = gameReducer(dealt, { type: 'PLACE_BID', payload: { playerIndex: 0, amount: MIN_BID } });
    const state = gameReducer(bid, { type: 'DOUBLE', payload: { playerIndex: 1 } });
    expect(state).toBe(bid);
    expect(state.gamePhase).toBe('BIDDING');
  });
});

describe('the doubling window', () => {
  it('opens when trump is named, with the second deal still pending', () => {
    const state = namedTrump(afterAuction());
    expect(state.gamePhase).toBe('DOUBLING');
    expect(state.trumpSuit).toBe(Suit.Spades);
    expect(handSizes(state)).toEqual(Array(NUM_PLAYERS).fill(HAND_SIZE_INITIAL));
    expect(state.deck).toHaveLength((HAND_SIZE_FULL - HAND_SIZE_INITIAL) * NUM_PLAYERS);
  });

  it('lets either defender double, and stops there', () => {
    for (const defender of DEFENDERS) {
      const state = gameReducer(namedTrump(afterAuction()), {
        type: 'DOUBLE', payload: { playerIndex: defender },
      });
      expect(state.gamePhase).toBe('REDOUBLING');
      expect(state.doubledBy).toBe(defender);
      expect(handSizes(state).every(n => n === HAND_SIZE_INITIAL)).toBe(true);
    }
  });

  it('keeps the window open after one defender declines', () => {
    const state = gameReducer(namedTrump(afterAuction()), {
      type: 'DECLINE_DOUBLE', payload: { playerIndex: DEFENDERS[0] },
    });
    expect(state.gamePhase).toBe('DOUBLING');
    expect(state.doubleDeclinedBy).toEqual([DEFENDERS[0]]);

    const doubled = gameReducer(state, { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[1] } });
    expect(doubled.gamePhase).toBe('REDOUBLING');
    expect(doubled.doubledBy).toBe(DEFENDERS[1]);
  });

  it('deals the last four cards and starts play once both defenders decline', () => {
    const state = declineDoubles(namedTrump(afterAuction()));
    expect(state.gamePhase).toBe('PLAYING');
    expect(stake(state)).toBe(1);
    expect(handSizes(state).every(n => n === HAND_SIZE_FULL)).toBe(true);
    expect(state.deck).toHaveLength(0);
    expect(state.currentTurn).toBe(BIDDER);
    expect(state.trickLeader).toBe(BIDDER);
  });

  it('refuses a double from the bidding side', () => {
    const open = namedTrump(afterAuction());
    for (const seat of [BIDDER, PARTNER]) {
      expect(gameReducer(open, { type: 'DOUBLE', payload: { playerIndex: seat } })).toBe(open);
      expect(gameReducer(open, { type: 'DECLINE_DOUBLE', payload: { playerIndex: seat } })).toBe(open);
    }
  });

  it('gives a defender who has already declined no second say', () => {
    const declined = gameReducer(namedTrump(afterAuction()), {
      type: 'DECLINE_DOUBLE', payload: { playerIndex: DEFENDERS[0] },
    });
    expect(gameReducer(declined, { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] } })).toBe(declined);
    expect(gameReducer(declined, { type: 'DECLINE_DOUBLE', payload: { playerIndex: DEFENDERS[0] } })).toBe(declined);
  });
});

describe('the redoubling window', () => {
  const doubled = (): GameState => gameReducer(namedTrump(afterAuction()), {
    type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] },
  });

  it('lets either member of the bidding team redouble, then starts play at x4', () => {
    for (const seat of [BIDDER, PARTNER]) {
      const state = gameReducer(doubled(), { type: 'REDOUBLE', payload: { playerIndex: seat } });
      expect(state.gamePhase).toBe('PLAYING');
      expect(state.redoubledBy).toBe(seat);
      expect(stake(state)).toBe(4);
      expect(handSizes(state).every(n => n === HAND_SIZE_FULL)).toBe(true);
    }
  });

  it('keeps the round at x2 when both decline', () => {
    const state = run(
      doubled(),
      { type: 'DECLINE_REDOUBLE', payload: { playerIndex: BIDDER } },
      { type: 'DECLINE_REDOUBLE', payload: { playerIndex: PARTNER } },
    );
    expect(state.gamePhase).toBe('PLAYING');
    expect(stake(state)).toBe(2);
    expect(handSizes(state).every(n => n === HAND_SIZE_FULL)).toBe(true);
  });

  it('waits for the partner after one decline', () => {
    const state = gameReducer(doubled(), { type: 'DECLINE_REDOUBLE', payload: { playerIndex: BIDDER } });
    expect(state.gamePhase).toBe('REDOUBLING');
    expect(handSizes(state).every(n => n === HAND_SIZE_INITIAL)).toBe(true);
  });

  it('refuses a redouble from a defender', () => {
    const open = doubled();
    for (const seat of DEFENDERS) {
      expect(gameReducer(open, { type: 'REDOUBLE', payload: { playerIndex: seat } })).toBe(open);
      expect(gameReducer(open, { type: 'DECLINE_REDOUBLE', payload: { playerIndex: seat } })).toBe(open);
    }
  });
});

describe('seventh card', () => {
  it('holds the deal, and the trump suit, until the stakes are settled', () => {
    const called = calledSeventh(afterAuction());
    expect(called.gamePhase).toBe('DOUBLING');
    expect(called.seventhCardCalled).toBe(true);
    expect(called.trumpSuit).toBeNull();
    expect(called.seventhCardId).toBeNull();
    expect(handSizes(called).every(n => n === HAND_SIZE_INITIAL)).toBe(true);

    const playing = declineDoubles(called);
    expect(playing.gamePhase).toBe('PLAYING');
    const seventh = playing.players[BIDDER].hand[SEVENTH_CARD_INDEX];
    expect(playing.seventhCardId).toBe(seventh.id);
    expect(playing.trumpSuit).toBe(seventh.suit);
  });

  it('resolves against the finished hand after a double and a redouble', () => {
    const state = run(
      calledSeventh(afterAuction()),
      { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[1] } },
      { type: 'REDOUBLE', payload: { playerIndex: PARTNER } },
    );
    expect(state.gamePhase).toBe('PLAYING');
    expect(stake(state)).toBe(4);
    const seventh = state.players[BIDDER].hand[SEVENTH_CARD_INDEX];
    expect(state.trumpSuit).toBe(seventh.suit);
    expect(state.seventhCardId).toBe(seventh.id);
  });

  it('keeps the seventh card off the table while trump is hidden', () => {
    const state = declineDoubles(calledSeventh(afterAuction()));
    const blocked = gameReducer(state, {
      type: 'PLAY_CARD', payload: { playerIndex: BIDDER, cardId: state.seventhCardId! },
    });
    expect(blocked).toBe(state);
  });
});

describe('scoring a doubled round', () => {
  const card = (suit: Suit, rank: number): Card => ({ suit, rank, id: `${suit}-${rank}-x` });
  // 4 jacks and 4 nines is 20 card points, comfortably past a bid of 16.
  const twentyPoints = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds]
    .flatMap(suit => [card(suit, 11), card(suit, 9)]);

  /** Hands the bidding team enough captured points to make the bid, without a sweep. */
  const withBidMade = (state: GameState): GameState => ({
    ...state,
    players: state.players.map(p => ({
      ...p,
      capturedCards: p.id === BIDDER ? twentyPoints : [],
      tricksWon: p.id === BIDDER ? 4 : p.team === state.players[BIDDER].team ? 0 : 2,
    })),
    lastTrickWinner: BIDDER,
  });

  it('pays out x2 on a double and x4 on a redouble', () => {
    const cases: [Action[], number][] = [
      [DEFENDERS.map(i => ({ type: 'DECLINE_DOUBLE' as const, payload: { playerIndex: i } })), 1],
      [[
        { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] } },
        { type: 'DECLINE_REDOUBLE', payload: { playerIndex: BIDDER } },
        { type: 'DECLINE_REDOUBLE', payload: { playerIndex: PARTNER } },
      ], 2],
      [[
        { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] } },
        { type: 'REDOUBLE', payload: { playerIndex: BIDDER } },
      ], 4],
    ];
    for (const [stakeActions, expected] of cases) {
      const played = run(namedTrump(afterAuction()), ...stakeActions);
      const scored = gameReducer(withBidMade(played), { type: 'END_ROUND' });
      expect(scored.totalScores.team0).toBe(expected);
      expect(scored.totalScores.team1).toBe(0);
    }
  });
});

describe('the next round', () => {
  it('clears the stakes and the seventh-card call', () => {
    const played = run(
      calledSeventh(afterAuction()),
      { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] } },
      { type: 'REDOUBLE', payload: { playerIndex: BIDDER } },
    );
    const next = gameReducer({ ...played, gamePhase: 'ROUND_OVER' }, { type: 'START_ROUND' });
    expect(next.gamePhase).toBe('BIDDING');
    expect(next.doubledBy).toBe(-1);
    expect(next.doubleDeclinedBy).toEqual([]);
    expect(next.redoubledBy).toBe(-1);
    expect(next.redoubleDeclinedBy).toEqual([]);
    expect(next.seventhCardCalled).toBe(false);
    expect(next.seventhCardId).toBeNull();
  });
});
