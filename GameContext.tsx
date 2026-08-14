import React, { createContext, useContext } from 'react';
import { GameState, Suit } from './types';
import { Action } from './gameReducer';

export interface GameContextValue {
  // Core state
  state: GameState;
  dispatch: React.Dispatch<Action>;
  handleDispatch: (action: Action) => void;

  // Identity
  myIndex: number;
  isHost: boolean;
  isMultiplayer: boolean;
  isSpectator: boolean;
  peerId: string;
  joinId: string;
  isDisconnected: boolean;

  // UI selection
  showMyCaptures: boolean;
  setShowMyCaptures: React.Dispatch<React.SetStateAction<boolean>>;
  mobileLogOpen: boolean;
  setMobileLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileChatOpen: boolean;
  setMobileChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatUnread: number;
  markChatRead: () => void;
  sendChat: (text: string) => void;

  // Animation state
  visualThrow: { cardId: string; playerIndex: number } | null;
  mobileOpponentSource: { cardId: string; playerIndex: number } | null;
  sweepingToPlayer: number | null;
  revealPhase: 'idle' | 'trump-toast' | 'royals-prompt' | 'royals-toast';

  // Actions
  legalCardIds: Set<string>;
  executePlayCard: (cardId: string) => void;
  executeBid: (amount: number) => void;
  executePass: () => void;
  executePassDouble: () => void;
  executeChooseTrump: (suit: Suit) => void;
  executeDeclareSeventhCard: () => void;
  executeDeclareRoyals: () => void;
  executeDeclineRoyals: () => void;
  executeRevealTrump: () => void;
  canRevealTrump: boolean;
  /** No legal card left but the still-hidden seventh card — reveal or nothing. */
  mustRevealTrump: boolean;
  /** My own seventh card while trump is secret; null otherwise. */
  myHiddenTrumpCardId: string | null;

  // Bidding / trump helpers
  canBid: boolean;
  canPassDouble: boolean;
  minBidAmount: number;
  canChooseTrump: boolean;
  canDeclareRoyals: boolean;

  // Positional players
  topPlayer: number;
  leftPlayer: number;
  rightPlayer: number;
  bottomPlayer: number;

  // Refs
  logEndRef: React.RefObject<HTMLDivElement | null>;

  // Pause state
  isPaused: boolean;
  offlinePlayers: { name: string }[];
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ value: GameContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <GameContext.Provider value={value}>{children}</GameContext.Provider>
);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside a GameProvider');
  return ctx;
}
