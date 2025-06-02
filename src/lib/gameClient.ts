import { browser } from '$app/environment';
import { getPlayerId } from './player';
import type { GameState, Choice, Event } from './types';
import { gameStateManager, type GameAction } from './gameStateManager';

/**
 * Client-side service for server-authoritative game operations
 * 
 * This service handles the communication between the client and server
 * for all game state changes, ensuring anti-cheat validation.
 */

export interface ServerGameResponse {
  success: boolean;
  gameState?: GameState;
  error?: string;
  message?: string;
}

export interface ChoiceSubmission {
  eventId: string;
  choiceIndex: number;
  choiceLabel: string;
  currentState: GameState;
}

class GameClient {
  private isServerMode: boolean;

  constructor() {
    this.isServerMode = browser && import.meta.env.VITE_DATABASE_MODE === 'remote';
  }

  /**
   * Start a new server-authoritative game
   */
  async startGame(initialState: GameState): Promise<ServerGameResponse> {
    if (!this.isServerMode) {
      // Local mode - use existing localStorage logic
      return { success: true, gameState: initialState };
    }

    try {
      const gameId = await gameStateManager.startGame(initialState);
      if (gameId) {
        return { 
          success: true, 
          gameState: initialState,
          message: `Server game started with ID: ${gameId}`
        };
      } else {
        return { 
          success: false, 
          error: 'Failed to start server-authoritative game' 
        };
      }
    } catch (error) {
      console.error('Error starting server game:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Submit a choice to the server for validation and processing
   */
  async submitChoice(submission: ChoiceSubmission): Promise<ServerGameResponse> {
    if (!this.isServerMode) {
      // Local mode - apply choice locally without server validation
      const { applyChoice } = await import('./engine');
      const choice = await this.findChoiceByLabel(submission);
      if (!choice) {
        return { success: false, error: 'Choice not found' };
      }
      
      const newState = applyChoice(submission.currentState, choice);
      return { success: true, gameState: newState };
    }

    try {
      const playerId = getPlayerId();
      if (!playerId) {
        return { success: false, error: 'No player ID available' };
      }

      const gameId = gameStateManager.getCurrentGameId();
      if (!gameId) {
        return { success: false, error: 'No active server game' };
      }

      // Apply choice locally first to get the expected new state
      const { applyChoice } = await import('./engine');
      const choice = await this.findChoiceByLabel(submission);
      if (!choice) {
        return { success: false, error: 'Choice not found' };
      }

      const expectedNewState = applyChoice(submission.currentState, choice);

      // Prepare action data for server
      const action: GameAction = {
        type: 'choice',
        data: {
          eventId: submission.eventId,
          choiceIndex: submission.choiceIndex,
          choiceLabel: submission.choiceLabel,
          choice: choice,
          timestamp: Date.now()
        }
      };

      // Submit to server for validation
      const success = await gameStateManager.submitAction(expectedNewState, action);
      
      if (success) {
        return {
          success: true,
          gameState: expectedNewState,
          message: 'Choice validated and processed by server'
        };
      } else {
        return {
          success: false,
          error: 'Server rejected the choice - possible cheating attempt detected'
        };
      }

    } catch (error) {
      console.error('Error submitting choice to server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit choice'
      };
    }
  }

  /**
   * Load game state from server
   */
  async loadGameState(): Promise<ServerGameResponse> {
    try {
      const gameState = await gameStateManager.loadGameState();
      if (gameState) {
        return { success: true, gameState };
      } else {
        return { success: false, error: 'No saved game state found' };
      }
    } catch (error) {
      console.error('Error loading game state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load game state'
      };
    }
  }

  /**
   * End the current game
   */
  async endGame(finalState: GameState): Promise<ServerGameResponse> {
    try {
      const success = await gameStateManager.endGame(finalState);
      return { 
        success, 
        message: success ? 'Game ended successfully' : 'Failed to end game' 
      };
    } catch (error) {
      console.error('Error ending game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end game'
      };
    }
  }

  /**
   * Check if server-authoritative mode is active
   */
  isServerAuthoritative(): boolean {
    return this.isServerMode && gameStateManager.hasActiveServerGame();
  }

  /**
   * Get current game ID (for debugging)
   */
  getCurrentGameId(): string | null {
    return gameStateManager.getCurrentGameId();
  }

  // Private helper methods

  private async findChoiceByLabel(submission: ChoiceSubmission): Promise<Choice | null> {
    try {
      const events = await import('$lib/content/events');
      const currentEvent = (events.default as Event[]).find(e => e.id === submission.eventId);
      if (currentEvent) {
        const choice = currentEvent.choices[submission.choiceIndex];
        if (choice && choice.label === submission.choiceLabel) {
          return choice;
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding choice:', error);
      return null;
    }
  }
}

// Export singleton instance
export const gameClient = new GameClient();

// Convenience functions
export async function startServerGame(initialState: GameState): Promise<ServerGameResponse> {
  return gameClient.startGame(initialState);
}

export async function submitGameChoice(submission: ChoiceSubmission): Promise<ServerGameResponse> {
  return gameClient.submitChoice(submission);
}

export async function loadServerGameState(): Promise<ServerGameResponse> {
  return gameClient.loadGameState();
}

export async function endServerGame(finalState: GameState): Promise<ServerGameResponse> {
  return gameClient.endGame(finalState);
}

export function isServerAuthoritative(): boolean {
  return gameClient.isServerAuthoritative();
}

export function getServerGameId(): string | null {
  return gameClient.getCurrentGameId();
} 