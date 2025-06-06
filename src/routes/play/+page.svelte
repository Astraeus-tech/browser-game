<script lang="ts">
  import { onMount } from 'svelte';
  import { game, getDefaultState } from '$lib/stores/game';
  import type { Event, Ending, GameState } from '$lib/types';
  import { applyChoice, scaleCreditRange, calculateEndingDetails } from '$lib/engine';
  import { makeRng } from '$lib/rng';
  import ResourceBars from '$lib/components/ResourceBars.svelte';
  import TypewriterText from '$lib/components/TypewriterText.svelte';
  import events from '$lib/content/events';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { calculateImpactScore, getImpactAssessment, getImpactColorClass } from '$lib/impact';
  import { submitRunScore, endGameAndSubmitScore } from '$lib/db';
  import { getDisplayName, setDisplayName } from '$lib/player';
  import DisplayNameModal from '$lib/components/DisplayNameModal.svelte';
  import type { PageData } from './$types'; // Import PageData for the load function's return type
  import { isServerAuthoritative } from '$lib/gameClient';
  import { secureGameClient } from '$lib/secureGameClient';

  export let data: PageData; // This prop receives data from the load function

  let currentEvents: Event[] = [];
  let selectedEvent: Event | null = null;
  let overlayChoice: any = null;
  let expandedSections = {
    wallstreet: false,
    ngo: false,
    researcher: false
  };
  let showDisplayNameModal = false;
  let pendingGameStateForScoreSubmission: GameState | null = null;


  // Simple leaderboard state
  let leaderboard: Array<{ rank: number; display_name: string; score: number; isCurrentUser?: boolean }> = [];
  let playerRank: number | null = null;
  let leaderboardError: string | null = null;
  let isLoadingLeaderboard = false;

  // Game count state - now comes from server-side load function
  let gameCount: number = data.gameCount || 0;

  function resetLeaderboardState() {
    leaderboard = [];
    playerRank = null;
    leaderboardError = null;
    isLoadingLeaderboard = false;
  }



  onMount(() => {
    // Simple initialization - server is source of truth
    if ($game.gameOver === 'playing') {
      pickEvent();
    }
    
    resetLeaderboardState();
    
    // Pre-fetch leaderboard for instant display when game ends
    console.log('[Frontend] Pre-fetching leaderboard for instant display...');
    fetchLeaderboard().catch(err => console.warn('Pre-fetch leaderboard failed:', err));
    
    // Game count is now provided by server-side load function, no fetch needed
  });

  function toggleSection(section: 'wallstreet' | 'ngo' | 'researcher') {
    // If the section is already expanded, collapse it
    if (expandedSections[section]) {
      expandedSections[section] = false;
    } else {
      // Otherwise collapse all sections and expand only the clicked one
      expandedSections = {
        wallstreet: false,
        ngo: false,
        researcher: false
      };
      expandedSections[section] = true;
    }
  }

  function resetExpandedSections() {
    expandedSections = {
      wallstreet: false,
      ngo: false,
      researcher: false
    };
  }

  async function pickEvent() {
    // Only use local event picking if not using secure client
    if (secureGameClient.hasActiveSession()) {
      // Server handles event selection, just find the current event for display
      const currentState = get(game);
      if (currentState.currentEventId) {
        const currentEvent = (events as Event[]).find(e => e.id === currentState.currentEventId);
        selectedEvent = currentEvent || null;
      }
      return;
    }

    // Fallback to local event picking (for backwards compatibility)
    currentEvents = (events as Event[]).filter(e =>
      e.year === $game.year && e.quarter === $game.quarter
    );

    if (currentEvents.length) {
      const currentState = get(game);
      
      // If we already have a saved event ID for this year/quarter, use it
      if (currentState.currentEventId) {
        const savedEvent = currentEvents.find(e => e.id === currentState.currentEventId);
        if (savedEvent) {
          selectedEvent = savedEvent;
          return;
        }
      }
      
      // Otherwise, select a new random event
      const { rng, nextSeed } = makeRng($game);
      const idx = Math.floor(rng() * currentEvents.length);
      selectedEvent = currentEvents[idx];
      
      // Check affordability on the new seed state before continuing
      const updatedState = { 
        ...currentState, 
        seed: nextSeed,
        currentEventId: selectedEvent.id // Save the selected event ID
      };
      const credits = updatedState.meters.company.credits;
      const hasAffordable = selectedEvent.choices.some(c =>
        credits >= getChoiceCost(c.effects.company?.credits)
      );
      if (!hasAffordable) {
        // Trigger out-of-credits loss ending
        let endingData: Ending = {
          id: 'out_of_credits',
          type: 'loss',
          title: 'Acquired at the Brink',
          reason: 'Credits too low',
          description: `Your runaway burn rate has drained every credit. As the final operations stall, Macrosoft swooped in with a surprise rescue acquisition—stripping you of the CEO title and subsuming your vision into their empire. Soon, your pioneering work will be relegated to corporate archives, another forgotten footnote in tech history.`
        };
        // Calculate score and stats for this ending
        // We need the full GameState object for calculateEndingDetails
        const finalGameStateForCalc: GameState = {
          ...updatedState, // This already has updated year, quarter, meters, seed, log
          gameOver: endingData // Temporarily set gameOver to the basic ending data
        };
        endingData = calculateEndingDetails(endingData, finalGameStateForCalc);

        const finalStateToSet: GameState = {
          ...updatedState,
          gameOver: endingData
        };
        await game.set(finalStateToSet);
        
        // Game ended due to out of credits - use atomic submission
        triggerScoreSubmission(finalStateToSet);
        return;
      }
      // Otherwise just update seed and continue
      await game.set(updatedState);
    } else {
      selectedEvent = null;
      console.warn('No events matched the current state.');
      
      // If game is in playing state but no events found, reset to intro
      if ($game.gameOver === 'playing') {
        console.log('No events available for current state, resetting to intro...');
        
        try {
          const freshState = getDefaultState();
          await game.set(freshState);
          console.log('Successfully reset to intro state');
        } catch (error) {
          console.error('Error during reset:', error);
          window.location.reload();
        }
      }
    }
  }

  // Helper to format a credit cost effect string (e.g. "-5..-3" → "-$5M credits")
  function formatCreditCost(effect: string): string {
    const { year, quarter } = get(game);
    const [scaledLo] = scaleCreditRange(effect, year, quarter);
    const absVal = Math.abs(scaledLo);
    // use M for millions, B for billions
    const unit = absVal >= 1000 ? `${(absVal / 1000).toFixed(1)}B` : `${absVal}M`;
    const sign = scaledLo < 0 ? '-' : '';
    return `${sign}$${unit} credits`;
  }

  // Helper to compute numeric credit cost (e.g. "-5..-3" → 5)
  function getChoiceCost(effect?: string): number {
    if (!effect) return 0;
    const { year, quarter } = get(game);
    const [scaledLo] = scaleCreditRange(effect, year, quarter);
    return scaledLo < 0 ? Math.abs(scaledLo) : 0;
  }

  function openChoiceOverlay(choice: any) {
    overlayChoice = choice;
    resetExpandedSections();
  }

  function closeOverlay() {
    overlayChoice = null;
    resetExpandedSections();
  }

  async function choose(label: string) {
    if (!selectedEvent) return;
    const choice = selectedEvent.choices.find((c) => c.label === label);
    if (!choice) return;

    const choiceIndex = selectedEvent.choices.indexOf(choice);

    // Always use secure client for choice processing
    console.log('Processing choice with secure server validation...');
    const response = await secureGameClient.makeChoice(choiceIndex);

    if (!response.success) {
      console.error('Server rejected choice:', response.error);
      alert(`Choice rejected: ${response.error}`);
      return;
    }

    if (!response.gameState) {
      console.error('Server did not return updated game state');
      return;
    }

    const nextState = response.gameState;
    await game.set(nextState);
    
    if (response.gameEnded) {
      // Game ended - scores are automatically submitted by server
      await fetchLeaderboard(); // Just fetch updated leaderboard
      return;
    }

    // Game continues - set next event
    if (response.nextEvent) {
      selectedEvent = response.nextEvent;
    } else {
      // Fallback to pickEvent if no next event provided
      await pickEvent();
    }
  }

  async function confirmChoice() {
    if (overlayChoice) {
      await choose(overlayChoice.label);
      closeOverlay();
    }
  }

  async function startGame() {
    // Check if player has a display name first
    const existingDisplayName = getDisplayName();
    if (!existingDisplayName) {
      // No display name - show modal to get one before starting game
      showDisplayNameModal = true;
      return;
    }
    
    // Start the secure game with the display name
    await startSecureGame(existingDisplayName);
  }

  async function startSecureGame(displayName: string) {
    console.log('Starting secure server game with display name:', displayName);
    
    const response = await secureGameClient.startGame(displayName);
    if (!response.success) {
      console.error('Failed to start secure game:', response.error);
      alert(`Failed to start game: ${response.error}`);
      return;
    }
    
    if (response.gameState) {
      console.log('Setting game state:', response.gameState);
      await game.set(response.gameState);
      selectedEvent = response.currentEvent || null;
      console.log('Secure game started successfully, selected event:', selectedEvent?.id);
    } else {
      console.error('No game state returned from server');
      alert('Server did not return game state');
    }
  }

  function startOver() {
    // Clear secure session if active
    secureGameClient.clearSession();
    game.set(getDefaultState());
    resetLeaderboardState();
    // Don't pick event here since we start in intro state
  }

  // Simplified leaderboard fetch using player ID
  async function fetchLeaderboard() {
    isLoadingLeaderboard = true;
    leaderboardError = null;
    
    try {
      // Use server player ID if available (authoritative), no fallback needed
      const playerId = secureGameClient.hasPlayerIdentity() 
        ? secureGameClient.getPlayerId()
        : null;
      
      let url = '/api/leaderboard-with-rank';
      if (playerId) {
        url += `?playerId=${encodeURIComponent(playerId)}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }
      
      if (result.error) {
        leaderboardError = result.error;
        leaderboard = [];
        playerRank = null;
      } else {
        // Combine top 10 with player entry if not in top 10
        leaderboard = result.leaderboard || [];
        playerRank = result.playerRank;
        
        // If player is not in top 10, add their entry at the bottom with proper styling
        if (result.playerEntry && result.playerRank && result.playerRank > 10) {
          // Ensure the player entry has the correct isCurrentUser flag
          const playerEntryWithFlag = {
            ...result.playerEntry,
            isCurrentUser: true
          };
          leaderboard = [...leaderboard, playerEntryWithFlag];
        }
        
        leaderboardError = null;
        console.log(`[Frontend] Fetched leaderboard, player rank: ${playerRank}`);
      }
    } catch (error: any) {
      console.error('[Frontend] Error fetching leaderboard:', error);
      leaderboardError = error.message || 'Failed to fetch leaderboard';
      leaderboard = [];
      playerRank = null;
    } finally {
      isLoadingLeaderboard = false;
    }
  }

  // Submit score first, then fetch leaderboard (legacy function for non-secure games)
  async function submitScoreAndFetchLeaderboard(displayName?: string | null) {
    console.log('[Frontend] Starting score submission...');
    
    try {
      // Submit score to server (server calculates score from game state)
      const success = await submitRunScore(displayName === null ? undefined : displayName);
      
      if (success) {
        console.log('[Frontend] Score submitted successfully, fetching leaderboard...');
        // Fetch updated leaderboard
        await fetchLeaderboard();
        console.log('[Frontend] Leaderboard updated with new score');
      } else {
        leaderboardError = "Score submission failed";
        console.error('[Frontend] Score submission failed');
      }
      
      return success;
    } catch (error: any) {
      console.error("Score submission failed:", error);
      leaderboardError = "Score submission failed";
      return false;
    }
  }

  // Atomic end game and submit score, then fetch leaderboard (legacy function for non-secure games)
  async function endGameAndSubmitScoreAndFetchLeaderboard(finalGameState: GameState, displayName?: string | null) {
    console.log('[Frontend] Starting atomic game end + score submission...');
    
    try {
      // Atomically end game and submit score
      const success = await endGameAndSubmitScore(finalGameState, displayName === null ? undefined : displayName);
      
      if (success) {
        console.log('[Frontend] Game ended and score submitted successfully, fetching leaderboard...');
        // Fetch updated leaderboard
        await fetchLeaderboard();
        console.log('[Frontend] Leaderboard updated with new score');
      } else {
        leaderboardError = "Game end and score submission failed";
        console.error('[Frontend] Game end and score submission failed');
      }
      
      return success;
    } catch (error: any) {
      console.error("Game end and score submission failed:", error);
      leaderboardError = "Game end and score submission failed";
      return false;
    }
  }

  async function triggerScoreSubmission(gameState: GameState) {
    // If using secure client, scores are already submitted automatically
    if (secureGameClient.hasPlayerIdentity()) {
      await fetchLeaderboard();
      return;
    }
    
    // Legacy score submission for non-secure games
    const existingDisplayName = getDisplayName();
    if (!existingDisplayName) {
      pendingGameStateForScoreSubmission = gameState;
      showDisplayNameModal = true;
      // Show empty leaderboard while waiting for name
      await fetchLeaderboard();
    } else {
      // Use atomic approach for server mode, legacy approach for local mode
      if (isServerAuthoritative()) {
        await endGameAndSubmitScoreAndFetchLeaderboard(gameState, existingDisplayName);
      } else {
        await submitScoreAndFetchLeaderboard(existingDisplayName);
      }
    }
  }

  async function handleNameSubmitted(event: CustomEvent<string>) {
    const newDisplayName = event.detail;
    // Note: No localStorage saving needed - server handles all player data
    
    if (pendingGameStateForScoreSubmission) {
      // This is for post-game score submission (legacy flow)
      if (isServerAuthoritative()) {
        await endGameAndSubmitScoreAndFetchLeaderboard(pendingGameStateForScoreSubmission, newDisplayName);
      } else {
        await submitScoreAndFetchLeaderboard(newDisplayName);
      }
      pendingGameStateForScoreSubmission = null;
    } else {
      // This is for pre-game name collection - start the game now
      await startSecureGame(newDisplayName);
    }
    
    showDisplayNameModal = false;
  }

  async function handleModalCancel() {
    if (pendingGameStateForScoreSubmission) {
      // This is for post-game score submission (legacy flow) - submit without name
      if (isServerAuthoritative()) {
        await endGameAndSubmitScoreAndFetchLeaderboard(pendingGameStateForScoreSubmission, undefined);
      } else {
        await submitScoreAndFetchLeaderboard(undefined);
      }
      pendingGameStateForScoreSubmission = null;
    } else {
      // This is for pre-game name collection - start game with Anonymous
      await startSecureGame('Anonymous');
    }
    
    showDisplayNameModal = false;
  }

  // Simple reactive check - no complex processing needed since API handles everything
  $: isGameOver = browser && $game.gameOver && $game.gameOver !== 'playing' && $game.gameOver !== 'intro';

  // Reactive handler to fix invalid game states
  let isFixingInvalidState = false;
  $: if (browser && $game.gameOver === 'playing' && !selectedEvent && !isFixingInvalidState) {
    console.warn('Detected invalid game state: playing but no selectedEvent. Attempting to fix...');
    fixInvalidGameState();
  }

  async function fixInvalidGameState() {
    // Prevent multiple simultaneous fix attempts
    if (isFixingInvalidState) {
      return;
    }
    isFixingInvalidState = true;
    
    try {
      const currentState = get(game);
      
      // If using secure client, try to restore the current event
      if (secureGameClient.hasActiveSession()) {
        console.log('Secure session active - attempting to restore current event...');
        
        // Try to get current game status from server
        const statusResponse = await secureGameClient.getGameStatus();
        if (statusResponse.success && statusResponse.gameState) {
          console.log('Successfully retrieved game state from server');
          const gameState = statusResponse.gameState;
          await game.set(gameState);
          
          // Try to load the current event
          if (gameState.currentEventId) {
            const events = await import('$lib/content/events');
            const currentEvent = (events.default as Event[]).find(e => e.id === gameState.currentEventId);
            if (currentEvent) {
              selectedEvent = currentEvent;
              console.log('Successfully restored current event:', currentEvent.id);
              return;
            }
          }
        }
        
        // If server approach failed, clear the secure session and reset
        console.warn('Server game state recovery failed, clearing session and resetting...');
        secureGameClient.clearSession();
      }
      
      // For non-secure games or failed secure recovery, try to pick an event
      try {
        await pickEvent();
        if (selectedEvent) {
          console.log('Successfully picked new event for current state');
          return;
        }
      } catch (error) {
        console.error('Failed to pick event:', error);
      }
      
      // If all else fails, reset to intro state
      console.warn('Unable to fix game state, resetting to intro...');
      const freshState = getDefaultState();
      await game.set(freshState);
      selectedEvent = null;
      resetLeaderboardState();
      
    } catch (error) {
      console.error('Error during game state fix attempt:', error);
      // Last resort: reload the page
      window.location.reload();
    } finally {
      isFixingInvalidState = false;
    }
  }
</script>

{#if browser}
<div class="flex items-center justify-center bg-black min-h-screen font-mono text-green-300">
  <div class="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden">
    <header class="flex flex-wrap items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
      <h1 class="text-lg font-bold mr-auto">
        Singularity Run 
        {#if gameCount > 0}
          <span class="text-xs font-normal text-gray-400">(# games played: {gameCount.toLocaleString()})</span>
        {/if}
      </h1>
      {#if $game.gameOver !== 'intro'}
        <div class="text-xs order-3 w-full mt-1 sm:mt-0 sm:w-auto sm:order-2 sm:mr-auto">Year: {$game.year} – Q{$game.quarter}</div>
      {:else}
        <div class="text-xs ml-auto">The AI Strategy Game</div>
      {/if}
      {#if $game.gameOver === 'playing' && $game.log.length > 0}
        <button
          on:click={startOver}
          class="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded order-2 sm:order-3"
        >
          Abandon Run
        </button>
      {/if}
      {#if $game.gameOver && $game.gameOver !== 'playing' && $game.gameOver !== 'intro'}
        {#if $game.gameOver.type === 'win'}
          <span class="text-green-400 font-bold order-2 sm:order-3">Victory! {#if playerRank}Rank: {playerRank}{/if}</span>
        {:else if $game.gameOver.type === 'draw'}
          <span class="text-yellow-400 font-bold order-2 sm:order-3">Draw</span>
        {:else}
          <span class="text-red-400 font-bold order-2 sm:order-3">Defeat</span>
        {/if}
      {/if}
    </header>
    {#if $game.gameOver !== 'intro'}
      <div class="px-4 py-2 border-b border-gray-700 overflow-x-auto">
        <ResourceBars
          company={$game.meters.company}
          environment={$game.meters.environment}
          ai_capability={$game.meters.ai_capability}
          metersHistory={$game.metersHistory}
        />
      </div>
    {/if}
    <div class="{$game.gameOver === 'intro' ? 'h-[32rem] md:h-[36rem]' : 'h-64 md:h-80'} p-4 bg-green-950 border-b border-gray-700 overflow-y-auto flex flex-col justify-between">
      {#if $game.gameOver === 'intro'}
        <!-- Landing page content -->
        <div>
          <h2 class="text-xl mb-4 text-yellow-300">Lead Humanity's Future</h2>
          
          <p class="mb-4">The year is 2025. You're the CEO of a promising AI startup on the brink of creating the most powerful artificial intelligence in history.</p>
          
          <p class="mb-4">Every decision you make will impact your company's success, the global environment, and the development of AI capabilities. Will you prioritize profits, pursue responsible innovation, or find a balance between competing interests?</p>
          
          <div class="my-6 px-4 py-4 bg-gray-800 rounded-md border-l-4 border-green-500">
            <h3 class="text-lg mb-2 text-green-400">Your Objective</h3>
            <p>Navigate the complex landscape of AI development while balancing:</p>
            <ul class="list-disc ml-6 mt-2 space-y-1">
              <li>Corporate interests and financial success</li>
              <li>Advancement of AI capabilities</li>
              <li>Impact on social stability and security</li>
            </ul>
          </div>
          
          <p class="italic text-sm text-green-300 mb-6">Can you reach the technological singularity without destroying the world—or your company?</p>
          
          <div class="text-xs text-red-400 mb-2 uppercase">Warning: Choices have consequences. Your decisions will shape the future.</div>
        </div>
      {:else if $game.gameOver && $game.gameOver !== 'playing'}
        <div>
          <h1 class="text-2xl font-bold text-yellow-300 mb-2">
            {$game.gameOver.title}
          </h1>
          <p class="mb-4 whitespace-pre-line"><TypewriterText text={$game.gameOver.description} speed={12} /></p>

          <!-- Score & Rank Section -->
          <div class="my-4 p-3 bg-gray-800 rounded-md">
            <h2 class="text-xl font-semibold text-blue-300 mb-2">Run Summary</h2>
            {#if $game.gameOver.type === 'win'}
              <p class="text-green-400 text-lg">Outcome: <span class="font-bold">Victory!</span></p>
              <!-- Rank display here is now primarily from currentPlayerRankMessage inside leaderboard section -->
            {:else if $game.gameOver.type === 'loss'}
              <p class="text-red-400 text-lg">Outcome: <span class="font-bold">Defeat</span></p>
              {#if $game.gameOver.reason}
                <p class="text-gray-400 text-sm mb-2">Reason: {$game.gameOver.reason}</p>
              {/if}
            {:else if $game.gameOver.type === 'draw'}
              <p class="text-yellow-400 text-lg">Outcome: <span class="font-bold">Stalemate</span></p>
            {/if}
            
            {#if $game.gameOver.scoreDetails}
              <p class="text-blue-300 mt-2">Total Score: <span class="font-bold text-xl">{$game.gameOver.scoreDetails.total}</span></p>
              <div class="text-xs text-gray-400 mt-2 space-y-0.5">
                <p>Progression: {$game.gameOver.scoreDetails.basePoints.progression} pts</p>
                <p>Company Performance: {$game.gameOver.scoreDetails.basePoints.company} pts</p>
                <p>Environmental Impact: {$game.gameOver.scoreDetails.basePoints.environment} pts</p>
                <p>AI Advancement: {$game.gameOver.scoreDetails.basePoints.aiCapability} pts</p>
                {#if $game.gameOver.scoreDetails.bonuses?.win}
                  <p>Win Bonus: +{$game.gameOver.scoreDetails.bonuses.win} pts</p>
                {/if}
                {#if $game.gameOver.scoreDetails.multipliers?.rank}
                  <p>Rank Multiplier: x{$game.gameOver.scoreDetails.multipliers.rank.toFixed(1)}</p>
                {/if}
                {#if $game.gameOver.scoreDetails.multipliers?.outcome}
                  <p>Outcome Multiplier: x{$game.gameOver.scoreDetails.multipliers.outcome.toFixed(1)}</p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Leaderboard Section -->
          {#if leaderboardError === 'Local mode: Leaderboard disabled'}
            <!-- No leaderboard shown in local mode -->
          {:else if leaderboard && leaderboard.length > 0}
            <div class="my-6 p-3 bg-gray-800 rounded-md">
              <h2 class="text-xl font-semibold text-purple-400 mb-3">Top Scores</h2>
              {#if playerRank}
                <p class="text-sm text-yellow-300 mb-2">Your rank: {playerRank}</p>
              {/if}
              <ol class="space-y-1 text-sm">
                {#each leaderboard as entry}
                  <li class="flex justify-between items-center px-2 py-1 rounded {entry.isCurrentUser ? 'bg-green-700 text-white' : ''}">
                    <span>
                      <span class="font-semibold {entry.isCurrentUser ? 'text-yellow-300' : 'text-gray-300'}">{entry.rank}. {entry.display_name}:</span> 
                      <span class="{entry.isCurrentUser ? 'text-yellow-300' : 'text-green-300'}">{entry.score} pts</span>
                    </span>
                  </li>
                {/each}
              </ol>
            </div>
          {:else if isLoadingLeaderboard}
            <div class="my-6 p-3 bg-gray-800 rounded-md">
              <h2 class="text-xl font-semibold text-blue-400 mb-3">Loading...</h2>
              <p class="text-sm text-gray-300">Fetching leaderboard...</p>
            </div>
          {:else if leaderboardError}
            <div class="my-6 p-3 bg-gray-800 rounded-md">
              <h2 class="text-xl font-semibold text-red-400 mb-3">Leaderboard Error</h2>
              <p class="text-sm text-red-300">Could not load top scores: {leaderboardError}</p>
            </div>
          {/if}
        </div>
      {:else if selectedEvent}
        <div>
          <h1 class="text-lg mb-2">{selectedEvent.headline}</h1>
          <p class="mb-4"><TypewriterText text={selectedEvent.description} speed={12} /></p>
        </div>
      {:else}
        {#if $game.gameOver === 'playing'}
          <div class="text-center">
            {#if isFixingInvalidState}
              <p class="text-blue-400 mb-4">🔄 Restoring game state...</p>
              <p class="text-sm text-gray-400">Synchronizing with server, please wait a moment.</p>
            {:else}
              <p class="text-yellow-400 mb-4">⚠️ Loading game data...</p>
              <p class="text-sm text-gray-400">Preparing your next decision...</p>
            {/if}
          </div>
        {:else}
          <p>No events loaded. Please check your content.</p>
        {/if}
      {/if}
    </div>
    <footer class="px-4 py-2 bg-gray-800 border-t border-gray-700">
      {#if $game.gameOver === 'intro'}
        <button
          class="w-full px-4 py-3 bg-green-700 hover:bg-green-600 rounded text-center text-lg font-bold"
          on:click={startGame}
        >
          Start Singularity Run
        </button>
        <div class="text-xs text-center mt-3 text-gray-400">
          Strategic decisions await. The future is in your hands.
        </div>
      {:else if $game.gameOver && $game.gameOver !== 'playing'}
        <button
          class="w-full mb-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
          on:click={startOver}
        >
          Start Over
        </button>
        <a 
          href="/analytics" 
          class="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
        >
          View Analytics
        </a>
      {:else if selectedEvent}
        {#each selectedEvent.choices as c}
          <button
            class="w-full mb-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
            disabled={$game.meters.company.credits < getChoiceCost(c.effects.company?.credits)}
            class:opacity-50={$game.meters.company.credits < getChoiceCost(c.effects.company?.credits)}
            class:cursor-not-allowed={$game.meters.company.credits < getChoiceCost(c.effects.company?.credits)}
            on:click={() => openChoiceOverlay(c)}
          >
            {c.label}{$game.meters.company.credits < getChoiceCost(c.effects.company?.credits) ? ' (Insufficient credits)' : ''}
          </button>
        {/each}
      {/if}
    </footer>
  </div>
  
  <!-- Choice Overlay -->
  {#if overlayChoice}
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10 p-4">
      <!-- Container with max-height instead of fixed height -->
      <div class="bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
        <!-- Header - exactly matching the main UI header height -->
        <header class="flex items-center bg-gray-800 px-4 py-2 border-b border-gray-700 flex-shrink-0">
          <h2 class="text-xl font-bold">{overlayChoice.label}</h2>
        </header>
        
        <!-- Resource bar equivalent height space -->
        <div class="px-4 py-3 border-b border-gray-700 bg-green-950 flex-shrink-0">
          {#if overlayChoice.effects.company?.credits}
          <div class="text-yellow-400 ml-auto">Cost: {formatCreditCost(overlayChoice.effects.company.credits)}</div>
          <div class="text-gray-400 ml-auto pb-2">(Available credits: ${$game.meters.company.credits}M)</div>
        {/if}
          <p class="mb-4">{overlayChoice.details}</p>
        </div>
        
        <!-- Main content area - scrollable with flex-grow -->
        <div class="p-4 bg-green-950 border-b border-gray-700 overflow-y-auto flex-grow">          
          <!-- Wall Street Analysis -->
          <div class="my-4 px-4 py-3 bg-gray-800 rounded-md border-l-4 border-blue-500">
            <div 
              class="flex justify-between items-center cursor-pointer" 
              on:click={() => toggleSection('wallstreet')}
            >
              <div class="flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"></path>
                  <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"></path>
                </svg>
                <h3 class="text-lg text-blue-400">Wall Street Analysis:</h3>
              </div>
              <svg 
                class="w-5 h-5 text-blue-400 transform transition-transform duration-200" 
                class:rotate-180={expandedSections.wallstreet}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            {#if expandedSections.wallstreet}
              <div class="mt-2">
                <p class="text-green-300 mb-3">{overlayChoice.wallstreet_analysis}</p>
                
                {#if overlayChoice.effects.company}
                  {@const companyImpact = calculateImpactScore(overlayChoice.effects.company)}
                  <p class="mt-2 font-semibold">
                    Expected impact: 
                    <span class={getImpactColorClass(companyImpact)}>
                      {getImpactAssessment(companyImpact)}
                    </span>
                  </p>
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- NGO Analysis -->
          <div class="my-4 px-4 py-3 bg-gray-800 rounded-md border-l-4 border-purple-500">
            <div 
              class="flex justify-between items-center cursor-pointer" 
              on:click={() => toggleSection('ngo')}
            >
              <div class="flex items-center">
                <svg class="w-5 h-5 mr-2 text-purple-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clip-rule="evenodd"></path>
                </svg>
                <h3 class="text-lg text-purple-400">NGO Analysis:</h3>
              </div>
              <svg 
                class="w-5 h-5 text-purple-400 transform transition-transform duration-200" 
                class:rotate-180={expandedSections.ngo}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            {#if expandedSections.ngo}
              <div class="mt-2">
                <p class="text-green-300 mb-3">{overlayChoice.ngo_analysis}</p>
                
                {#if overlayChoice.effects.environment}
                  {@const environmentImpact = calculateImpactScore(overlayChoice.effects.environment)}
                  <p class="mt-2 font-semibold">
                    Expected impact: 
                    <span class={getImpactColorClass(environmentImpact)}>
                      {getImpactAssessment(environmentImpact)}
                    </span>
                  </p>
                {/if}
              </div>
            {/if}
          </div>
          
          <!-- Researcher Analysis -->
          <div class="my-4 px-4 py-3 bg-gray-800 rounded-md border-l-4 border-amber-500">
            <div 
              class="flex justify-between items-center cursor-pointer" 
              on:click={() => toggleSection('researcher')}
            >
              <div class="flex items-center">
                <svg class="w-5 h-5 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path>
                </svg>
                <h3 class="text-lg text-amber-400">Researcher Analysis:</h3>
              </div>
              <svg 
                class="w-5 h-5 text-amber-400 transform transition-transform duration-200" 
                class:rotate-180={expandedSections.researcher}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            {#if expandedSections.researcher}
              <div class="mt-2">
                <p class="text-green-300 mb-3">{overlayChoice.researcher_analysis}</p>
                
                {#if overlayChoice.effects.ai_capability}
                  {@const aiImpact = calculateImpactScore(overlayChoice.effects.ai_capability)}
                  <p class="mt-2 font-semibold">
                    Expected impact: 
                    <span class={getImpactColorClass(aiImpact)}>
                      {getImpactAssessment(aiImpact)}
                    </span>
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Footer - fixed at bottom -->
        <footer class="px-4 py-2 bg-gray-800 border-t border-gray-700 flex-shrink-0">
          <div class="flex justify-between">
            <button 
              class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              on:click={closeOverlay}
            >
              Cancel
            </button>
            <button 
              class="px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
              on:click={confirmChoice}
              disabled={$game.meters.company.credits < getChoiceCost(overlayChoice.effects.company?.credits)}
              class:opacity-50={$game.meters.company.credits < getChoiceCost(overlayChoice.effects.company?.credits)}
              class:cursor-not-allowed={$game.meters.company.credits < getChoiceCost(overlayChoice.effects.company?.credits)}
            >
              Choose
            </button>
          </div>
        </footer>
      </div>
    </div>
  {/if}

  <DisplayNameModal 
    bind:isOpen={showDisplayNameModal} 
    on:submitName={handleNameSubmitted} 
    on:cancelSubmit={handleModalCancel} 
  />
</div>
{/if}