import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, GameState, Suit } from '../types';
import {
  SUIT_SYMBOLS,
  CHAT_MAX_LEN,
  Z_HUD, Z_ACTION_BAR, Z_OVERLAY, Z_MODAL,
} from '../constants';
import { MAX_BID, getPointsForCard } from '../rules';

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
              <span style={{ color: 'var(--accent)' }}>
                {state.bidValue}{state.bidAdjustment !== 0 ? ` → ${state.bidValue + state.bidAdjustment}` : ''}
              </span>
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

/** "Last move" banner — pinned to the bottom edge of the table felt. */
export function LastMoveBanner({ message }: { message: string }) {
  return (
    <div
      className="last-move-banner-wrap absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 max-w-[92vw]"
      style={{ zIndex: Z_HUD + 5 }}
    >
      <div
        className="last-move-banner pill-chip rounded-full px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 whitespace-nowrap overflow-hidden"
        style={{ background: 'var(--bg-2)' }}
      >
        <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] font-bold shrink-0" style={{ color: 'var(--accent)' }}>Last</span>
        <span className="text-xs sm:text-sm truncate" style={{ color: 'var(--fg-soft)' }}>{message}</span>
      </div>
    </div>
  );
}

/** Game log — pill chip expands to side panel / bottom sheet */
export function GameLog({ entries, logEndRef }: { entries: string[]; logEndRef: React.RefObject<HTMLDivElement | null> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const latest = entries[entries.length - 1] ?? '';

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        title="Show game log"
        className="pill-chip pl-3 pr-2 py-1.5 flex items-center gap-2 hover:bg-[color:var(--bg-2)] transition-colors max-w-[min(55vw,320px)]"
        style={{ zIndex: Z_HUD, color: 'var(--fg-soft)' }}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] shrink-0 font-bold" style={{ color: 'var(--accent)' }}>Log</span>
        <span className="text-xs truncate">{latest}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="glass-panel rounded-2xl flex flex-col w-[min(90vw,380px)]"
      style={{ zIndex: Z_HUD, color: 'var(--fg)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--accent)' }}>Game Log</span>
        <button
          onClick={() => setIsExpanded(false)}
          title="Collapse"
          className="transition-colors p-1 -mr-1 rounded hover:bg-[color:var(--bg-2)]"
          style={{ color: 'var(--dim)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div
        className="px-4 py-2 max-h-72 overflow-y-auto flex flex-col"
        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%)' }}
      >
        <div className="mt-auto flex flex-col pt-6">
          {entries.map((log, i) => {
            const isLatest = i === entries.length - 1;
            return (
              <div
                key={i}
                className="py-2 leading-snug animate-fade-in text-[13px]"
                style={{
                  color: isLatest ? 'var(--fg)' : 'var(--fg-soft)',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--line-soft)' : 'none',
                }}
              >
                {log}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
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

/** Chat room — pill chip expands to side panel. Desktop counterpart to GameLog. */
export function ChatRoom({ messages, myIndex, unread, onOpen, onClose, onSend }: {
  messages: ChatMessage[];
  myIndex: number;
  unread: number;
  onOpen: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latest = messages[messages.length - 1];

  useEffect(() => {
    if (!isExpanded) return;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    // While expanded, incoming messages are treated as read immediately.
    onOpen();
  }, [messages, isExpanded, onOpen]);

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  const expand = () => { setIsExpanded(true); onOpen(); };
  const collapse = () => { setIsExpanded(false); onClose(); };
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  if (!isExpanded) {
    const previewText = latest ? `${latest.name}: ${latest.text}` : 'No messages yet';
    return (
      <button
        onClick={expand}
        title="Open chat"
        className="pill-chip pl-3 pr-2 py-1.5 flex items-center gap-2 hover:bg-[color:var(--bg-2)] transition-colors max-w-[min(55vw,320px)] relative"
        style={{ zIndex: Z_HUD, color: 'var(--fg-soft)' }}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] shrink-0 font-bold" style={{ color: 'var(--accent)' }}>Chat</span>
        <span className="text-xs truncate">{previewText}</span>
        {unread > 0 && (
          <span
            className="inline-flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 px-1.5"
            style={{ minWidth: 18, height: 18, background: 'var(--accent)', color: '#06121f' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="glass-panel rounded-2xl flex flex-col w-[min(90vw,400px)]"
      style={{ zIndex: Z_HUD, color: 'var(--fg)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--accent)' }}>Chat</span>
        <button
          onClick={collapse}
          title="Collapse"
          className="transition-colors p-1 -mr-1 rounded hover:bg-[color:var(--bg-2)]"
          style={{ color: 'var(--dim)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div
        ref={scrollRef}
        className="px-4 py-2 max-h-80 overflow-y-auto flex flex-col"
        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%)' }}
      >
        <div className="mt-auto flex flex-col pt-6 gap-1.5">
          {messages.length === 0 && (
            <div className="py-3 text-[13px]" style={{ color: 'var(--dim)' }}>No messages yet. Say hi!</div>
          )}
          {messages.map(m => {
            const mine = m.playerIndex === myIndex;
            const nameColor = m.team === 0 ? 'var(--accent)' : 'var(--red)';
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: nameColor }}>
                  {mine ? 'You' : m.name}
                </span>
                <span
                  className="text-[14px] leading-snug px-3 py-1.5 rounded-xl max-w-[85%] break-words whitespace-pre-wrap"
                  style={{
                    background: mine ? 'rgba(46, 72, 108, 0.9)' : 'rgba(28, 48, 74, 0.9)',
                    border: '1px solid var(--line-soft)',
                    color: 'var(--fg)',
                  }}
                >
                  {m.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LEN}
          placeholder="Type a message..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          name="nine-chat-input"
          className="flex-1 bg-transparent outline-none text-[14px]"
          style={{ color: 'var(--fg)' }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="text-sm font-semibold px-4 py-1.5 rounded-full transition-colors"
          style={{
            background: draft.trim() ? 'var(--accent)' : 'var(--bg-2)',
            color: draft.trim() ? '#06121f' : 'var(--dimmer)',
            border: '1px solid var(--line)',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

