// The card vocabulary is shared across every game in the org, so it lives in
// the skin package. Re-exported here so the rest of this codebase keeps
// importing its types from one place.
// In 29 a rank is 1 (Ace), 7, 8, 9, 10, 11 (J), 12 (Q) or 13 (K).
export { Suit } from '@laurelwood/card-class';
export type { Card, ChatMessage } from '@laurelwood/card-class';

import type { Card, ChatMessage, Suit } from '@laurelwood/card-class';

export interface TrickPlay {
  playerIndex: number;
  card: Card;
}

export interface CompletedTrick {
  leaderIndex: number;
  ledSuit: Suit;
  plays: TrickPlay[];
  winnerIndex: number;
  isLast?: boolean;
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  isOnline?: boolean;
  peerId?: string;
  hand: Card[];
  capturedCards: Card[]; // all cards from tricks their team won
  tricksWon: number;
  team: 0 | 1;
}

export interface Spectator {
  name: string;
  peerId: string;
}

export type GamePhase =
  | 'LOBBY'
  | 'BIDDING'
  | 'CHOOSING_TRUMP'
  | 'DOUBLING'
  | 'REDOUBLING'
  | 'PLAYING'
  | 'ROUND_OVER'
  | 'GAME_OVER';

export interface GameState {
  gamePhase: GamePhase;
  roomId?: string;
  players: Player[];
  deck: Card[];
  currentTurn: number; // active player during PLAYING
  dealerIndex: number;

  // Bidding auction
  biddingTurn: number;        // whose turn to act next in auction
  currentBid: number | null;  // highest bid so far (null if none placed)
  highBidder: number;         // player index with current highest bid (-1 if none)
  passedPlayers: number[];    // indices who have passed
  lastBids: (number | 'pass' | null)[]; // each player's most recent action (null = not yet acted)
  pairActive: boolean;         // true while an auction pair is in progress
  pairPriority: number;        // within an active pair, the original high-bidder (-1 if no pair); keeps match privilege throughout the pair
  pairChallenger: number;      // within an active pair, the player who opened the pair by raising (-1 if no pair); must always raise strictly

  // Stakes — settled after trump is chosen and before the second deal.
  doubledBy: number;           // index of the defender who doubled; -1 if none. Doubles the round's game-point delta.
  doubleDeclinedBy: number[];  // defender indices that have declined to double; the window closes once every one of them has.
  redoubledBy: number;         // index of the bidding-team player who redoubled; -1 if none. Takes the round's game-point delta to x4.
  redoubleDeclinedBy: number[]; // bidding-team indices that have declined to redouble; the window closes once every one of them has.

  // Contract
  bidWinner: number;          // -1 until bidding completes
  bidValue: number;           // final bid amount
  trumpSuit: Suit | null;     // chosen trump (hidden from non-bidders client-side); stays null through the stakes window when seventh card was called
  trumpChooser: number;       // who picks / revealed by — usually bidWinner
  seventhCardCalled: boolean; // bid winner took the seventh card instead of naming a suit; the deal that resolves it waits for the stakes window to close
  seventhCardId: string | null; // id of the card that became trump via "seventh card"; null when trump was named outright. Redacted from spectators until reveal — the id encodes the suit.
  trumpRevealed: boolean;
  revealedAtTrick: number;    // index of trick when trump was revealed (-1 if not yet)
  revealerIndex: number;      // player who requested the reveal; cleared once they play a card (-1 when not applicable)
  bidAdjustment: number;      // adjustment applied to bidValue from royals
  royalsDeclared: { playerIndex: number; team: 0 | 1; adjustment: number } | null;
  royalsResolved: boolean;    // true once the royals holder has declared or skipped (or no holder)

  // Current trick
  currentTrick: TrickPlay[];  // plays in the trick-in-progress
  trickLeader: number;         // leader of current trick
  ledSuit: Suit | null;        // suit led in current trick
  lastTrickWinner: number;     // player index of the very last completed trick (-1 initially)

  // History
  completedTricks: CompletedTrick[];

  // Concession — both members of a side must agree before a round is given up.
  concedeVotes: number[];        // seat indices currently offering to give up
  concededBy: 0 | 1 | null;      // the side that gave up, once both of them agreed

  // Scoring
  roundScores: { team0: number; team1: number }; // card points this round
  totalScores: { team0: number; team1: number }; // game points (cumulative, can be negative)

  gameLog: string[];
  chatLog: ChatMessage[];
  readyForLobbyIndices?: number[];

  // Spectators — anyone who arrived after the game was already in progress, or
  // whose seat couldn't be filled. They never appear in `players` and never
  // see any hand on the wire (the host publishes a redacted state to a
  // separate spectator topic).
  spectators: Spectator[];
}

// Network Types
export type NetworkAction =
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'PLAYER_JOINED'; payload: { index: number; name: string; peerId: string } }
  | { type: 'CLIENT_ACTION'; payload: any };
