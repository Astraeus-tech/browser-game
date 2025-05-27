<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  let displayName = '';
  let errorMessage = '';

  const dispatch = createEventDispatcher();

  function handleSubmit() {
    if (!displayName.trim()) {
      errorMessage = 'Display name cannot be empty.';
      return;
    }
    if (displayName.length < 3 || displayName.length > 20) {
      errorMessage = 'Display name must be between 3 and 20 characters.';
      return;
    }
    // Basic alphanumeric check (allow spaces)
    if (!/^[a-zA-Z0-9 ]+$/.test(displayName)) {
        errorMessage = 'Display name can only contain letters, numbers, and spaces.';
        return;
    }

    errorMessage = '';
    dispatch('submitName', displayName.trim());
    isOpen = false; // Close modal on successful submission
  }

  function handleCancel() {
    dispatch('cancelSubmit');
    isOpen = false;
  }

  // Close modal if user presses Escape key
  function keydown(event: KeyboardEvent) {
    if (isOpen && event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={keydown}/>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 font-mono">
    <div class="bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg w-full max-w-md p-6">
      <h2 class="text-xl font-bold text-green-300 mb-4">Enter Your Display Name</h2>
      <p class="text-sm text-gray-400 mb-4">
        This name will be shown on the leaderboard. You can only set it once.
      </p>
      <form on:submit|preventDefault={handleSubmit}>
        <input 
          type="text" 
          bind:value={displayName} 
          placeholder="Min 3, Max 20 characters"
          class="w-full px-3 py-2 mb-2 bg-gray-800 border border-gray-600 rounded text-green-300 focus:ring-green-500 focus:border-green-500"
          minlength="3"
          maxlength="20"
          required
          aria-label="Display Name"
        />
        {#if errorMessage}
          <p class="text-red-400 text-xs mb-3">{errorMessage}</p>
        {/if}
        <div class="flex justify-end space-x-3">
          <button 
            type="button" 
            on:click={handleCancel}
            class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Skip for Now
          </button>
          <button 
            type="submit"
            class="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded"
          >
            Save & Submit Score
          </button>
        </div>
      </form>
    </div>
  </div>
{/if} 