import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardComponent } from '../components/CardComponent';
import { LastMoveBanner, TrumpBadge } from '../components/panels';
import { FeltContent } from '../components/FeltContent';
import { SharedOverlays } from '../components/SharedOverlays';
import { useGame } from '../GameContext';
import { compareCardStrength, NUM_PLAYERS, getPointsForCard } from '../rules';
import { Card, ChatMessage } from '../types';
import { CHAT_MAX_LEN } from '../constants';

const DRAG_THRESHOLD_PX = 6;

function MobileChatBody({ messages, myIndex, onSend }: {
  messages: ChatMessage[];
  myIndex: number;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };
  return (
    <>
      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0,
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 6,
          paddingBottom: 8,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: '32px 0' }}>
            No messages yet. Say hi!
          </div>
        )}
        {messages.map(m => {
          const mine = m.playerIndex === myIndex;
          const nameColor = m.team === 0 ? 'var(--accent)' : 'var(--red)';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: nameColor }}>
                {mine ? 'You' : m.name}
              </span>
              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1.35,
                  padding: '6px 10px',
                  borderRadius: 12,
                  maxWidth: '85%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
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
      <form
        onSubmit={e => { e.preventDefault(); submit(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}
      >
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LEN}
          placeholder="Type a message..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          name="nine-chat-input"
          style={{ flex: 1, background: 'transparent', outline: 'none', fontSize: 16, color: 'var(--fg)' }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 999,
            background: draft.trim() ? 'var(--accent)' : 'var(--bg-2)',
            color: draft.trim() ? '#06121f' : 'var(--dimmer)',
            border: '1px solid var(--line)',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Send
        </button>
      </form>
    </>
  );
}

export const MobileView: React.FC = () => {
  const {
    state, myIndex,
    topPlayer, rightPlayer, leftPlayer, bottomPlayer,
    setShowMyCaptures,
    mobileLogOpen, setMobileLogOpen,
    mobileChatOpen, setMobileChatOpen,
    chatUnread, markChatRead, sendChat,
    mobileOpponentSource, sweepingToPlayer,
    legalCardIds, executePlayCard,
    revealPhase,
  } = useGame();

  const chatEnabled = !!state.roomId && state.players.some(p => p.isHuman && p.id !== myIndex);

  // Pin .m-phone to window.innerHeight (the LAYOUT viewport). iOS shrinks the
  // VISUAL viewport when the keyboard opens — so 100dvh collapses and
  // sometimes doesn't fully restore after the keyboard closes, leaving a dead
  // strip of empty space under the page. The layout viewport stays stable
  // across keyboard toggles, so window.innerHeight is the reliable anchor.
  useEffect(() => {
    const apply = () => {
      const phone = document.querySelector('.m-phone') as HTMLElement | null;
      if (!phone) return;
      const h = window.innerHeight;
      phone.style.height = `${h}px`;
      phone.style.maxHeight = `${h}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      const phone = document.querySelector('.m-phone') as HTMLElement | null;
      if (phone) {
        phone.style.height = '';
        phone.style.maxHeight = '';
      }
    };
  }, []);

  const closeChat = () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
    setMobileChatOpen(false);
    markChatRead();
  };

  const royalsName = state.royalsDeclared
    ? state.players[state.royalsDeclared.playerIndex]?.name
    : undefined;

  const isMyBidTurn = state.gamePhase === 'BIDDING' && state.biddingTurn === myIndex;
  const isMyPlayTurn = state.gamePhase === 'PLAYING'
    && state.currentTurn === myIndex
    && state.currentTrick.length < NUM_PLAYERS
    && revealPhase === 'idle';

  const oppIndices = [leftPlayer, topPlayer, rightPlayer].filter(i => i !== -1);
  const me = bottomPlayer !== -1 ? state.players[bottomPlayer] : null;

  const total0 = state.totalScores.team0;
  const total1 = state.totalScores.team1;

  const sumTeamRoundPts = (team: 0 | 1) =>
    state.players
      .filter(p => p.team === team)
      .reduce((sum, p) => sum + p.capturedCards.reduce((s, c) => s + getPointsForCard(c), 0), 0);
  const roundPts0 = sumTeamRoundPts(0);
  const roundPts1 = sumTeamRoundPts(1);

  const trickCardIds = new Set(state.currentTrick.map(p => p.card.id));

  // ── Drag-to-play state ──
  // A pending touch (`pendingRef`) becomes an active drag only after the pointer
  // moves past DRAG_THRESHOLD_PX. Until then the card stays put — a mild tap is
  // a no-op. Once active, the card is rendered via a portal to document.body
  // so it's guaranteed above any felt / felt-wrap stacking context.
  const feltRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{
    cardId: string; pointerId: number;
    startX: number; startY: number;
    originLeft: number; originTop: number; originWidth: number; originHeight: number;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    cardId: string;
    startX: number; startY: number;
    dx: number; dy: number;
    originLeft: number; originTop: number; originWidth: number; originHeight: number;
  } | null>(null);

  const onCardPointerDown = (card: Card) => (e: React.PointerEvent) => {
    if (!isMyPlayTurn || !legalCardIds.has(card.id)) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    pendingRef.current = {
      cardId: card.id, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      originLeft: rect.left, originTop: rect.top,
      originWidth: rect.width, originHeight: rect.height,
    };
  };

  const onCardPointerMove = (card: Card) => (e: React.PointerEvent) => {
    const p = pendingRef.current;
    if (!p || p.cardId !== card.id) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    const active = dragging && dragging.cardId === card.id;
    if (!active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      // Promote to active drag now.
      (e.currentTarget as HTMLElement).setPointerCapture(p.pointerId);
      setDragging({
        cardId: p.cardId,
        startX: p.startX, startY: p.startY,
        dx, dy,
        originLeft: p.originLeft, originTop: p.originTop,
        originWidth: p.originWidth, originHeight: p.originHeight,
      });
      return;
    }
    setDragging({ ...dragging!, dx, dy });
  };

  const onCardPointerUp = (card: Card) => (e: React.PointerEvent) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p || p.cardId !== card.id) return;
    const active = dragging && dragging.cardId === card.id;
    if (!active) return; // mild tap — no action, nothing to reset
    const rect = feltRef.current?.getBoundingClientRect();
    const insideFelt = !!rect
      && e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (insideFelt) executePlayCard(card.id);
    setDragging(null);
  };

  const onCardPointerCancel = () => {
    pendingRef.current = null;
    setDragging(null);
  };

  return (
    <>
      <div className="m-phone">
        <header className="m-hud">
          <div className="m-hud-bar">
            <button
              className="m-hud-btn m-home-btn"
              onClick={() => {
                if (confirm('Leave game and return to home?')) window.location.reload();
              }}
              title="Home"
              aria-label="Home"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9" />
                <path d="M5 10v10h14V10" />
              </svg>
            </button>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell ${total0 > total1 ? 'active lead' : ''}`}>
              <span className="label">Team A</span>
              <span className="v">
                {total0}
                {state.gamePhase === 'PLAYING' && (
                  <span style={{ fontWeight: 400, opacity: 0.7 }}> ({roundPts0})</span>
                )}
              </span>
            </div>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell b ${total1 > total0 ? 'active lead' : ''}`}>
              <span className="label">Team B</span>
              <span className="v">
                {total1}
                {state.gamePhase === 'PLAYING' && (
                  <span style={{ fontWeight: 400, opacity: 0.7 }}> ({roundPts1})</span>
                )}
              </span>
            </div>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell ${state.bidWinner >= 0 && state.players[state.bidWinner]?.team === 1 ? 'b' : ''} ${state.bidValue > 0 ? 'lead' : ''}`}>
              <span className="label">Bid</span>
              <span className="v">
                {state.bidValue > 0 ? `${state.bidValue + state.bidAdjustment}` : '-'}
              </span>
            </div>
          </div>
        </header>

        <section className="m-opps">
          {oppIndices.map(i => {
            const opp = state.players[i];
            if (!opp) return <div key={i} />;
            const isBidTurn = state.gamePhase === 'BIDDING' && state.biddingTurn === i;
            const isPlayTurn = state.gamePhase === 'PLAYING'
              && state.currentTurn === i
              && state.currentTrick.length < NUM_PLAYERS
              && revealPhase === 'idle';
            const isTurn = isBidTurn || isPlayTurn;
            const sourceGhostCard = mobileOpponentSource && mobileOpponentSource.playerIndex === i
              ? opp.hand.find(c => c.id === mobileOpponentSource.cardId)
              : null;
            const isBidder = state.bidWinner === i && state.gamePhase !== 'BIDDING';
            const oppSweepCards = sweepingToPlayer === i ? opp.capturedCards.slice(-4) : [];
            return (
              <div key={i} className={`m-opp ${isTurn ? 'turn' : ''} ${opp.team === 1 ? 'b' : ''}`}>
                {oppSweepCards.length > 0 && (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    {oppSweepCards.map((card, idx) => (
                      <div
                        key={card.id}
                        className="absolute"
                        style={{
                          top: -20 + idx * 2,
                          left: -20 + idx * 2,
                          transform: `rotate(${(idx - 1.5) * 4}deg)`,
                        }}
                      >
                        <CardComponent card={card} />
                      </div>
                    ))}
                  </div>
                )}
                {sourceGhostCard && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0"
                    data-card-id={sourceGhostCard.id}
                  >
                    <CardComponent card={sourceGhostCard} faceDown={false} />
                  </div>
                )}
                <div className="av">{opp.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="name">
                  {opp.name}
                  {isBidder && <span style={{ marginLeft: 4, color: 'var(--gold)', fontSize: 10 }}>★</span>}
                </div>
                <div className="held" style={{ fontSize: 10, color: 'var(--dim)' }}>
                  {opp.hand.length} cards · {opp.tricksWon} tricks
                </div>
              </div>
            );
          })}
        </section>

        <div className="m-felt-wrap">
          <div className="m-felt" ref={feltRef}>
            {state.gamePhase === 'PLAYING' && state.trumpRevealed && state.trumpSuit && revealPhase === 'idle' && (
              <TrumpBadge suit={state.trumpSuit} royalsName={royalsName} />
            )}
            <div className="m-felt-grid">
              <FeltContent />
            </div>
          </div>
          {state.gameLog.length > 0 && (state.gamePhase === 'PLAYING' || state.gamePhase === 'BIDDING') && (
            <LastMoveBanner message={state.gameLog[state.gameLog.length - 1]} />
          )}
        </div>

        {me && (
          <div className="m-me-chip" style={{ position: 'relative' }}>
            {sweepingToPlayer === bottomPlayer && (() => {
              const cards = me.capturedCards.slice(-4);
              if (cards.length === 0) return null;
              return (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                  {cards.map((card, idx) => (
                    <div
                      key={card.id}
                      className="absolute"
                      style={{
                        top: -20 + idx * 2,
                        left: -20 + idx * 2,
                        transform: `rotate(${(idx - 1.5) * 4}deg)`,
                      }}
                    >
                      <CardComponent card={card} />
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="left">
              <div className={`av ${me.team === 1 ? 'b' : ''}`}>{me.name?.[0]?.toUpperCase() || 'Y'}</div>
              <div className="who">{me.name}</div>
              {(isMyPlayTurn || isMyBidTurn) && (
                <span
                  className="animate-accent-pulse"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--accent)',
                    color: '#06121f',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {isMyBidTurn ? 'Your Bid' : 'Drag to play'}
                </span>
              )}
              {me.capturedCards.length > 0 && (
                <button
                  onClick={() => setShowMyCaptures(true)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--fg-soft)' }}
                >
                  {me.tricksWon} tricks
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {chatEnabled && (
                <button
                  className="log-btn"
                  onClick={() => { setMobileChatOpen(true); markChatRead(); }}
                  style={{ position: 'relative' }}
                  aria-label="Open chat"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  Chat
                  {chatUnread > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 999,
                        background: 'var(--accent)',
                        color: '#06121f',
                        fontSize: 9,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </button>
              )}
              <button className="log-btn" onClick={() => setMobileLogOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                Log
              </button>
            </div>
          </div>
        )}

        {me && (
          <section className="m-hand-area">
            <div className="m-hand no-scrollbar">
              {[...me.hand]
                .filter(c => !trickCardIds.has(c.id))
                .sort((a, b) => a.suit === b.suit ? compareCardStrength(b, a) : a.suit.localeCompare(b.suit))
                .map(card => {
                  const isLegal = legalCardIds.has(card.id);
                  const dimmed = state.gamePhase === 'PLAYING' && isMyPlayTurn && !isLegal;
                  const isDraggable = isMyPlayTurn && isLegal;
                  const isActive = dragging?.cardId === card.id;
                  return (
                    <div
                      key={card.id}
                      onPointerDown={onCardPointerDown(card)}
                      onPointerMove={onCardPointerMove(card)}
                      onPointerUp={onCardPointerUp(card)}
                      onPointerCancel={onCardPointerCancel}
                      style={{
                        position: 'relative',
                        touchAction: isDraggable ? 'none' : 'auto',
                        flex: '0 0 auto',
                        visibility: isActive ? 'hidden' : 'visible',
                      }}
                    >
                      <CardComponent
                        card={card}
                        faceDown={false}
                        isPlayable={isDraggable}
                        isDimmed={dimmed}
                        flipId={isActive ? `hand-placeholder-${card.id}` : undefined}
                      />
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {mobileLogOpen && (
          <>
            <div className="m-sheet-backdrop" onClick={() => setMobileLogOpen(false)} />
            <div className="m-sheet">
              <div className="m-sheet-handle" />
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontFamily: 'Fredoka', fontSize: 15, fontWeight: 500, color: 'var(--fg)' }}>
                Game Log
                <button
                  onClick={() => setMobileLogOpen(false)}
                  style={{ fontSize: 12, color: 'var(--dim)', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-2)' }}
                >
                  Close
                </button>
              </h3>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[...state.gameLog].reverse().map((entry, i) => (
                  <div
                    key={i}
                    style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13, color: 'var(--fg-soft)', lineHeight: 1.4 }}
                  >
                    {entry}
                  </div>
                ))}
                {state.gameLog.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No events yet.</div>
                )}
              </div>
            </div>
          </>
        )}

        {mobileChatOpen && chatEnabled && (
          <>
            <div
              className="m-sheet-backdrop"
              onClick={closeChat}
            />
            <div className="m-sheet" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="m-sheet-handle" />
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontFamily: 'Fredoka', fontSize: 15, fontWeight: 500, color: 'var(--fg)' }}>
                Chat
                <button
                  onClick={closeChat}
                  style={{ fontSize: 12, color: 'var(--dim)', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-2)' }}
                >
                  Close
                </button>
              </h3>
              <MobileChatBody
                messages={state.chatLog ?? []}
                myIndex={myIndex}
                onSend={sendChat}
              />
            </div>
          </>
        )}
      </div>
      {dragging && me && (() => {
        const card = me.hand.find(c => c.id === dragging.cardId);
        if (!card) return null;
        return createPortal(
          <div
            className="pointer-events-none"
            style={{
              position: 'fixed',
              left: dragging.originLeft,
              top: dragging.originTop,
              width: dragging.originWidth,
              height: dragging.originHeight,
              transform: `translate(${dragging.dx}px, ${dragging.dy}px)`,
              zIndex: 9999,
            }}
          >
            <CardComponent card={card} faceDown={false} />
          </div>,
          document.body,
        );
      })()}
      <SharedOverlays />
    </>
  );
};
