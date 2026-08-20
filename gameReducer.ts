import { Card, ChatMessage, GameState, Player, Spectator, Suit, CompletedTrick } from './types';
import { cardFromId, createDeck, shuffleDeck } from './utils/deck';
import { getTrickWinner, cardPoints } from './utils/gameLogic';
import {
  getRankLabel,
  SUIT_SYMBOLS, MAX_LOG_ENTRIES, CHAT_MAX_HISTORY, EMPTY_SLOT_NAME, pickBotNames,
} from './constants';
import {
  NUM_PLAYERS, NUM_TRICKS, HAND_SIZE_INITIAL, HAND_SIZE_FULL, SEVENTH_CARD_INDEX,
  MIN_BID, MAX_BID, DEFAULT_DEALER_BID,
  LAST_TRICK_POINT,
  ROYALS_ADJUSTMENT, hasRoyals,
  WINNING_GAME_POINTS,
  SUIT_NAMES,
  DOUBLE_MULTIPLIER, REDOUBLE_MULTIPLIER, getGamePointMagnitude,
} from './rules';

export type Action =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'INIT_LOBBY'; payload: { isHost: boolean; roomId?: string; hostName?: string } }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'SET_PLAYER_OFFLINE'; payload: { peerId: string } }
  | { type: 'SET_PLAYER_TEAM'; payload: { playerIndex: number; team: 0 | 1 } }
  | { type: 'START_GAME'; payload: { playerName: string } }
  | { type: 'START_ROUND' }
  | { type: 'PLACE_BID'; payload: { playerIndex: number; amount: number } }
  | { type: 'PASS_BID'; payload: { playerIndex: number } }
  | { type: 'CHOOSE_TRUMP'; payload: { suit: Suit } }
  | { type: 'DECLARE_SEVENTH_CARD'; payload: { playerIndex: number } }
  | { type: 'DOUBLE'; payload: { playerIndex: number } }
  | { type: 'DECLINE_DOUBLE'; payload: { playerIndex: number } }
  | { type: 'REDOUBLE'; payload: { playerIndex: number } }
  | { type: 'DECLINE_REDOUBLE'; payload: { playerIndex: number } }
  | { type: 'PLAY_CARD'; payload: { playerIndex: number; cardId: string } }
  | { type: 'REVEAL_TRUMP'; payload: { playerIndex: number } }
  | { type: 'DECLARE_ROYALS'; payload: { playerIndex: number } }
  | { type: 'SKIP_ROYALS'; payload: { playerIndex: number } }
  | { type: 'COMPLETE_TRICK' }
  | { type: 'END_ROUND' }
  | { type: 'RETURN_TO_LOBBY'; payload: { playerIndex: number } }
  | { type: 'ADD_LOG'; payload: string }
  | { type: 'SEND_CHAT'; payload: ChatMessage }
  | { type: 'ADD_SPECTATOR'; payload: Spectator }
  | { type: 'REMOVE_SPECTATOR'; payload: { peerId: string } };

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
  doubledBy: -1,
  doubleDeclinedBy: [],
  redoubledBy: -1,
  redoubleDeclinedBy: [],

  bidWinner: -1,
  bidValue: 0,
  trumpSuit: null,
  trumpChooser: -1,
  seventhCardCalled: false,
  seventhCardId: null,
  trumpRevealed: false,
  revealedAtTrick: -1,
  revealerIndex: -1,
  bidAdjustment: 0,
  royalsDeclared: null,
  royalsResolved: false,

  currentTrick: [],
  trickLeader: 0,
  ledSuit: null,
  lastTrickWinner: -1,

  completedTricks: [],

  roundScores: { team0: 0, team1: 0 },
  totalScores: { team0: 0, team1: 0 },
  gameLog: [],
  chatLog: [],
  spectators: [],
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
      return isValidGameState(action.payload)
        ? { ...action.payload, chatLog: action.payload.chatLog ?? [] }
        : state;

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
      // Exclude the host's name so a human can't accidentally share a name
      // with one of the seeded bots.
      const botNames = pickBotNames(3, [action.payload.playerName]);
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

    case 'SET_PLAYER_TEAM': {
      if (state.gamePhase !== 'LOBBY') return state;
      const { playerIndex, team } = action.payload;
      const target = state.players[playerIndex];
      if (!target || target.team === team) return state;
      const np = [...state.players];
      np[playerIndex] = { ...target, team };
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

      // First transition out of LOBBY — reseat humans so partners sit across
      // (same team in even slots vs odd slots), then fill remaining seats with
      // bots. The host (slot 0) anchors their team to the even slots so their
      // own seat doesn't shift. Existing pre-named bots (single-player path)
      // are reused; multiplayer empty slots draw fresh bot names.
      let seated: Player[];
      if (state.gamePhase === 'LOBBY') {
        const hostTeam = state.players[0].team;
        const oddTeam: 0 | 1 = (1 - hostTeam) as 0 | 1;
        const evenHumans = state.players.filter(p => p.isHuman && p.team === hostTeam);
        const oddHumans = state.players.filter(p => p.isHuman && p.team === oddTeam);
        const slotted: (Player | null)[] = [
          evenHumans[0] ?? null,
          oddHumans[0] ?? null,
          evenHumans[1] ?? null,
          oddHumans[1] ?? null,
        ];
        const botsNeeded = slotted.filter(s => s === null).length;
        const existingBots = state.players.filter(p => !p.isHuman && p.name !== EMPTY_SLOT_NAME);
        const freshNeeded = Math.max(0, botsNeeded - existingBots.length);
        // Every name already at the table — humans and bots being carried over
        // from a prior single-player session — must be excluded so fresh picks
        // can't accidentally duplicate an existing one.
        const takenNames = new Set<string>();
        for (const p of state.players) {
          if (p.isHuman && p.name) takenNames.add(p.name);
        }
        for (const b of existingBots) takenNames.add(b.name);
        const freshBotNames = freshNeeded > 0 ? pickBotNames(freshNeeded, takenNames) : [];
        const botPool: { name: string; existing?: Player }[] = [
          ...existingBots.map(b => ({ name: b.name, existing: b })),
          ...freshBotNames.map(n => ({ name: n })),
        ];
        let botCursor = 0;
        seated = slotted.map((p, idx) => {
          const slotTeam: 0 | 1 = (idx % 2 === 0 ? hostTeam : oddTeam) as 0 | 1;
          if (p) return { ...p, id: idx, team: slotTeam };
          const next = botPool[botCursor++];
          const base = next.existing ?? makeEmptyPlayer(idx, next.name, false);
          return { ...base, id: idx, team: slotTeam };
        });
      } else {
        seated = state.players;
      }

      const players = seated.map(p => {
        const newHand = deck.splice(0, HAND_SIZE_INITIAL);
        return {
          ...p,
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
        doubledBy: -1,
        doubleDeclinedBy: [],
        redoubledBy: -1,
        redoubleDeclinedBy: [],
        bidWinner: -1,
        bidValue: 0,
        trumpSuit: null,
        trumpChooser: -1,
        seventhCardCalled: false,
        seventhCardId: null,
        trumpRevealed: false,
        revealedAtTrick: -1,
        revealerIndex: -1,
        bidAdjustment: 0,
        royalsDeclared: null,
        royalsResolved: false,
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
      return openStakesWindow({
        ...state,
        trumpSuit: action.payload.suit,
        trumpChooser: state.bidWinner,
        gameLog: logPush(state.gameLog, `${chooser.name} chose trump`),
      });
    }

    case 'DECLARE_SEVENTH_CARD': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'CHOOSING_TRUMP') return state;
      if (state.bidWinner < 0) return state;
      // Only the bid winner may call it, and only in place of naming a suit.
      if (playerIndex !== state.bidWinner) return state;
      const chooser = state.players[state.bidWinner];
      if (!chooser) return state;

      // Only the call is recorded here. The 7th card doesn't exist until the
      // deal is finished, and the deal waits for the stakes window — otherwise
      // the bidder would be sitting on a known trump suit while the defenders
      // decide whether to double.
      return openStakesWindow({
        ...state,
        trumpChooser: state.bidWinner,
        seventhCardCalled: true,
        // Deliberately suit-free, like the `chose trump` line — every player sees this.
        gameLog: logPush(state.gameLog, `${chooser.name} called seventh card`),
      });
    }

    case 'DOUBLE': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'DOUBLING') return state;
      if (state.doubledBy >= 0) return state;
      if (state.doubleDeclinedBy.includes(playerIndex)) return state;
      const actor = state.players[playerIndex];
      const bidder = state.players[state.bidWinner];
      if (!actor || !bidder) return state;
      // Only a defender may double.
      if (actor.team === bidder.team) return state;

      return {
        ...state,
        doubledBy: playerIndex,
        gamePhase: 'REDOUBLING',
        gameLog: logPush(
          state.gameLog,
          `${actor.name} doubles — round game points x${DOUBLE_MULTIPLIER}`,
        ),
      };
    }

    case 'DECLINE_DOUBLE': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'DOUBLING') return state;
      if (state.doubleDeclinedBy.includes(playerIndex)) return state;
      const actor = state.players[playerIndex];
      const bidder = state.players[state.bidWinner];
      if (!actor || !bidder) return state;
      if (actor.team === bidder.team) return state;

      // One decline doesn't close the window — the partner still gets their say.
      const declined = [...state.doubleDeclinedBy, playerIndex];
      const defenders = state.players.filter(p => p.team !== bidder.team).length;
      if (declined.length < defenders) {
        return { ...state, doubleDeclinedBy: declined };
      }
      return beginPlay({ ...state, doubleDeclinedBy: declined });
    }

    case 'REDOUBLE': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'REDOUBLING') return state;
      if (state.redoubledBy >= 0) return state;
      const actor = state.players[playerIndex];
      const bidder = state.players[state.bidWinner];
      if (!actor || !bidder) return state;
      // Only the bid winner or their partner may answer a double.
      if (actor.team !== bidder.team) return state;

      return beginPlay({
        ...state,
        redoubledBy: playerIndex,
        gameLog: logPush(
          state.gameLog,
          `${actor.name} redoubles — round game points x${REDOUBLE_MULTIPLIER}`,
        ),
      });
    }

    case 'DECLINE_REDOUBLE': {
      const { playerIndex } = action.payload;
      if (state.gamePhase !== 'REDOUBLING') return state;
      if (state.redoubleDeclinedBy.includes(playerIndex)) return state;
      const actor = state.players[playerIndex];
      const bidder = state.players[state.bidWinner];
      if (!actor || !bidder) return state;
      if (actor.team !== bidder.team) return state;

      const declined = [...state.redoubleDeclinedBy, playerIndex];
      const teamSize = state.players.filter(p => p.team === bidder.team).length;
      if (declined.length < teamSize) {
        return { ...state, redoubleDeclinedBy: declined };
      }
      return beginPlay({ ...state, redoubleDeclinedBy: declined });
    }

    case 'PLAY_CARD': {
      const { playerIndex, cardId } = action.payload;
      if (state.gamePhase !== 'PLAYING') return state;
      if (state.currentTurn !== playerIndex) return state;
      const player = state.players[playerIndex];
      const card = player.hand.find(c => c.id === cardId);
      if (!card) return state;
      if (state.currentTrick.length >= NUM_PLAYERS) return state;

      // The seventh card is a face-down trump — it can't hit the table while
      // trump is still secret. The holder must REVEAL_TRUMP first, which is
      // always available to them in this phase, so this can't strand anyone.
      if (!state.trumpRevealed && state.seventhCardId === cardId) return state;

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
      // A named trump reveals only the suit. A seventh card is turned face up,
      // so the card itself becomes public knowledge along with it.
      const seventh = cardFromId(state.seventhCardId);
      const what = seventh ? `${suitName} — seventh card ${cardStr(seventh)}` : suitName;
      return {
        ...state,
        trumpRevealed: true,
        revealedAtTrick: state.completedTricks.length, // current trick index
        revealerIndex: action.payload.playerIndex,
        gameLog: logPush(state.gameLog, `${asker?.name ?? 'Someone'} revealed trump as ${what}`),
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
        royalsResolved: true,
        gameLog: logPush(
          logPush(state.gameLog, `${player.name} declared Royals`),
          `Bid target is now ${state.bidValue + effectiveAdjustment}`,
        ),
      };
    }

    case 'SKIP_ROYALS': {
      if (state.gamePhase !== 'PLAYING') return state;
      if (!state.trumpSuit || !state.trumpRevealed) return state;
      if (state.royalsResolved) return state;
      const { playerIndex } = action.payload;
      const player = state.players[playerIndex];
      if (!player || !hasRoyals(player.hand, state.trumpSuit)) return state;
      return { ...state, royalsResolved: true };
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

      const teamTricksWon = [0, 1].map(team =>
        state.players.filter(p => p.team === team).reduce((sum, p) => sum + p.tricksWon, 0),
      );
      const sweepTeam =
        teamTricksWon[bidderTeam] === NUM_TRICKS
          ? bidderTeam
          : teamTricksWon[1 - bidderTeam] === NUM_TRICKS
            ? 1 - bidderTeam
            : -1;
      const magnitude = getGamePointMagnitude({
        doubled: state.doubledBy >= 0,
        redoubled: state.redoubledBy >= 0,
        swept: sweepTeam >= 0,
      });

      const gamePointDelta = (bidderWon ? 1 : -1) * magnitude;
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
      if (sweepTeam >= 0) {
        nextLog = logPush(nextLog, `Team ${sweepTeam === 0 ? 'A' : 'B'} swept all 8 tricks`);
      }
      if (magnitude > 1) {
        nextLog = logPush(nextLog, `Game points x${magnitude} this round`);
      }

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

    case 'SEND_CHAT':
      return {
        ...state,
        chatLog: [...(state.chatLog ?? []), action.payload].slice(-CHAT_MAX_HISTORY),
      };

    case 'ADD_SPECTATOR': {
      const list = state.spectators ?? [];
      if (list.some(sp => sp.peerId === action.payload.peerId)) return state;
      return { ...state, spectators: [...list, action.payload] };
    }

    case 'REMOVE_SPECTATOR': {
      const list = state.spectators ?? [];
      return { ...state, spectators: list.filter(sp => sp.peerId !== action.payload.peerId) };
    }

    default:
      return state;
  }
};

