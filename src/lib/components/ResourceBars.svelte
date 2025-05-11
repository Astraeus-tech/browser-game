<script lang="ts">
    import type { Meters } from '$lib/types';
    import { onMount, afterUpdate } from 'svelte';
    import MetricTooltip from './MetricTooltip.svelte';
    import { Chart, type ChartConfiguration } from 'chart.js/auto';
  
    export let company: Record<string, number>;
    export let environment: Record<string, number>;
    export let ai_capability: Record<string, number>;
    export let metersHistory: Array<{
      year: number;
      quarter: number;
      meters: {
        company: Record<string, number>;
        environment: Record<string, number>;
        ai_capability: Record<string, number>;
      };
    }> = [];
  
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
            label: 'Cyber/Bio',
            icon: '⚠️',
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

    // Function to generate chart data from meters history
    function generateChartData() {
      const labels = [];
      const aiCapabilityData = [];
      const singularityCurveData = [];
      
      // Add data from meters history
      if (metersHistory && metersHistory.length > 0) {
        // Process historical data
        for (const record of metersHistory) {
          // Add label
          labels.push(`Q${record.quarter} ${record.year}`);
          
          // Calculate AI capability sum multiplied by (0.7 * Revenue)
          const aiValues = Object.values(record.meters.ai_capability);
          const aiSum = aiValues.reduce((sum: number, val: number) => sum + val, 0);
          const revenue = record.meters.company.revenue || 0;
          const scaledValue = aiSum * (0.7 * revenue);
          aiCapabilityData.push(scaledValue);
        }
      }
      
      // Add current metrics as newest data point if not already included in history
      if (ai_capability && environment && company) {
        // Don't add current point if it's already the last point in history
        const shouldAddCurrentPoint = metersHistory.length === 0 || 
                                      !isCurrentStateInHistory();
                                      
        if (shouldAddCurrentPoint) {
          // Add current quarter label
          const currentLabel = metersHistory.length === 0 ? `Q3 2025` : "Current";
          labels.push(currentLabel);
          
          // Calculate sum of current AI capabilities multiplied by (0.7 * Revenue)
          const currentAiValues = Object.values(ai_capability);
          const currentAiSum = currentAiValues.reduce((sum, val) => sum + val, 0);
          const currentRevenue = company.revenue || 0;
          const scaledCurrentValue = currentAiSum * (0.7 * currentRevenue);
          aiCapabilityData.push(scaledCurrentValue);
        }
      }
      
      // Generate exponential singularity curve
      // Constants for the exponential formula
      const A = 5000;  // Initial value of the curve
      const B = Math.log(500000/5000) / 10;  // Growth rate parameter
      
      /* This exponential curve represents a technological singularity progression
       * Formula: A * e^(B*r) where:
       * - A is the starting value (5000)
       * - B controls the growth rate, calculated to reach 500,000 after 10 periods
       * - r is the time period (round number)
       * 
       * The curve starts slow but accelerates exponentially, modeling the theoretical
       * runaway growth of superintelligent AI capabilities.
       */
      
      // Generate singularity curve values for each data point
      const totalRounds = labels.length;
      for (let round = 0; round < totalRounds; round++) {
        const singularityValue = A * Math.exp(B * round);
        singularityCurveData.push(singularityValue);
      }
      
      return {
        labels,
        datasets: [
          {
            label: 'Your AI Capability',
            data: aiCapabilityData,
            borderColor: 'rgba(0, 200, 255, 0.7)',
            backgroundColor: 'rgba(0, 200, 255, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Road to Singularity',
            data: singularityCurveData,
            borderColor: 'rgba(255, 99, 132, 0.7)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            tension: 0,  // No tension for exponential curve to show true exponential shape
            fill: true,
            borderDash: [5, 5]  // Dashed line to indicate theoretical nature
          }
        ]
      };
    }
    
    // Helper function to check if current state is already in history
    function isCurrentStateInHistory() {
      if (metersHistory.length === 0) return false;
      
      // Get last history entry
      const lastHistoryEntry = metersHistory[metersHistory.length - 1];
      
      // Compare AI Impact values
      const currentAiSum = Object.values(ai_capability).reduce((sum, val) => sum + val, 0) * (0.7 * company.revenue);
      const lastAiSum = Object.values(lastHistoryEntry.meters.ai_capability).reduce((sum, val) => sum + val, 0) * 
                        (0.7 * lastHistoryEntry.meters.company.revenue);
      
      return Math.abs(currentAiSum - lastAiSum) < 0.001; // Allow for small rounding differences
    }

    let chartCanvas: HTMLCanvasElement;
    let chart: Chart;
    
    // Function to update the chart with current data
    function updateChart() {
      if (chart) {
        const data = generateChartData();
        chart.data = data;
        chart.update();
      }
    }
    
    // Watch for changes in the props and update the chart
    $: if (chart && (metersHistory || company || environment || ai_capability)) {
      updateChart();
    }

    onMount(() => {
      if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        if (ctx) {
          const config: ChartConfiguration = {
            type: 'line',
            data: generateChartData(),
            options: {
              responsive: true,
              maintainAspectRatio: false,
              layout: {
                padding: {
                  top: 10
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  // Set a fixed minimum scale that shows the starting point well
                  suggestedMin: 0,
                  // Set a higher max to ensure points don't hit the top
                  suggestedMax: 10000, 
                  grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                  },
                  ticks: {
                    display: false, // Hide Y-axis labels completely
                    color: 'rgba(255, 255, 255, 0.6)',
                    font: {
                      family: 'monospace',
                      size: 10
                    }
                  }
                },
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                    font: {
                      family: 'monospace',
                      size: 10
                    }
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'top',
                  align: 'start',
                  labels: {
                    boxWidth: 20,
                    padding: 5, // Increased padding for more space
                    usePointStyle: true, // Use point style for cleaner look
                    pointStyle: 'rect', // Use rectangles matching the line colors
                    pointStyleWidth: 10, // Control the width of the point style
                    color: 'rgba(255, 255, 255, 0.8)',
                    font: {
                      family: 'monospace',
                      size: 10
                    }
                  }
                },
                tooltip: {
                  enabled: false // Disable tooltips when hovering over data points
                }
              }
            }
          };
          
          chart = new Chart(ctx, config);
        }
      }

      return () => {
        if (chart) {
          chart.destroy();
        }
      };
    });
