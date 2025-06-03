import { browser } from '$app/environment';

const DISPLAY_NAME_KEY = 'display_name';

/**
 * Simple localStorage display name storage for good UX
 * Server handles all player identity internally
 */

export function getPlayerId(): string | null {
  return null; // Server handles player identity
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