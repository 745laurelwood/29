export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Clubs = 'C',
  Diamonds = 'D',
}

export interface Card {
  suit: Suit;
  rank: number; // 1 (Ace), 7, 8, 9, 10, 11 (J), 12 (Q), 13 (K)
  id: string;
}

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

export type GamePhase =
  | 'LOBBY'
  | 'BIDDING'
  | 'CHOOSING_TRUMP'
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

  // Contract
  bidWinner: number;          // -1 until bidding completes
  bidValue: number;           // final bid amount
  trumpSuit: Suit | null;     // chosen trump (hidden from non-bidders client-side)
  trumpChooser: number;       // who picks / revealed by — usually bidWinner
  trumpRevealed: boolean;
  revealedAtTrick: number;    // index of trick when trump was revealed (-1 if not yet)
  revealerIndex: number;      // player who requested the reveal; cleared once they play a card (-1 when not applicable)
  bidAdjustment: number;      // adjustment applied to bidValue from royals
  royalsDeclared: { playerIndex: number; team: 0 | 1; adjustment: number } | null;

  // Current trick
  currentTrick: TrickPlay[];  // plays in the trick-in-progress
  trickLeader: number;         // leader of current trick
  ledSuit: Suit | null;        // suit led in current trick
  lastTrickWinner: number;     // player index of the very last completed trick (-1 initially)

  // History
  completedTricks: CompletedTrick[];

  // Scoring
  roundScores: { team0: number; team1: number }; // card points this round
  totalScores: { team0: number; team1: number }; // game points (cumulative, can be negative)

  gameLog: string[];
  readyForLobbyIndices?: number[];
}

// Network Types
export type NetworkAction =
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'PLAYER_JOINED'; payload: { index: number; name: string; peerId: string } }
  | { type: 'CLIENT_ACTION'; payload: any };
