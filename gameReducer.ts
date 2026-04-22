import { Card, GameState, Player, Suit, CompletedTrick } from './types';
import { createDeck, shuffleDeck } from './utils/deck';
import { getTrickWinner, cardPoints } from './utils/gameLogic';
import {
  getRankLabel,
  SUIT_SYMBOLS, MAX_LOG_ENTRIES, EMPTY_SLOT_NAME, pickBotNames,
} from './constants';
import {
  NUM_PLAYERS, NUM_TRICKS, HAND_SIZE_INITIAL, HAND_SIZE_FULL,
  MIN_BID, MAX_BID, DEFAULT_DEALER_BID,
  LAST_TRICK_POINT,
  ROYALS_ADJUSTMENT, hasRoyals,
  WINNING_GAME_POINTS,
  SUIT_NAMES,
} from './rules';

export type Action =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'INIT_LOBBY'; payload: { isHost: boolean; roomId?: string; hostName?: string } }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'SET_PLAYER_OFFLINE'; payload: { peerId: string } }
  | { type: 'START_GAME'; payload: { playerName: string } }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_BID'; payload: { playerIndex: number; amount: number } }
  | { type: 'PASS_BID'; payload: { playerIndex: number } }
  | { type: 'CHOOSE_TRUMP'; payload: { suit: Suit } }
  | { type: 'DEAL_REMAINING' }
  | { type: 'PLAY_CARD'; payload: { playerIndex: number; cardId: string } }
  | { type: 'REVEAL_TRUMP'; payload: { playerIndex: number } }
  | { type: 'DECLARE_ROYALS'; payload: { playerIndex: number } }
  | { type: 'COMPLETE_TRICK' }
  | { type: 'END_ROUND' }
  | { type: 'RETURN_TO_LOBBY'; payload: { playerIndex: number } }
  | { type: 'ADD_LOG'; payload: string };

export const INITIAL_STATE: GameState = {
  gamePhase: 'LOBBY',
  players: [],
  deck: [],
  currentTurn: 0,
  dealerIndex: NUM_PLAYERS - 1,

  biddingTurn: 0,
  currentBid: null,
  highBidder: -1,
  passedPlayers: [],
  lastBids: [null, null, null, null],
  pairActive: false,
  pairPriority: -1,
  pairChallenger: -1,

  bidWinner: -1,
  bidValue: 0,
  trumpSuit: null,
  trumpChooser: -1,
  trumpRevealed: false,
  revealedAtTrick: -1,
  revealerIndex: -1,
  bidAdjustment: 0,
  royalsDeclared: null,

  currentTrick: [],
  trickLeader: 0,
  ledSuit: null,
  lastTrickWinner: -1,

  completedTricks: [],

  roundScores: { team0: 0, team1: 0 },
  totalScores: { team0: 0, team1: 0 },
  gameLog: [],
};

export function makeEmptyPlayer(id: number, name: string, isHuman: boolean, peerId?: string): Player {
  return {
    id,
    name,
    isHuman,
    peerId,
    hand: [],
    capturedCards: [],
    tricksWon: 0,
    score: 0 as any, // for back-compat with saved sessions; not actively used
    team: (id % 2) as 0 | 1,
    isOnline: true,
  } as Player & { score?: number };
}

export const isValidGameState = (s: any): s is GameState =>
  !!s && typeof s === 'object' && Array.isArray(s.players) && !!s.gamePhase;

const cardStr = (c: Card): string => `${getRankLabel(c.rank)}${SUIT_SYMBOLS[c.suit]}`;

const nextClockwise = (idx: number): number => (idx + 1) % NUM_PLAYERS;

/** Next player in bidding who hasn't passed and isn't the current high bidder. */
const nextBidderTurn = (state: GameState): number => {
  const passed = new Set(state.passedPlayers);
  let i = nextClockwise(state.biddingTurn);
  for (let step = 0; step < NUM_PLAYERS * 2; step++) {
    if (!passed.has(i) && i !== state.highBidder) return i;
    i = nextClockwise(i);
  }
  return state.highBidder; // signals "auction over"
};

const logPush = (log: string[], entry: string): string[] =>
  [...log, entry].slice(-MAX_LOG_ENTRIES);

const emptyPlayers = (players: Player[]): Player[] =>
  players.map(p => ({ ...p, hand: [], capturedCards: [], tricksWon: 0 }));

