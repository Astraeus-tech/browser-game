import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ServerGameManager } from '$lib/db/serverGame';
import type { GameState } from '$lib/types';

export const POST: RequestHandler = async () => {
  try {
    const testPlayerId = '550e8400-e29b-41d4-a716-446655440003'; // Valid UUID format
    
    console.log('Testing SIMPLIFIED single-table architecture...');
    
    // Test data
    const initialGameState: GameState = {
      year: 2025,
      quarter: 3,
      meters: {
        company: {
          revenue: 50,
          reputation: 50,
          employees: 50,
          credits: 100,
          valuation: 2500
        },
        environment: {
          sustainability: 50,
          carbon_footprint: 50,
          stability: 50,
          public_opinion: 50
        },
        ai_capability: {
          research: 50,
          safety: 50,
          alignment: 50,
          progress: 50,
          sentience: 30
        }
      },
      metersHistory: [],
      log: ['Game started with simplified architecture'],
      seed: 12345,
      gameOver: 'playing',
      currentEventId: 'test-event-2025-q3-1'
    };

    // 1. Start game (creates first action with full state)
    console.log('Step 1: Starting game...');
    const gameId = await ServerGameManager.startGame(testPlayerId, initialGameState, {
      seed: '12345',
      difficulty: 'normal'
    });

    // 2. Get current state (should be instant single query)
    console.log('Step 2: Getting current state...');
    const gameData = await ServerGameManager.getGameState(testPlayerId);
    
    if (!gameData) {
      throw new Error('Failed to retrieve game state');
    }

    // 3. Submit a choice (creates second action with updated state)
    console.log('Step 3: Submitting choice...');
    const updatedGameState: GameState = {
      ...initialGameState,
      quarter: 4, // Advanced to next quarter
      meters: {
        ...initialGameState.meters,
        company: {
          ...initialGameState.meters.company,
          revenue: 55 // Choice effect
        }
      },
      log: [...initialGameState.log, 'Made strategic choice: Increase revenue'],
      currentEventId: undefined // Cleared after quarter change
    };

    const choiceAction = {
      type: 'choice' as const,
      data: {
        eventId: 'test-event-2025-q3-1',
        choiceIndex: 1,
        choiceLabel: 'Increase revenue focus',
        meterChanges: { 'company.revenue': 5 },
        timestamp: Date.now()
      }
    };

    await ServerGameManager.updateGameState(gameId, testPlayerId, updatedGameState, choiceAction);

    // 4. Get state again (should show updated state)
    console.log('Step 4: Getting updated state...');
    const updatedGameData = await ServerGameManager.getGameState(testPlayerId);
    
    if (!updatedGameData) {
      throw new Error('Failed to retrieve updated game state');
    }

    // 5. End the game
    console.log('Step 5: Ending game...');
    const finalGameState: GameState = {
      ...updatedGameState,
      gameOver: {
        id: 'simplified-test-ending',
        type: 'win',
        title: 'Simplified Architecture Victory',
        description: 'Successfully tested the new single-table architecture'
      }
    };

    await ServerGameManager.endGame(gameId, testPlayerId, finalGameState);

    // 6. Verify cleanup (should not find active game)
    console.log('Step 6: Verifying cleanup...');
    const gameDataAfterEnd = await ServerGameManager.getGameState(testPlayerId);

    // 7. Get game history (should show all actions)
    console.log('Step 7: Getting game history...');
    const gameHistory = await ServerGameManager.getGameHistory(gameId);

    return json({
      success: true,
      message: 'Simplified single-table architecture test completed successfully!',
      testResults: {
        gameStart: { 
          gameId, 
          success: true,
          initialStateStored: gameData.gameState.meters.company.revenue === 50
        },
        choiceSubmission: { 
          success: true, 
          stateUpdated: updatedGameData.gameState.meters.company.revenue === 55,
          quarterAdvanced: updatedGameData.gameState.quarter === 4
        },
        gameEnd: { 
          success: true,
          gameNoLongerActive: gameDataAfterEnd === null
        },
        auditTrail: {
          totalActions: gameHistory.length,
          hasStartAction: gameHistory.some(a => a.action_type === 'start'),
          hasChoiceAction: gameHistory.some(a => a.action_type === 'choice'),
          hasEndAction: gameHistory.some(a => a.action_type === 'end'),
          allActionsHaveFullState: gameHistory.every(a => a.full_game_state !== null)
        }
      },
      architectureAdvantages: {
        singleTable: 'All data in gameActions table only',
        fastQueries: 'Current state = single indexed query by player_id',
        completeAuditTrail: 'Every action preserved with full state',
        simpleLogic: 'No complex checkpoint/join logic needed'
      }
    });

  } catch (error) {
    console.error('Simplified architecture test failed:', error);
    return json({ 
      error: 'Simplified architecture test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}; 