// ============================================================
// Helpers
// ============================================================

/** Tops every hand up to HAND_SIZE_FULL from the deck. */
function dealRemaining(state: GameState): GameState {
  const deck = [...state.deck];
  const players = state.players.map(p => {
    const need = HAND_SIZE_FULL - p.hand.length;
    const extra = deck.splice(0, Math.max(0, need));
    return { ...p, hand: [...p.hand, ...extra] };
  });
  return { ...state, players, deck };
}

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

/**
 * Hands the contract to the defenders once trump is set. They double or decline
 * on four cards, knowing only that a trump exists. A table with no defenders
 * can't happen in a seated 2v2 round, but the guard keeps the helper total.
 */
function openStakesWindow(state: GameState): GameState {
  const bidderTeam = state.players[state.bidWinner]?.team;
  const hasDefenders = state.players.some(p => p.team !== bidderTeam);
  return hasDefenders ? { ...state, gamePhase: 'DOUBLING' } : beginPlay(state);
}

/**
 * Closes the stakes window: the last four cards go out, a seventh-card call
 * resolves against the finished hand, and the bid winner leads. Dealing here
 * rather than at trump selection is what keeps the double honest — nobody has
 * seen a fifth card when the stake is agreed.
 */
function beginPlay(state: GameState): GameState {
  const dealt = dealRemaining(state);
  const seventh = state.seventhCardCalled
    ? dealt.players[state.bidWinner]?.hand[SEVENTH_CARD_INDEX]
    : undefined;
  return {
    ...dealt,
    trumpSuit: seventh ? seventh.suit : dealt.trumpSuit,
    seventhCardId: seventh ? seventh.id : dealt.seventhCardId,
    gamePhase: 'PLAYING',
    currentTurn: state.bidWinner,
    trickLeader: state.bidWinner,
    ledSuit: null,
    currentTrick: [],
  };
}
