import React, { useState, useEffect, useReducer, useRef } from 'react';
import { flushSync } from 'react-dom';
import mqtt from 'mqtt';
import { Card, GameState, Player, Suit } from './types';
import { sounds } from './utils/sound';
import { flipTransition } from './utils/flip';
import { loadSession, saveSession, clearSession, SavedSession } from './utils/session';
import {
  ROYALS_ANIM_DURATION_MS, AI_BID_DELAY_MS, AI_TRUMP_DELAY_MS, AI_PLAY_DELAY_MS, TRICK_REVEAL_DELAY_MS,
  EMPTY_SLOT_NAME,
} from './constants';
import {
  NUM_PLAYERS, NUM_TRICKS,
  MIN_BID, MAX_BID,
  hasRoyals,
  getTrickStrength,
  getPointsForCard,
} from './rules';
import { Action, INITIAL_STATE, makeEmptyPlayer, gameReducer } from './gameReducer';
import { GameProvider, GameContextValue } from './GameContext';
import { MobileView } from './views/MobileView';
import { DesktopView } from './views/DesktopView';
import { Lobby } from './views/Lobby';
import { getPlayableCards, canFollowSuit, getTrickWinner } from './utils/gameLogic';

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Local UI state
  const [showMyCaptures, setShowMyCaptures] = useState(false);
  const [visualThrow, setVisualThrow] = useState<{ cardId: string; playerIndex: number } | null>(null);
  const [mobileOpponentSource, setMobileOpponentSource] = useState<{ cardId: string; playerIndex: number } | null>(null);
  const [sweepingToPlayer, setSweepingToPlayer] = useState<number | null>(null);
  const aiThinkingRef = useRef(false);
  // Scripted reveal sequence:
  //   idle → trump-toast → (royals-prompt | royals-toast) → idle
  // While non-idle, AI is paused and the top-left TrumpBadge is hidden so
  // the user can watch one announcement at a time.
  type RevealPhase = 'idle' | 'trump-toast' | 'royals-prompt' | 'royals-toast';
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('idle');
  const trumpSeqRef = useRef(false);
  const trickCompletingRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Mobile layout
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [mobileLogOpen, setMobileLogOpen] = useState(false);

  // Networking state
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('nine_playerName') || '');
  const [myIndex, setMyIndex] = useState(0);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => loadSession());
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const handleDataRef = useRef<(data: any) => void>(() => {});
  const stateRef = useRef(state);
  const peerIdRef = useRef('');
  const isOrchestratingRef = useRef(false);
  const pendingSyncStateRef = useRef<GameState | null>(null);
  const clientRejoinRef = useRef<{ roomId: string; name: string; myPeerId: string } | null>(null);
  const wakeLockRef = useRef<any | null>(null);
  const hostInitializedRef = useRef(false);
  const hostRoomIdRef = useRef<string | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { localStorage.setItem('nine_playerName', playerName); }, [playerName]);

  // ── Screen wake lock ──
  useEffect(() => {
    if (state.gamePhase === 'LOBBY' || state.gamePhase === 'GAME_OVER') return;
    const lock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) { /* ignore */ }
    };
    lock();
    const onVis = () => { if (document.visibilityState === 'visible') lock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [state.gamePhase]);

  // ── Host-side rebroadcast on wake ──
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const client = mqttClientRef.current;
      const roomId = hostRoomIdRef.current;
      if (!client || !roomId) return;
      try {
        if (!client.connected) { client.reconnect(); return; }
      } catch { /* fall through */ }
      try {
        const snapshot = stateRef.current;
        client.publish(`nine_game_${roomId}`, JSON.stringify({ type: 'SYNC_STATE', payload: snapshot }));
      } catch (e) { console.error('Host wake rebroadcast error:', e); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [isMultiplayer, isHost]);

  useEffect(() => {
    if (!isMultiplayer || isHost) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const info = clientRejoinRef.current;
      const client = mqttClientRef.current;
      if (!info || !client) return;
      try {
        if (!client.connected) { client.reconnect(); return; }
      } catch { /* fall through */ }
      try {
        const payload = { type: 'PLAYER_JOINED', payload: { name: info.name, peerId: info.myPeerId } };
        client.publish(`nine_game_${info.roomId}`, JSON.stringify(payload));
      } catch (e) { console.error('Client re-associate error:', e); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [isMultiplayer, isHost]);

  useEffect(() => {
    if (!isMultiplayer || !isHost || !state.roomId) return;
    if (state.gamePhase === 'LOBBY') return;
    if (state.gamePhase === 'GAME_OVER') { clearSession(); return; }
    saveSession({ role: 'host', roomId: state.roomId, playerName, state });
  }, [isMultiplayer, isHost, state, playerName]);

  // ── Reveal sequence: trump toast → (royals prompt / royals toast) → idle ──
  const TRUMP_TOAST_MS = 2200;
  useEffect(() => {
    if (!state.trumpRevealed) { trumpSeqRef.current = false; return; }
    if (trumpSeqRef.current) return;
    trumpSeqRef.current = true;
    sounds.reveal();
    setRevealPhase('trump-toast');

    const t = window.setTimeout(() => {
      const trump = stateRef.current.trumpSuit;
      const players = stateRef.current.players;
      const alreadyDeclared = !!stateRef.current.royalsDeclared;
      const holder = trump && !alreadyDeclared
        ? players.find(p => hasRoyals(p.hand, trump))
        : null;
      if (!holder) { setRevealPhase('idle'); return; }
      if (holder.isHuman) {
        setRevealPhase('royals-prompt');
      } else {
        // Bots auto-declare. The `royals-toast → idle` effect below handles
        // the subsequent timeout so we never race with its cleanup.
        dispatch({ type: 'DECLARE_ROYALS', payload: { playerIndex: holder.id } });
        sounds.royals();
        setRevealPhase('royals-toast');
      }
    }, TRUMP_TOAST_MS);

    return () => { window.clearTimeout(t); };
  }, [state.trumpRevealed]);

  // Human declared royals from the prompt → advance to the toast phase.
  useEffect(() => {
    if (revealPhase !== 'royals-prompt') return;
    if (!state.royalsDeclared) return;
    sounds.royals();
    setRevealPhase('royals-toast');
  }, [state.royalsDeclared, revealPhase]);

  // Owns the royals-toast → idle timeout in its own effect so the cleanup
  // triggered by the very setState above doesn't cancel the timer.
  useEffect(() => {
    if (revealPhase !== 'royals-toast') return;
    const t = window.setTimeout(() => setRevealPhase('idle'), ROYALS_ANIM_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [revealPhase]);

  // ── Broadcast state to clients ──
  useEffect(() => {
    if (isHost && isMultiplayer && mqttClientRef.current) {
      const payloadString = JSON.stringify({ type: 'SYNC_STATE', payload: state });
      try { mqttClientRef.current.publish(`nine_game_${state.roomId}`, payloadString); } catch(e) { console.error('Host broadcast error:', e); }
    }
  }, [state, isHost, isMultiplayer]);

  useEffect(() => {
    handleDataRef.current = (data: any) => {
      const s = stateRef.current;
      if (data.type === 'PLAYER_JOINED') {
        const newPlayers = [...s.players];
        const rebroadcast = (players: typeof newPlayers) => {
          try {
            if (mqttClientRef.current && s.roomId) {
              const snapshot = { ...s, players };
              mqttClientRef.current.publish(
                `nine_game_${s.roomId}`,
                JSON.stringify({ type: 'SYNC_STATE', payload: snapshot })
              );
            }
          } catch (e) { console.error('PLAYER_JOINED rebroadcast error:', e); }
        };

        const existingPlayerIdx = newPlayers.findIndex(p => p.name === data.payload.name && p.isHuman);
        if (existingPlayerIdx !== -1) {
          newPlayers[existingPlayerIdx] = { ...newPlayers[existingPlayerIdx], peerId: data.payload.peerId, isOnline: true };
          dispatch({ type: 'UPDATE_PLAYERS', payload: newPlayers });
          rebroadcast(newPlayers);
          return;
        }

        if (s.gamePhase !== 'LOBBY') {
          rebroadcast(newPlayers);
          return;
        }
        const slot = newPlayers.findIndex((p, i) => i !== 0 && p.name === EMPTY_SLOT_NAME);
        if (slot !== -1) {
          newPlayers[slot] = { ...newPlayers[slot], name: data.payload.name, isHuman: true, peerId: data.payload.peerId };
          dispatch({ type: 'UPDATE_PLAYERS', payload: newPlayers });
          rebroadcast(newPlayers);
        }
      } else if (data.type === 'CLIENT_ACTION') {
        dispatch(data.payload);
      } else if (data.type === 'PLAYER_OFFLINE') {
        dispatch({ type: 'SET_PLAYER_OFFLINE', payload: { peerId: data.payload.peerId } });
      }
    };
  }, []);

  const initHostWithRef = (resume?: Extract<SavedSession, { role: 'host' }>) => {
    setIsMultiplayer(true);
    setIsHost(true);
    setMyIndex(0);
    setIsDisconnected(false);

    const roomId = resume?.roomId ?? Math.random().toString(36).substring(2, 6).toUpperCase();
    setPeerId(roomId);
    if (!resume) clearSession();

    hostInitializedRef.current = false;
    hostRoomIdRef.current = roomId;

    const client = mqtt.connect(MQTT_BROKER);
    mqttClientRef.current = client;

    client.on('connect', () => {
      setIsDisconnected(false);
      client.subscribe(`nine_game_${roomId}`, (err) => {
        if (err) { console.error('HOST subscribe error:', err); return; }
        if (!hostInitializedRef.current) {
          hostInitializedRef.current = true;
          if (resume) {
            dispatch({ type: 'SET_GAME_STATE', payload: resume.state });
          } else {
            dispatch({ type: 'INIT_LOBBY', payload: { isHost: true, roomId, hostName: playerName || 'You (Host)' } });
            dispatch({
              type: 'UPDATE_PLAYERS',
              payload: [
                makeEmptyPlayer(0, playerName || 'You (Host)', true, roomId),
                makeEmptyPlayer(1, EMPTY_SLOT_NAME, false),
                makeEmptyPlayer(2, EMPTY_SLOT_NAME, false),
                makeEmptyPlayer(3, EMPTY_SLOT_NAME, false),
              ],
            });
          }
        } else {
          try {
            const snapshot = stateRef.current;
            client.publish(`nine_game_${roomId}`, JSON.stringify({ type: 'SYNC_STATE', payload: snapshot }));
          } catch (e) { console.error('HOST rebroadcast error:', e); }
        }
      });
    });

    client.on('message', (topic, message) => {
      try {
        const raw = message.toString();
        const parsed = JSON.parse(raw);
        if (parsed.type === 'SYNC_STATE') return;
        if (parsed.type === 'MOVE_ANNOUNCE' && parsed.originatorPeerId === roomId) return;

        if (parsed.type === 'MOVE_ANNOUNCE') {
          executeOrchestratedPlay(parsed.payload);
          return;
        }

        if (parsed.type === 'PLAYER_JOINED' || parsed.type === 'CLIENT_ACTION' || parsed.type === 'PLAYER_OFFLINE') {
          handleDataRef.current(parsed);
        }
      } catch(e) { console.error('Host JSON Parse Error:', e); }
    });

    client.on('close', () => {
      console.warn('HOST: MQTT Connection dropped.');
      setIsDisconnected(true);
    });
  };

  const joinGame = (resume?: Extract<SavedSession, { role: 'client' }>) => {
    const roomId = resume?.roomId ?? joinId;
    const name = resume?.playerName ?? playerName;
    if (!roomId) return;
    if (resume && !joinId) setJoinId(roomId);
    setIsMultiplayer(true);
    setIsHost(false);
    setIsDisconnected(false);

    const myPeerId = resume?.myPeerId ?? Math.random().toString(36).substring(2, 9);
    setPeerId(myPeerId);

    const displayName = name || `Player ${myPeerId.substring(0, 4)}`;
    saveSession({ role: 'client', roomId, playerName: displayName, myPeerId });
    clientRejoinRef.current = { roomId, name: displayName, myPeerId };

    const client = mqtt.connect(MQTT_BROKER, {
      will: {
        topic: `nine_game_${roomId}`,
        payload: JSON.stringify({ type: 'PLAYER_OFFLINE', payload: { peerId: myPeerId } }),
        qos: 0,
        retain: false
      }
    });
    mqttClientRef.current = client;

    client.on('connect', () => {
      setIsDisconnected(false);
      client.subscribe(`nine_game_${roomId}`, (err) => {
        if (err) { console.error('CLIENT subscribe error:', err); return; }
        const joinPayload = { type: 'PLAYER_JOINED', payload: { name: displayName, peerId: myPeerId } };
        client.publish(`nine_game_${roomId}`, JSON.stringify(joinPayload));
      });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'SYNC_STATE') {
          const newState = data.payload as GameState;
          if (isOrchestratingRef.current) {
            pendingSyncStateRef.current = newState;
            return;
          }
          const me = newState.players.find(p => p.peerId === myPeerId);
          if (me) setMyIndex(me.id);
          dispatch({ type: 'SET_GAME_STATE', payload: newState });
        } else if (data.type === 'MOVE_ANNOUNCE') {
          if (data.originatorPeerId === myPeerId) return;
          executeOrchestratedPlay(data.payload);
        }
      } catch(e) { console.error('Client JSON Parse Error:', e); }
    });

    client.on('close', () => {
      console.warn('CLIENT: MQTT Connection dropped.');
      setIsDisconnected(true);
    });
  };

  // ── Auto-scroll game log ──
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.gameLog]);

  // ── Animation constants ──
  const FLIP_FLY_MS = 900;
  const FLIP_SWEEP_MS = 900;

  /**
   * Orchestrates a PLAY_CARD action with animations.
   * payload shape: { playerIndex, cardId }
   */
  const executeOrchestratedPlay = async (payload: { playerIndex: number; cardId: string }) => {
    isOrchestratingRef.current = true;
    const isOpponent = payload.playerIndex !== myIndex;
    if (isOpponent) {
      flushSync(() => setMobileOpponentSource({
        cardId: payload.cardId,
        playerIndex: payload.playerIndex,
      }));
    }
    try {
      sounds.throwCard();
      await flipTransition(() => {
        setMobileOpponentSource(null);
        dispatch({ type: 'PLAY_CARD', payload });
      }, FLIP_FLY_MS);
    } finally {
      isOrchestratingRef.current = false;
      const pending = pendingSyncStateRef.current;
      if (pending) {
        pendingSyncStateRef.current = null;
        const me = pending.players.find(p => p.peerId === peerIdRef.current);
        if (me) setMyIndex(me.id);
        dispatch({ type: 'SET_GAME_STATE', payload: pending });
      }
    }
  };

  const publishMoveAnnounce = (payload: { playerIndex: number; cardId: string }) => {
    const client = mqttClientRef.current;
    if (!client) return;
    const roomId = state.roomId || joinId;
    if (!roomId) return;
    try {
      client.publish(
        `nine_game_${roomId}`,
        JSON.stringify({ type: 'MOVE_ANNOUNCE', payload, originatorPeerId: peerIdRef.current })
      );
    } catch (e) { console.error('publishMoveAnnounce error:', e); }
  };

  // ── Trick completion: when 4 cards played, reveal winner, sweep cards ──
  // Runs on every peer (host and clients) so each one animates locally.
  // The reducer is deterministic, so everyone computes the same post-trick
  // state; the host's SYNC_STATE arriving during the animation gets queued
  // via isOrchestratingRef / pendingSyncStateRef and applied after.
  // Only the host dispatches END_ROUND — clients receive that via SYNC_STATE.
  useEffect(() => {
    if (state.gamePhase !== 'PLAYING') return;
    if (state.currentTrick.length !== NUM_PLAYERS) return;
    if (trickCompletingRef.current) return;
    trickCompletingRef.current = true;
    isOrchestratingRef.current = true;
    (async () => {
      await new Promise(r => setTimeout(r, TRICK_REVEAL_DELAY_MS));

      // Compute winner (for sweep animation target).
      const trumpActive = state.trumpRevealed;
      const winnerPlay = state.ledSuit
        ? getTrickWinner(state.currentTrick, state.ledSuit, state.trumpSuit, trumpActive)
        : state.currentTrick[0];
      const winnerIdx = winnerPlay.playerIndex;

      sounds.capture();
      await flipTransition(() => {
        setSweepingToPlayer(winnerIdx);
        dispatch({ type: 'COMPLETE_TRICK' });
      }, FLIP_SWEEP_MS);
      flushSync(() => {
        setSweepingToPlayer(null);
      });

      isOrchestratingRef.current = false;
      const pending = pendingSyncStateRef.current;
      if (pending) {
        pendingSyncStateRef.current = null;
        const me = pending.players.find(p => p.peerId === peerIdRef.current);
        if (me) setMyIndex(me.id);
        dispatch({ type: 'SET_GAME_STATE', payload: pending });
      }

      trickCompletingRef.current = false;

      // After last trick, finalize round — host only, clients follow via SYNC_STATE.
      const postState = stateRef.current;
      if (
        postState.completedTricks.length >= NUM_TRICKS &&
        postState.gamePhase === 'PLAYING' &&
        (!isMultiplayer || isHost)
      ) {
        await new Promise(r => setTimeout(r, 500));
        dispatch({ type: 'END_ROUND' });
      }
    })();
  }, [state.gamePhase, state.currentTrick.length, isHost, isMultiplayer]);

  // ── AI: bidding ──
  useEffect(() => {
    if (!isHost && isMultiplayer) return;
    if (state.gamePhase !== 'BIDDING') return;
    const bidder = state.players[state.biddingTurn];
    if (!bidder || bidder.isHuman) return;
    if (aiThinkingRef.current) return;
    aiThinkingRef.current = true;
    const turn = state.biddingTurn;
    const curBid = state.currentBid;
    const hand = bidder.hand;
    const timer = setTimeout(() => {
      const decision = aiChooseBid(hand, curBid);
      if (decision === 'PASS') {
        dispatch({ type: 'PASS_BID', payload: { playerIndex: turn } });
      } else {
        sounds.bid();
        dispatch({ type: 'PLACE_BID', payload: { playerIndex: turn, amount: decision } });
      }
      aiThinkingRef.current = false;
    }, AI_BID_DELAY_MS);
    return () => { clearTimeout(timer); aiThinkingRef.current = false; };
  }, [state.gamePhase, state.biddingTurn, state.currentBid, isHost, isMultiplayer]);

  // ── AI: trump selection ──
  useEffect(() => {
    if (!isHost && isMultiplayer) return;
    if (state.gamePhase !== 'CHOOSING_TRUMP') return;
    const chooser = state.players[state.bidWinner];
    if (!chooser || chooser.isHuman) return;
    if (aiThinkingRef.current) return;
    aiThinkingRef.current = true;
    const hand = chooser.hand;
    const timer = setTimeout(() => {
      const suit = aiChooseTrump(hand);
      dispatch({ type: 'CHOOSE_TRUMP', payload: { suit } });
      setTimeout(() => dispatch({ type: 'DEAL_REMAINING' }), 150);
      aiThinkingRef.current = false;
    }, AI_TRUMP_DELAY_MS);
    return () => { clearTimeout(timer); aiThinkingRef.current = false; };
  }, [state.gamePhase, state.bidWinner, isHost, isMultiplayer]);

  // ── AI: playing a card ──
  useEffect(() => {
    if (!isHost && isMultiplayer) return;
    if (state.gamePhase !== 'PLAYING') return;
    if (state.currentTrick.length >= NUM_PLAYERS) return;
    if (revealPhase !== 'idle') return;
    const player = state.players[state.currentTurn];
    if (!player || player.isHuman) return;
    if (aiThinkingRef.current) return;
    if (player.hand.length === 0) return;
    aiThinkingRef.current = true;
    const timer = setTimeout(async () => {
      // Decide whether to reveal trump (if we can't follow suit and trump isn't revealed).
      const ledSuit = state.ledSuit;
      const cannotFollow = ledSuit != null && !canFollowSuit(player.hand, ledSuit);
      if (cannotFollow && !state.trumpRevealed && state.trumpSuit) {
        // Reveal trump before playing. The reveal-sequence effect takes over
        // from here: it plays the trump toast, then (if any) the royals toast,
        // then flips revealPhase back to 'idle' so AI can resume.
        dispatch({ type: 'REVEAL_TRUMP', payload: { playerIndex: state.currentTurn } });
        aiThinkingRef.current = false;
        return;
      }

      const botMustPlayTrump = state.trumpRevealed && state.revealerIndex === state.currentTurn;
      const chosen = aiChooseCard(
        player.hand,
        ledSuit,
        state.trumpSuit,
        state.trumpRevealed,
        botMustPlayTrump,
        state.currentTrick.map(tp => tp.card),
        state.currentTrick,
        state.players,
        state.currentTurn,
        state.bidWinner,
        state.highBidder,
      );
      if (!chosen) { aiThinkingRef.current = false; return; }

      const payload = { playerIndex: state.currentTurn, cardId: chosen.id };
      if (isMultiplayer) publishMoveAnnounce(payload);
      await executeOrchestratedPlay(payload);
      aiThinkingRef.current = false;
    }, AI_PLAY_DELAY_MS);
    return () => { clearTimeout(timer); aiThinkingRef.current = false; };
  }, [state.gamePhase, state.currentTurn, state.currentTrick.length, state.ledSuit, state.trumpRevealed, isHost, isMultiplayer, revealPhase]);

  // ── Dispatch (local or network) ──
  const handleDispatch = (action: Action) => {
    if (isHost) {
      dispatch(action);
      return;
    }
    if (action.type !== 'START_ROUND') {
      dispatch(action);
    }
    if (mqttClientRef.current) {
      mqttClientRef.current.publish(`nine_game_${state.roomId || joinId}`, JSON.stringify({ type: 'CLIENT_ACTION', payload: action }));
    }
  };

  // ── Trump-reveal decision (for non-bidder humans who can't follow suit) ──
  // Show a one-off modal per (trick, player) asking whether to ask for a reveal.
  // Once they pick, the choice sticks for that turn even if state updates.
  const me = state.players[myIndex];
  const canFollow = me && state.ledSuit ? canFollowSuit(me.hand, state.ledSuit) : true;
  const isMyTurnRaw = state.currentTurn === myIndex
    && state.gamePhase === 'PLAYING'
    && state.currentTrick.length < NUM_PLAYERS
    && revealPhase === 'idle';

  const currentTurnKey = `${state.completedTricks.length}:${state.currentTurn}`;
  const [revealPromptDismissedKey, setRevealPromptDismissedKey] = useState<string | null>(null);
  const needRevealDecision = !!(
    isMyTurnRaw
    && state.ledSuit
    && me
    && !canFollow
    && !state.trumpRevealed
    && state.trumpSuit
    && myIndex !== state.bidWinner
    && revealPromptDismissedKey !== currentTurnKey
  );

  // ── Legal cards for my turn ──
  const legalCardIds = new Set<string>();
  const isMyTurn = isMyTurnRaw && !needRevealDecision;
  if (isMyTurn && me) {
    const mustPlayTrump = state.trumpRevealed && state.revealerIndex === myIndex;
    const legal = getPlayableCards(me.hand, state.ledSuit, mustPlayTrump, state.trumpSuit);
    for (const c of legal) legalCardIds.add(c.id);
  }

  // ── Bidding helpers ──
  const canBid = state.gamePhase === 'BIDDING' && state.biddingTurn === myIndex;
  const minBidAmount = state.currentBid == null ? MIN_BID : state.currentBid + 1;

  // ── Trump helpers ──
  const canChooseTrump = state.gamePhase === 'CHOOSING_TRUMP' && state.bidWinner === myIndex;

  // ── Royals (human) ──
  const canDeclareRoyals = !!(
    state.gamePhase === 'PLAYING' &&
    state.trumpRevealed &&
    state.trumpSuit &&
    me &&
    hasRoyals(me.hand, state.trumpSuit) &&
    !state.royalsDeclared
  );

  // ── Human actions ──
  const executePlayCard = (cardId: string) => {
    if (!isMyTurn || !me) return;
    if (!legalCardIds.has(cardId)) return;
    if (revealPhase !== 'idle') return;
    const payload = { playerIndex: myIndex, cardId };
    if (isMultiplayer) publishMoveAnnounce(payload);
    executeOrchestratedPlay(payload);
  };

  const executeRevealTrump = () => {
    if (!needRevealDecision) return;
    handleDispatch({ type: 'REVEAL_TRUMP', payload: { playerIndex: myIndex } });
    // No need to mark dismissed — state.trumpRevealed becoming true hides the prompt.
  };

  const executeDeclineReveal = () => {
    if (!needRevealDecision) return;
    setRevealPromptDismissedKey(currentTurnKey);
  };

  const executeBid = (amount: number) => {
    if (!canBid) return;
    if (amount < minBidAmount || amount > MAX_BID) return;
    sounds.bid();
    handleDispatch({ type: 'PLACE_BID', payload: { playerIndex: myIndex, amount } });
  };

  const executePass = () => {
    if (!canBid) return;
    handleDispatch({ type: 'PASS_BID', payload: { playerIndex: myIndex } });
  };

  const executeChooseTrump = (suit: Suit) => {
    if (!canChooseTrump) return;
    handleDispatch({ type: 'CHOOSE_TRUMP', payload: { suit } });
    // After trump chosen, deal remaining cards.
    setTimeout(() => handleDispatch({ type: 'DEAL_REMAINING' }), 150);
  };

  const executeDeclareRoyals = () => {
    if (!canDeclareRoyals) return;
    handleDispatch({ type: 'DECLARE_ROYALS', payload: { playerIndex: myIndex } });
  };

  const executeDeclineRoyals = () => {
    if (revealPhase === 'royals-prompt') setRevealPhase('idle');
  };

  // Map player indices to visual positions
  const positionFor = (pIndex: number): 'bottom' | 'left' | 'top' | 'right' => {
    const positions = ['bottom', 'left', 'top', 'right'] as const;
    return positions[(pIndex - myIndex + NUM_PLAYERS) % NUM_PLAYERS];
  };

  const topPlayer    = state.players.findIndex((_, i) => positionFor(i) === 'top');
  const leftPlayer   = state.players.findIndex((_, i) => positionFor(i) === 'left');
  const rightPlayer  = state.players.findIndex((_, i) => positionFor(i) === 'right');
  const bottomPlayer = state.players.findIndex((_, i) => positionFor(i) === 'bottom');

  const offlinePlayers = state.players.filter(p => p.isHuman && p.id !== 0 && !p.isOnline);
  const isPaused = (offlinePlayers.length > 0 && state.gamePhase !== 'LOBBY') || isDisconnected;

  if (state.gamePhase === 'LOBBY') {
    return (
      <Lobby
        state={state}
        isMultiplayer={isMultiplayer}
        isHost={isHost}
        peerId={peerId}
        playerName={playerName}
        setPlayerName={setPlayerName}
        joinId={joinId}
        setJoinId={setJoinId}
        savedSession={savedSession}
        setSavedSession={setSavedSession}
        onCreateRoom={initHostWithRef}
        onJoinRoom={joinGame}
        onStartSinglePlayer={() => {
          setIsHost(true);
          setIsMultiplayer(true);
          setMyIndex(0);
          dispatch({ type: 'START_GAME', payload: { playerName: playerName || 'You' } });
        }}
        onStartRound={() => dispatch({ type: 'START_ROUND' })}
      />
    );
  }

  const gameContext: GameContextValue = {
    state, dispatch, handleDispatch,
    myIndex, isHost, isMultiplayer, peerId, joinId, isDisconnected,
    showMyCaptures, setShowMyCaptures,
    mobileLogOpen, setMobileLogOpen,
    visualThrow, mobileOpponentSource, sweepingToPlayer,
    revealPhase,
    legalCardIds,
    executePlayCard, executeBid, executePass,
    executeChooseTrump,
    executeDeclareRoyals, executeDeclineRoyals,
    executeRevealTrump, executeDeclineReveal,
    needRevealDecision,
    canBid, minBidAmount,
    canChooseTrump, canDeclareRoyals,
    topPlayer, leftPlayer, rightPlayer, bottomPlayer,
    logEndRef,
    isPaused, offlinePlayers,
  };

  return (
    <GameProvider value={gameContext}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </GameProvider>
  );
}

