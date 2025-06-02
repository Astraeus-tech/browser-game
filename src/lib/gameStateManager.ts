import { browser } from '$app/environment';
import { getPlayerId } from './player';
import type { GameState } from './types';

/**
 * Server-Authoritative Game State Manager
 * 
 * Integrates with the new server-authoritative game infrastructure:
 * - Uses /api/server-game/* endpoints
 * - Maintains localStorage backup for offline capability
 * - Handles action validation and state synchronization
 */

export interface GameAction {
  type: 'choice' | 'event' | 'meter_change' | 'quarter_advance';
  data: any;
  timestamp?: number;
}

export interface CheckpointType {
  type: 'start' | 'quarter' | 'end' | 'manual';
}

class GameStateManager {
  private currentGameId: string | null = null;
  private actionSequence: number = 0;
  private pendingActions: GameAction[] = [];
  private lastCheckpoint: GameState | null = null;

  /**
   * Initialize a new game session using server-authoritative system
   */
  async startGame(initialState: GameState): Promise<string | null> {
    const databaseMode = import.meta.env.VITE_DATABASE_MODE;
    
    if (databaseMode !== 'remote') {
      // Local mode - just use localStorage
      this.saveToLocalStorage(initialState);
      return 'local-game';
    }

    try {
      const playerId = getPlayerId();
      if (!playerId) {
        console.warn('No player ID for remote game start, using localStorage');
        this.saveToLocalStorage(initialState);
        return null;
      }

      const response = await fetch('/api/server-game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          initialGameState: initialState,
          metadata: { 
            startedAt: Date.now(),
            seed: initialState.seed?.toString() || Math.random().toString(),
            difficulty: 'normal'
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        this.currentGameId = result.gameId;
        this.actionSequence = 0;
        this.lastCheckpoint = initialState;
        this.pendingActions = [];
        
        // Also save to localStorage as backup
        this.saveToLocalStorage(initialState);
        
        console.log('Server-authoritative game started with ID:', this.currentGameId);
        return this.currentGameId;
      } else {
        console.warn('Failed to start remote game:', result.error);
        this.saveToLocalStorage(initialState);
        return null;
      }
    } catch (error) {
      console.error('Error starting remote game:', error);
      this.saveToLocalStorage(initialState);
      return null;
    }
  }

  /**
   * Save game state with server-side validation and checkpointing
   */
  async saveGameState(gameState: GameState, action?: GameAction): Promise<boolean> {
    const databaseMode = import.meta.env.VITE_DATABASE_MODE;
    
    // Always save to localStorage immediately for responsiveness
    this.saveToLocalStorage(gameState);
    
    if (databaseMode !== 'remote' || !this.currentGameId) {
      return true; // Local mode or no active game
    }

    // If we have an action, send it to the server for validation and processing
    if (action) {
      return this.submitAction(gameState, action);
    } else {
      // Force a checkpoint for explicit saves
      return this.createManualCheckpoint(gameState);
    }
  }

  /**
   * Load game state from server with localStorage fallback
   */
  async loadGameState(): Promise<GameState | null> {
    const databaseMode = import.meta.env.VITE_DATABASE_MODE;
    
    if (databaseMode !== 'remote') {
      return this.loadFromLocalStorage();
    }

    try {
      const playerId = getPlayerId();
      if (!playerId) {
        return this.loadFromLocalStorage();
      }

      const response = await fetch(`/api/server-game/state?playerId=${encodeURIComponent(playerId)}`);
      const result = await response.json();

      if (result.success && result.gameState) {
        this.currentGameId = result.gameId;
        this.lastCheckpoint = result.gameState;
        
        // Also save to localStorage as backup
        this.saveToLocalStorage(result.gameState);
        
        console.log('Game state loaded from server-authoritative system');
        return result.gameState;
      } else {
        console.log('No remote game state found, checking localStorage');
        return this.loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error loading remote game state:', error);
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Submit an action to the server for validation and state update
   */
  async submitAction(newGameState: GameState, action: GameAction): Promise<boolean> {
    try {
      const playerId = getPlayerId();
      if (!playerId || !this.currentGameId) {
        console.warn('Cannot submit action: missing player ID or game ID');
        return false;
      }

      // Prepare action data for server validation
      const serverAction = {
        type: action.type,
        data: {
          ...action.data,
          timestamp: action.timestamp || Date.now()
        }
      };

      const response = await fetch('/api/server-game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: this.currentGameId,
          playerId,
          newGameState,
          action: serverAction
        })
      });

      const result = await response.json();
      if (result.success) {
        this.actionSequence++;
        console.log('Action validated and processed by server:', action.type);
        return true;
      } else {
        console.warn('Server rejected action:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error submitting action to server:', error);
      return false;
    }
  }

  /**
   * Force save current state as checkpoint (for critical moments)
   */
  async forceCheckpoint(gameState: GameState, type: CheckpointType['type'] = 'manual'): Promise<boolean> {
    if (import.meta.env.VITE_DATABASE_MODE !== 'remote' || !this.currentGameId) {
      this.saveToLocalStorage(gameState);
      return true;
    }

    return this.createManualCheckpoint(gameState);
  }

  /**
   * End current game session using server-authoritative system
   */
  async endGame(finalState: GameState): Promise<boolean> {
    const databaseMode = import.meta.env.VITE_DATABASE_MODE;
    
    // Always save to localStorage
    this.saveToLocalStorage(finalState);
    
    if (databaseMode === 'remote' && this.currentGameId) {
      try {
        const playerId = getPlayerId();
        if (playerId) {
          const response = await fetch('/api/server-game/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: this.currentGameId,
              playerId,
              finalGameState: finalState
            })
          });

          const result = await response.json();
          if (result.success) {
            console.log('Game ended successfully on server');
          } else {
            console.warn('Failed to end game on server:', result.error);
          }
        }
      } catch (error) {
        console.error('Error ending game on server:', error);
      }
    }
    
