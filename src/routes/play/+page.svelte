<script lang="ts">
    import { onMount } from 'svelte';
    import { game } from '$lib/stores/game';
    import type { Event } from '$lib/types';
    import { applyChoice } from '$lib/engine';
    import events from '$lib/content/events.json';
    import { makeRng } from '$lib/rng';
    import ResourceBars from '$lib/components/ResourceBars.svelte';

    let state: any;
    const unsubscribe = game.subscribe((v) => (state = v));

    let currentEvents: Event[] = [];
    let selectedEvent: Event | null = null;

    function pickEvent() {
      currentEvents = events as Event[];

      if (currentEvents.length) {
        const { rng, nextSeed } = makeRng(state);
        const idx = Math.floor(rng() * currentEvents.length);
        selectedEvent = currentEvents[idx];
        game.update(s => ({ ...s, seed: nextSeed }));
      } else {
        selectedEvent = null;
      }
    }

    function choose(label: string) {
      if (!selectedEvent) return;
      const choice = selectedEvent.choices.find((c) => c.label === label);
      if (!choice) return;
      const next = applyChoice(state, choice);
      game.set(next);
      pickEvent();
    }

    onMount(() => {
      pickEvent();
    });
</script>

<main class="p-4 font-mono bg-black text-green-300 min-h-screen">
    <div class="mb-4 font-mono text-sm">Year: {state.year}</div>
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
      <p>No events available for year {state.year}.</p>
    {/if}
</main>