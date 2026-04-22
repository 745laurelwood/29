import React from 'react';
import { CardComponent } from './CardComponent';
import { RoyalsOverlay } from './panels';
import { useGame } from '../GameContext';
import { SUIT_SYMBOLS } from '../constants';
import { SUIT_NAMES } from '../rules';
import { compareCardStrength } from '../rules';
import { Suit } from '../types';

/** Modals + transient overlays rendered by both mobile and desktop. */
export const SharedOverlays: React.FC = () => {
  const {
    state, myIndex,
    showMyCaptures, setShowMyCaptures,
    isPaused, isDisconnected, offlinePlayers,
    executeDeclareRoyals, executeDeclineRoyals,
    executeRevealTrump, executeDeclineReveal, needRevealDecision,
    revealPhase,
  } = useGame();

  const me = state.players[myIndex];

  const showTrumpToast = revealPhase === 'trump-toast' && !!state.trumpSuit;
  const royalsPromptReady = revealPhase === 'royals-prompt' && !!me && !!state.trumpSuit;
  const showRoyalsAnim = revealPhase === 'royals-toast' && !!state.royalsDeclared;

  // Delay the reveal-trump and royals prompts by 1s so the player can see the
  // previous card's play-animation settle before the modal pops up.
  const PROMPT_DELAY_MS = 1000;
  const [revealPromptVisible, setRevealPromptVisible] = React.useState(false);
  const [royalsPromptVisible, setRoyalsPromptVisible] = React.useState(false);
  React.useEffect(() => {
    if (!needRevealDecision) { setRevealPromptVisible(false); return; }
    const t = window.setTimeout(() => setRevealPromptVisible(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [needRevealDecision]);
  React.useEffect(() => {
    if (!royalsPromptReady) { setRoyalsPromptVisible(false); return; }
    const t = window.setTimeout(() => setRoyalsPromptVisible(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [royalsPromptReady]);

  const showRevealPrompt = needRevealDecision && revealPromptVisible;
  const showRoyalsPrompt = royalsPromptReady && royalsPromptVisible;

  return (
    <>
      {showMyCaptures && me && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setShowMyCaptures(false)}
        >
          <div
            className="glass-panel p-5 sm:p-7 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5 pb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              <div>
                <h2 className="text-xl sm:text-2xl font-display" style={{ color: 'var(--accent)' }}>Your Captures</h2>
                <p className="text-xs mt-0.5 uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
                  {me.tricksWon} {me.tricksWon === 1 ? 'trick' : 'tricks'} · {me.capturedCards.length} cards
                </p>
              </div>
              <button
                onClick={() => setShowMyCaptures(false)}
                className="p-2 rounded-full transition-all"
                style={{ background: 'var(--bg-1)', color: 'var(--fg-soft)', border: '1px solid var(--line)' }}
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mb-5 pr-2">
              {me.capturedCards.length === 0 ? (
                <p className="text-center py-12" style={{ color: 'var(--dim)' }}>You haven't won any tricks yet.</p>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center items-center">
                  {[...me.capturedCards]
                    .sort((a, b) => a.suit === b.suit ? compareCardStrength(b, a) : a.suit.localeCompare(b.suit))
                    .map((card, i) => (
                      <div key={card.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                        <CardComponent card={card} flipId={`mycap-${card.id}`} />
                      </div>
                    ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowMyCaptures(false)}
              className="btn-accent w-full py-3 rounded-xl text-base font-semibold uppercase tracking-wider"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showRevealPrompt && state.ledSuit && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.72)' }}
        >
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full text-center">
            <h2 className="text-xl font-display mb-2" style={{ color: 'var(--accent)' }}>Reveal trump?</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--fg-soft)' }}>
              You can't follow {SUIT_NAMES[state.ledSuit]}. Asking reveals the trump suit to everyone.
              If you reveal and hold a trump, you must play one this turn.
            </p>
            <div className="flex gap-2">
              <button
                onClick={executeDeclineReveal}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-1)', color: 'var(--fg-soft)', border: '1px solid var(--line)' }}
              >
                Play without revealing
              </button>
              <button
                onClick={executeRevealTrump}
                className="btn-accent flex-1 py-2.5 rounded-xl text-sm font-semibold"
              >
                Reveal trump
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoyalsPrompt && me && state.trumpSuit && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 1000, background: 'rgba(0,0,0,0.72)' }}
        >
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full text-center">
            <h2 className="text-xl font-display mb-2" style={{ color: 'var(--gold)' }}>Royals!</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--fg-soft)' }}>
              You hold both the K and Q of {SUIT_NAMES[state.trumpSuit]}. Declaring Royals will{' '}
              {state.players[state.bidWinner]?.team === me.team ? 'lower your team\'s bid target' : 'raise the bidder\'s target'} by 4.
            </p>
            <div className="flex gap-2">
              <button
                onClick={executeDeclineRoyals}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--bg-1)', color: 'var(--fg-soft)', border: '1px solid var(--line)' }}
              >
                Skip
              </button>
              <button
                onClick={executeDeclareRoyals}
                className="btn-accent flex-1 py-2.5 rounded-xl text-sm font-semibold"
              >
                Declare
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoyalsAnim && state.royalsDeclared && state.players[state.royalsDeclared.playerIndex] && (
        <div className="fixed inset-0 pointer-events-none z-[90] flex items-center justify-center">
          <RoyalsOverlay
            playerName={state.players[state.royalsDeclared.playerIndex].name}
            adjustment={state.royalsDeclared.adjustment}
          />
        </div>
      )}

      {showTrumpToast && state.trumpSuit && (() => {
        const isRed = state.trumpSuit === Suit.Hearts || state.trumpSuit === Suit.Diamonds;
        return (
          <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] pointer-events-none">
            <div
              className="px-5 py-2.5 rounded-full animate-fade-in flex items-center gap-3"
              style={{
                background: '#faf9f5',
                border: '1px solid rgba(0,0,0,0.12)',
                color: '#111',
                fontWeight: 600,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              <span>Trump revealed</span>
              <span
                style={{
                  fontSize: '1.6em',
                  lineHeight: 1,
                  color: isRed ? '#c0303b' : '#111',
                }}
              >
                {SUIT_SYMBOLS[state.trumpSuit]}
              </span>
            </div>
          </div>
        );
      })()}

      {isPaused && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }}>
          <div className="glass-panel p-6 sm:p-9 rounded-2xl max-w-md w-full text-center" style={{ border: '1px solid rgba(232,146,154,0.25)' }}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-80">
              <svg className="w-full h-full" style={{ color: 'var(--red)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-display mb-3" style={{ color: 'var(--red)' }}>Connection Lost!</h2>
            {isDisconnected ? (
              <p className="text-sm sm:text-base mb-6" style={{ color: 'var(--fg-soft)' }}>
                Connection dropped. Refresh the page and you'll be offered a Resume option to rejoin room <span className="font-mono" style={{ color: 'var(--fg)' }}>{state.roomId}</span>.
              </p>
            ) : (
              <p className="text-sm sm:text-base mb-6" style={{ color: 'var(--fg-soft)' }}>
                Waiting for {offlinePlayers.map(p => p.name).join(', ')} to securely reconnect...
              </p>
            )}
            <div className="flex gap-4 justify-center">
              <div
                className="px-5 py-1.5 rounded-full tracking-[0.14em] text-xs font-semibold"
                style={{ background: 'rgba(232,146,154,0.08)', border: '1px solid rgba(232,146,154,0.3)', color: 'var(--red)' }}
              >
                GAME PAUSED
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