// ============================================================
// AI heuristics
// ============================================================

function aiChooseBid(hand: Card[], currentBid: number | null): number | 'PASS' {
  // Simple hand-strength metric: sum card values + extras for Jacks/9s.
  let strength = 0;
  for (const c of hand) {
    strength += getPointsForCard(c) * 2;
    if (c.rank === 11) strength += 2;
    if (c.rank === 9) strength += 1;
  }
  // Suit concentration bonus: big if one suit dominates.
  const counts: Record<string, number> = {};
  for (const c of hand) counts[c.suit] = (counts[c.suit] || 0) + 1;
  const maxCount = Math.max(...Object.values(counts));
  strength += maxCount * 2;

  // Estimate fair bid target around 16 + strength/3.
  const estimate = Math.min(22, Math.max(MIN_BID, 14 + Math.floor(strength / 3)));
  const minToBid = currentBid == null ? MIN_BID : currentBid + 1;
  if (minToBid > estimate) return 'PASS';
  if (Math.random() < 0.15 && minToBid <= estimate - 1) return minToBid;
  return Math.min(MAX_BID, minToBid);
}

function aiChooseTrump(hand: Card[]): Suit {
  const suitScores: Record<string, number> = {};
  for (const c of hand) {
    suitScores[c.suit] = (suitScores[c.suit] || 0)
      + (getPointsForCard(c) * 2)
      + getTrickStrength(c.rank);
  }
  let best: Suit = Object.keys(suitScores)[0] as Suit;
  let bestScore = -1;
  for (const [s, v] of Object.entries(suitScores)) {
    if (v > bestScore) { best = s as Suit; bestScore = v; }
  }
  return best;
}

