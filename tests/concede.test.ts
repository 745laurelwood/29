// Giving up takes a whole side. One player offering does nothing until their
// partner matches it, and the side that gives up loses the round.

import { describe, expect, it } from 'vitest';
import { gameReducer, INITIAL_STATE, Action } from '../gameReducer';
import { GameState, Suit } from '../types';
import { MIN_BID } from '../rules';

const run = (state: GameState, ...actions: Action[]): GameState =>
  actions.reduce(gameReducer, state);

const BIDDER = 0;
const PARTNER = 2;          // same side as the bidder
const DEFENDERS = [1, 3] as const;

/** Seat 0 wins the bid at the minimum and play begins, undoubled. */
function inPlay(): GameState {
  const dealt = run(
    INITIAL_STATE,
    { type: 'INIT_LOBBY', payload: { isHost: true } },
    { type: 'START_ROUND' },
  );
  return run(
    dealt,
    { type: 'PLACE_BID', payload: { playerIndex: BIDDER, amount: MIN_BID } },
    { type: 'PASS_BID', payload: { playerIndex: 1 } },
    { type: 'PASS_BID', payload: { playerIndex: 2 } },
    { type: 'PASS_BID', payload: { playerIndex: 3 } },
    { type: 'CHOOSE_TRUMP', payload: { suit: Suit.Spades } },
    ...DEFENDERS.map(i => ({ type: 'DECLINE_DOUBLE' as const, payload: { playerIndex: i } })),
  );
}

const concede = (i: number): Action => ({ type: 'TOGGLE_CONCEDE', payload: { playerIndex: i } });

describe('offering to give up', () => {
  it('does nothing on its own', () => {
    const state = gameReducer(inPlay(), concede(BIDDER));
    expect(state.gamePhase).toBe('PLAYING');
    expect(state.concedeVotes).toEqual([BIDDER]);
    expect(state.concededBy).toBeNull();
    expect(state.totalScores).toEqual({ team0: 0, team1: 0 });
  });

  it('is withdrawable right up until the partner matches it', () => {
    const offered = gameReducer(inPlay(), concede(BIDDER));
    const withdrawn = gameReducer(offered, concede(BIDDER));
    expect(withdrawn.concedeVotes).toEqual([]);
    expect(withdrawn.gamePhase).toBe('PLAYING');
  });

  it('is not answered by an opponent', () => {
    // A defender offering does not complete the bidding side's concession.
    const state = run(inPlay(), concede(BIDDER), concede(DEFENDERS[0]));
    expect(state.gamePhase).toBe('PLAYING');
    expect(state.concededBy).toBeNull();
  });

  it('is ignored outside play', () => {
    const dealt = run(
      INITIAL_STATE,
      { type: 'INIT_LOBBY', payload: { isHost: true } },
      { type: 'START_ROUND' },
    );
    expect(gameReducer(dealt, concede(BIDDER))).toBe(dealt);
  });
});

describe('a side giving up', () => {
  it('hands the round to the opponents when the bidding side gives up', () => {
    const state = run(inPlay(), concede(BIDDER), concede(PARTNER));
    expect(state.gamePhase).toBe('ROUND_OVER');
    expect(state.concededBy).toBe(0);
    // The bidding side is team 0 here, so it takes the loss.
    expect(state.totalScores.team0).toBe(-1);
    expect(state.totalScores.team1).toBe(0);
  });

  it('hands the round to the bidder when the defenders give up', () => {
    const state = run(inPlay(), concede(DEFENDERS[0]), concede(DEFENDERS[1]));
    expect(state.gamePhase).toBe('ROUND_OVER');
    expect(state.concededBy).toBe(1);
    expect(state.totalScores.team0).toBe(1);
    expect(state.totalScores.team1).toBe(0);
  });

  it('pays the stake that was agreed, without a sweep', () => {
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
      { type: 'DOUBLE', payload: { playerIndex: DEFENDERS[0] } },
      { type: 'REDOUBLE', payload: { playerIndex: BIDDER } },
      concede(BIDDER),
      concede(PARTNER),
    );
    // x4 from the redouble; nobody swept anything, so no sweep on top.
    expect(state.totalScores.team0).toBe(-4);
  });

  it('does not claim the bid was made or missed on points', () => {
    const state = run(inPlay(), concede(BIDDER), concede(PARTNER));
    expect(state.gameLog.join('\n')).toContain('gave up the round');
    expect(state.gameLog.join('\n')).not.toContain('missed the bid');
    expect(state.gameLog.join('\n')).not.toContain('made the bid');
  });

  it('ends the match when the handed-over round is the last one needed', () => {
    // Only the bidding side's total moves, so this is team 0 one point short.
    const nearlyWon: GameState = { ...inPlay(), totalScores: { team0: 5, team1: 0 } };
    const state = run(nearlyWon, concede(DEFENDERS[0]), concede(DEFENDERS[1]));
    expect(state.totalScores.team0).toBe(6);
    expect(state.gamePhase).toBe('GAME_OVER');
  });

  it('ends the match when a side gives up its way to the bottom', () => {
    const nearlyLost: GameState = { ...inPlay(), totalScores: { team0: -5, team1: 0 } };
    const state = run(nearlyLost, concede(BIDDER), concede(PARTNER));
    expect(state.totalScores.team0).toBe(-6);
    expect(state.gamePhase).toBe('GAME_OVER');
  });
});

describe('the next round', () => {
  it('clears the offers', () => {
    const given = run(inPlay(), concede(BIDDER), concede(PARTNER));
    const next = gameReducer(given, { type: 'START_ROUND' });
    expect(next.concedeVotes).toEqual([]);
    expect(next.concededBy).toBeNull();
    expect(next.gamePhase).toBe('BIDDING');
  });
});
