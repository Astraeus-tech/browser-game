import { eq, desc, and, isNull, isNotNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { GameState } from '../types';
import { db } from './index';
import { gameActions } from './schema';

export interface GameMetadata {
  seed?: string;
  difficulty?: string;
  settings?: Record<string, any>;
}

export interface GameAction {
  type: 'start' | 'choice' | 'end';
  data: {
    eventId?: string;
    choiceId?: string;
    choiceIndex?: number;
    choiceLabel?: string;
    choice?: any;
    meterChanges?: Record<string, number>;
    eventData?: any;
    [key: string]: any;
  };
}

/**
 * SIMPLIFIED Server Game Manager
 * 
 * Uses single gameActions table with full game state for:
 * - Complete audit trail
 * - Fast current state retrieval
 * - Simple active game tracking
 */
export class ServerGameManager {
  /**
   * Start a new game session - creates initial action with full state
   */
  static async startGame(playerId: string, initialGameState: GameState, metadata: GameMetadata = {}): Promise<string> {
    const gameId = uuidv4();
    
    // Create initial 'start' action with full game state
    await db.insert(gameActions).values({
      id: uuidv4(),
      player_id: playerId,
      game_id: gameId,
      action_type: 'start',
      action_data: { metadata, startedAt: Date.now() },
      full_game_state: initialGameState,
      sequence_number: 1,
      game_ended_at: null, // Active game
      created_at: new Date()
    });

    return gameId;
  }

  /**
   * Get current game state for a player - simple latest action query
   */
  static async getGameState(playerId: string): Promise<{ gameId: string; gameState: GameState; metadata?: GameMetadata } | null> {
    // Get latest action for this player where game hasn't ended
    const latestAction = await db.select()
      .from(gameActions)
      .where(and(
        eq(gameActions.player_id, playerId),
        isNull(gameActions.game_ended_at) // Only active games
      ))
      .orderBy(desc(gameActions.sequence_number))
      .limit(1);

    if (!latestAction.length) return null;

    const action = latestAction[0];
    const metadata = action.action_type === 'start' ? (action.action_data as any).metadata : undefined;

    return {
      gameId: action.game_id,
      gameState: action.full_game_state,
      metadata
    };
  }

  /**
   * Get most recent completed game state for a player - for score submission
   */
  static async getMostRecentCompletedGame(playerId: string): Promise<{ gameId: string; gameState: GameState; metadata?: GameMetadata } | null> {
    // Get latest action for this player where game HAS ended
    const latestAction = await db.select()
      .from(gameActions)
      .where(and(
        eq(gameActions.player_id, playerId),
        isNotNull(gameActions.game_ended_at) // Only completed games
      ))
      .orderBy(desc(gameActions.created_at))
      .limit(1);

    if (!latestAction.length) return null;

    const action = latestAction[0];
    
    return {
      gameId: action.game_id,
      gameState: action.full_game_state,
      metadata: undefined // Could get from start action if needed
    };
  }

  /**
   * Update game state with an action - single insert operation
   */
  static async updateGameState(
    gameId: string, 
    playerId: string, 
    newGameState: GameState, 
    action: GameAction
  ): Promise<void> {
    // Get current sequence number for this game
    const lastAction = await db.select({ sequence_number: gameActions.sequence_number })
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId))
      .orderBy(desc(gameActions.sequence_number))
      .limit(1);

    const nextSequence = lastAction.length ? lastAction[0].sequence_number + 1 : 1;

    // Insert new action with complete game state
    await db.insert(gameActions).values({
      id: uuidv4(),
      player_id: playerId,
      game_id: gameId,
      action_type: action.type,
      action_data: action.data,
      full_game_state: newGameState,
      sequence_number: nextSequence,
      game_ended_at: null, // Still active
      created_at: new Date()
    });
  }

  /**
   * End a game - mark all actions for this game as ended
   */
  static async endGame(gameId: string, playerId: string, finalGameState: GameState): Promise<void> {
    // Get the current sequence number
    const lastAction = await db.select({ sequence_number: gameActions.sequence_number })
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId))
      .orderBy(desc(gameActions.sequence_number))
      .limit(1);

    const nextSequence = lastAction.length ? lastAction[0].sequence_number + 1 : 1;

    // Create final 'end' action
    await db.insert(gameActions).values({
      id: uuidv4(),
      player_id: playerId,
      game_id: gameId,
      action_type: 'end',
      action_data: { endedAt: Date.now() },
      full_game_state: finalGameState,
      sequence_number: nextSequence,
      game_ended_at: new Date(), // Mark as ended
      created_at: new Date()
    });

    // Mark all previous actions for this game as ended
    await db.update(gameActions)
      .set({ game_ended_at: new Date() })
      .where(and(
        eq(gameActions.game_id, gameId),
        isNull(gameActions.game_ended_at)
      ));
  }

  /**
   * Get complete game history for analysis
   */
  static async getGameHistory(gameId: string): Promise<any[]> {
    const actions = await db.select()
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId))
      .orderBy(gameActions.sequence_number);

    return actions;
  }

  /**
   * Get all active games (for admin/debugging)
   */
  static async getActiveGames(): Promise<any[]> {
    const activeGames = await db.select()
      .from(gameActions)
      .where(isNull(gameActions.game_ended_at))
      .orderBy(desc(gameActions.created_at));

    // Group by game_id and return latest action for each game
    const gameMap = new Map();
    for (const action of activeGames) {
      if (!gameMap.has(action.game_id) || action.sequence_number > gameMap.get(action.game_id).sequence_number) {
        gameMap.set(action.game_id, action);
      }
    }

    return Array.from(gameMap.values());
  }

  /**
   * Validate that a game action is legitimate
   */
  static validateAction(gameState: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'start':
        return true; // Basic validation
      case 'choice':
        return action.data.choiceIndex !== undefined && action.data.eventId !== undefined;
      case 'end':
        return true;
      default:
        return false;
    }
  }

  /**
   * Reconstruct game state at any point (for debugging/analysis)
   */
  static async reconstructGameState(gameId: string, targetSequence?: number): Promise<GameState | null> {
    let query;
    
    if (targetSequence) {
      query = db.select()
        .from(gameActions)
        .where(and(
          eq(gameActions.game_id, gameId),
          eq(gameActions.sequence_number, targetSequence)
        ));
    } else {
      query = db.select()
        .from(gameActions)
        .where(eq(gameActions.game_id, gameId))
        .orderBy(desc(gameActions.sequence_number))
        .limit(1);
    }

    const actions = await query;
    return actions.length ? actions[0].full_game_state : null;
  }

  /**
   * Clean up old completed games (optional maintenance)
   */
  static async cleanupOldGames(olderThanDays: number = 30): Promise<number> {
    // For now, just return 0 - cleanup can be implemented later with proper Drizzle syntax
    return 0;
  }
} 