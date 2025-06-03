import { eq, desc, and, isNull, isNotNull, sql } from 'drizzle-orm';
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
   * Get current game state for a player - optimized to avoid marking actions as ended
   */
  static async getGameState(playerId: string): Promise<{ gameId: string; gameState: GameState; metadata?: GameMetadata } | null> {
    // Get latest action for this player
    const latestAction = await db.select()
      .from(gameActions)
      .where(eq(gameActions.player_id, playerId))
      .orderBy(desc(gameActions.sequence_number))
      .limit(1);

    if (!latestAction.length) return null;

    const action = latestAction[0];
    
    // If the latest action is 'end', the game is over - return null for active games
    if (action.action_type === 'end') {
      return null;
    }
    
    // Get metadata from action_data (cached in all actions)
    const metadata = (action.action_data as any).metadata;

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
    // Get latest action for this player where action type is 'end'
    const latestAction = await db.select()
      .from(gameActions)
      .where(and(
        eq(gameActions.player_id, playerId),
        eq(gameActions.action_type, 'end') // Only completed games
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
   * Update game state with an action - simplified without game_ended_at tracking
   */
  static async updateGameState(
    gameId: string, 
    playerId: string, 
    newGameState: GameState, 
    action: GameAction,
    metadata?: GameMetadata
  ): Promise<void> {
    // Get current sequence number using optimized indexed query
    const seqStartTime = performance.now();
    const result = await db.select({ 
      max_sequence: sql<number>`COALESCE(MAX(${gameActions.sequence_number}), 0)` 
    })
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId));
    const seqTime = performance.now() - seqStartTime;

    const nextSequence = (result[0]?.max_sequence || 0) + 1;

    // Cache metadata in action_data for performance
    const actionDataWithMetadata = {
      ...action.data,
      metadata: metadata
    };

    // Insert new action with complete game state
    const insertStartTime = performance.now();
    await db.insert(gameActions).values({
      id: uuidv4(),
      player_id: playerId,
      game_id: gameId,
      action_type: action.type,
      action_data: actionDataWithMetadata,
      full_game_state: newGameState,
      sequence_number: nextSequence,
      game_ended_at: null, // Not used for tracking anymore
      created_at: new Date()
    });
    const insertTime = performance.now() - insertStartTime;
    
    console.log(`[PERF] updateGameState - Sequence query: ${seqTime.toFixed(2)}ms, Insert: ${insertTime.toFixed(2)}ms`);
  }

  /**
   * End a game - MUCH faster without mass UPDATE operation
   */
  static async endGame(gameId: string, playerId: string, finalGameState: GameState, metadata?: GameMetadata): Promise<void> {
    const endTime = new Date();
    
    // Get sequence number for final action
    const seqStartTime = performance.now();
    const result = await db.select({ 
      max_sequence: sql<number>`COALESCE(MAX(${gameActions.sequence_number}), 0)` 
    })
      .from(gameActions)
      .where(eq(gameActions.game_id, gameId));
    const seqTime = performance.now() - seqStartTime;

    const nextSequence = (result[0]?.max_sequence || 0) + 1;

    // Create final 'end' action - this alone marks the game as ended
    const insertStartTime = performance.now();
    await db.insert(gameActions).values({
      id: uuidv4(),
      player_id: playerId,
      game_id: gameId,
      action_type: 'end',
      action_data: { endedAt: Date.now(), metadata },
      full_game_state: finalGameState,
      sequence_number: nextSequence,
      game_ended_at: endTime,
      created_at: endTime
    });
    const insertTime = performance.now() - insertStartTime;

    // NO MORE EXPENSIVE UPDATE OPERATION!
    // The presence of an 'end' action is sufficient to mark the game as completed
    
    console.log(`[PERF] endGame - Sequence: ${seqTime.toFixed(2)}ms, Insert: ${insertTime.toFixed(2)}ms, Update: ELIMINATED`);
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
   * Get all active games (for admin/debugging) - using new logic
   */
  static async getActiveGames(): Promise<any[]> {
    // Get all games that don't have an 'end' action as their latest action
    const allLatestActions = await db.select()
      .from(gameActions)
      .orderBy(desc(gameActions.created_at));

    // Group by game_id and filter out games whose latest action is 'end'
    const gameMap = new Map();
    for (const action of allLatestActions) {
      if (!gameMap.has(action.game_id)) {
        // Only include if latest action is not 'end'
        if (action.action_type !== 'end') {
          gameMap.set(action.game_id, action);
        }
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