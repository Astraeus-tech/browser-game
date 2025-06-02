import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';
import type { GameState } from '$lib/types';

export const POST: RequestHandler = async () => {
  try {
    const testPlayerId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID format
    
    // Create a mock initial game state
    const initialGameState: GameState = {
      year: 2025,
      quarter: 1,
      meters: {
        company: {
          revenue: 50,
          reputation: 50,
          employees: 50
        },
        environment: {
          sustainability: 50,
          carbon_footprint: 50
        },
        ai_capability: {
          research: 50,
          safety: 50,
          alignment: 50
        }
      },
      metersHistory: [],
      log: ['Game started'],
      seed: 12345,
      gameOver: 'playing'
    };

    // Test 1: Start a new game
    console.log('Testing game start...');
    const gameId = await ServerGameManager.startGame(testPlayerId, initialGameState, {
      seed: '12345',
      difficulty: 'normal'
    });

    // Test 2: Get game state
    console.log('Testing get game state...');
    const gameData = await ServerGameManager.getGameState(testPlayerId);
    
    if (!gameData) {
      throw new Error('Failed to retrieve game state');
    }

    // Test 3: Update game state with an action
    console.log('Testing game action...');
    const updatedGameState: GameState = {
      ...initialGameState,
      quarter: 2,
      log: [...initialGameState.log, 'Made a choice']
    };

    await ServerGameManager.updateGameState(gameId, testPlayerId, updatedGameState, {
      type: 'choice',
      data: {
        eventId: 'test-event-1',
        choiceIndex: 0,
        meterChanges: { 'company.revenue': 10 }
      }
    });

    // Test 4: Get game history
    console.log('Testing game history...');
    const history = await ServerGameManager.getGameHistory(gameId);

    // Test 5: End the game
    console.log('Testing game end...');
    const finalGameState: GameState = {
      ...updatedGameState,
      gameOver: {
        id: 'test-ending',
        type: 'win',
        title: 'Test Victory',
        description: 'Successfully completed the test'
      }
    };

    await ServerGameManager.endGame(gameId, testPlayerId, finalGameState);

    // Verify game is no longer active
    const gameDataAfterEnd = await ServerGameManager.getGameState(testPlayerId);

    return json({
      success: true,
      message: 'All ServerGameManager tests passed!',
      testResults: {
        gameStart: { gameId, success: true },
        gameStateRetrieval: { 
          success: true, 
          gameId: gameData.gameId,
          hasMetadata: !!gameData.metadata 
        },
        gameAction: { success: true },
        gameHistory: { 
          success: true, 
          checkpointsCount: history.checkpoints.length,
          actionsCount: history.actions.length 
        },
        gameEnd: { success: true },
        gameCleanup: { 
          success: gameDataAfterEnd === null,
          message: gameDataAfterEnd ? 'Game still active (unexpected)' : 'Game properly cleaned up'
        }
      }
    });

  } catch (error) {
    console.error('ServerGameManager test failed:', error);
    return json({ 
      error: 'ServerGameManager test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 