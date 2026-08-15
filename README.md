# 29

A web-based version of **29**, the classic 4-player partnership trick-taking card game. Play against AI opponents or with friends in a shared room.

## Rules

### Players and cards

29 is played by four players in fixed partnerships, partners facing each other. A 32-card deck is used: A, K, Q, J, 10, 9, 8, 7 in each of the four suits. Cards 2–6 are removed.

Card values (points count for the team that wins the trick):

| Card | Points |
| --- | --- |
| Jack | 3 |
| Nine | 2 |
| Ace | 1 |
| Ten | 1 |
| K, Q, 8, 7 | 0 |

Within a suit, trick-taking order (high to low) is: **J, 9, A, 10, K, Q, 8, 7**.

Total card points in the deck = 28. The winner of the last trick gets an extra point, making the round total **29** — which gives the game its name.

### Deal and bidding

Deal and play are clockwise. The dealer shuffles and deals 4 cards to each player. Based on this partial hand, players bid for the right to choose trumps.

- The player left of the dealer bids first.
- Legal bids range from **16 to 29**.
- Each subsequent player may raise or pass. Once a player passes, they are out of the auction.
- When a new high bid is placed, the previous high bidder gets the chance to **match** it (retaining priority) or raise higher.
- If everyone passes, the dealer is assigned a bid of 16 and picks trump by default.

The winner picks a **trump suit secretly**. The last 4 cards stay in the deck until the stakes are settled.

### Seventh card

If the bid winner is unsure what to pick as trump, they may declare **seventh card** instead of naming a suit. Once the stakes are settled the dealer completes the deal, and the 7th card in the bidder's hand becomes the trump, whatever it turns out to be — the call is made sight unseen and cannot be taken back.

The bidder is shown that card once and it stays marked in their hand until trump is revealed. Everyone else sees only that seventh card was called, never the suit.

The card stands in for a face-down trump: the bidder **cannot play it while trump is still hidden**. If it becomes their only otherwise-legal card — the led suit turns out to be trump and it is their only one, or it is the last card in their hand — they must reveal trump before they can play it.

### Doubling and redoubling

Stakes are settled after the contract is set and before the second deal, so every decision is made on four cards, knowing a trump has been chosen but not which suit it is.

- **Double**: either defender may double the round's game-point change. Whoever doubles first commits their side; the window closes once both have declined.
- **Redouble**: the bidding team may answer. Either the bid winner **or their partner** may *redouble*, taking the round to ±4 game points. Whoever redoubles first commits the team. If both decline, the stake stays doubled.

The dealer then deals the remaining 4 cards to each player so everyone has 8, and the first trick begins.

### Play

The bid winner leads the first trick. Play is clockwise and players must follow suit if possible.

Until trump is revealed, it is secret. A player who cannot follow suit may either:
- play any card off-suit, or
- **ask for trump to be revealed**, which forces the bidder to disclose the trump suit.

From the trick in which trump is revealed onward:
- A player unable to follow suit may play a trump.
- The player who revealed (if it was their turn and they could not follow) **must** play a trump if they have one.
- A trick containing trumps is won by the highest trump; otherwise by the highest card of the led suit.

The winner of each trick leads the next.

### Royals

If a player holds **both the King and Queen of trump** at the moment trump is revealed, they may declare **royals** and show the pair. The bid is adjusted by 4:

- If the royals-holder is on the **bidding team**: their team's bid is **reduced by 4** (easier to make).
- If the royals-holder is on the **opposing team**: the bid is **increased by 4** (harder to make).

The adjusted bid is clamped to [16, 29]. Royals cannot be declared if the K or Q of trump has already been played before the reveal.

### Scoring

After all 8 tricks are played, each team counts its card points, and the team winning the last trick adds 1.

- If the bidding team makes their (possibly royals-adjusted) bid: +1 game point to them.
- Otherwise: –1 game point to them.

The defending team's game-point total does not change on a successful bid.

That ±1 is then scaled by the stakes:

- **Sweep bonus**: if either side wins all 8 tricks, the change is doubled.
- **Double**: doubles the change; a **redouble** takes it to ×4.
- These stack, but a single round can never swing more than **±4** game points.

A team wins the match by reaching **±6 game points**.

## Run locally

**Prerequisites**: Node.js, pnpm.

```bash
pnpm install
pnpm run dev
```
