import { db } from '$lib/db/index';
import { gameActions, scores } from '$lib/db/schema';
import { sql, inArray, and, eq, desc } from 'drizzle-orm';
import events from '$lib/content/events';
import type { Event } from '$lib/types';

function processChoicesByEvent(
  endGameRecords: Array<{ game_id: string, full_game_state: any }>, 
  choiceRecords: Array<{ game_id: string, action_data: any }>
) {
  // Load events to get year/quarter metadata
  const eventsMap = new Map<string, Event>();
  for (const event of events as Event[]) {
    eventsMap.set(event.id, event);
  }

  // Structure: eventId -> choiceLabel -> outcome -> count
  const choicesByEvent: Record<string, Record<string, { win: number, loss: number, draw: number, total: number }>> = {};
  
  let totalProcessed = 0;

  // First, extract actual choice data from choice records
  const choicesByGame: Record<string, Array<{ eventId: string, choiceLabel: string, timestamp?: number }>> = {};
  
  for (const choiceRecord of choiceRecords) {
    if (!choiceRecord.game_id) continue;
    
    const choiceData = choiceRecord.action_data as any;
    
    // Extract choice data from the choice action record
    if (choiceData?.eventId && choiceData?.choiceLabel) {
      if (!choicesByGame[choiceRecord.game_id]) {
        choicesByGame[choiceRecord.game_id] = [];
      }
      
      choicesByGame[choiceRecord.game_id].push({
        eventId: choiceData.eventId,
        choiceLabel: choiceData.choiceLabel,
        timestamp: choiceData.timestamp || 0
      });
    }
  }

  // Sort choices within each game by timestamp to ensure correct order
  for (const gameId in choicesByGame) {
    choicesByGame[gameId].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  console.log(`Extracted choices for ${Object.keys(choicesByGame).length} games`);

  // Process end game records and map choices to outcomes
  for (const endRecord of endGameRecords) {
    try {
      const gameState = endRecord.full_game_state as any;
      const gameOver = gameState?.gameOver || {};
      const outcome = gameOver.type;
      const gameId = endRecord.game_id;

      if (!outcome || !gameId || !['win', 'loss', 'draw'].includes(outcome)) continue;

      const choices = choicesByGame[gameId] || [];
      if (choices.length === 0) continue;
      
      totalProcessed++;

      // Process each choice in the game
      choices.forEach((choice) => {
        const eventId = choice.eventId;
        const choiceLabel = choice.choiceLabel;
        
        if (!choicesByEvent[eventId]) {
          choicesByEvent[eventId] = {};
        }
        
        if (!choicesByEvent[eventId][choiceLabel]) {
          choicesByEvent[eventId][choiceLabel] = { win: 0, loss: 0, draw: 0, total: 0 };
        }
        
        choicesByEvent[eventId][choiceLabel][outcome as 'win' | 'loss' | 'draw']++;
        choicesByEvent[eventId][choiceLabel].total++;
      });

    } catch (error) {
      console.error('Error processing game record for event analysis:', error);
      continue;
    }
  }

  console.log(`Processed ${totalProcessed} game records for choice-by-event analysis`);

  // Calculate improved percentages and group by quarter
  const quarterAnalysis: Record<string, Record<string, {
    eventHeadline: string,
    choices: Array<{
      choice: string,
      totalPercent: number,
      winPercent: number,
      lossPercent: number,
      drawPercent: number
    }>
  }>> = {};

  for (const [eventId, eventChoices] of Object.entries(choicesByEvent)) {
    const event = eventsMap.get(eventId);
    if (!event) continue;

    const quarterKey = `${event.year}-Q${event.quarter}`;
    
    if (!quarterAnalysis[quarterKey]) {
      quarterAnalysis[quarterKey] = {};
    }

    const choiceEntries = Object.entries(eventChoices);
    
    // Calculate total games that had this event (for total percentages)
    const totalGamesForEvent = choiceEntries.reduce((sum, [_, data]) => sum + data.total, 0);
    
    // Calculate outcome-specific totals for this event
    const winGamesForEvent = choiceEntries.reduce((sum, [_, data]) => sum + data.win, 0);
    const lossGamesForEvent = choiceEntries.reduce((sum, [_, data]) => sum + data.loss, 0);
    const drawGamesForEvent = choiceEntries.reduce((sum, [_, data]) => sum + data.draw, 0);
    
    if (totalGamesForEvent === 0) {
      quarterAnalysis[quarterKey][eventId] = {
        eventHeadline: event.headline,
        choices: []
      };
      continue;
    }

    quarterAnalysis[quarterKey][eventId] = {
      eventHeadline: event.headline,
      choices: choiceEntries
        .map(([choiceLabel, data]) => ({
          choice: choiceLabel,
          // Total %: Out of all players who saw this event, what % picked this choice?
          totalPercent: (data.total / totalGamesForEvent) * 100,
          // Win %: Out of all players who saw this event AND won, what % picked this choice?
          winPercent: winGamesForEvent > 0 ? (data.win / winGamesForEvent) * 100 : 0,
          // Loss %: Out of all players who saw this event AND lost, what % picked this choice?
          lossPercent: lossGamesForEvent > 0 ? (data.loss / lossGamesForEvent) * 100 : 0,
          // Draw %: Out of all players who saw this event AND drew, what % picked this choice?
          drawPercent: drawGamesForEvent > 0 ? (data.draw / drawGamesForEvent) * 100 : 0
        }))
        .sort((a, b) => b.totalPercent - a.totalPercent) // Sort by popularity
        .slice(0, 10) // Top 10 choices per event
    };
  }

  return quarterAnalysis;
}

// Optimized function to fetch event analysis data efficiently
async function fetchEventAnalysisData(limit = 500) {
  console.log(`Fetching event analysis data with limit: ${limit}`);
  
  // Single query to get all end game records we need
  const endGameRecords = await db.select({
    game_id: gameActions.game_id,
    full_game_state: gameActions.full_game_state
  })
    .from(gameActions)
    .where(sql`${gameActions.action_type} = 'end'
               AND ${gameActions.full_game_state}->'gameOver' IS NOT NULL`)
    .limit(limit);
  
  console.log(`Fetched ${endGameRecords.length} end game records for event analysis`);
  
  if (endGameRecords.length === 0) {
    return {};
  }

  // Get all game IDs for the second query
  const gameIds = endGameRecords.map(record => record.game_id).filter(Boolean);
  
  // Single query to get all choice records we need
  const choiceRecords = await db.select({
    game_id: gameActions.game_id,
    action_data: gameActions.action_data
  })
    .from(gameActions)
    .where(and(
      eq(gameActions.action_type, 'choice'),
      inArray(gameActions.game_id, gameIds)
    ))
    .limit(limit * 10); // Allow for multiple choices per game
  
  console.log(`Fetched ${choiceRecords.length} choice records for event analysis`);
  
  return processChoicesByEvent(endGameRecords, choiceRecords);
}

// Optimized function to get path length data efficiently  
async function fetchPathLengthData(limit = 500) {
  console.log(`Fetching path length data with limit: ${limit}`);
  
  // First, get all end game records with their outcomes
  const endGameRecords = await db.select({
    game_id: gameActions.game_id,
    outcome: sql<string>`${gameActions.full_game_state}->'gameOver'->>'type'`,
    sequence_number: gameActions.sequence_number
  })
    .from(gameActions)
    .where(sql`${gameActions.action_type} = 'end'
               AND ${gameActions.full_game_state}->'gameOver' IS NOT NULL`)
    .limit(limit);

  console.log(`Fetched ${endGameRecords.length} end game records for path length analysis`);

  if (endGameRecords.length === 0) {
    return [];
  }

  // For each game, the path length is the sequence number of the end action
  // (since sequence starts at 1, this gives us the total number of actions including the end)
  // But we want the number of choices, so we subtract 1 for the end action
  const pathLengthData: Array<{ pathLength: number, outcome: string, percentage: number }> = [];
  
  // Group by path length and outcome
  const lengthOutcomeGroups: Record<string, number> = {};
  
  for (const endRecord of endGameRecords) {
    if (!endRecord.outcome || !['win', 'loss', 'draw'].includes(endRecord.outcome)) continue;
    
    // Cap sequence numbers: min 2, max 11
    let sequenceNumber = endRecord.sequence_number || 2;
    if (sequenceNumber < 2) sequenceNumber = 2;
    if (sequenceNumber > 11) sequenceNumber = 11;
    
    // Path length is sequence_number - 1 (subtract the end action)
    const pathLength = sequenceNumber - 1;
    const key = `${pathLength}-${endRecord.outcome}`;
    
    if (!lengthOutcomeGroups[key]) {
      lengthOutcomeGroups[key] = 0;
    }
    lengthOutcomeGroups[key]++;
  }

  // Convert to the expected format
  const totalGames = endGameRecords.length;
  
  for (const [key, count] of Object.entries(lengthOutcomeGroups)) {
    const [pathLengthStr, outcome] = key.split('-');
    const pathLength = parseInt(pathLengthStr, 10);
    
    pathLengthData.push({
      pathLength,
      outcome,
      percentage: totalGames > 0 ? Math.round((count / totalGames) * 1000) / 10 : 0
    });
  }

  console.log(`Processed ${pathLengthData.length} path length data points`);

  return pathLengthData.filter(item => item.percentage > 0);
}

// Function to fetch leaderboard data for analytics page
async function fetchLeaderboardData() {
  console.log('Fetching leaderboard data for analytics');
  
  const databaseMode = import.meta.env.VITE_DATABASE_MODE;

  if (databaseMode !== 'remote') {
    return { leaderboard: [], error: 'Local mode: Leaderboard disabled' };
  }

  try {
    // Get top 100 scores for analytics
    const topScores = await db
      .select({
        display_name: scores.display_name,
        score: scores.score,
        player_id: scores.player_id,
        run_ts: scores.run_ts
      })
      .from(scores)
      .orderBy(desc(scores.score), desc(scores.run_ts))
      .limit(100);

    // Add rank to all entries
    const leaderboard = topScores.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    console.log(`Fetched ${leaderboard.length} leaderboard entries`);

    return { leaderboard, error: null };

  } catch (e: any) {
    console.error('Leaderboard data fetch error:', e);
    return { leaderboard: [], error: e.message || 'Database error' };
  }
}

export const load = async () => {
  try {
    // Return immediately with loading state, and provide promises for async data
    return {
      // Immediate data that loads fast
      stats: { totalGames: 0, hasData: false, loading: true },
      
      // Promises for heavy data that will load asynchronously
      outcomeDataPromise: fetchOutcomeData(),
      pathLengthDataPromise: fetchPathLengthData(500),
      eventAnalysisPromise: fetchEventAnalysisData(500),
      leaderboardDataPromise: fetchLeaderboardData()
    };
  } catch (error) {
    console.error('Analytics data fetch error:', error);
    return {
      stats: { totalGames: 0, hasData: false, loading: false },
      outcomeDataPromise: Promise.resolve([]),
      pathLengthDataPromise: Promise.resolve([]),
      eventAnalysisPromise: Promise.resolve({}),
      leaderboardDataPromise: Promise.resolve({ leaderboard: [], error: 'Loading error' })
    };
  }
};

// New function to fetch outcome data separately
async function fetchOutcomeData() {
  try {
    const outcomeData = await db.select({
      outcomeType: sql<string>`${gameActions.full_game_state}->'gameOver'->>'type'`,
      endingId: sql<string>`${gameActions.full_game_state}->'gameOver'->>'id'`,
      endingTitle: sql<string>`${gameActions.full_game_state}->'gameOver'->>'title'`,
      rank: sql<string>`${gameActions.full_game_state}->'gameOver'->>'rank'`,
      count: sql<number>`COUNT(*)`
    })
      .from(gameActions)
      .where(sql`${gameActions.action_type} = 'end'
                 AND ${gameActions.full_game_state}->'gameOver' IS NOT NULL`)
      .groupBy(
        sql`${gameActions.full_game_state}->'gameOver'->>'type'`,
        sql`${gameActions.full_game_state}->'gameOver'->>'id'`,
        sql`${gameActions.full_game_state}->'gameOver'->>'title'`,
        sql`${gameActions.full_game_state}->'gameOver'->>'rank'`
      )
      .limit(50);

    // Calculate total for percentages (excluding wins with null ranks)
    const totalGames = outcomeData.reduce((sum, item) => {
      // Exclude wins with null ranks from total count
      if (item.outcomeType === 'win' && !item.rank) {
        return sum;
      }
      return sum + Number(item.count);
    }, 0);

    const processedOutcomeData = outcomeData
      .map(item => ({
        outcomeType: item.outcomeType,
        endingId: item.endingId,
        endingTitle: item.endingTitle,
        rank: item.rank,
        percentage: totalGames > 0 ? Math.round((Number(item.count) / totalGames) * 1000) / 10 : 0
      }))
      .filter(item => {
        if (!item.outcomeType || !['win', 'loss', 'draw'].includes(item.outcomeType)) {
          return false;
        }
        // For wins, require a non-null rank (exclude old db entries)
        if (item.outcomeType === 'win' && !item.rank) {
          return false;
        }
        return true;
      });

    return {
      outcomeData: processedOutcomeData,
      stats: { totalGames, hasData: totalGames > 0, loading: false }
    };
  } catch (error) {
    console.error('Outcome data fetch error:', error);
    return {
      outcomeData: [],
      stats: { totalGames: 0, hasData: false, loading: false }
    };
  }
} 