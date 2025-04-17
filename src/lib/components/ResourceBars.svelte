<script lang="ts">
    import type { Resources } from '$lib/types';
  
    export let resources: Resources;
  
    // Define meters with labels and Tailwind color classes
    const meters: {
      key: keyof Resources;
      label: string;
      color: string;
    }[] = [
      { key: 'ai_cap', label: 'AI Cap', color: 'bg-green-500' },
      { key: 'social_trust', label: 'Trust', color: 'bg-blue-500' },
      { key: 'env_health', label: 'Env', color: 'bg-teal-500' },
      { key: 'economic_stability', label: 'Stability', color: 'bg-yellow-500' }
    ];
  </script>
  
  <div class="space-y-3 mb-6">
    {#each meters as m}
      <div>
        <!-- Label and current value -->
        <div class="flex justify-between text-xs uppercase mb-1 tracking-wide">
          <span>{m.label}</span>
          <span>{resources[m.key]}</span>
        </div>
        <!-- Bar background -->
        <div class="w-full h-2 bg-gray-800 rounded overflow-hidden">
          <!-- Filled portion -->
          <div
            class={`h-full ${m.color}`}
            style="width: {Math.min(Math.max(resources[m.key], 0), 100)}%;"
          ></div>
        </div>
      </div>
    {/each}
  </div>