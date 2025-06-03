import type { GameState, Event } from './types';

/**
 * Secure Game Client
 * 
 * This client handles all game logic on the server, providing
 * the same interface as the existing local game logic but with
 * server-side validation and anti-cheat protection.
 */
export class SecureGameClient {
  private gameId: string | null = null;
  private playerId: string | null = null;

  /**
   * Start a new secure game session
   */
  async startGame(displayName: string): Promise<{ success: boolean; gameState?: GameState; currentEvent?: Event; error?: string }> {
    try {
      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', response.status, errorText);
        return {
          success: false,
          error: `Server error: ${response.status} ${response.statusText}`
        };
      }

      const result = await response.json();
      console.log('Server response:', result);

      if (result.success) {
        console.log('Setting gameId:', result.gameId, 'playerId:', result.playerId);
        this.gameId = result.gameId;
        this.playerId = result.playerId;
        
        console.log('SecureGameClient state after setting:', { gameId: this.gameId, playerId: this.playerId });
        
        // Get the first event from the updated game state
        const currentEvent = await this.getCurrentEvent(result.gameState);
        
        return {
          success: true,
          gameState: result.gameState,
          currentEvent
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to start game'
        };
      }
    } catch (error) {
      console.error('Error starting secure game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Make a choice in the current game
   */
  async makeChoice(choiceIndex: number): Promise<{ success: boolean; gameState?: GameState; gameEnded?: boolean; nextEvent?: Event; finalScore?: number; error?: string }> {
    console.log('makeChoice called with current state:', { gameId: this.gameId, playerId: this.playerId, choiceIndex });
    
    if (!this.gameId || !this.playerId) {
      console.error('No active game session - gameId:', this.gameId, 'playerId:', this.playerId);
      return { success: false, error: 'No active game session' };
    }

    try {
      const response = await fetch('/api/game/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: this.gameId,
          playerId: this.playerId,
          choiceIndex
        })
      });

      const result = await response.json();

      if (result.success) {
        // If game ended, clear the session
        if (result.gameEnded) {
          this.gameId = null;
          this.playerId = null;
        }

        return {
          success: true,
          gameState: result.gameState,
          gameEnded: result.gameEnded,
          nextEvent: result.nextEvent,
          finalScore: result.finalScore
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to process choice'
        };
      }
    } catch (error) {
      console.error('Error making choice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the current game status
   */
  async getGameStatus(): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
    if (!this.gameId || !this.playerId) {
      return { success: false, error: 'No active game session' };
    }

    try {
      const response = await fetch(`/api/game/status/${this.gameId}?playerId=${this.playerId}`);
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          gameState: result.gameState
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to get game status'
        };
      }
    } catch (error) {
      console.error('Error getting game status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper method to get current event from game state
   */
  private async getCurrentEvent(gameState: GameState): Promise<Event | undefined> {
    if (!gameState.currentEventId) {
      return undefined;
    }

    try {
      // Import events dynamically to avoid SSR issues
      const events = await import('$lib/content/events');
      return (events.default as Event[]).find(e => e.id === gameState.currentEventId);
    } catch (error) {
      console.error('Error loading events:', error);
      return undefined;
    }
  }

  /**
   * Check if there's an active game session
   */
  hasActiveSession(): boolean {
    const hasSession = this.gameId !== null && this.playerId !== null;
    console.log('hasActiveSession check:', { gameId: this.gameId, playerId: this.playerId, hasSession });
    return hasSession;
  }

  /**
   * Clear the current session (for logout/reset)
   */
  clearSession(): void {
    this.gameId = null;
    this.playerId = null;
  }
}

// Export singleton instance with debug info
const instance = new SecureGameClient();
console.log('SecureGameClient singleton created:', instance);
export const secureGameClient = instance; 