<script lang="ts">
  import { onMount } from 'svelte';
  import { game, defaultState } from '$lib/stores/game';
  import type { Event } from '$lib/types';
  import { applyChoice } from '$lib/engine';
  import { makeRng } from '$lib/rng';
  import ResourceBars from '$lib/components/ResourceBars.svelte';
  import events from '$lib/content/events';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';

  console.clear();

  let currentEvents: Event[] = [];
  let selectedEvent: Event | null = null;

  onMount(() => {
    pickEvent();
  });

  function pickEvent() {
    console.log('STATE → year:', $game.year, 'quarter:', $game.quarter);
    console.log('ALL EVENTS →', events);

    // Filter events by matching year and quarter from event properties
    currentEvents = (events as Event[]).filter(e =>
      e.year === $game.year && e.quarter === $game.quarter
    );

    console.log('FILTERED EVENTS →', currentEvents.map(e => e.id));

    if (currentEvents.length) {
      const { rng, nextSeed } = makeRng($game);
      const idx = Math.floor(rng() * currentEvents.length);
      selectedEvent = currentEvents[idx];
      console.log('SELECTED EVENT →', selectedEvent.id);
      game.update(s => ({ ...s, seed: nextSeed }));
    } else {
      selectedEvent = null;
      console.warn('No events matched the current state.');
    }
  }

  // Helper to format a credit cost effect string (e.g. "-5..-3" → "-$5M credits")
  function formatCreditCost(effect: string): string {
    const [lo] = effect.split('..').map(Number);
    const abs = Math.abs(lo);
    // use M for millions, B for billions
    const unit = abs >= 1000 ? `${(abs/1000).toFixed(1)}B` : `${abs}M`;
    const sign = lo < 0 ? '-' : '';
    return `${sign}$${unit} credits`;
  }

  // Helper to compute numeric credit cost (e.g. "-5..-3" → 5)
  function getChoiceCost(effect?: string): number {
    if (!effect) return 0;
    const [lo] = effect.split('..').map(Number);
    return lo < 0 ? Math.abs(lo) : 0;
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

    game.set(nextState);
    pickEvent();
  }

  function startOver() {
    game.set({ ...defaultState, seed: Date.now() });
    pickEvent();
  }
</script>

{#if browser}
<div class="flex items-center justify-center bg-black min-h-screen font-mono text-green-300">
  <div class="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden">
    <header class="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
      <h1 class="text-lg font-bold">Singularity Run</h1>
      <div class="text-xs">Year: {$game.year} – Q{$game.quarter}</div>
    </header>
    <div class="px-4 py-2 border-b border-gray-700">
      <ResourceBars
        company={$game.meters.company}
        environment={$game.meters.environment}
        ai_capability={$game.meters.ai_capability}
      />
    </div>
    <div class="h-64 md:h-80 p-4 bg-green-950 border-b border-gray-700 overflow-y-auto flex flex-col justify-between">
      {#if $game.gameOver && $game.gameOver !== 'playing'}
        <div>
          <h1 class="text-2xl font-bold text-yellow-300 mb-2">
            {$game.gameOver.title}
          </h1>
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
            on:click={() => choose(c.label)}
          >
            {c.label}{c.effects.company?.credits ? ` (${formatCreditCost(c.effects.company.credits)})` : ''}
          </button>
        {/each}
      {/if}
    </footer>
  </div>
</div>
{/if}