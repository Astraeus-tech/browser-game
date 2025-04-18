<script lang="ts">
    import type { Meters } from '$lib/types';
  
    export let company;
export let environment;
export let ai_capability;
  
    const meterGroups = [
      {
        title: 'Company',
        key: 'company',
        meters: [
          { key: 'credits', label: 'Credits', color: 'bg-green-500' },
          { key: 'revenue', label: 'Revenue', color: 'bg-emerald-600' },
          { key: 'valuation', label: 'Valuation', color: 'bg-lime-600' },
          { key: 'approval', label: 'Approval', color: 'bg-blue-400' },
          { key: 'security', label: 'Security', color: 'bg-gray-400' },
          { key: 'alignment_confidence', label: 'Alignment', color: 'bg-pink-500' }
        ]
      },
      {
        title: 'Environment',
        key: 'environment',
        meters: [
          { key: 'stability', label: 'Stability', color: 'bg-cyan-500' },
          { key: 'bio_risk', label: 'Bio-Risk', color: 'bg-red-600' },
          { key: 'cyber_risk', label: 'Cyber-Risk', color: 'bg-purple-500' },
          { key: 'labor_shock', label: 'Labor Shock', color: 'bg-orange-500' },
          { key: 'climate_load', label: 'Climate Load', color: 'bg-yellow-600' }
        ]
      },
      {
        title: 'AI Capability',
        key: 'ai_capability',
        meters: [
          { key: 'coding', label: 'Coding', color: 'bg-indigo-400' },
          { key: 'hacking', label: 'Hacking', color: 'bg-red-500' },
          { key: 'bioweapons', label: 'Bioweapons', color: 'bg-fuchsia-700' },
          { key: 'politics_persuasion', label: 'Persuasion', color: 'bg-teal-500' },
          { key: 'robotics_embodied', label: 'Robotics', color: 'bg-yellow-500' },
          { key: 'research_taste', label: 'Research Taste', color: 'bg-blue-500' }
        ]
      }
    ];
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  {#each meterGroups as group}
    <div class="bg-gray-900 p-4 rounded-lg shadow">
      <h2 class="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">{group.title}</h2>
      <div class="space-y-1">
        {#each group.meters as m}
          <div class="flex items-center justify-between text-xs text-gray-300">
            <span class="font-semibold">{m.label}</span>
            <span>{group.key === 'company' ? company[m.key] : group.key === 'environment' ? environment[m.key] : ai_capability[m.key]}</span>
          </div>
          <div class="w-full h-1 bg-gray-800 rounded overflow-hidden mb-2">
            <div
              class={`h-full ${m.color} transition-all duration-300`}
              style="width: {Math.min(Math.max(group.key === 'company' ? company[m.key] : group.key === 'environment' ? environment[m.key] : ai_capability[m.key], 0), 100)}%;"
            ></div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>