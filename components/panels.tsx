import React, { useEffect, useRef, useState } from 'react';
import { FeltFooterSlot } from '@laurelwood/card-class';
import { GameState, Suit } from '../types';
import {
  SUIT_SYMBOLS,
  Z_HUD, Z_ACTION_BAR, Z_OVERLAY, Z_MODAL,
} from '../constants';
import { MAX_BID, getPointsForCard, getStakeMultiplier } from '../rules';

// The game log, chat, last-move banner and suit colouring now come from
// @laurelwood/card-class. What's left here is the chrome that only makes
// sense in 29: the HUD, the trump badge, Royals and the bidding controls.

/** HUD panel — game-points, bid, trump, tricks. */
export function HUD({
  state, isMultiplayer, roomId, myIndex,
}: {
  state: GameState; isMultiplayer: boolean; roomId: string; myIndex: number;
}) {
  const [copied, setCopied] = useState(false);
  const copyRoom = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };

  const total0 = state.totalScores.team0;
  const total1 = state.totalScores.team1;
  const lead = total0 - total1;
  const leadingTeam: 0 | 1 | null = lead > 0 ? 0 : lead < 0 ? 1 : null;

  const team0IsLeader = leadingTeam === 0;
  const team1IsLeader = leadingTeam === 1;

  const sumTeamRoundPts = (team: 0 | 1) =>
    state.players
      .filter(p => p.team === team)
      .reduce((sum, p) => sum + p.capturedCards.reduce((s, c) => s + getPointsForCard(c), 0), 0);
  const roundPts0 = sumTeamRoundPts(0);
  const roundPts1 = sumTeamRoundPts(1);

  const bidder = state.bidWinner >= 0 ? state.players[state.bidWinner] : null;
  const stakeMultiplier = getStakeMultiplier({
    doubled: state.doubledBy >= 0,
    redoubled: state.redoubledBy >= 0,
  });
  const showTrumpToMe = !!(state.trumpSuit && (state.trumpRevealed || myIndex === state.bidWinner));

  return (
    <div className="glass-panel px-3 py-2 sm:px-4 sm:py-3 rounded-2xl isolate" style={{ zIndex: Z_HUD }}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-stretch gap-0.5 rounded-full pill-chip p-0.5 sm:p-1">
          <div className={`flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full transition-colors ${team0IsLeader ? 'bg-[color:var(--bg-2)] ring-1 ring-[color:var(--line)]' : ''}`}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--accent)' }}>A</span>
            <span className="font-display text-sm sm:text-base leading-none tabular-nums" style={{ color: 'var(--accent)' }}>
              {total0}
              {state.gamePhase === 'PLAYING' && (
                <span style={{ fontWeight: 400, opacity: 0.75 }}> ({roundPts0})</span>
              )}
            </span>
          </div>
          <div className="w-px my-1" style={{ background: 'var(--line)' }} />
          <div className={`flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full transition-colors ${team1IsLeader ? 'bg-[color:var(--bg-2)] ring-1 ring-[color:var(--line)]' : ''}`}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--red)' }}>B</span>
            <span className="font-display text-sm sm:text-base leading-none tabular-nums" style={{ color: 'var(--red)' }}>
              {total1}
              {state.gamePhase === 'PLAYING' && (
                <span style={{ fontWeight: 400, opacity: 0.75 }}> ({roundPts1})</span>
              )}
            </span>
          </div>
          <div className="w-px my-1" style={{ background: 'var(--line)' }} />
          <div className="flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full">
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>Bid</span>
            <span
              className="font-display text-sm sm:text-base leading-none tabular-nums"
              style={{
                color: bidder
                  ? (bidder.team === 0 ? 'var(--accent)' : 'var(--red)')
                  : 'var(--dim)',
              }}
            >
              {bidder ? `${state.bidValue + state.bidAdjustment}` : '-'}
            </span>
          </div>
        </div>
      </div>

      {(bidder || showTrumpToMe || state.gamePhase === 'PLAYING' || (isMultiplayer && roomId)) && (
        <div className="mt-2 flex flex-col gap-y-1 text-[14px]" style={{ color: 'var(--dim)' }}>
          {bidder && (
            <div>
              <span className="text-[color:var(--fg)]">{bidder.name}</span>
              <span> bid </span>
              <span style={{ color: bidder.team === 0 ? 'var(--accent)' : 'var(--red)' }}>
                {state.bidValue}{state.bidAdjustment !== 0 ? ` → ${state.bidValue + state.bidAdjustment}` : ''}
              </span>
              {stakeMultiplier > 1 && (
                <span
                  className="ml-2 px-1.5 rounded font-semibold tabular-nums"
                  title={state.redoubledBy >= 0 ? 'Redoubled' : 'Doubled'}
                  style={{
                    background: 'rgba(232,146,154,0.18)',
                    color: 'var(--red)',
                    border: '1px solid rgba(232,146,154,0.55)',
                  }}
                >
                  x{stakeMultiplier}
                </span>
              )}
            </div>
          )}
          {isMultiplayer && roomId && (
            <div className="flex items-center gap-x-3">
              <button
                onClick={copyRoom}
                title="Click to copy"
                className="ml-auto font-mono hover:text-[color:var(--accent)] transition-colors"
              >
                {copied ? 'Copied!' : roomId}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Reveal-trump button — occupies the same slot as LastMoveBanner. Shown when
 * the local player can't follow suit and trump isn't yet revealed. Declining
 * is implicit — just play a card normally, except in the `forced` case, where
 * the only card left is the bidder's own hidden seventh card and their hand is
 * dimmed to nothing until they reveal. */
export function RevealTrumpButton({ onClick, forced = false }: { onClick: () => void; forced?: boolean }) {
  return (
    <FeltFooterSlot>
      <button
        onClick={onClick}
        title={forced
          ? 'Your only playable card is the seventh card — trump must be revealed before you can play it.'
          : 'Ask the bidder to declare trump. If you hold a trump, you must play one.'}
        className={`rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 active:scale-95 ${forced ? 'animate-pulse' : ''}`}
        style={{
          // Forced: the whole hand is dimmed, so this button is the only thing
          // to click — turn it up so it doesn't read as an optional aside.
          background: forced ? 'rgba(216,176,97,0.30)' : 'rgba(216,176,97,0.18)',
          color: 'var(--gold)',
          border: `1px solid rgba(216,176,97,${forced ? 0.9 : 0.55})`,
          boxShadow: `0 2px 12px rgba(216,176,97,${forced ? 0.45 : 0.25})`,
          letterSpacing: '0.04em',
        }}
      >
        {forced ? 'Reveal trump to play' : 'Reveal trump'}
      </button>
    </FeltFooterSlot>
  );
}

/** Persistent badge showing the revealed trump suit (and any declared Royals)
 *  in the top-left of the felt. */
export function TrumpBadge({ suit, royalsName }: { suit: Suit; royalsName?: string }) {
  const isRed = suit === Suit.Hearts || suit === Suit.Diamonds;
  return (
    <div
      className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 px-3 py-1.5 rounded-xl flex flex-col items-start gap-0.5 pointer-events-none"
      style={{
        background: 'var(--felt)',
        border: '1px solid var(--felt-rim)',
        color: 'var(--fg)',
        fontWeight: 600,
        fontSize: '0.9rem',
        boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
      }}
    >
      <div className="flex items-center gap-2">
        <span>Trump</span>
        <span style={{ fontSize: '1.3em', lineHeight: 1, color: isRed ? '#ff7c85' : 'var(--fg)' }}>
          {SUIT_SYMBOLS[suit]}
        </span>
      </div>
      {royalsName && (
        <div className="flex items-center gap-1" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold)' }}>
          <span>{royalsName} 👑</span>
        </div>
      )}
    </div>
  );
}

/** Royals animation overlay. */
export function RoyalsOverlay({ playerName, adjustment }: { playerName: string; adjustment: number }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: Z_OVERLAY }}
    >
      <div
        className="animate-fade-in text-center px-8 py-5 sm:px-10 sm:py-6 rounded-2xl"
        style={{
          background: 'rgba(10, 14, 20, 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1px solid rgba(216,176,97,0.35)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="text-4xl sm:text-5xl md:text-7xl font-display tracking-wide"
          style={{ color: 'var(--gold)', textShadow: '0 0 12px rgba(216,176,97,0.45)' }}
        >
          👑 ROYALS 👑
        </div>
        <div className="text-lg sm:text-xl md:text-2xl mt-2 tracking-normal" style={{ color: 'var(--fg)' }}>
          {playerName} · bid {adjustment > 0 ? '+' : ''}{adjustment}
        </div>
      </div>
    </div>
  );
}

/** Bidding controls: tappable number chips (scrollable) + gavel (bid) + X (pass). */
export function BiddingControls({
  minBidAmount, onBid, onPass, disabled,
}: {
  minBidAmount: number;
  onBid: (amount: number) => void;
  onPass: () => void;
  disabled?: boolean;
}) {
  // No default selection. A chip only becomes "selected" (blue) when the
  // player explicitly taps it. When the minimum valid bid rises above the
  // current selection (someone else just bid higher), or when the turn
  // switches away (disabled flips true), the selection clears.
  const [amount, setAmount] = useState<number | null>(null);

  const range = React.useMemo(() => {
    const arr: number[] = [];
    for (let i = minBidAmount; i <= MAX_BID; i++) arr.push(i);
    return arr;
  }, [minBidAmount]);

  React.useEffect(() => {
    setAmount(prev => (prev != null && prev >= minBidAmount && prev <= MAX_BID ? prev : null));
  }, [minBidAmount]);

  React.useEffect(() => {
    if (disabled) setAmount(null);
  }, [disabled]);

  // Convert vertical mouse-wheel into horizontal scroll on desktop, so the bid
  // chips are reachable without a visible scrollbar. Trackpad horizontal
  // gestures (deltaX) pass through untouched. Only intercept when we have
  // remaining room in the requested direction, so the page can keep scrolling
  // once the chip strip hits its end.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= max && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const canBid = !disabled && amount != null && amount >= minBidAmount && amount <= MAX_BID;

  return (
    <div
      className="w-full flex items-stretch justify-center gap-2"
      style={{ zIndex: Z_ACTION_BAR, height: 52 }}
    >
      {/* Number chips — horizontally scrollable. Tap any chip to select it.
         `mask-image` fades the actual chip content near the edges, which
         serves as a scroll-affordance without overlapping any chip. */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          width: '10rem',
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(111,176,255,0.45)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.22)',
        }}
      >
        <div
          ref={scrollerRef}
          className="h-full overflow-x-auto no-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
            maskImage:
              'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)',
          }}
        >
          <div
            className="flex h-full items-center gap-1.5 px-2"
          >
            {range.map(n => {
              const selected = n === amount;
              return (
                <button
                  key={n}
                  onClick={() => setAmount(n)}
                  disabled={disabled}
                  className="font-display tabular-nums transition-all active:scale-95 flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 36,
                    borderRadius: 10,
                    fontSize: selected ? '1.15rem' : '0.95rem',
                    fontWeight: 500,
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: selected ? '#06121f' : 'var(--fg-soft)',
                    border: selected ? '1px solid var(--accent)' : '1px solid transparent',
                    boxShadow: selected ? '0 2px 8px rgba(111,176,255,0.35)' : 'none',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bid (gavel icon) */}
      <button
        onClick={() => { if (amount != null) onBid(amount); }}
        disabled={!canBid}
        title={amount != null ? `Bid ${amount}` : 'Select a number to bid'}
        aria-label={amount != null ? `Bid ${amount}` : 'Bid'}
        className={`rounded-2xl flex items-center justify-center transition-all active:scale-[0.96] ${
          canBid ? 'hover:brightness-110' : 'cursor-not-allowed opacity-50'
        }`}
        style={{
          width: 52,
          height: 52,
          background: 'rgba(111,176,255,0.15)',
          color: 'var(--accent)',
          border: '1px solid rgba(111,176,255,0.45)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
          <path d="m16 16 6-6" />
          <path d="m8 8 6-6" />
          <path d="m9 7 8 8" />
          <path d="m21 11-8-8" />
        </svg>
      </button>

      {/* Pass (X icon) */}
      <button
        onClick={onPass}
        disabled={disabled}
        title="Pass"
        aria-label="Pass"
        className={`rounded-2xl flex items-center justify-center transition-all active:scale-[0.96] ${
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110'
        }`}
        style={{
          width: 52,
          height: 52,
          background: 'rgba(232,146,154,0.15)',
          color: 'var(--red)',
          border: '1px solid rgba(232,146,154,0.45)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Give-up control. Both members of a side have to offer before the round is
 * handed over, so this reads as an offer rather than a button that ends the
 * game: it says what it is waiting for, and stays withdrawable until the
 * partner matches it.
 */
export function ConcedeControl({
  offered, partnerOffered, partnerName, onToggle,
}: {
  offered: boolean;
  partnerOffered: boolean;
  partnerName?: string;
  onToggle: () => void;
}) {
  const label = offered
    ? (partnerName ? `Waiting for ${partnerName}` : 'Offered — waiting')
    : partnerOffered
      ? `Agree to give up`
      : 'Give up';
  const title = offered
    ? 'You have offered to give up this round. Click to take it back.'
    : partnerOffered
      ? 'Your partner has offered to give up. Agreeing ends the round and the opponents take it.'
      : 'Offer to give up the round. It only counts once your partner agrees too.';

  // The partner's open offer is the one state worth pulling the eye, since it
  // is the only one waiting on this player.
  const urgent = partnerOffered && !offered;
  return (
    <button
      onClick={onToggle}
      title={title}
      className={`pill-chip px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${urgent ? 'animate-accent-pulse' : ''}`}
      style={{
        zIndex: Z_HUD,
        color: offered || urgent ? 'var(--red)' : 'var(--dim)',
        borderColor: offered || urgent ? 'rgba(232,146,154,0.55)' : undefined,
        background: offered || urgent ? 'rgba(232,146,154,0.12)' : undefined,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
