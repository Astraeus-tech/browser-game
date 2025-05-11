<script lang="ts">
  import { onMount } from 'svelte';
  import { game, getDefaultState } from '$lib/stores/game';
  import type { Event } from '$lib/types';
  import { applyChoice, scaleCreditRange } from '$lib/engine';
  import { makeRng } from '$lib/rng';
  import ResourceBars from '$lib/components/ResourceBars.svelte';
  import events from '$lib/content/events';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { calculateImpactScore, getImpactAssessment, getImpactColorClass } from '$lib/impact';

  console.clear();

  let currentEvents: Event[] = [];
  let selectedEvent: Event | null = null;
  let overlayChoice: any = null; // This will store the currently selected choice for the overlay
  let expandedSections = {
    wallstreet: false,
    ngo: false,
    researcher: false
  };

  // Impact assessment ranges - easy to modify if needed
  const IMPACT_RANGES = {
    NEUTRAL: { min: 0, max: 5 },
    SLIGHT: { min: 5, max: 10 },
    MODERATE: { min: 10, max: 25 },
    STRONG: { min: 25, max: Infinity }
  };

  onMount(() => {
    pickEvent();
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
    console.log('STATE → year:', $game.year, 'quarter:', $game.quarter);
    console.log('ALL EVENTS →', events);

    // Filter events by matching year and quarter from event properties
    currentEvents = (events as Event[]).filter(e =>
      e.year === $game.year && e.quarter === $game.quarter
    );

    console.log('FILTERED EVENTS →', currentEvents.map(e => e.id));

    if (currentEvents.length) {
      const currentState = get(game);
      
      // If we already have a saved event ID for this year/quarter, use it
      if (currentState.currentEventId) {
        const savedEvent = currentEvents.find(e => e.id === currentState.currentEventId);
        if (savedEvent) {
          selectedEvent = savedEvent;
          console.log('LOADED SAVED EVENT →', selectedEvent.id);
          return;
        }
      }
      
      // Otherwise, select a new random event
      const { rng, nextSeed } = makeRng($game);
      const idx = Math.floor(rng() * currentEvents.length);
      selectedEvent = currentEvents[idx];
      console.log('SELECTED EVENT →', selectedEvent.id);
      
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
        game.set({
          ...updatedState,
          gameOver: {
            id: 'out_of_credits',
            type: 'loss',
            title: 'Acquired at the Brink',
            reason: 'Credits too low',
            description: `Your runaway burn rate has drained every credit. As the final operations stall, Macrosoft swooped in with a surprise rescue acquisition—stripping you of the CEO title and subsuming your vision into their empire. Soon, your pioneering work will be relegated to corporate archives, another forgotten footnote in tech history.`
          }
        });
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

    // If the game is over (i.e., a win/loss condition was met), do not pick a new event
    if (nextState.gameOver !== 'playing') {
      game.set(nextState);
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

  function startOver() {
    game.set(getDefaultState());
    pickEvent();
  }
</script>

{#if browser}
<div class="flex items-center justify-center bg-black min-h-screen font-mono text-green-300">
  <div class="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden">
    <header class="flex flex-wrap items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
      <h1 class="text-lg font-bold mr-auto">Singularity Run</h1>
      <div class="text-xs order-3 w-full mt-1 sm:mt-0 sm:w-auto sm:order-2 sm:mr-auto">Year: {$game.year} – Q{$game.quarter}</div>
      {#if $game.gameOver === 'playing' && $game.log.length > 0}
        <button
          on:click={startOver}
          class="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded order-2 sm:order-3"
        >
          Abandon Run
        </button>
      {/if}
      {#if $game.gameOver && $game.gameOver !== 'playing'}
        {#if $game.gameOver.type === 'win'}
          <span class="text-green-400 font-bold order-2 sm:order-3">Victory! Rank:{$game.gameOver.rank}</span>
        {:else if $game.gameOver.type === 'draw'}
          <span class="text-yellow-400 font-bold order-2 sm:order-3">Draw</span>
        {:else}
          <span class="text-red-400 font-bold order-2 sm:order-3">Defeat</span>
        {/if}
      {/if}
    </header>
    <div class="px-4 py-2 border-b border-gray-700 overflow-x-auto">
      <ResourceBars
        company={$game.meters.company}
        environment={$game.meters.environment}
        ai_capability={$game.meters.ai_capability}
        metersHistory={$game.metersHistory}
      />
    </div>
    <div class="h-64 md:h-80 p-4 bg-green-950 border-b border-gray-700 overflow-y-auto flex flex-col justify-between">
      {#if $game.gameOver && $game.gameOver !== 'playing'}
        <div>
          <h1 class="text-2xl font-bold text-yellow-300 mb-2">
            {$game.gameOver.title}
          </h1>
          {#if $game.gameOver.type === 'loss' && $game.gameOver.reason}
            <p class="text-gray-400 text-sm mb-2">{$game.gameOver.reason}</p>
          {/if}
          <p class="mb-4 whitespace-pre-line">{$game.gameOver.description}</p>
          {#if $game.gameOver.rank}
            <p class="italic text-sm text-green-400">Game Over – Rank: {$game.gameOver.rank}</p>
          {/if}
        </div>
      {:else if selectedEvent}
        <div>
          <h1 class="text-lg mb-2">{selectedEvent.headline}</h1>
          <p class="mb-4">{selectedEvent.description}</p>
        </div>
      {:else}
        <p>No events loaded. Please check your content.</p>
      {/if}
    </div>
    <footer class="px-4 py-2 bg-gray-800 border-t border-gray-700">
      {#if $game.gameOver && $game.gameOver !== 'playing'}
        <button
          class="w-full mb-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
          on:click={startOver}
        >
          Start Over
        </button>
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
    <div class="fixed min-h-screen inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
      <!-- Use the exact same dimensions and structure as the main UI -->
      <div style="height: 48rem;" class="bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl flex flex-col overflow-hidden">
        <!-- Header - exactly matching the main UI header height -->
        <header class="flex items-center bg-gray-800 px-4 py-2 border-b border-gray-700">
          <h2 class="text-xl font-bold">{overlayChoice.label}</h2>

        </header>
        
        <!-- Resource bar equivalent height space -->
        <div class="px-4 py-3 border-b border-gray-700 bg-green-950">
          {#if overlayChoice.effects.company?.credits}
          <div class="text-yellow-400 ml-auto">Cost: {formatCreditCost(overlayChoice.effects.company.credits)}</div>
          <div class="text-gray-400 ml-auto pb-2">(Available credits: ${$game.meters.company.credits}M)</div>
        {/if}
          <p class="mb-4">{overlayChoice.details}</p>
        </div>
        
        <!-- Main content area - make taller to match screenshot -->
        <div class="p-4 bg-green-950 border-b border-gray-700 overflow-y-auto" style="height: 38rem;">          
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
        
        <!-- Footer - exactly matching height -->
        <footer class="px-4 py-2 bg-gray-800 border-t border-gray-700">
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
</div>
{/if}