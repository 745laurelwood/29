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
  peerId: string;
  joinId: string;
  isDisconnected: boolean;

  // UI selection
  showMyCaptures: boolean;
  setShowMyCaptures: React.Dispatch<React.SetStateAction<boolean>>;
  mobileLogOpen: boolean;
  setMobileLogOpen: React.Dispatch<React.SetStateAction<boolean>>;

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
  executeChooseTrump: (suit: Suit) => void;
  executeDeclareRoyals: () => void;
  executeDeclineRoyals: () => void;
  executeRevealTrump: () => void;
  executeDeclineReveal: () => void;
  needRevealDecision: boolean;

  // Bidding / trump helpers
  canBid: boolean;
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
