import React from 'react';
import { CardComponent } from './CardComponent';
import { useGame } from '../GameContext';
import { TEAM_BADGE_CLASSES, TEAM_LABELS } from '../constants';
import { compareCardStrength, NUM_PLAYERS } from '../rules';

type Position = 'bottom' | 'left' | 'top' | 'right';

interface PlayerHandProps {
  playerIndex: number;
  position: Position;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({ playerIndex, position }) => {
  const {
    state, myIndex,
    setShowMyCaptures,
    legalCardIds,
    sweepingToPlayer,
    executePlayCard,
    revealPhase,
  } = useGame();

  if (!state.players[playerIndex]) return null;
  const player = state.players[playerIndex];
  const isMe = playerIndex === myIndex;
  const isCurrentTurn = state.currentTurn === playerIndex
    && state.gamePhase === 'PLAYING'
    && state.currentTrick.length < NUM_PLAYERS
    && revealPhase === 'idle';
  const isMyBidTurn = state.gamePhase === 'BIDDING' && state.biddingTurn === playerIndex;

  const wrapperRotation = position === 'left' ? 'rotate-90' : position === 'right' ? '-rotate-90' : '';
  const wrapperScale = position !== 'bottom' ? 'scale-75' : '';
  const compactClass = !isMe ? 'opp-compact' : '';

  const isReceivingSweep = sweepingToPlayer === playerIndex;
  const sweepCards = isReceivingSweep ? player.capturedCards.slice(-4) : [];

  const trickCardIds = new Set(state.currentTrick.map(p => p.card.id));

  return (
    <div className="relative">
      {sweepCards.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          {sweepCards.map((card, i) => (
            <div
              key={card.id}
              className="absolute"
              style={{
                top: -20 + i * 2,
                left: -20 + i * 2,
                transform: `rotate(${(i - 1.5) * 4}deg)`,
              }}
            >
              <CardComponent card={card} />
            </div>
          ))}
        </div>
      )}
      <div className={`flex flex-col items-center py-2 px-1 ${wrapperRotation} ${wrapperScale} ${compactClass}`}>
        <div className="mb-1 font-display flex flex-col items-center" style={{ color: 'var(--fg)' }}>
          <div className="flex items-center gap-2 leading-tight">
            {isMe && player.capturedCards.length > 0 ? (
              <button
                onClick={() => setShowMyCaptures(true)}
                className="text-xs sm:text-sm px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer opp-count"
                style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--fg-soft)' }}
                title="View your captured cards"
              >
                {player.tricksWon} {player.tricksWon === 1 ? 'trick' : 'tricks'}
              </button>
            ) : (
              <span
                className="text-xs sm:text-sm px-2 py-0.5 rounded-full whitespace-nowrap opp-count"
                style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--dim)' }}
              >
                {player.tricksWon} {player.tricksWon === 1 ? 'trick' : 'tricks'}
              </span>
            )}
            <span className="text-lg sm:text-2xl md:text-3xl opp-name">{player.name}</span>
            <span
              className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md uppercase tracking-wider ${TEAM_BADGE_CLASSES[player.team as 0 | 1]}`}
              title={`Team ${TEAM_LABELS[player.team as 0 | 1]}`}
            >
              {TEAM_LABELS[player.team as 0 | 1]}
            </span>
            {state.bidWinner === playerIndex && state.gamePhase !== 'BIDDING' && (
              <span
                className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                style={{ background: 'rgba(216,176,97,0.15)', color: 'var(--gold)' }}
                title="Bidder"
              >
                Bidder
              </span>
            )}
            {(isCurrentTurn || isMyBidTurn) && (
              <span
                className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full animate-accent-pulse whitespace-nowrap"
                style={{
                  background: 'var(--accent)', color: '#06121f',
                  boxShadow: '0 0 14px rgba(111,176,255,0.55)',
                  fontWeight: 600, letterSpacing: '0.04em',
                }}
              >
                {isMe ? 'Your Turn' : 'Thinking'}
              </span>
            )}
          </div>
        </div>

        {(() => {
          const visibleHand = [...player.hand]
            .filter(c => !trickCardIds.has(c.id))
            .sort((a, b) => a.suit === b.suit ? compareCardStrength(b, a) : a.suit.localeCompare(b.suit));
          const showEmpty = visibleHand.length === 0
            && state.gamePhase !== 'GAME_OVER'
            && state.gamePhase !== 'ROUND_OVER'
            && state.gamePhase !== 'BIDDING'
            && state.gamePhase !== 'CHOOSING_TRUMP';
          const emptyPlaceholder = (
            <div
              className="w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-lg flex items-center justify-center text-xs"
              style={{ border: '2px dashed var(--line)', color: 'var(--dimmer)' }}
            >
              Empty
            </div>
          );
          return isMe ? (
            <div className="hand-scroll no-scrollbar">
              <div className="flex items-end -space-x-6 sm:-space-x-8 transition-all duration-300 shrink-0">
                {visibleHand.map(card => {
                  const isLegal = legalCardIds.has(card.id);
                  const dimmed = state.gamePhase === 'PLAYING' && isCurrentTurn && !isLegal;
                  return (
                    <CardComponent
                      key={card.id}
                      card={card}
                      faceDown={false}
                      isPlayable={isCurrentTurn && isLegal}
                      isDimmed={dimmed}
                      onClick={isCurrentTurn && isLegal ? () => executePlayCard(card.id) : undefined}
                    />
                  );
                })}
                {showEmpty && emptyPlaceholder}
              </div>
            </div>
          ) : (
            <div className="flex opp-cards -space-x-6 sm:-space-x-8 transition-all duration-300">
              {visibleHand.map(card => (
                <CardComponent
                  key={card.id}
                  card={card}
                  faceDown={state.gamePhase !== 'GAME_OVER'}
                  isPlayable={false}
                  isSelected={false}
                />
              ))}
              {showEmpty && emptyPlaceholder}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
