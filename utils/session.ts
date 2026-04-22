import type { GameState } from '../types';

const KEY = 'nine_session_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

type Timestamped<T> = T & { savedAt: number };

export type HostSession = { role: 'host'; roomId: string; playerName: string; state: GameState };
export type ClientSession = { role: 'client'; roomId: string; playerName: string; myPeerId: string };
export type SavedSession = Timestamped<HostSession> | Timestamped<ClientSession>;

export const saveSession = (session: HostSession | ClientSession) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {}
};

const isValidSession = (s: any): s is SavedSession => {
  if (!s || typeof s !== 'object') return false;
  if (typeof s.savedAt !== 'number' || typeof s.roomId !== 'string' || typeof s.playerName !== 'string') return false;
  if (s.role === 'host') {
    return !!s.state && typeof s.state === 'object' && Array.isArray(s.state.players) && !!s.state.gamePhase;
  }
  if (s.role === 'client') {
    return typeof s.myPeerId === 'string';
  }
  return false;
};

export const loadSession = (): SavedSession | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      localStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(KEY); } catch {}
    return null;
  }
};

export const clearSession = () => {
  try { localStorage.removeItem(KEY); } catch {}
};