</script>

<div class="font-mono text-xs max-w-4xl">
  <!-- Company Stats Row -->
  <div class="flex flex-row flex-wrap gap-x-4 gap-y-2 mb-4 border-b border-green-900/30 pb-2">
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

  <!-- Main Layout: Two-column structure -->
  <div class="flex gap-4">
    <!-- Left Column: Company and Environment metrics stacked -->
    <div class="w-1/2 space-y-4">
      <!-- Company Meters -->
      <div class="space-y-0.5 pt-0.5">
        <div class="text-gray-400 font-semibold mb-1">Company</div>
        {#each meterGroups[0].meters.filter(m => m.showBar) as m}
          {@const value = company[m.key]}
          <div class="flex items-center gap-1 group">
            <div class="w-27 flex items-center gap-1">
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
            <div class="w-4 text-right text-gray-400">{value}</div>
          </div>
        {/each}
      </div>

      <!-- Environment Meters -->
      <div class="space-y-0.5 pt-2 border-t border-green-900/30">
        <div class="text-gray-400 font-semibold mb-1">Environment</div>
        {#each meterGroups[1].meters.filter(m => m.showBar) as m}
          {@const value = environment[m.key]}
          <div class="flex items-center gap-1 group">
            <div class="w-27 flex items-center gap-1">
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
            <div class="w-4 text-right text-gray-400">{value}</div>
          </div>
        {/each}
      </div>
    </div>

        <!-- Right Column: AI Progress Trends -->
    <div class="w-1/2 border-l border-green-900/30 pl-4">
      <div class="space-y-0.5 pt-0.5">
        <div class="text-gray-400 font-semibold mb-1">AI Progress Trends</div>
       
        <!-- AI Capabilities Chart -->
        <div class="h-42">
          <canvas bind:this={chartCanvas}></canvas>
        </div>
      </div>

        <!-- Commented out AI individual capabilities 
        <div class="grid grid-cols-1 gap-y-1">
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
        -->
      </div>
  </div>
</div>