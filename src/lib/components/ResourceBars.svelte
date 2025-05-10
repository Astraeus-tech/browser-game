<script lang="ts">
    import type { Meters } from '$lib/types';
    import { onMount } from 'svelte';
    import MetricTooltip from './MetricTooltip.svelte';
  
    export let company;
    export let environment;
    export let ai_capability;
  
    type Meter = {
      key: string;
      label: string;
      icon: string;
      format: (value: number) => string;
      showBar?: boolean;
      isRisk?: boolean;
    };
  
    type MeterGroup = {
      title: string;
      key: string;
      meters: Meter[];
    };
  
    // Tooltip descriptions for each metric
    const tooltips: Record<string, string> = {
      credits: "Your available credits to spend on projects",
      revenue: "Projected annual revenue from current operations",
      valuation: "Company valuation derived from AI capability and revenue",
      approval: "Public approval rating as a percentage",
      security: "Security posture and resilience rating",
      alignment_confidence: "Confidence score that your AI aligns with human intent",
      social_stability: "General social stability in the environment",
      cyber_bio_risk: "Risk level of cyber or bio catastrophes",
      climate_load: "Environmental burden due to compute and emissions",
      coding: "AI coding capability level",
      hacking: "AI hacking capability level",
      bioweapons: "AI bio-weapon development capability level",
      politics_persuasion: "AI's ability to influence political discourse",
      robotics_embodied: "AI robotics and embodied intelligence capability level",
      research_taste: "AI's research direction quality and innovation index"
    };
  
    // Format numbers with appropriate units
    function formatCurrency(value: number): string {
      const billions = value >= 1000;
      return billions 
        ? `$${(value/1000).toFixed(1)}B` 
        : `$${value.toFixed(0)}M`;
    }
  
    function formatPercentage(value: number): string {
      return `${value}%`;
    }
  
    function getAILevel(value: number): string {
      if (value < 20) return '▮▯▯▯▯';
      if (value < 40) return '▮▮▯▯▯';
      if (value < 60) return '▮▮▮▯▯';
      if (value < 80) return '▮▮▮▮▯';
      return '▮▮▮▮▮';
    }
  
    const meterGroups: MeterGroup[] = [
      {
        title: 'Company',
        key: 'company',
        meters: [
          { 
            key: 'credits', 
            label: 'Credits', 
            icon: '💰',
            format: formatCurrency,
            showBar: false
          },
          { 
            key: 'revenue', 
            label: 'Revenue/yr', 
            icon: '📈',
            format: formatCurrency,
            showBar: false
          },
          { 
            key: 'valuation', 
            label: 'Valuation', 
            icon: '💎',
            format: formatCurrency,
            showBar: false
          },
          { 
            key: 'approval', 
            label: 'Approval', 
            icon: '👥',
            format: formatPercentage,
            showBar: true
          },
          { 
            key: 'security', 
            label: 'Security', 
            icon: '🔒',
            format: formatPercentage,
            showBar: true
          },
          { 
            key: 'alignment_confidence', 
            label: 'Alignment', 
            icon: '🎯',
            format: formatPercentage,
            showBar: true
          }
        ]
      },
      {
        title: 'Environment',
        key: 'environment',
        meters: [
          {
            key: 'social_stability',
            label: 'Stability',
            icon: '🌍',
            format: formatPercentage,
            showBar: true
          },
          {
            key: 'cyber_bio_risk',
            label: 'Cyber & Bio',
            icon: '💻🧬',
            format: formatPercentage,
            showBar: true,
            isRisk: true
          },
          {
            key: 'climate_load',
            label: 'Climate',
            icon: '🌡️',
            format: formatPercentage,
            showBar: true,
            isRisk: true
          }
        ]
      },
      {
        title: 'AI Capabilities',
        key: 'ai_capability',
        meters: [
          { 
            key: 'coding', 
            label: 'Code', 
            icon: '👨‍💻',
            format: formatPercentage
          },
          { 
            key: 'hacking', 
            label: 'Hack', 
            icon: '🔓',
            format: formatPercentage
          },
          { 
            key: 'bioweapons', 
            label: 'Bio', 
            icon: '🧪',
            format: formatPercentage
          },
          { 
            key: 'politics_persuasion', 
            label: 'Politics', 
            icon: '🗣️',
            format: formatPercentage
          },
          { 
            key: 'robotics_embodied', 
            label: 'Robot', 
            icon: '🤖',
            format: formatPercentage
          },
          { 
            key: 'research_taste', 
            label: 'Research', 
            icon: '🔬',
            format: formatPercentage
          }
        ]
      }
    ];