    // Clean up client state
    this.currentGameId = null;
    this.actionSequence = 0;
    this.pendingActions = [];
    this.lastCheckpoint = null;
    
    return true;
  }

  /**
   * Get current game ID (useful for debugging/admin)
   */
  getCurrentGameId(): string | null {
    return this.currentGameId;
  }

  /**
   * Check if we have an active server-side game
   */
  hasActiveServerGame(): boolean {
    return this.currentGameId !== null && import.meta.env.VITE_DATABASE_MODE === 'remote';
  }

  // Private methods

  private async createManualCheckpoint(gameState: GameState): Promise<boolean> {
    // For manual checkpoints, we just save state locally and let the server
    // handle checkpointing through the action system
    this.saveToLocalStorage(gameState);
    return true;
  }

  private saveToLocalStorage(gameState: GameState): boolean {
    if (!browser) return false;
    
    try {
      localStorage.setItem('game', JSON.stringify(gameState));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  private loadFromLocalStorage(): GameState | null {
    if (!browser) return null;
    
    try {
      const raw = localStorage.getItem('game');
      if (raw) {
        return JSON.parse(raw) as GameState;
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    return null;
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager();

// Convenience functions for backward compatibility
export async function saveGameState(gameState: GameState, action?: GameAction): Promise<boolean> {
  return gameStateManager.saveGameState(gameState, action);
}

export async function loadGameState(): Promise<GameState | null> {
  return gameStateManager.loadGameState();
}

export async function startNewGame(initialState: GameState): Promise<string | null> {
  return gameStateManager.startGame(initialState);
}

export async function endCurrentGame(finalState: GameState): Promise<boolean> {
  return gameStateManager.endGame(finalState);
}

export async function forceCheckpoint(gameState: GameState): Promise<boolean> {
  return gameStateManager.forceCheckpoint(gameState);
}

// New server-authoritative functions
export async function submitGameAction(newGameState: GameState, action: GameAction): Promise<boolean> {
  return gameStateManager.submitAction(newGameState, action);
}

export function getCurrentGameId(): string | null {
  return gameStateManager.getCurrentGameId();
}

export function hasActiveServerGame(): boolean {
  return gameStateManager.hasActiveServerGame();
} 