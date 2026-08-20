import React, { useState } from 'react';
import {
  LobbyShell, LobbyPanel, LobbyNotice, ResumeSessionCard, SeatRow, TeamToggle,
  lobbyInputClass, lobbyInputStyle,
} from '@laurelwood/card-class';
import { GameState } from '../types';
import { SavedSession, clearSession } from '../utils/session';
import { EMPTY_SLOT_NAME, TEAM_LABELS } from '../constants';
import { Rulebook } from '../components/Rulebook';

interface LobbyProps {
  state: GameState;
  isMultiplayer: boolean;
  isHost: boolean;
  peerId: string;
  myIndex: number;
  playerName: string;
  setPlayerName: (n: string) => void;
  joinId: string;
  setJoinId: (s: string) => void;
  savedSession: SavedSession | null;
  setSavedSession: (s: SavedSession | null) => void;
  joinError: string | null;
  clearJoinError: () => void;
  onCreateRoom: (resume?: Extract<SavedSession, { role: 'host' }>) => void;
  onJoinRoom: (resume?: Extract<SavedSession, { role: 'client' }>) => void;
  onStartSinglePlayer: () => void;
  onStartRound: () => void;
  onSetTeam: (playerIndex: number, team: 0 | 1) => void;
  onLeaveRoom: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  state, isMultiplayer, isHost, peerId, myIndex,
  playerName, setPlayerName,
  joinId, setJoinId,
  savedSession, setSavedSession,
  joinError, clearJoinError,
  onCreateRoom, onJoinRoom, onStartSinglePlayer, onStartRound, onSetTeam, onLeaveRoom,
}) => {
  const [showRulebook, setShowRulebook] = useState(false);
  if (showRulebook) return <Rulebook onClose={() => setShowRulebook(false)} />;

  return (
    <LobbyShell>
      {!isMultiplayer ? (
        <LobbyPanel title="29" subtitle="Partnership Trick-Taking">
          {joinError && <LobbyNotice message={joinError} onDismiss={clearJoinError} />}
          {savedSession && (
            <ResumeSessionCard
              role={savedSession.role}
              roomId={savedSession.roomId}
              playerName={savedSession.playerName}
              onResume={() => {
                if (savedSession.role === 'host') onCreateRoom(savedSession);
                else onJoinRoom(savedSession);
                setSavedSession(null);
              }}
              onDiscard={() => { clearSession(); setSavedSession(null); }}
            />
          )}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={15}
              className={lobbyInputClass}
              style={lobbyInputStyle}
            />
            <button
              onClick={() => onCreateRoom()}
              className="btn-accent w-full py-3.5 rounded-xl text-base sm:text-lg font-semibold"
            >
              Create Room
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Room ID"
                value={joinId}
                onChange={e => setJoinId(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl px-4 py-3 text-center focus:outline-none font-semibold transition-all"
                style={lobbyInputStyle}
              />
              <button
                onClick={() => onJoinRoom()}
                className="px-5 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all active:scale-95"
                style={{ background: 'var(--bg-1)', color: 'var(--fg)', border: '1px solid var(--accent-soft)' }}
              >
                Join
              </button>
            </div>
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
              <span className="uppercase text-[10px] tracking-[0.18em]" style={{ color: 'var(--dim)' }}>Practice</span>
              <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
            </div>
            <button
              onClick={onStartSinglePlayer}
              className="w-full py-3 rounded-xl text-base font-semibold transition-all active:scale-[0.98] hover:brightness-110"
              style={{
                background: 'linear-gradient(180deg, #b8e0b0 0%, #8fc992 100%)',
                color: '#0f2a1a',
                border: '1px solid rgba(127,215,169,0.5)',
                boxShadow: '0 4px 14px rgba(127,215,169,0.25)',
              }}
            >
              Single Player
            </button>
            <button
              onClick={() => setShowRulebook(true)}
              className="w-full py-3 rounded-xl text-base transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-1)', color: 'var(--fg-soft)', border: '1px solid var(--line)' }}
            >
              Rulebook
            </button>
          </div>
        </LobbyPanel>
      ) : (
        <LobbyPanel wide heading="Lobby">
          {isHost && (
            <div className="mb-5 p-4 rounded-xl text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--dim)' }}>Share this Room ID with friends:</p>
              <p
                className="text-xl sm:text-2xl font-mono tracking-widest select-all cursor-pointer hover:brightness-110"
                style={{ color: 'var(--accent)' }}
                onClick={() => navigator.clipboard.writeText(peerId)}
              >
                {peerId}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {state.players.map((p, i) => {
              const isEmpty = p.name === EMPTY_SLOT_NAME;
              const isMe = i === myIndex;
              return (
                <SeatRow
                  key={i}
                  seatNumber={i + 1}
                  name={p.name}
                  isEmpty={isEmpty}
                  isMe={isMe}
                  isBot={!p.isHuman}
                >
                  {!isEmpty && p.isHuman && (
                    <TeamToggle team={p.team} interactive={isMe} onPick={t => onSetTeam(i, t)} />
                  )}
                </SeatRow>
              );
            })}
          </div>
          {(() => {
            const humanTeam0 = state.players.filter(p => p.isHuman && p.team === 0).length;
            const humanTeam1 = state.players.filter(p => p.isHuman && p.team === 1).length;
            const overflowTeam = humanTeam0 > 2 ? 0 : humanTeam1 > 2 ? 1 : null;
            const teamsValid = overflowTeam === null;
            return (
              <>
                {!teamsValid && (
                  <p className="text-center text-xs mb-3" style={{ color: 'var(--red, #ff5a6e)' }}>
                    Team {TEAM_LABELS[overflowTeam!]} has too many players (max 2). Have someone switch teams.
                  </p>
                )}
                {isHost ? (
                  <button
                    onClick={onStartRound}
                    disabled={!teamsValid}
                    className={`w-full py-3.5 rounded-xl text-base sm:text-lg font-semibold transition-all ${teamsValid ? 'btn-accent' : ''}`}
                    style={!teamsValid ? {
                      background: 'var(--bg-1)',
                      color: 'var(--dimmer)',
                      border: '1px solid var(--line-soft)',
                      cursor: 'not-allowed',
                    } : undefined}
                  >
                    Start Game
                  </button>
                ) : (
                  <div className="text-center animate-pulse" style={{ color: 'var(--fg-soft)' }}>Waiting for host to start</div>
                )}
              </>
            );
          })()}
          <button
            onClick={onLeaveRoom}
            className="mt-3 w-full py-2 text-sm transition-colors"
            style={{ color: 'var(--dim)' }}
          >
            Leave
          </button>
        </LobbyPanel>
      )}
    </LobbyShell>
  );
};
