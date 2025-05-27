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
  import { submitRunScore } from '$lib/db';
  import { getDisplayName, setDisplayName as saveDisplayNameToStorage } from '$lib/player';
  import DisplayNameModal from '$lib/components/DisplayNameModal.svelte';
  import type { PageData } from './$types'; // Import PageData for the load function's return type
  // getPlayerId is no longer strictly needed here for rank logic if server sends full leaderboard
  // but keep if used elsewhere.
  // import { getPlayerId } from '$lib/player'; 

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
  // currentPlayerId might still be useful if you want to highlight based on a persistent ID
  // but for ranking based on current score and display name, it's less critical now.
  // let currentPlayerId: string | null = null; 

  // Simplified leaderboard state - only populated after game ends
  let leaderboard: Array<{ display_name: string; score: number }> = [];
  let processedLeaderboard: Array<{ rank: number; display_name: string; score: number; isCurrentUser?: boolean }> = [];
  let currentPlayerRankMessage: string | null = null;
  let leaderboardError: string | null = null;
  let isLoadingLeaderboard = false;

  // Removed playerRankInfo, isFetchingPlayerRank, fetchPlayerRank function

  function resetLeaderboardState() {
    leaderboard = [];
    processedLeaderboard = [];
    currentPlayerRankMessage = null;
    leaderboardError = null;
    isLoadingLeaderboard = false;
  }

  onMount(() => {
    // Only pick event if we're in playing state
    if ($game.gameOver === 'playing') {
      pickEvent();
    }
    // currentPlayerId = getPlayerId(); // if needed
    resetLeaderboardState(); // Ensure clean state on initial mount
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

  function pickEvent() {

    // Filter events by matching year and quarter from event properties
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
        game.set(finalStateToSet);
        triggerScoreSubmission(finalStateToSet);
        return;
      }
      // Otherwise just update seed and continue
      game.set(updatedState);
    } else {
      selectedEvent = null;
      console.warn('No events matched the current state.');
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

  function choose(label: string) {
    if (!selectedEvent) return;
    const choice = selectedEvent.choices.find((c) => c.label === label);
    if (!choice) return;

    const currentState = get(game);
    const nextState = applyChoice(currentState, choice);

    game.set(nextState);

    if (nextState.gameOver !== 'playing') {
      triggerScoreSubmission(nextState);
      return;
    }

    // Clear the currentEventId when advancing to new quarter/year
    if (nextState.year !== currentState.year || nextState.quarter !== currentState.quarter) {
      nextState.currentEventId = undefined;
    }

    game.set(nextState);
    pickEvent();
  }

  function confirmChoice() {
    if (overlayChoice) {
      choose(overlayChoice.label);
      closeOverlay();
    }
  }

  function startGame() {
    // Transition from intro to playing state
    game.update(state => ({
      ...state,
      gameOver: 'playing'
    }));
    pickEvent();
  }

  function startOver() {
    game.set(getDefaultState());
    resetLeaderboardState();
    // Don't pick event here since we start in intro state
  }

  // New function to fetch leaderboard after score submission
  async function fetchLeaderboard() {
    isLoadingLeaderboard = true;
    leaderboardError = null;
    
    try {
      console.log('[Frontend] Fetching fresh leaderboard after score submission');
      const response = await fetch('/api/get-leaderboard');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }
      
      if (result.error) {
        leaderboardError = result.error;
        leaderboard = [];
      } else {
        leaderboard = result.leaderboard || [];
        leaderboardError = null;
        console.log(`[Frontend] Successfully fetched ${leaderboard.length} scores`);
      }
    } catch (error: any) {
      console.error('[Frontend] Error fetching leaderboard:', error);
      leaderboardError = error.message || 'Failed to fetch leaderboard';
      leaderboard = [];
    } finally {
      isLoadingLeaderboard = false;
    }
  }

  // Renamed and refactored for clarity and to ensure proper awaiting of leaderboard fetch
  async function submitScoreAndFetchLeaderboard(gameState: GameState, displayName?: string | null) {
    console.log('[Frontend] Starting score submission...');
    const success = await submitRunScore(gameState, displayName === null ? undefined : displayName);
    console.log('[Frontend] Score submission result:', success);
    
    if (success) {
      console.log('[Frontend] Score submitted successfully, fetching fresh leaderboard...');
      // Fetch fresh leaderboard after successful score submission
      await fetchLeaderboard();
      console.log('[Frontend] Leaderboard fetch completed');
    } else {
      // Handle submission failure
      console.error("Score submission failed. Leaderboard may not be up-to-date.");
      leaderboardError = "Score submission failed";
    }
    return success;
  }

  async function triggerScoreSubmission(gameState: GameState) {
    const existingDisplayName = getDisplayName();
    if (!existingDisplayName) {
      pendingGameStateForScoreSubmission = gameState;
      showDisplayNameModal = true;
    } else {
      await submitScoreAndFetchLeaderboard(gameState, existingDisplayName);
    }
  }

  async function handleNameSubmitted(event: CustomEvent<string>) {
    const newDisplayName = event.detail;
    saveDisplayNameToStorage(newDisplayName);
    if (pendingGameStateForScoreSubmission) {
      await submitScoreAndFetchLeaderboard(pendingGameStateForScoreSubmission, newDisplayName);
    }
    showDisplayNameModal = false;
    pendingGameStateForScoreSubmission = null;
  }

  async function handleModalCancel() {
    if (pendingGameStateForScoreSubmission) {
      // Submit score as anonymous if modal is cancelled
      await submitScoreAndFetchLeaderboard(pendingGameStateForScoreSubmission, undefined);
    }
    showDisplayNameModal = false;
    pendingGameStateForScoreSubmission = null;
  }

  // Simplified reactive block for leaderboard processing
  $: {
    if (browser) {
      const g = $game;
      const gameOverState = g.gameOver;
      const isEffectivelyGameOver = gameOverState && gameOverState !== 'playing' && gameOverState !== 'intro';

      if (isEffectivelyGameOver && leaderboard.length > 0) {
        // Game is over and we have leaderboard data - process it
        console.log('[Frontend] Game over AND leaderboard loaded - processing leaderboard');
        
        const currentRunEnding = gameOverState as Ending;
        const scoreDetails = currentRunEnding.scoreDetails;

        if (scoreDetails) {
          const currentRunScore = scoreDetails.total;
          const currentRunDisplayName = getDisplayName() || 'Anonymous';

          const fullLeaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            display_name: entry.display_name || 'Anonymous',
            rank: index + 1,
            isCurrentUser: false
          }));

          let playerEntryInList: (typeof fullLeaderboard[0]) | undefined = undefined;
          for (const entry of fullLeaderboard) {
            if (entry.score === currentRunScore && entry.display_name === currentRunDisplayName) {
              entry.isCurrentUser = true;
              playerEntryInList = entry;
              break;
            }
          }

          if (playerEntryInList) {
            currentPlayerRankMessage = `Your rank: ${playerEntryInList.rank}`;
            if (playerEntryInList.rank <= 10) {
              processedLeaderboard = fullLeaderboard.slice(0, 10);
            } else {
              const top9 = fullLeaderboard.slice(0, 9);
              processedLeaderboard = [...top9, playerEntryInList];
            }
          } else {
            currentPlayerRankMessage = `Your score: ${currentRunScore}. Rank will show if on leaderboard.`;
            processedLeaderboard = fullLeaderboard.slice(0, 10);
            console.warn(`Current run (Score: ${currentRunScore}, Name: ${currentRunDisplayName}) not found in leaderboard.`);
          }
        }
      } else if (isEffectivelyGameOver && isLoadingLeaderboard) {
        // Game is over but still loading leaderboard
        console.log('[Frontend] Game over but still loading leaderboard');
        currentPlayerRankMessage = "Submitting score and fetching leaderboard...";
        processedLeaderboard = [];
      } else if (isEffectivelyGameOver && leaderboardError) {
        // Game is over but there was an error fetching leaderboard
        console.log('[Frontend] Game over but leaderboard error:', leaderboardError);
        if (leaderboardError === 'Local mode: Leaderboard is disabled.') {
          currentPlayerRankMessage = 'Local mode: Leaderboard is disabled.';
        } else {
          currentPlayerRankMessage = `Leaderboard error: ${leaderboardError}`;
        }
        processedLeaderboard = [];
      } else if (isEffectivelyGameOver && !isLoadingLeaderboard && leaderboard.length === 0) {
        // Game is over, not loading, no error, but no leaderboard data
        console.log('[Frontend] Game over but no leaderboard data available');
        currentPlayerRankMessage = "No leaderboard data available";
        processedLeaderboard = [];
      } else {
        // Game not over or no leaderboard data yet - no logging needed
        currentPlayerRankMessage = null;
        processedLeaderboard = [];
      }
    }
  }