export const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return isValidGameState(action.payload) ? action.payload : state;

    case 'INIT_LOBBY':
      return {
        ...INITIAL_STATE,
        gamePhase: 'LOBBY',
        roomId: action.payload.roomId,
        players: Array.from({ length: NUM_PLAYERS }, (_, i) =>
          makeEmptyPlayer(i, i === 0 ? (action.payload.hostName || 'You (Host)') : EMPTY_SLOT_NAME, false)
        ),
      };

    case 'START_GAME': {
      const botNames = pickBotNames(3);
      return {
        ...INITIAL_STATE,
        gamePhase: 'LOBBY',
        players: [
          makeEmptyPlayer(0, action.payload.playerName, true),
          makeEmptyPlayer(1, botNames[0], false),
          makeEmptyPlayer(2, botNames[1], false),
          makeEmptyPlayer(3, botNames[2], false),
        ],
      };
    }

    case 'UPDATE_PLAYERS':
      return { ...state, players: action.payload };

    case 'SET_PLAYER_OFFLINE': {
      const idx = state.players.findIndex(p => p.peerId === action.payload.peerId);
      if (idx === -1) return state;
      const np = [...state.players];
      np[idx] = { ...np[idx], isOnline: false };
      return { ...state, players: np };
    }

    case 'START_ROUND': {
      const deck = shuffleDeck(createDeck());
      const isFromRoundOver = state.gamePhase === 'ROUND_OVER';
      const isFirstRound = state.gamePhase === 'LOBBY';
      // Dealer rotates clockwise between rounds; first round dealer is the
      // last seat so that player 0 (human / host) becomes the first bidder.
      let dealerIndex: number;
      if (isFirstRound) {
        dealerIndex = NUM_PLAYERS - 1;
      } else if (isFromRoundOver) {
        dealerIndex = nextClockwise(state.dealerIndex);
      } else {
        dealerIndex = state.dealerIndex;
      }
      const firstBidder = nextClockwise(dealerIndex);

      // Fill empty multiplayer slots with bots on first deal.
      const emptySlotCount = state.gamePhase === 'LOBBY'
        ? state.players.filter(p => p.name === EMPTY_SLOT_NAME).length
        : 0;
      const botNamePool = emptySlotCount > 0 ? pickBotNames(emptySlotCount) : [];
      let botNameCursor = 0;

      const players = state.players.map((p, idx) => {
        const filledName = p.name === EMPTY_SLOT_NAME && botNameCursor < botNamePool.length
          ? botNamePool[botNameCursor++]
          : p.name;
        const newHand = deck.splice(0, HAND_SIZE_INITIAL);
        return {
          ...p,
          name: filledName,
          hand: newHand,
          capturedCards: [],
          tricksWon: 0,
        };
      });

      return {
        ...state,
        gamePhase: 'BIDDING',
        deck,
        players,
        dealerIndex,
        currentTurn: firstBidder,
        biddingTurn: firstBidder,
        currentBid: null,
        highBidder: -1,
        passedPlayers: [],
        lastBids: Array(NUM_PLAYERS).fill(null),
        pairActive: false,
        pairPriority: -1,
        pairChallenger: -1,
        bidWinner: -1,
        bidValue: 0,
        trumpSuit: null,
        trumpChooser: -1,
        trumpRevealed: false,
        revealedAtTrick: -1,
        revealerIndex: -1,
        bidAdjustment: 0,
        royalsDeclared: null,
        currentTrick: [],
        trickLeader: 0,
        ledSuit: null,
        lastTrickWinner: -1,
        completedTricks: [],
        roundScores: { team0: 0, team1: 0 },
        gameLog: [`${players[firstBidder].name} bids first`],
      };
    }

    case 'PLACE_BID': {
      const { playerIndex, amount } = action.payload;
      if (state.gamePhase !== 'BIDDING') return state;
      if (state.biddingTurn !== playerIndex) return state;
      if (state.passedPlayers.includes(playerIndex)) return state;

      // Bid validity:
      //  - First bid ever: amount >= MIN_BID.
      //  - If this player is the pair's PRIORITY (the original outbid side of
      //    the current pair), they may MATCH (amount === currentBid) or raise.
      //  - Everyone else (including the pair challenger) must strictly raise.
      const isPriority = state.pairActive && playerIndex === state.pairPriority;
      if (state.currentBid == null) {
        if (amount < MIN_BID || amount > MAX_BID) return state;
      } else {
        const minAllowed = isPriority ? state.currentBid : state.currentBid + 1;
        if (amount < minAllowed || amount > MAX_BID) return state;
      }

      const bidder = state.players[playerIndex];
      const log = logPush(state.gameLog, `${bidder.name} bids ${amount}`);
      const newLastBids = [...state.lastBids];
      newLastBids[playerIndex] = amount;

      const isMatch = state.currentBid != null && amount === state.currentBid;

      // A new pair forms when a raise happens outside of an active pair.
      // The priority (match-capable side) is the just-outbid player; the
      // challenger (raise-only side) is the raiser. These stay fixed for the
      // life of the pair — the priority keeps match privilege throughout.
      const justOutbid = state.highBidder;
      const formsNewPair =
        !isMatch &&
        !state.pairActive &&
        justOutbid >= 0 &&
        justOutbid !== playerIndex &&
        !state.passedPlayers.includes(justOutbid);

      const newPairActive = formsNewPair ? true : state.pairActive;
      const newPairPriority = formsNewPair ? justOutbid : state.pairPriority;
      const newPairChallenger = formsNewPair ? playerIndex : state.pairChallenger;

      const nextState: GameState = {
        ...state,
        currentBid: amount,
        highBidder: playerIndex,
        pairActive: newPairActive,
        pairPriority: newPairPriority,
        pairChallenger: newPairChallenger,
        lastBids: newLastBids,
        gameLog: log,
      };

      // Next turn:
      //  - If pair is active, the other pair member gets the turn.
      //  - Otherwise (no pair), next clockwise non-passed non-highBidder.
      let next: number;
      if (newPairActive) {
        next = (playerIndex === newPairPriority) ? newPairChallenger : newPairPriority;
      } else {
        next = nextBidderTurn(nextState);
      }
      if (next === playerIndex) {
        return finalizeAuction({ ...nextState, biddingTurn: playerIndex });
      }
      return { ...nextState, biddingTurn: next };
    }

    case 'PASS_BID': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'BIDDING') return state;
      if (state.biddingTurn !== playerIndex) return state;
      if (state.passedPlayers.includes(playerIndex)) return state;
      const passer = state.players[playerIndex];
      const log = logPush(state.gameLog, `${passer.name} passes`);
      const newPassed = [...state.passedPlayers, playerIndex];
      const newLastBids = [...state.lastBids];
      newLastBids[playerIndex] = 'pass';

      // A pass by a pair member dissolves the pair; the high bidder will face
      // a fresh challenger via clockwise turn order.
      const passerIsPairMember = state.pairActive && (
        playerIndex === state.pairPriority || playerIndex === state.pairChallenger
      );
      const newPairActive = passerIsPairMember ? false : state.pairActive;
      const newPairPriority = passerIsPairMember ? -1 : state.pairPriority;
      const newPairChallenger = passerIsPairMember ? -1 : state.pairChallenger;

      const nextState: GameState = {
        ...state,
        passedPlayers: newPassed,
        pairActive: newPairActive,
        pairPriority: newPairPriority,
        pairChallenger: newPairChallenger,
        lastBids: newLastBids,
        gameLog: log,
      };
      // If nobody has bid yet and everyone except the dealer has passed,
      // dealer is auto-assigned the default bid.
      const allButDealerPassed =
        nextState.currentBid == null &&
        newPassed.length === NUM_PLAYERS - 1 &&
        !newPassed.includes(nextState.dealerIndex);
      if (allButDealerPassed) {
        const dealer = nextState.players[nextState.dealerIndex];
        const dealerBids = [...newLastBids];
        dealerBids[nextState.dealerIndex] = DEFAULT_DEALER_BID;
        return finalizeAuction({
          ...nextState,
          currentBid: DEFAULT_DEALER_BID,
          highBidder: nextState.dealerIndex,
          biddingTurn: nextState.dealerIndex,
          lastBids: dealerBids,
          gameLog: logPush(log, `${dealer.name} is forced to bid ${DEFAULT_DEALER_BID}`),
        });
      }
      const next = nextBidderTurn(nextState);
      if (next === nextState.highBidder || nextState.highBidder === -1 && newPassed.length === NUM_PLAYERS) {
        if (nextState.highBidder === -1) {
          return nextState;
        }
        return finalizeAuction({ ...nextState, biddingTurn: nextState.highBidder });
      }
      return { ...nextState, biddingTurn: next };
    }

    case 'CHOOSE_TRUMP': {
      if (state.gamePhase !== 'CHOOSING_TRUMP') return state;
      if (state.bidWinner < 0) return state;
      const chooser = state.players[state.bidWinner];
      return {
        ...state,
        trumpSuit: action.payload.suit,
        trumpChooser: state.bidWinner,
        gamePhase: 'PLAYING',
        currentTurn: state.bidWinner,
        trickLeader: state.bidWinner,
        ledSuit: null,
        currentTrick: [],
        gameLog: logPush(state.gameLog, `${chooser.name} chose trump`),
      };
    }

    case 'DEAL_REMAINING': {
      if (state.gamePhase !== 'PLAYING') return state;
      const deck = [...state.deck];
      if (deck.length === 0) return state;
      const players = state.players.map((p, idx) => {
        const need = HAND_SIZE_FULL - p.hand.length;
        const extra = deck.splice(0, Math.max(0, need));
        return { ...p, hand: [...p.hand, ...extra] };
      });
      return {
        ...state,
        players,
        deck,
      };
    }

    case 'PLAY_CARD': {
      const { playerIndex, cardId } = action.payload;
      if (state.gamePhase !== 'PLAYING') return state;
      if (state.currentTurn !== playerIndex) return state;
      const player = state.players[playerIndex];
      const card = player.hand.find(c => c.id === cardId);
      if (!card) return state;
      if (state.currentTrick.length >= NUM_PLAYERS) return state;

      // Enforce follow-suit if possible.
      const leadingTrick = state.currentTrick.length === 0;
      if (!leadingTrick && state.ledSuit) {
        const canFollow = player.hand.some(c => c.suit === state.ledSuit);
        if (canFollow && card.suit !== state.ledSuit) return state;
      }

      const newHand = player.hand.filter(c => c.id !== cardId);
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, hand: newHand };

      const newTrick = [...state.currentTrick, { playerIndex, card }];
      const newLedSuit = leadingTrick ? card.suit : state.ledSuit!;

      const log = logPush(state.gameLog, `${player.name} played ${cardStr(card)}`);

      const trickComplete = newTrick.length === NUM_PLAYERS;

      // If this player is the trick's trump-revealer, their obligation to
      // play trump is discharged as soon as they play.
      const clearRevealer = state.revealerIndex === playerIndex;

      return {
        ...state,
        players: newPlayers,
        currentTrick: newTrick,
        ledSuit: newLedSuit,
        trickLeader: leadingTrick ? playerIndex : state.trickLeader,
        currentTurn: trickComplete ? state.currentTurn : nextClockwise(playerIndex),
        revealerIndex: clearRevealer ? -1 : state.revealerIndex,
        gameLog: log,
      };
    }

    case 'REVEAL_TRUMP': {
      if (state.gamePhase !== 'PLAYING') return state;
      if (state.trumpRevealed) return state;
      if (!state.trumpSuit) return state;
      const asker = state.players[action.payload.playerIndex];
      const suitName = SUIT_NAMES[state.trumpSuit];
      return {
        ...state,
        trumpRevealed: true,
        revealedAtTrick: state.completedTricks.length, // current trick index
        revealerIndex: action.payload.playerIndex,
        gameLog: logPush(state.gameLog, `${asker?.name ?? 'Someone'} revealed trump as ${suitName}`),
      };
    }

    case 'DECLARE_ROYALS': {
      if (state.gamePhase !== 'PLAYING') return state;
      if (state.royalsDeclared) return state;
      if (!state.trumpSuit || !state.trumpRevealed) return state;
      const { playerIndex } = action.payload;
      const player = state.players[playerIndex];
      if (!player || !hasRoyals(player.hand, state.trumpSuit)) return state;
      const bidderTeam = state.players[state.bidWinner]?.team;
      const declarerTeam = player.team;
      // If declarer is on bidder's team: reduces their bid target (-4).
      // Otherwise: raises the bidder's target (+4).
      const rawAdjustment = declarerTeam === bidderTeam ? -ROYALS_ADJUSTMENT : ROYALS_ADJUSTMENT;
      // Clamp adjusted bid within [MIN_BID, MAX_BID].
      const newTarget = Math.min(MAX_BID, Math.max(MIN_BID, state.bidValue + rawAdjustment));
      const effectiveAdjustment = newTarget - state.bidValue;
      return {
        ...state,
        bidAdjustment: effectiveAdjustment,
        royalsDeclared: { playerIndex, team: declarerTeam, adjustment: effectiveAdjustment },
        gameLog: logPush(
          logPush(state.gameLog, `${player.name} declared Royals`),
          `Bid target is now ${state.bidValue + effectiveAdjustment}`,
        ),
      };
    }

    case 'COMPLETE_TRICK': {
      if (state.gamePhase !== 'PLAYING') return state;
      if (state.currentTrick.length !== NUM_PLAYERS) return state;
      if (!state.ledSuit) return state;
      const trumpActive = state.trumpRevealed;
      const winnerPlay = getTrickWinner(
        state.currentTrick,
        state.ledSuit,
        state.trumpSuit,
        trumpActive,
      );
      const winnerIdx = winnerPlay.playerIndex;
      const winner = state.players[winnerIdx];

      const trickCards = state.currentTrick.map(tp => tp.card);

      const newPlayers = state.players.map((p, idx) =>
        idx === winnerIdx
          ? { ...p, capturedCards: [...p.capturedCards, ...trickCards], tricksWon: p.tricksWon + 1 }
          : p,
      );

      const trickNumber = state.completedTricks.length + 1;
      const isLastTrick = trickNumber === NUM_TRICKS;

      const completed: CompletedTrick = {
        leaderIndex: state.trickLeader,
        ledSuit: state.ledSuit,
        plays: state.currentTrick,
        winnerIndex: winnerIdx,
        isLast: isLastTrick,
      };

      const log = logPush(
        state.gameLog,
        `${winner.name} wins trick ${trickNumber} with ${cardStr(winnerPlay.card)}`,
      );

      return {
        ...state,
        players: newPlayers,
        currentTrick: [],
        ledSuit: null,
        trickLeader: winnerIdx,
        currentTurn: winnerIdx,
        lastTrickWinner: winnerIdx,
        completedTricks: [...state.completedTricks, completed],
        gameLog: log,
      };
    }

    case 'END_ROUND': {
      const teamCardPoints = [0, 1].map(team =>
        state.players
          .filter(p => p.team === team)
          .reduce((sum, p) => sum + cardPoints(p.capturedCards), 0),
      );

      // Last-trick bonus
      const lastWinnerIdx = state.lastTrickWinner;
      if (lastWinnerIdx >= 0) {
        const lastTeam = state.players[lastWinnerIdx].team;
        teamCardPoints[lastTeam] += LAST_TRICK_POINT;
      }

      const roundScores = { team0: teamCardPoints[0], team1: teamCardPoints[1] };

      const bidderTeam = state.bidWinner >= 0 ? state.players[state.bidWinner].team : 0;
      const target = state.bidValue + state.bidAdjustment;
      const bidderTeamPoints = teamCardPoints[bidderTeam];
      const bidderWon = bidderTeamPoints >= target;

      const gamePointDelta = bidderWon ? 1 : -1;
      const newTotalScores = {
        team0: state.totalScores.team0 + (bidderTeam === 0 ? gamePointDelta : 0),
        team1: state.totalScores.team1 + (bidderTeam === 1 ? gamePointDelta : 0),
      };

      const isGameOver =
        newTotalScores.team0 >= WINNING_GAME_POINTS ||
        newTotalScores.team1 >= WINNING_GAME_POINTS ||
        newTotalScores.team0 <= -WINNING_GAME_POINTS ||
        newTotalScores.team1 <= -WINNING_GAME_POINTS;

      const bidderName = state.players[state.bidWinner]?.name ?? 'Bidder';

      let nextLog = logPush(state.gameLog, 'Round over');
      nextLog = logPush(nextLog, `Team A scored ${roundScores.team0}`);
      nextLog = logPush(nextLog, `Team B scored ${roundScores.team1}`);
      nextLog = logPush(nextLog, `${bidderName} ${bidderWon ? 'made the bid' : 'missed the bid'}`);

      return {
        ...state,
        gamePhase: isGameOver ? 'GAME_OVER' : 'ROUND_OVER',
        roundScores,
        totalScores: newTotalScores,
        gameLog: nextLog,
      };
    }

    case 'RETURN_TO_LOBBY': {
      if (state.gamePhase !== 'GAME_OVER') return state;
      const { playerIndex } = action.payload;
      const ready = new Set(state.readyForLobbyIndices || []);
      ready.add(playerIndex);
      const humans = state.players.filter(p => p.isHuman);
      const allReady = humans.every(p => ready.has(p.id));
      if (!allReady) {
        return { ...state, readyForLobbyIndices: Array.from(ready) };
      }
      return {
        ...INITIAL_STATE,
        gamePhase: 'LOBBY',
        roomId: state.roomId,
        players: state.players.map(p => ({
          ...p,
          hand: [],
          capturedCards: [],
          tricksWon: 0,
        })),
      };
    }

    case 'ADD_LOG':
      return { ...state, gameLog: logPush(state.gameLog, action.payload) };

    default:
      return state;
  }
};

// ============================================================
// Helpers
// ============================================================

function finalizeAuction(state: GameState): GameState {
  if (state.highBidder < 0 || state.currentBid == null) return state;
  const winner = state.players[state.highBidder];
  return {
    ...state,
    gamePhase: 'CHOOSING_TRUMP',
    bidWinner: state.highBidder,
    bidValue: state.currentBid,
    currentTurn: state.highBidder,
    gameLog: logPush(
      state.gameLog,
      `${winner.name} won the bid at ${state.currentBid}`,
    ),
  };
}
