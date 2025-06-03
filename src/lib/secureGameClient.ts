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
    const startTime = performance.now();
    try {
      const fetchStartTime = performance.now();
      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName })
      });
      const fetchEndTime = performance.now();

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
        
        // Get the first event from the updated game state (optimize by avoiding dynamic import)
        let currentEvent: Event | undefined;
        if (result.gameState.currentEventId) {
          try {
            // Import events statically - more efficient than dynamic import
            const events = await import('$lib/content/events');
            currentEvent = (events.default as Event[]).find(e => e.id === result.gameState.currentEventId);
          } catch (error) {
            console.error('Error loading events:', error);
          }
        }
        
        const totalTime = performance.now() - startTime;
        const networkTime = fetchEndTime - fetchStartTime;
        console.log(`[PERF] SecureGameClient.startGame - Total: ${totalTime.toFixed(2)}ms, Network: ${networkTime.toFixed(2)}ms`);

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
        // If game ended, clear only the game session, keep player identity
        if (result.gameEnded) {
          this.gameId = null;
          // Keep playerId for persistent identity across games
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
   * Check if there's an active game session
   */
  hasActiveSession(): boolean {
    const hasSession = this.gameId !== null;
    console.log('hasActiveSession check:', { gameId: this.gameId, playerId: this.playerId, hasSession });
    return hasSession;
  }

  /**
   * Check if there's a persistent player identity
   */
  hasPlayerIdentity(): boolean {
    return this.playerId !== null;
  }

  /**
   * Get the current player ID (persistent across game sessions)
   */
  getPlayerId(): string | null {
    return this.playerId;
  }

  /**
   * Clear the current session (for logout/reset)
   * Only clears game session, keeps player identity persistent
   */
  clearSession(): void {
    this.gameId = null;
    // Don't clear playerId - player identity should persist across games
    // this.playerId = null;
  }
}

// Export singleton instance with debug info
const instance = new SecureGameClient();
console.log('SecureGameClient singleton created:', instance);
export const secureGameClient = instance; 