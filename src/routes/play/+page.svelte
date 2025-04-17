<script lang="ts">
  import { onMount } from 'svelte';
  import { game, defaultState } from '$lib/stores/game';
  import type { Event } from '$lib/types';
  import { applyChoice } from '$lib/engine';
  import { makeRng } from '$lib/rng';
  import ResourceBars from '$lib/components/ResourceBars.svelte';
  import events from '$lib/content/events.json';
  import { browser } from '$app/environment';

  console.clear();

  let state: import('$lib/types').GameState = defaultState;
  let currentEvents: Event[] = [];
  let selectedEvent: Event | null = null;

  onMount(() => {
    // Subscribe to game state
    const unsubscribe = game.subscribe((v) => {
      state = v;
    });
    // Pick the first event
    pickEvent();
    return unsubscribe;
  });

  function pickEvent() {
    console.log('STATE → year:', state.year, 'quarter:', state.quarter);
    console.log('ALL EVENTS →', events);

    // Filter events by matching year and quarter from event.condition string
    currentEvents = (events as Event[]).filter(e => {
      if (!e.condition) return true;
      const match = e.condition.match(/state\.year\s*===\s*(\d+)\s*&&\s*state\.quarter\s*===\s*(\d+)/);
      if (!match) return false;
      const eventYear = parseInt(match[1], 10);
      const eventQuarter = parseInt(match[2], 10);
      return eventYear === state.year && eventQuarter === state.quarter;
    });

    console.log('FILTERED EVENTS →', currentEvents.map(e => e.id));

    if (currentEvents.length) {
      const { rng, nextSeed } = makeRng(state);
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
    const nextState = applyChoice(state, choice);
    game.set(nextState);
    pickEvent();
  }
</script>

{#if browser}
<main class="p-4 font-mono bg-black text-green-300 min-h-screen">
  <div class="mb-4 text-sm">
    Year: {state.year} – Quarter: {state.quarter}
  </div>
  <ResourceBars resources={state.resources} />

  {#if selectedEvent}
    <section class="mb-4">
      <h1 class="text-lg mb-2">{selectedEvent.headline}</h1>
      <p class="mb-4">{selectedEvent.description}</p>
    </section>
    <section>
      {#each selectedEvent.choices as c}
        <button
          class="block mb-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
          on:click={() => choose(c.label)}
        >
          {c.label}
        </button>
      {/each}
    </section>
  {:else}
    <p>No events loaded. Please check your content.</p>
  {/if}
</main>
{/if}