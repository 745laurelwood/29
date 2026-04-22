import React from 'react';
import { MIN_BID, MAX_BID, ROYALS_ADJUSTMENT, WINNING_GAME_POINTS } from '../rules';

interface RulebookProps {
  onClose: () => void;
}

export const Rulebook: React.FC<RulebookProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 200, background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <div
        className="max-w-3xl mx-auto px-5 sm:px-8 pb-8 sm:pb-12 relative"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}
      >
        <button
          onClick={onClose}
          aria-label="Close rulebook"
          className="sticky float-right w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[color:var(--bg-2)]"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            color: 'var(--fg-soft)',
            top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          }}
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <header className="mb-8 pt-2">
          <h1 className="font-display text-3xl sm:text-4xl mb-1" style={{ color: 'var(--accent)' }}>29 — Rulebook</h1>
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>
            A partnership trick-taking card game
          </p>
        </header>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Overview</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            29 is played by four players in two fixed partnerships, with partners seated across from
            each other. Play proceeds clockwise. The game uses 32 cards — A, 7, 8, 9, 10, J, Q, K in
            each of the four suits. Ace is higher than 10 for the purpose of winning tricks.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Card Strength</h2>
          <p className="mb-2" style={{ color: 'var(--fg-soft)' }}>
            Within a single suit, cards rank from <strong>strongest to weakest</strong> as:
          </p>
          <p className="font-mono text-center py-2 rounded-xl mb-2"
             style={{ color: 'var(--accent)', background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
            J · 9 · A · 10 · K · Q · 8 · 7
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Card Points</h2>
          <ul className="space-y-2" style={{ color: 'var(--fg-soft)' }}>
            <li>Each Jack: <strong>3 points</strong></li>
            <li>Each 9: <strong>2 points</strong></li>
            <li>Each Ace and 10: <strong>1 point</strong></li>
            <li>K, Q, 8, 7: <strong>0 points</strong></li>
            <li>The winner of the last (8th) trick receives an <strong>additional 1 point</strong>.</li>
          </ul>
          <p className="mt-3" style={{ color: 'var(--fg-soft)' }}>Total per round: 29 points (28 from cards + 1 last-trick bonus).</p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Dealing</h2>
          <ol className="list-decimal list-inside space-y-2" style={{ color: 'var(--fg-soft)' }}>
            <li>Four cards are dealt face-down to each player.</li>
            <li>Players bid on the strength of their four-card hand.</li>
            <li>The bid winner chooses a trump suit secretly.</li>
            <li>The dealer then deals four more cards to each player so everyone now has eight.</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Bidding</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            Starting with the player to the dealer's left, each player in turn either passes or makes a
            bid. Bids are numbers from <strong>{MIN_BID}</strong> to <strong>{MAX_BID}</strong>. Each new bid must strictly exceed
            the previous high bid. A pass is permanent — the player takes no further part in the auction.
          </p>
          <p style={{ color: 'var(--fg-soft)' }}>
            If everyone passes, the dealer is assigned a default bid of <strong>{MIN_BID}</strong> and chooses trump. The
            winning bidder undertakes that their side will capture at least the bid number of points in
            the round.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>The Play</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            The bid winner leads the first trick. Each player in turn plays one card; subsequent
            players must follow the led suit if they can.
          </p>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            The trump suit is kept <em>secret</em> until it needs to be revealed. If a player cannot follow
            suit, they may ask the bidder to declare trump. Once trump is revealed, any player who cannot
            follow may instead play a trump (optional) to compete for the trick.
          </p>
          <p style={{ color: 'var(--fg-soft)' }}>
            <strong>From the trick during which trump is declared onwards</strong>, the highest trump played
            wins the trick. Otherwise the highest card of the led suit wins. The winner of a trick leads
            the next.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Royals</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            If a player holds both the <strong>King and Queen of the trump suit</strong> at the moment trump is
            revealed, they may declare <em>Royals</em>:
          </p>
          <ul className="space-y-2" style={{ color: 'var(--fg-soft)' }}>
            <li>If the declarer is on the bidder's team, the bid target <strong>decreases by {ROYALS_ADJUSTMENT}</strong>.</li>
            <li>If the declarer is on the opposing team, the bid target <strong>increases by {ROYALS_ADJUSTMENT}</strong>.</li>
          </ul>
          <p className="mt-3" style={{ color: 'var(--fg-soft)' }}>
            The adjusted target always stays within [{MIN_BID}, {MAX_BID}]. A player who has already played the
            King or Queen of trump before the reveal cannot declare Royals.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Scoring</h2>
          <p style={{ color: 'var(--fg-soft)' }}>
            When all eight tricks have been played, each side counts the card points in its captured
            tricks (and the last-trick bonus). If the bidding side meets or exceeds their adjusted bid,
            they score <strong>+1 game point</strong>; otherwise, they score <strong>-1</strong>. The non-bidding side's score
            does not change.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Winning the Game</h2>
          <p style={{ color: 'var(--fg-soft)' }}>
            Rounds continue until one team reaches <strong>+{WINNING_GAME_POINTS}</strong> game points — or falls to
            <strong> -{WINNING_GAME_POINTS}</strong>. The leading side at that point wins.
          </p>
        </section>

        <div className="text-center py-4">
          <button
            onClick={onClose}
            className="btn-accent px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
