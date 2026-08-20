import { createSessionStore } from '@laurelwood/card-class';
import type { SavedSession as SharedSavedSession } from '@laurelwood/card-class';
import type { GameState } from '../types';

/**
 * Reconnect memory. The store itself is shared; what belongs to 29 is the
 * storage key and what counts as a state this build can still load.
 */
const store = createSessionStore<GameState>({
  key: 'nine_session_v1',
  isValidState: s => Array.isArray(s.players) && !!s.gamePhase,
});

export type SavedSession = SharedSavedSession<GameState>;
export type HostSession = Extract<SavedSession, { role: 'host' }>;
export type ClientSession = Extract<SavedSession, { role: 'client' }>;

export const saveSession = store.save;
export const loadSession = store.load;
export const clearSession = store.clear;
