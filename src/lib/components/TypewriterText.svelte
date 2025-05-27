<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';

  export let text: string = '';
  export let speed: number = 20; // Milliseconds per character

  let displayedText: string = '';
  let currentIndex: number = 0;
  let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

  function startAnimation() {
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = undefined;

    displayedText = '';
    currentIndex = 0;

    if (text && text.length > 0 && browser) {
      intervalId = setInterval(() => {
        if (currentIndex < text.length) {
          displayedText += text[currentIndex];
          currentIndex++;
        } else {
          if (intervalId) clearInterval(intervalId);
          intervalId = undefined;
        }
      }, speed);
    } else {
      displayedText = browser ? '' : text;
    }
  }

  onMount(() => {
    // Reactive statement handles initial animation
  });

  $: if (browser) {
    tick().then(() => {
      startAnimation();
    });
  } else {
    displayedText = text;
  }

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = undefined;
  });
</script>

<span>{displayedText}</span> 