</script>

<div class="font-mono text-xs max-w-4xl">
  <!-- Company Stats Row -->
  <div class="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2 mb-4 border-b border-green-900/30 pb-2">
    {#each meterGroups[0].meters.filter(m => !m.showBar) as m}
      {@const value = company[m.key]}
      <div class="flex items-center gap-1 min-w-[90px]">
        <MetricTooltip 
          content={tooltips[m.key]}
          icon={m.icon} 
          label={`${m.label}:`} 
          iconClass="opacity-70 group-hover:opacity-100"
          labelClass="text-gray-400"
        />
        <span class="text-green-400">{m.format(value)}</span>
      </div>
    {/each}
  </div>

  <!-- Company and Environment Meters -->
  <div class="flex flex-col sm:flex-row gap-x-8 gap-y-4 mb-4 border-b border-green-900/30 pb-2">
    <!-- Company Meters -->
    <div class="flex-1 space-y-0.5">
      <div class="text-gray-400 font-semibold mb-1">Company</div>
      {#each meterGroups[0].meters.filter(m => m.showBar) as m}
        {@const value = company[m.key]}
        <div class="flex items-center gap-2 group">
          <div class="w-24 sm:w-32 flex items-center gap-1">
            <MetricTooltip 
              content={tooltips[m.key]}
              icon={m.icon} 
              label={m.label} 
              iconClass="opacity-70 group-hover:opacity-100"
              labelClass="text-gray-400"
            />
          </div>
          <div class="flex-1 h-2 bg-gray-800/50 rounded-sm overflow-hidden relative">
            <div class="absolute inset-0 bg-gradient-to-r from-black/20 to-white/20 z-10"></div>
            <div
              class="h-full {m.isRisk ? 'bg-red-500/40' : 'bg-green-500/40'} transition-all duration-300 relative"
              style="width: {Math.min(Math.max(value, 0), 100)}%;"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>
          </div>
          <div class="w-8 text-right text-gray-400">{value}</div>
        </div>
      {/each}
    </div>

    <!-- Environment Meters -->
    <div class="flex-1 space-y-0.5 sm:border-l border-green-900/30 sm:pl-4">
      <div class="text-gray-400 font-semibold mb-1">Environment</div>
      {#each meterGroups[1].meters.filter(m => m.showBar) as m}
        {@const value = environment[m.key]}
        <div class="flex items-center gap-2 group">
          <div class="w-24 sm:w-32 flex items-center gap-1">
            <MetricTooltip 
              content={tooltips[m.key]}
              icon={m.icon} 
              label={m.label} 
              iconClass="opacity-70 group-hover:opacity-100"
              labelClass="text-gray-400"
            />
          </div>
          <div class="flex-1 h-2 bg-gray-800/50 rounded-sm overflow-hidden relative">
            <div class="absolute inset-0 bg-gradient-to-r from-black/20 to-white/20 z-10"></div>
            <div
              class="h-full {m.isRisk ? 'bg-red-500/40' : 'bg-green-500/40'} transition-all duration-300 relative"
              style="width: {Math.min(Math.max(value, 0), 100)}%;"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>
          </div>
          <div class="w-8 text-right text-gray-400">{value}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- AI Capabilities -->
  <div class="mt-4 mb-1 text-gray-400 font-semibold">AI Capabilities</div>
  <div class="grid grid-cols-2 gap-x-4 gap-y-1">
    {#each meterGroups[2].meters as m}
      {@const value = ai_capability[m.key]}
      <div class="grid grid-cols-[24px_70px_1fr_30px] items-center group">
        <div>
          <MetricTooltip 
            content={tooltips[m.key]}
            icon={m.icon} 
            label=""
            iconClass="opacity-70 group-hover:opacity-100"
            labelClass="hidden"
          />
        </div>
        <span class="text-gray-400 text-xs truncate pr-1">{m.label}</span>
        <div class="font-bold tracking-tight text-cyan-500 text-xs mx-1">
          {getAILevel(value)}
        </div>
        <div class="text-right text-cyan-400 text-xs">Lv{Math.ceil(value/20)}</div>
      </div>
    {/each}
  </div>
</div>