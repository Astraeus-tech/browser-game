import { browser } from '$app/environment';

const PLAYER_ID_KEY = 'player_id';
const DISPLAY_NAME_KEY = 'display_name';

export function getPlayerId(): string | null {
  if (!browser) {
    return null; // crypto.randomUUID and localStorage are browser-only
  }
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string | null {
  if (!browser) {
    return null;
  }
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function setDisplayName(name: string): void {
  if (!browser) {
    return;
  }
  localStorage.setItem(DISPLAY_NAME_KEY, name);
} 