function aiChooseCard(
  hand: Card[],
  ledSuit: Suit | null,
  trump: Suit | null,
  trumpRevealed: boolean,
  mustPlayTrump: boolean,
  trickCards: Card[],
  trickPlays: { playerIndex: number; card: Card }[],
  players: Player[],
  myIndex: number,
  bidWinner: number,
  _highBidder: number,
): Card | null {
  if (hand.length === 0) return null;
  const legal = getPlayableCards(hand, ledSuit, mustPlayTrump, trump);
  if (legal.length === 0) return hand[0];

  const myTeam = players[myIndex].team;
  const bidderTeam = players[bidWinner]?.team;

  // Leading: pick a strong card from our longest suit.
  if (!ledSuit) {
    // Prefer a high trump if we have many, else a high off-suit card.
    const sortedByStrength = [...legal].sort((a, b) => getTrickStrength(b.rank) - getTrickStrength(a.rank));
    return sortedByStrength[0];
  }

  // Following: compute current winner of trick-in-progress.
  const trumpActive = trumpRevealed && trump != null;
  const currentBestCard = trumpActive && trickCards.some(c => c.suit === trump)
    ? trickCards.filter(c => c.suit === trump).reduce((best, c) => getTrickStrength(c.rank) > getTrickStrength(best.rank) ? c : best)
    : trickCards.filter(c => c.suit === ledSuit).reduce((best, c) => getTrickStrength(c.rank) > getTrickStrength(best.rank) ? c : best, trickCards[0]);

  const canFollow = hand.some(c => c.suit === ledSuit);
  if (canFollow) {
    const suitCards = legal.filter(c => c.suit === ledSuit);
    // Try to win with smallest winning card.
    const mustBeatSuit = !trumpActive || !trickCards.some(c => c.suit === trump);
    if (mustBeatSuit) {
      const winning = suitCards.filter(c => getTrickStrength(c.rank) > getTrickStrength(currentBestCard.rank));
      if (winning.length > 0) {
        winning.sort((a, b) => getTrickStrength(a.rank) - getTrickStrength(b.rank));
        return winning[0];
      }
    }
    // Can't win — dump the lowest-value card in the led suit.
    suitCards.sort((a, b) => (getPointsForCard(a) + getTrickStrength(a.rank) * 0.1) - (getPointsForCard(b) + getTrickStrength(b.rank) * 0.1));
    return suitCards[0];
  }

  // Can't follow: option to ruff with trump, or slough off.
  if (trumpActive && trump) {
    const trumps = legal.filter(c => c.suit === trump);
    // If partner is currently winning, don't overtrump.
    const leaderPlay = trickPlays[0];
    const currentWinnerIndex = trumpActive && trickCards.some(c => c.suit === trump)
      ? trickPlays.filter(tp => tp.card.suit === trump).reduce((best, tp) => getTrickStrength(tp.card.rank) > getTrickStrength(best.card.rank) ? tp : best).playerIndex
      : trickPlays.filter(tp => tp.card.suit === ledSuit).reduce((best, tp) => getTrickStrength(tp.card.rank) > getTrickStrength(best.card.rank) ? tp : best, leaderPlay).playerIndex;
    const partnerWinning = players[currentWinnerIndex]?.team === myTeam;

    if (!partnerWinning && trumps.length > 0) {
      // Overtrump with smallest that wins.
      const currentBestTrump = trickCards.filter(c => c.suit === trump);
      const minStrength = currentBestTrump.length > 0
        ? Math.max(...currentBestTrump.map(c => getTrickStrength(c.rank)))
        : 0;
      const winningTrumps = trumps.filter(c => getTrickStrength(c.rank) > minStrength);
      if (winningTrumps.length > 0) {
        winningTrumps.sort((a, b) => getTrickStrength(a.rank) - getTrickStrength(b.rank));
        return winningTrumps[0];
      }
    }
  }

  // Slough off the least-valuable card.
  const sorted = [...legal].sort(
    (a, b) => (getPointsForCard(a) + getTrickStrength(a.rank) * 0.1) - (getPointsForCard(b) + getTrickStrength(b.rank) * 0.1)
  );
  return sorted[0];
}