</script>

{#if browser}
<div class="flex items-center justify-center bg-black min-h-screen font-mono text-green-300">
  <div class="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden">
    <header class="flex flex-wrap items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
      <h1 class="text-lg font-bold mr-auto">Singularity Run</h1>
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
          <!-- Display rank from currentPlayerRankMessage if available, or fallback -->
          <span class="text-green-400 font-bold order-2 sm:order-3">Victory! {#if currentPlayerRankMessage}{currentPlayerRankMessage}{:else if $game.gameOver.rank}Rank:{$game.gameOver.rank}{/if}</span>
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
          {#if currentPlayerRankMessage === 'Local mode: Leaderboard is disabled.'}
            <!-- No leaderboard shown in local mode -->
          {:else if processedLeaderboard && processedLeaderboard.length > 0}
            <div class="my-6 p-3 bg-gray-800 rounded-md">
              <h2 class="text-xl font-semibold text-purple-400 mb-3">Top Scores</h2>
              {#if currentPlayerRankMessage && currentPlayerRankMessage !== 'Local mode: Leaderboard is disabled.'}
                <p class="text-sm text-yellow-300 mb-2">{currentPlayerRankMessage}</p>
              {/if}
              <ol class="list-decimal list-inside space-y-1 text-sm">
                {#each processedLeaderboard as entry}
                  <li class="flex justify-between items-center px-2 py-1 rounded {entry.isCurrentUser ? 'bg-green-700 text-white' : ''}">
                    <span>
                      <span class="font-semibold {entry.isCurrentUser ? 'text-yellow-300' : 'text-gray-300'}">{entry.rank}. {entry.display_name}:</span> 
                      <span class="{entry.isCurrentUser ? 'text-yellow-300' : 'text-green-300'}">{entry.score} pts</span>
                    </span>
                  </li>
                {/each}
              </ol>
            </div>
          {:else if leaderboardError && leaderboardError !== 'Local mode: Leaderboard is disabled.'}
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
        <p>No events loaded. Please check your content.</p>
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
          href="https://form.typeform.com/to/Ok2IMgF5" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
        >
          Provide Feedback
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