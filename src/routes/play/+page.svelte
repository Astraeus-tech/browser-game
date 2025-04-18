<script lang="ts">
  import { onMount } from 'svelte';
  import { game, defaultState } from '$lib/stores/game';
  import type { Event } from '$lib/types';
  import { applyChoice } from '$lib/engine';
  import { makeRng } from '$lib/rng';
  import ResourceBars from '$lib/components/ResourceBars.svelte';
  import events from '$lib/content/events.json';
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
</script>

{#if browser}
<main class="p-4 font-mono bg-black text-green-300 min-h-screen flex flex-col gap-4">
  <div class="text-xs">
    Year: {$game.year} – Quarter: {$game.quarter}
  </div>

  <ResourceBars
    company={$game.meters.company}
    environment={$game.meters.environment}
    ai_capability={$game.meters.ai_capability}
  />

  <div class="bg-green-950 border border-green-700 rounded p-4 h-[300px] overflow-y-auto flex flex-col justify-between">
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

  <section class="mt-4">
    {#if $game.gameOver && $game.gameOver !== 'playing'}
      <p class="text-green-500 italic">Game Over</p>
    {:else if selectedEvent}
      {#each selectedEvent.choices as c}
        <button
          class="block mb-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
          on:click={() => choose(c.label)}
        >
          {c.label}
        </button>
      {/each}
    {/if}
  </section>
</main>
{/if}