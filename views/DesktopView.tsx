import React from 'react';
import { HUD, GameLog, LastMoveBanner, TrumpBadge } from '../components/panels';
import { FeltContent } from '../components/FeltContent';
import { PlayerHand } from '../components/PlayerHand';
import { SharedOverlays } from '../components/SharedOverlays';
import { useGame } from '../GameContext';
import { Z_HUD } from '../constants';

export const DesktopView: React.FC = () => {
  const {
    state, isMultiplayer, myIndex,
    topPlayer, leftPlayer, rightPlayer, bottomPlayer,
    logEndRef,
    revealPhase,
  } = useGame();

  const royalsName = state.royalsDeclared
    ? state.players[state.royalsDeclared.playerIndex]?.name
    : undefined;

  return (
    <>
      <div className="game-grid royal-bg relative">
        <div
          className="fixed left-0 right-0 flex items-start justify-between gap-2 p-2 sm:p-3 pointer-events-none"
          style={{ zIndex: Z_HUD, top: 'var(--safe-t)' }}
        >
          <div className="pointer-events-auto">
            <HUD state={state} isMultiplayer={isMultiplayer} roomId={state.roomId || ''} myIndex={myIndex} />
          </div>
          <div className="pointer-events-auto flex justify-end">
            <GameLog entries={state.gameLog} logEndRef={logEndRef} />
          </div>
        </div>

        <div className="game-area-top flex items-start justify-center pt-3 sm:pt-4">
          {topPlayer !== -1 && <PlayerHand playerIndex={topPlayer} position="top" />}
        </div>

        <div className="game-area-left flex items-center justify-center">
          {leftPlayer !== -1 && <PlayerHand playerIndex={leftPlayer} position="left" />}
        </div>

        <div className="game-area-center flex items-stretch justify-center px-2 sm:px-4 pt-2 sm:pt-3 pb-4 sm:pb-6 min-h-0 min-w-0">
          <div
            className="relative w-full max-w-5xl h-full table-felt rounded-[1.25rem] sm:rounded-[2rem] flex items-center justify-center p-3 sm:p-6 min-h-0"
            style={{ border: '1px solid var(--line)', boxShadow: '0 18px 40px rgba(0,0,0,0.55), inset 0 0 40px rgba(0,0,0,0.45)' }}
          >
            <div className="absolute inset-2 rounded-[1rem] sm:rounded-[1.5rem] pointer-events-none" style={{ border: '1px solid rgba(111,176,255,0.05)' }} />

            {state.gamePhase === 'PLAYING' && state.trumpRevealed && state.trumpSuit && revealPhase === 'idle' && (
              <TrumpBadge suit={state.trumpSuit} royalsName={royalsName} />
            )}

            {state.gameLog.length > 0 && (state.gamePhase === 'PLAYING' || state.gamePhase === 'BIDDING') && (
              <LastMoveBanner message={state.gameLog[state.gameLog.length - 1]} />
            )}

            <div className="flex items-center justify-center w-full h-full z-10">
              <FeltContent />
            </div>
          </div>
        </div>

        <div className="game-area-right flex items-center justify-center">
          {rightPlayer !== -1 && <PlayerHand playerIndex={rightPlayer} position="right" />}
        </div>

        <div className="game-area-bottom flex items-end justify-center pt-3 sm:pt-4 pb-4 sm:pb-6">
          {bottomPlayer !== -1 && <PlayerHand playerIndex={bottomPlayer} position="bottom" />}
        </div>
      </div>
      <SharedOverlays />
    </>
  );
};
