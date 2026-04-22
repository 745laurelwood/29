import React from 'react';
import { CardComponent } from './CardComponent';
import { BiddingControls } from './panels';
import { useGame } from '../GameContext';
import { Suit } from '../types';
import {
  SUIT_SYMBOLS, SUIT_COLORS,
  TEAM_LABELS, TEAM_TEXT_COLORS,
} from '../constants';
import { SUIT_NAMES, NUM_TRICKS } from '../rules';
import { clearSession } from '../utils/session';

/** Felt contents — bidding / trump choice / current-trick cards. */
export const FeltContent: React.FC = () => {
  const {
    state, myIndex, isHost, handleDispatch,
    canChooseTrump, executeChooseTrump,
    canBid, minBidAmount, executeBid, executePass,
    leftPlayer, rightPlayer, topPlayer, bottomPlayer,
  } = useGame();

  // ── GAME OVER ──
  if (state.gamePhase === 'GAME_OVER') {
    const { totalScores } = state;
    const winningTeam: 0 | 1 = totalScores.team0 >= totalScores.team1 ? 0 : 1;
    const teamMembers = (t: 0 | 1) => state.players.filter(p => p.team === t).map(p => p.name);
    const readySet = new Set(state.readyForLobbyIndices || []);
    const humanPlayers = state.players.filter(p => p.isHuman);
    const totalHumans = humanPlayers.length;
    const readyHumans = humanPlayers.filter(p => readySet.has(p.id)).length;
    const iAmReady = readySet.has(myIndex);

    return (
      <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 py-6 sm:py-8 max-w-xl w-full">
        <div className="text-center">
          <div className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Game Over</div>
          <div className={`mt-1 text-xl sm:text-2xl font-display ${TEAM_TEXT_COLORS[winningTeam]}`}>
            Team {TEAM_LABELS[winningTeam]} Wins!
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
          {([0, 1] as const).map(team => {
            const label = `Team ${TEAM_LABELS[team]}`;
            const total = team === 0 ? totalScores.team0 : totalScores.team1;
            const isWinner = team === winningTeam;
            return (
              <div
                key={team}
                className="p-3 sm:p-4 rounded-xl text-center"
                style={{
                  background: isWinner ? 'rgba(127,215,169,0.1)' : 'var(--bg-1)',
                  border: `1px solid ${isWinner ? 'rgba(127,215,169,0.4)' : 'var(--line)'}`,
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.14em] flex items-center justify-center gap-2" style={{ color: 'var(--dim)' }}>
                  <span>{label}</span>
                  {isWinner && <span className="normal-case tracking-normal" style={{ color: 'var(--good)' }}>Winner</span>}
                </div>
                <div className={`text-2xl sm:text-3xl font-display mt-1 ${TEAM_TEXT_COLORS[team]}`}>{total}</div>
                <ul className="mt-2 text-[11px] sm:text-xs space-y-0.5" style={{ color: 'var(--fg-soft)' }}>
                  {teamMembers(team).map((name, i) => (<li key={i}>{name}</li>))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => {
              if (isHost) clearSession();
              handleDispatch({ type: 'RETURN_TO_LOBBY', payload: { playerIndex: myIndex } });
            }}
            disabled={iAmReady}
            className={`px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition-all ${
              iAmReady
                ? 'text-[color:var(--dimmer)] bg-[color:var(--bg-1)]/50 border border-[color:var(--line-soft)] cursor-not-allowed'
                : 'btn-accent'
            }`}
          >
            {iAmReady ? 'Waiting for others' : 'Return to Lobby'}
          </button>
          {totalHumans > 1 && (
            <p className="text-xs" style={{ color: 'var(--dim)' }}>
              {readyHumans} / {totalHumans} ready
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── ROUND OVER ──
  if (state.gamePhase === 'ROUND_OVER') {
    const { roundScores, totalScores, bidValue, bidAdjustment, bidWinner } = state;
    const bidder = state.players[bidWinner];
    const target = bidValue + bidAdjustment;
    const bidderTeam = bidder?.team ?? 0;
    const bidderPts = bidderTeam === 0 ? roundScores.team0 : roundScores.team1;
    const bidderMade = bidderPts >= target;
    return (
      <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 py-6 sm:py-8 max-w-xl w-full">
        <div className="text-center">
          <div className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Round Complete</div>
          <div className="mt-1 text-lg sm:text-xl font-display" style={{ color: 'var(--fg)' }}>
            {bidder && (
              <>
                <span className={TEAM_TEXT_COLORS[bidderTeam]}>{bidder.name}</span>
                {bidderMade ? ' made the bid' : ' missed the bid'}
              </>
            )}
          </div>
          <div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--fg-soft)' }}>
            Target {target}{bidAdjustment !== 0 ? ` (${bidValue}${bidAdjustment > 0 ? '+' : ''}${bidAdjustment})` : ''} · Scored {bidderPts}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
          {([0, 1] as const).map(team => {
            const label = `Team ${TEAM_LABELS[team]}`;
            const round = team === 0 ? roundScores.team0 : roundScores.team1;
            const total = team === 0 ? totalScores.team0 : totalScores.team1;
            const isBidderTeam = team === bidderTeam;
            return (
              <div
                key={team}
                className="p-3 sm:p-4 rounded-xl text-center"
                style={{
                  background: isBidderTeam ? 'rgba(127,215,169,0.08)' : 'var(--bg-1)',
                  border: `1px solid ${isBidderTeam ? 'rgba(127,215,169,0.35)' : 'var(--line)'}`,
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>{label}</div>
                <div className={`text-xl sm:text-2xl font-display ${TEAM_TEXT_COLORS[team]}`}>{round}</div>
                <div className="text-[10px] mt-1 uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>Game Points</div>
                <div className={`text-base sm:text-lg font-display ${TEAM_TEXT_COLORS[team]}`}>{total}</div>
              </div>
            );
          })}
        </div>
        {isHost ? (
          <button
            onClick={() => handleDispatch({ type: 'START_ROUND' })}
            className="btn-accent px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold"
          >
            Next Round
          </button>
        ) : (
          <div className="text-xs sm:text-sm animate-pulse" style={{ color: 'var(--fg-soft)' }}>Waiting for host</div>
        )}
      </div>
    );
  }

  // ── BIDDING ──
  if (state.gamePhase === 'BIDDING') {
    const current = state.players[state.biddingTurn];
    return (
      <div className="flex flex-col items-center gap-4 sm:gap-5">
        <div className="text-sm sm:text-base uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Auction</div>
        <div className="text-xl sm:text-3xl md:text-4xl font-display" style={{ color: 'var(--fg)' }}>
          {state.currentBid == null
            ? 'No bids yet'
            : <>High bid <span style={{ color: 'var(--accent)' }}>{state.currentBid}</span> by {state.players[state.highBidder]?.name}</>
          }
        </div>
        {current && (
          <div className="text-base sm:text-lg md:text-xl animate-pulse" style={{ color: 'var(--fg-soft)' }}>
            {current.id === myIndex ? 'Your turn to bid' : `${current.name} is bidding...`}
          </div>
        )}
        <div className="mt-2" style={{ width: 'min(92vw, 28rem)' }}>
          <BiddingControls
            minBidAmount={minBidAmount}
            onBid={executeBid}
            onPass={executePass}
            disabled={!canBid}
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {state.players.map(p => {
            const passed = state.passedPlayers.includes(p.id);
            const bid = state.lastBids?.[p.id];
            const hasBid = typeof bid === 'number';
            const isHigh = p.id === state.highBidder;
            const teamColor = p.team === 0 ? 'var(--accent)' : 'var(--red)';
            return (
              <span
                key={p.id}
                className="text-sm sm:text-base px-3 py-1.5 rounded-full"
                style={{
                  background: passed ? 'var(--bg-1)' : 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  color: passed ? 'var(--dim)' : 'var(--fg-soft)',
                  textDecoration: passed ? 'line-through' : 'none',
                }}
              >
                {p.name}
                {hasBid && (
                  <span
                    style={{
                      color: teamColor,
                      marginLeft: 6,
                      fontWeight: isHigh ? 700 : 500,
                    }}
                  >
                    {bid}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CHOOSING TRUMP ──
  if (state.gamePhase === 'CHOOSING_TRUMP') {
    const chooser = state.players[state.bidWinner];
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Trump Selection</div>
        {canChooseTrump ? (
          <>
            <div className="text-base sm:text-lg font-display" style={{ color: 'var(--fg)' }}>
              Choose the Trump Suit
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {(Object.values(Suit) as Suit[]).map(suit => (
                <button
                  key={suit}
                  onClick={() => executeChooseTrump(suit)}
                  className={`
                    relative w-20 h-24 sm:w-24 sm:h-28 rounded-xl flex flex-col items-center justify-center
                    transition-all hover:-translate-y-1 active:scale-95
                    ${SUIT_COLORS[suit]}
                  `}
                  style={{
                    background: 'linear-gradient(180deg, #faf9f5 0%, #ece8de 100%)',
                    border: '1px solid var(--line)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                  }}
                  title={`Choose ${SUIT_NAMES[suit]}`}
                >
                  <div className="text-5xl sm:text-6xl">{SUIT_SYMBOLS[suit]}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] mt-1 opacity-70">{SUIT_NAMES[suit]}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm animate-pulse" style={{ color: 'var(--fg-soft)' }}>
            {chooser ? `${chooser.name} is choosing the trump...` : 'Waiting...'}
          </div>
        )}
      </div>
    );
  }

  // ── PLAYING: show current trick plays arranged around centre by position ──
  const positionFor = (playerIndex: number): 'bottom' | 'left' | 'top' | 'right' => {
    if (playerIndex === bottomPlayer) return 'bottom';
    if (playerIndex === leftPlayer) return 'left';
    if (playerIndex === topPlayer) return 'top';
    return 'right';
  };

  const positionClasses: Record<'bottom' | 'left' | 'top' | 'right', string> = {
    bottom: 'translate-y-10 sm:translate-y-14 md:translate-y-20',
    top:    '-translate-y-10 sm:-translate-y-14 md:-translate-y-20',
    left:   '-translate-x-12 sm:-translate-x-20 md:-translate-x-28',
    right:  'translate-x-12 sm:translate-x-20 md:translate-x-28',
  };

  const trickCardIds = new Set(state.currentTrick.map(p => p.card.id));

  return (
    <div className="relative w-full min-h-[160px] sm:min-h-[220px] flex items-center justify-center">
      {state.currentTrick.length === 0 && (
        <div className="text-xs sm:text-sm opacity-60" style={{ color: 'var(--fg-soft)' }}>
          Trick {state.completedTricks.length + 1} of {NUM_TRICKS}.{' '}
          {state.players[state.currentTurn]
            ? (state.currentTurn === myIndex ? 'your lead' : `${state.players[state.currentTurn].name} leads`)
            : ''
          }
        </div>
      )}
      {state.currentTrick.map(tp => {
        const pos = positionFor(tp.playerIndex);
        return (
          <div
            key={tp.card.id}
            className={`absolute transition-transform ${positionClasses[pos]}`}
          >
            <CardComponent card={tp.card} faceDown={false} />
          </div>
        );
      })}
      {/* visualThrow placeholder: the thrown card's element is already rendered
          by the hand; FLIP animates from hand to here. */}
    </div>
  );
};
