<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import Chart from 'chart.js/auto';
  
  export let data: {
    stats: {
      totalGames: number;
      hasData: boolean;
      loading: boolean;
    };
    outcomeDataPromise: Promise<{
      outcomeData: Array<{
        outcomeType: string | null;
        endingId: string | null;
        endingTitle: string | null;
        rank: string | null;
        percentage: number;
      }>;
      stats: {
        totalGames: number;
        hasData: boolean;
        loading: boolean;
      };
    }>;
    pathLengthDataPromise: Promise<Array<{
      pathLength: number;
      outcome: string | null;
      percentage: number;
    }>>;
    eventAnalysisPromise: Promise<Record<string, Record<string, {
      eventHeadline: string;
      choices: Array<{
        choice: string;
        totalPercent: number;
        winPercent: number;
        lossPercent: number;
        drawPercent: number;
      }>;
    }>>>;
    leaderboardDataPromise: Promise<{
      leaderboard: Array<{
        display_name: string;
        score: number;
        player_id: string;
        run_ts: Date;
        rank: number;
      }>;
      error: string | null;
    }>;
  };

  // Loading states
  let isLoadingOutcomes = true;
  let isLoadingPathLength = true;
  let isLoadingEventAnalysis = true;
  let isLoadingLeaderboard = true;

  // Data states
  let outcomeData: Array<{
    outcomeType: string | null;
    endingId: string | null;
    endingTitle: string | null;
    rank: string | null;
    percentage: number;
  }> = [];
  let pathLengthData: Array<{
    pathLength: number;
    outcome: string | null;
    percentage: number;
  }> = [];
  let eventAnalysis: Record<string, Record<string, {
    eventHeadline: string;
    choices: Array<{
      choice: string;
      totalPercent: number;
      winPercent: number;
      lossPercent: number;
      drawPercent: number;
    }>;
  }>> = {};
  let leaderboardData: Array<{
    display_name: string;
    score: number;
    player_id: string;
    run_ts: Date;
    rank: number;
  }> = [];
  let leaderboardError: string | null = null;
  let stats = data.stats;

  let charts: { [key: string]: Chart } = {};
  let selectedOutcome: string | null = null;

  // Improved color scheme for better accessibility and readability
  const colors = {
    wins: {
      S: '#10b981', // Emerald-500 - bright green for S rank
      A: '#059669', // Emerald-600 - medium green for A rank  
      B: '#047857', // Emerald-700 - darker green for B rank
      default: '#065f46' // Emerald-800 - darkest green for other wins
    },
    losses: {
      primary: '#dc2626',   // Red-600 - main loss color
      secondary: '#b91c1c', // Red-700 - secondary loss color
      tertiary: '#991b1b',  // Red-800 - tertiary loss color
      quaternary: '#7f1d1d' // Red-900 - quaternary loss color
    },
    draws: '#f59e0b', // Amber-500 - distinct orange for draws
    text: '#f3f4f6',  // Gray-100 - high contrast text
    border: '#9ca3af', // Gray-400 - visible borders
    background: '#111827' // Gray-900 - dark background
  };

  onMount(async () => {
    if (browser) {
      // Load data asynchronously
      loadAnalyticsData();
    }
  });

  async function loadAnalyticsData() {
    try {
      // Load outcome data
      const outcomeResult = await data.outcomeDataPromise;
      outcomeData = outcomeResult.outcomeData;
      stats = outcomeResult.stats;
      isLoadingOutcomes = false;
      
      // Wait for DOM to update before creating charts
      await tick();
      
      // Setup outcome charts once data is loaded
      if (stats.hasData) {
        createMainOutcomeChart();
        createEndingBreakdownChart();
        createRankDistributionChart();
        createLossTypesChart();
      }

      // Load path length data
      pathLengthData = await data.pathLengthDataPromise;
      isLoadingPathLength = false;
      
      // Wait for DOM to update
      await tick();
      
      // Setup path length charts once data is loaded
      if (pathLengthData.length > 0) {
        createGameLengthChart();
      }

      // Load event analysis data
      eventAnalysis = await data.eventAnalysisPromise;
      isLoadingEventAnalysis = false;
      
      // Wait for DOM to update
      await tick();
      
      // Setup event charts once data is loaded
      if (Object.keys(eventAnalysis).length > 0) {
        createEventCharts();
      }

      // Load leaderboard data
      const leaderboardResult = await data.leaderboardDataPromise;
      leaderboardData = leaderboardResult.leaderboard;
      leaderboardError = leaderboardResult.error;
      isLoadingLeaderboard = false;

    } catch (error) {
      console.error('Error loading analytics data:', error);
      isLoadingOutcomes = false;
      isLoadingPathLength = false;
      isLoadingEventAnalysis = false;
      isLoadingLeaderboard = false;
    }
  }

  function setupCharts() {
    // Main outcome chart (horizontal bar with better readability)
    createMainOutcomeChart();
    
    // Basic analysis charts - improved readability
    createEndingBreakdownChart();
    createRankDistributionChart();
    createLossTypesChart();
    createGameLengthChart();
    
    // Choice Analysis
    createEventCharts();
  }

  function createMainOutcomeChart() {
    const canvas = document.getElementById('mainChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Group by outcome type and calculate percentages
    const outcomeGroups = outcomeData.reduce((acc, item) => {
      const type = item.outcomeType || 'unknown';
      if (!acc[type]) acc[type] = 0;
      acc[type] += item.percentage;
      return acc;
    }, {} as Record<string, number>);

    // Sort by frequency (descending)
    const sortedOutcomes = Object.entries(outcomeGroups)
      .sort(([,a], [,b]) => b - a);
    
    const labels = sortedOutcomes.map(([type]) => 
      type.charAt(0).toUpperCase() + type.slice(1) + 's'
    );
    const values = sortedOutcomes.map(([,value]) => value);
    const backgroundColors = sortedOutcomes.map(([type]) => {
      switch(type) {
        case 'win': return colors.wins.default;
        case 'loss': return colors.losses.primary;
        case 'draw': return colors.draws;
        default: return colors.border;
      }
    });

    charts.main = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: backgroundColors,
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Make it horizontal for better readability
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%',
              font: { size: 14 }
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 14 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Overall Game Outcomes Distribution',
            color: colors.text,
            font: { size: 18, weight: 'bold' }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: ${context.parsed.x.toFixed(1)}%`;
              }
            }
          }
        },

      }
    });
  }

  function createEndingBreakdownChart() {
    const canvas = document.getElementById('endingChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Show ALL endings ranked by frequency
    const sortedEndings = [...outcomeData]
      .sort((a, b) => b.percentage - a.percentage);

    if (sortedEndings.length === 0) return;

    charts.ending = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sortedEndings.map(item => {
          const title = item.endingTitle || item.endingId || 'Unknown';
          return title.length > 25 ? title.substring(0, 22) + '...' : title;
        }),
        datasets: [{
          data: sortedEndings.map(item => item.percentage),
          backgroundColor: sortedEndings.map(item => {
            switch(item.outcomeType) {
              case 'win':
                switch(item.rank) {
                  case 'S': return colors.wins.S;
                  case 'A': return colors.wins.A;
                  case 'B': return colors.wins.B;
                  default: return colors.wins.default;
                }
              case 'loss': return colors.losses.primary;
              case 'draw': return colors.draws;
              default: return colors.border;
            }
          }),
          borderColor: colors.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Horizontal for better label readability
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 12 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'All Game Endings (Ranked by Frequency)',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return sortedEndings[index].endingTitle || sortedEndings[index].endingId || 'Unknown';
              },
              label: (context) => `${context.parsed.x.toFixed(1)}% of all games`
            }
          }
        }
      }
    });
  }

  function createRankDistributionChart() {
    const canvas = document.getElementById('rankChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Only show wins with ranks
    const winData = outcomeData.filter(item => 
      item.outcomeType === 'win' && item.rank
    );

    if (winData.length === 0) return;

    // Group by rank
    const rankGroups = winData.reduce((acc, item) => {
      const rank = item.rank || 'Other';
      if (!acc[rank]) acc[rank] = 0;
      acc[rank] += item.percentage;
      return acc;
    }, {} as Record<string, number>);

    const sortedRanks = Object.entries(rankGroups)
      .sort(([a], [b]) => {
        const order = { 'S': 0, 'A': 1, 'B': 2 };
        return (order[a as keyof typeof order] ?? 999) - (order[b as keyof typeof order] ?? 999);
      });

    charts.rank = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sortedRanks.map(([rank]) => `Rank ${rank}`),
        datasets: [{
          data: sortedRanks.map(([, percentage]) => percentage),
          backgroundColor: sortedRanks.map(([rank]) => {
            switch(rank) {
              case 'S': return colors.wins.S;
              case 'A': return colors.wins.A;
              case 'B': return colors.wins.B;
              default: return colors.wins.default;
            }
          }),
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%',
              font: { size: 14 }
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 14 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Victory Rank Distribution',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed.x.toFixed(1)}%`
            }
          }
        }
      }
    });
  }

  function createLossTypesChart() {
    const canvas = document.getElementById('lossTypesChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Only show loss endings, sorted by frequency
    const lossData = outcomeData.filter(item => item.outcomeType === 'loss')
      .sort((a, b) => b.percentage - a.percentage);
    if (lossData.length === 0) return;

    // Calculate total loss percentage to normalize to 100%
    const totalLossPercentage = lossData.reduce((sum, item) => sum + item.percentage, 0);
    
    // Normalize percentages so they add up to 100% among losses
    const normalizedData = lossData.map(item => ({
      ...item,
      normalizedPercentage: totalLossPercentage > 0 ? (item.percentage / totalLossPercentage) * 100 : 0
    }));

    charts.lossTypes = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: normalizedData.map(item => {
          const title = item.endingTitle || item.endingId || 'Unknown';
          return title.length > 20 ? title.substring(0, 17) + '...' : title;
        }),
        datasets: [{
          data: normalizedData.map(item => item.normalizedPercentage),
          backgroundColor: normalizedData.map((_, index) => {
            const lossColors = Object.values(colors.losses);
            return lossColors[index % lossColors.length];
          }),
          borderColor: colors.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%',
              font: { size: 12 }
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 11 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Loss Types Distribution',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return normalizedData[index].endingTitle || normalizedData[index].endingId || 'Unknown';
              },
              label: (context) => {
                const index = context.dataIndex;
                const item = normalizedData[index];
                return [
                  `${context.parsed.x.toFixed(1)}% of all losses`,
                  `${item.percentage.toFixed(1)}% of all games`
                ];
              }
            }
          }
        }
      }
    });
  }

  function createGameLengthChart() {
    const canvas = document.getElementById('gameLengthChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (!pathLengthData || pathLengthData.length === 0) return;

    // Group by path length and sum percentages across all outcomes
    const lengthTotals = pathLengthData.reduce((acc, item) => {
      const length = item.pathLength;
      if (!acc[length]) acc[length] = 0;
      acc[length] += item.percentage;
      return acc;
    }, {} as Record<number, number>);

    // Get all actual lengths from the data and sort them
    const lengths = Object.keys(lengthTotals).map(Number).sort((a, b) => a - b);
    const percentages = lengths.map(length => lengthTotals[length]);

    charts.gameLength = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: lengths.map(l => `${l} turns${l === 1 ? '' : 's'}`),
        datasets: [{
          data: percentages,
          backgroundColor: colors.wins.default,
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Make it horizontal
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%',
              font: { size: 14 }
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 14 },
              maxTicksLimit: 20, // Allow up to 20 labels
              autoSkip: false // Don't skip any labels
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Game Length Distribution',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.x.toFixed(1)}% of games ended after ${context.label}`
            }
          }
        }
      }
    });
  }

  function createWinLossComparisonChart() {
    const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Calculate win vs loss percentages
    const winPercentage = outcomeData
      .filter(item => item.outcomeType === 'win')
      .reduce((sum, item) => sum + item.percentage, 0);
    
    const lossPercentage = outcomeData
      .filter(item => item.outcomeType === 'loss')
      .reduce((sum, item) => sum + item.percentage, 0);

    const drawPercentage = outcomeData
      .filter(item => item.outcomeType === 'draw')
      .reduce((sum, item) => sum + item.percentage, 0);

    charts.comparison = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Success', 'Failure', 'Stalemate'],
        datasets: [{
          label: 'Percentage',
          data: [winPercentage, lossPercentage, drawPercentage],
          backgroundColor: [colors.wins.default, colors.losses.primary, colors.draws],
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          x: {
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Overall Success Rate',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        }
      }
    });
  }

  function createVictoryQualityChart() {
    const canvas = document.getElementById('qualityChart') as HTMLCanvasElement;
    if (!canvas) return;

    const winData = outcomeData.filter(item => item.outcomeType === 'win');
    if (winData.length === 0) return;

    // Group by rank and calculate totals
    const rankTotals = winData.reduce((acc, item) => {
      const rank = item.rank || 'Unranked';
      if (!acc[rank]) acc[rank] = 0;
      acc[rank] += item.percentage;
      return acc;
    }, {} as Record<string, number>);

    charts.quality = new Chart(canvas, {
      type: 'polarArea',
      data: {
        labels: Object.keys(rankTotals).map(rank => `Rank ${rank}`),
        datasets: [{
          data: Object.values(rankTotals),
          backgroundColor: Object.keys(rankTotals).map(rank => {
            switch(rank) {
              case 'S': return colors.wins.S + '80';
              case 'A': return colors.wins.A + '80';
              case 'B': return colors.wins.B + '80';
              default: return colors.wins.default + '80';
            }
          }),
          borderColor: Object.keys(rankTotals).map(rank => {
            switch(rank) {
              case 'S': return colors.wins.S;
              case 'A': return colors.wins.A;
              case 'B': return colors.wins.B;
              default: return colors.wins.default;
            }
          }),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Victory Quality Distribution',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          }
        }
      }
    });
  }

  function createAllEndingsChart() {
    const canvas = document.getElementById('allEndingsChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Show all endings sorted by percentage
    const sortedData = [...outcomeData]
      .sort((a, b) => b.percentage - a.percentage);

    if (sortedData.length === 0) return;

    charts.allEndings = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sortedData.map(item => 
          (item.endingTitle || item.endingId || 'Unknown').substring(0, 12) + '...'
        ),
        datasets: [{
          label: 'Frequency %',
          data: sortedData.map(item => item.percentage),
          backgroundColor: sortedData.map(item => {
            switch(item.outcomeType) {
              case 'win': 
                return item.rank === 'S' ? colors.wins.S :
                       item.rank === 'A' ? colors.wins.A :
                       item.rank === 'B' ? colors.wins.B :
                       colors.wins.default;
              case 'loss': return colors.losses.primary;
              case 'draw': return colors.draws;
              default: return colors.border;
            }
          }),
          borderColor: colors.border,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'All Endings Overview',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        }
      }
    });
  }

  function createOutcomeSummaryChart() {
    const canvas = document.getElementById('summaryChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Count number of different ending types per outcome
    const outcomeCounts = outcomeData.reduce((acc, item) => {
      const type = item.outcomeType || 'unknown';
      if (!acc[type]) acc[type] = { count: 0, percentage: 0 };
      acc[type].count += 1;
      acc[type].percentage += item.percentage;
      return acc;
    }, {} as Record<string, { count: number, percentage: number }>);

    charts.summary = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Variety', 'Frequency', 'Distribution'],
        datasets: Object.entries(outcomeCounts).map(([type, data]) => ({
          label: type.charAt(0).toUpperCase() + type.slice(1),
          data: [
            data.count, // Variety (number of different endings)
            data.percentage, // Total frequency
            data.percentage / data.count // Average per ending
          ],
          backgroundColor: (type === 'win' ? colors.wins.default : 
                           type === 'loss' ? colors.losses.primary : colors.draws) + '20',
          borderColor: type === 'win' ? colors.wins.default : 
                      type === 'loss' ? colors.losses.primary : colors.draws,
          borderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Outcome Analysis Summary',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          }
        },
        scales: {
          r: {
            angleLines: { color: colors.border + '60' },
            grid: { color: colors.border + '40' },
            pointLabels: { color: colors.text },
            ticks: { color: colors.text, backdropColor: 'transparent' }
          }
        }
      }
    });
  }

  function createSuccessEfficiencyChart() {
    const canvas = document.getElementById('efficiencyChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Analyze efficiency: shorter successful paths are better
    const winData = outcomeData.filter(item => item.outcomeType === 'win');
    if (winData.length === 0) return;

    // Calculate success rate by rank with efficiency scoring
    const rankData = winData.reduce((acc, item) => {
      const rank = item.rank || 'Unranked';
      if (!acc[rank]) acc[rank] = { percentage: 0, efficiency: 0 };
      acc[rank].percentage += item.percentage;
      // S rank = 100% efficiency, A = 80%, B = 60%, other = 40%
      acc[rank].efficiency = rank === 'S' ? 100 : rank === 'A' ? 80 : rank === 'B' ? 60 : 40;
      return acc;
    }, {} as Record<string, { percentage: number, efficiency: number }>);

    const ranks = Object.keys(rankData).sort((a, b) => rankData[b].efficiency - rankData[a].efficiency);

    charts.efficiency = new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets: ranks.map(rank => ({
          label: `Rank ${rank}`,
          data: [{
            x: rankData[rank].efficiency, // Efficiency score
            y: rankData[rank].percentage, // Frequency
            r: Math.max(rankData[rank].percentage / 2, 5) // Bubble size
          }],
          backgroundColor: rank === 'S' ? colors.wins.S + '80' :
                          rank === 'A' ? colors.wins.A + '80' :
                          rank === 'B' ? colors.wins.B + '80' :
                          colors.wins.default + '80',
          borderColor: rank === 'S' ? colors.wins.S :
                      rank === 'A' ? colors.wins.A :
                      rank === 'B' ? colors.wins.B :
                      colors.wins.default,
          borderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'Quality Score', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: 'Frequency %', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Success Quality vs Frequency',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const dataset = context.dataset;
                const dataPoint = dataset.data[context.dataIndex] as any;
                return `${dataset.label}: ${dataPoint.y.toFixed(1)}% frequency, Quality: ${dataPoint.x}`;
              }
            }
          }
        }
      }
    });
  }

  function createStrategicDiversityChart() {
    const canvas = document.getElementById('diversityChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Calculate strategic diversity metrics
    const totalEndings = outcomeData.length;
    const winEndings = outcomeData.filter(item => item.outcomeType === 'win').length;
    const lossEndings = outcomeData.filter(item => item.outcomeType === 'loss').length;
    const drawEndings = outcomeData.filter(item => item.outcomeType === 'draw').length;

    // Diversity score: how evenly distributed are outcomes
    const totalWinPercent = outcomeData.filter(item => item.outcomeType === 'win').reduce((sum, item) => sum + item.percentage, 0);
    const avgWinPercent = winEndings > 0 ? totalWinPercent / winEndings : 0;
    
    charts.diversity = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Ending Variety', 'Win Diversity', 'Exploration', 'Consistency', 'Mastery'],
        datasets: [{
          label: 'Strategic Profile',
          data: [
            Math.min((totalEndings / 50) * 100, 100), // Ending variety (normalized to 50 max)
            Math.min((winEndings / 20) * 100, 100), // Win path diversity
            Math.min((lossEndings / 30) * 100, 100), // Exploration of failure paths
            Math.max(100 - (avgWinPercent * 2), 0), // Consistency (inverse of average)
            totalWinPercent // Overall mastery
          ],
          backgroundColor: colors.wins.default + '20',
          borderColor: colors.wins.default,
          borderWidth: 3,
          pointBackgroundColor: colors.wins.default
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Strategic Diversity Profile',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            angleLines: { color: colors.border + '60' },
            grid: { color: colors.border + '40' },
            pointLabels: { color: colors.text },
            ticks: { 
              color: colors.text, 
              backdropColor: 'transparent',
              stepSize: 20
            }
          }
        }
      }
    });
  }

  function createQualityProgressionChart() {
    const canvas = document.getElementById('progressionChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Skip if no pathLengthData - we'll add real data later
    if (pathLengthData.length === 0) {
      // Create a placeholder chart showing "No data available"
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.text;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No progression data available yet', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    const pathLengthSuccess = pathLengthData.reduce((acc, item) => {
      const outcome = item.outcome;
      const length = item.pathLength;
      if (outcome && length) {
        if (!acc[length]) acc[length] = { win: 0, loss: 0, draw: 0 };
        if (acc[length][outcome as keyof typeof acc[number]] !== undefined) {
          acc[length][outcome as keyof typeof acc[number]] += item.percentage;
        }
      }
      return acc;
    }, {} as Record<number, Record<string, number>>);

    const lengths = Object.keys(pathLengthSuccess).map(Number).sort((a, b) => a - b);
    const winRates = lengths.map(length => {
      const total = pathLengthSuccess[length].win + pathLengthSuccess[length].loss + pathLengthSuccess[length].draw;
      return total > 0 ? (pathLengthSuccess[length].win / total) * 100 : 0;
    });

    charts.progression = new Chart(canvas, {
      type: 'line',
      data: {
        labels: lengths.map(l => `${l} choices`),
        datasets: [{
          label: 'Win Rate %',
          data: winRates,
          borderColor: colors.wins.default,
          backgroundColor: colors.wins.default + '20',
          borderWidth: 4,
          tension: 0.4,
          pointBackgroundColor: colors.wins.default,
          pointBorderColor: colors.border,
          pointBorderWidth: 2,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: 'Success Rate %', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          x: {
            title: { display: true, text: 'Game Length', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Learning Curve: Success vs Game Length',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        }
      }
    });
  }

    function createEventCharts() {
    // Create charts for all quarters and events
    if (!eventAnalysis) return;
    
    for (const [quarterKey, quarterEvents] of Object.entries(eventAnalysis)) {
      for (const [eventId, eventData] of Object.entries(quarterEvents)) {
        createEventChoiceChart(eventId, eventData.eventHeadline, eventData.choices);
      }
    }
  }

  function createEventChoiceChart(eventId: string, eventHeadline: string, choiceData: any[]) {
    const sanitizedEventId = eventId.replace(/[^a-zA-Z0-9]/g, '_');
    const canvas = document.getElementById(`event_${sanitizedEventId}_chart`) as HTMLCanvasElement;
    if (!canvas) return;
    
    if (choiceData.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.text;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    // Prepare data for the chart
    const choiceLabels = choiceData.map((item: any) => 
      item.choice.length > 40 ? item.choice.substring(0, 37) + '...' : item.choice
    );

    const chartKey = `event_${sanitizedEventId}`;
    charts[chartKey] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: choiceLabels,
        datasets: [
          {
            label: 'Choice Popularity',
            data: choiceData.map((item: any) => item.totalPercent),
            backgroundColor: colors.wins.default,
            borderColor: colors.border,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%',
              font: { size: 12 }
            }
          },
          y: {
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              font: { size: 11 }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: eventHeadline,
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              afterBody: (tooltipItems: any) => {
                const index = tooltipItems[0].dataIndex;
                const item = choiceData[index];
                return [
                  `Full choice: ${item.choice}`,
                  `${item.totalPercent.toFixed(1)}% of players chose this option`
                ];
              }
            }
          }
        }
      }
    });
  }

  function createPathOptimizationChart() {
    const canvas = document.getElementById('optimizationChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Use pathLengthData instead of sequenceData
    if (!pathLengthData || pathLengthData.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.text;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No path length data available', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    // Compare path efficiency: wins vs losses by length
    const efficiencyData = pathLengthData.reduce((acc, item) => {
      const outcome = item.outcome;
      const length = item.pathLength;
      if (outcome && length) {
        if (!acc[outcome]) acc[outcome] = {};
        if (!acc[outcome][length]) acc[outcome][length] = 0;
        acc[outcome][length] += item.percentage;
      }
      return acc;
    }, {} as Record<string, Record<number, number>>);

    const allLengths = new Set<number>();
    Object.values(efficiencyData).forEach(lengths => {
      Object.keys(lengths).forEach(length => allLengths.add(Number(length)));
    });

    const sortedLengths = Array.from(allLengths).sort((a, b) => a - b);

    charts.optimization = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sortedLengths.map(l => `${l} choices`),
        datasets: [
          {
            label: 'Wins',
            data: sortedLengths.map(length => efficiencyData.win?.[length] || 0),
            borderColor: colors.wins.default,
            backgroundColor: colors.wins.default + '20',
            borderWidth: 3,
            tension: 0.4
          },
          {
            label: 'Losses',
            data: sortedLengths.map(length => efficiencyData.loss?.[length] || 0),
            borderColor: colors.losses.primary,
            backgroundColor: colors.losses.primary + '20',
            borderWidth: 3,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Frequency %', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          x: {
            title: { display: true, text: 'Path Length', color: colors.text },
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Path Length Optimization Analysis',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          }
        }
      }
    });
  }

  function createPathLengthChart() {
    const canvas = document.getElementById('pathLengthChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (!pathLengthData || pathLengthData.length === 0) return;

    // Group by path length
    const lengthGroups = pathLengthData.reduce((acc, item) => {
      const outcome = item.outcome;
      if (outcome && item.pathLength) {
        if (!acc[item.pathLength]) acc[item.pathLength] = { win: 0, loss: 0, draw: 0 };
        if (acc[item.pathLength][outcome] !== undefined) {
          acc[item.pathLength][outcome] += item.percentage;
        }
      }
      return acc;
    }, {} as Record<number, Record<string, number>>);

    const lengths = Object.keys(lengthGroups).map(Number).sort((a, b) => a - b);

    charts.pathLength = new Chart(canvas, {
      type: 'line',
      data: {
        labels: lengths.map(l => `${l} choices`),
        datasets: [
          {
            label: 'Win %',
            data: lengths.map(l => lengthGroups[l].win || 0),
            borderColor: colors.wins.default,
            backgroundColor: colors.wins.default + '20',
            borderWidth: 3,
            tension: 0.4
          },
          {
            label: 'Loss %',
            data: lengths.map(l => lengthGroups[l].loss || 0),
            borderColor: colors.losses.primary,
            backgroundColor: colors.losses.primary + '20',
            borderWidth: 3,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.border + '40' },
            ticks: { 
              color: colors.text,
              callback: (value) => value + '%'
            }
          },
          x: {
            grid: { color: colors.border + '40' },
            ticks: { color: colors.text }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Game Length vs Outcome',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          }
        }
      }
    });
  }

  function createPerformanceTrendsChart() {
    const canvas = document.getElementById('trendsChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Analyze win rate by ending difficulty (based on rank)
    const winData = outcomeData.filter(item => item.outcomeType === 'win');
    if (winData.length === 0) return;

    const rankData = winData.reduce((acc, item) => {
      const rank = item.rank || 'Unranked';
      if (!acc[rank]) acc[rank] = 0;
      acc[rank] += item.percentage;
      return acc;
    }, {} as Record<string, number>);

    const ranks = ['S', 'A', 'B', 'Unranked'].filter(rank => rankData[rank]);

    charts.trends = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Quality', 'Frequency', 'Consistency', 'Diversity', 'Excellence'],
        datasets: ranks.map(rank => ({
          label: `Rank ${rank}`,
          data: [
            rankData[rank], // Quality (percentage of wins)
            rankData[rank] / (winData.length || 1) * 100, // Frequency
            Math.min(rankData[rank] * 2, 100), // Consistency (capped)
            Math.min((Object.keys(rankData).length / 4) * 100, 100), // Diversity
            rank === 'S' ? 100 : rank === 'A' ? 80 : rank === 'B' ? 60 : 40 // Excellence
          ],
          backgroundColor: (rank === 'S' ? colors.wins.S : 
                           rank === 'A' ? colors.wins.A :
                           rank === 'B' ? colors.wins.B : colors.wins.default) + '20',
          borderColor: rank === 'S' ? colors.wins.S : 
                      rank === 'A' ? colors.wins.A :
                      rank === 'B' ? colors.wins.B : colors.wins.default,
          borderWidth: 2
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Performance Analysis by Rank',
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          }
        },
        scales: {
          r: {
            angleLines: { color: colors.border + '60' },
            grid: { color: colors.border + '40' },
            pointLabels: { color: colors.text },
            ticks: { color: colors.text, backdropColor: 'transparent' }
          }
        }
      }
    });
  }

  function updateDrillDownChart() {
    if (!selectedOutcome) return;
    
    const canvas = document.getElementById('drillDownChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Filter data for selected outcome type only
    const filteredData = outcomeData.filter(item => 
      item.outcomeType === selectedOutcome
    );
    
    if (filteredData.length === 0) return;

    // Destroy existing chart
    if (charts.drillDown) {
      charts.drillDown.destroy();
    }

    // If only one ending of this type, show a message instead of chart
    if (filteredData.length === 1) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.text;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Only one ${selectedOutcome} type found:`,
          canvas.width / 2,
          canvas.height / 2 - 20
        );
        ctx.fillText(
          filteredData[0].endingTitle || filteredData[0].endingId || 'Unknown',
          canvas.width / 2,
          canvas.height / 2 + 10
        );
        ctx.fillText(
          `${filteredData[0].percentage.toFixed(1)}% of all games`,
          canvas.width / 2,
          canvas.height / 2 + 40
        );
      }
      return;
    }

    // Create chart for multiple endings of this type
    charts.drillDown = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: filteredData.map(item => 
          item.endingTitle || item.endingId || 'Unknown'
        ),
        datasets: [{
          data: filteredData.map(item => item.percentage),
          backgroundColor: filteredData.map((item, index) => {
            if (selectedOutcome === 'win') {
              return item.rank === 'S' ? colors.wins.S :
                     item.rank === 'A' ? colors.wins.A :
                     item.rank === 'B' ? colors.wins.B :
                     colors.wins.default;
            } else if (selectedOutcome === 'loss') {
              const lossColors = Object.values(colors.losses);
              return lossColors[index % lossColors.length];
            } else {
              return colors.draws;
            }
          }),
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${selectedOutcome.charAt(0).toUpperCase()}${selectedOutcome.slice(1)} Types Breakdown`,
            color: colors.text,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom',
            labels: { color: colors.text }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed.toFixed(1)}%`
            }
          }
        }
      }
    });
  }
</script>

<div class="min-h-screen bg-gray-900 text-gray-100 p-6">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-4xl font-bold text-center mb-4 text-yellow-400">Game Analytics Dashboard</h1>
    
    {#if !stats.hasData && !isLoadingOutcomes && !isLoadingPathLength && !isLoadingEventAnalysis}
      <div class="text-center p-8">
        <p class="text-xl text-gray-400">No game data available yet.</p>
        <p class="text-gray-500 mt-2">Complete some games to see analytics.</p>
      </div>
    {:else}
      <div class="text-center mb-6">
        {#if isLoadingOutcomes || isLoadingPathLength || isLoadingEventAnalysis || isLoadingLeaderboard}
          <div class="flex items-center justify-center space-x-2 mb-2">
            <div class="w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
            <p class="text-sm text-yellow-400">Loading analytics data...</p>
          </div>
        {/if}
        <p class="text-sm text-gray-400 mt-1">All values shown as percentages</p>
      </div>
    {/if}
  </div>

  {#if stats.hasData || isLoadingOutcomes}
    
    <!-- MAIN OUTCOME CHART WITH DRILL-DOWN -->
    <div class="mb-12">
      <div class="flex items-center mb-6">
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>
        <h2 class="px-6 text-2xl font-bold text-yellow-400">Game Outcomes Overview</h2>
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        
        <!-- Main Outcome Distribution -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
          {#if isLoadingOutcomes}
            <div class="h-96 flex flex-col space-y-4">
              <div class="placeholder animate-pulse bg-surface-400/20 h-8 w-3/4 mx-auto rounded"></div>
              <div class="flex-1 space-y-3">
                <div class="placeholder animate-pulse bg-surface-400/20 h-16 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-12 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-8 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-6 rounded"></div>
              </div>
            </div>
          {:else}
            <div class="h-96">
              <canvas id="mainChart"></canvas>
            </div>
          {/if}
          <p class="text-sm text-gray-400 mt-3 text-center">Overall game outcomes distribution</p>
        </div>

        <!-- All Endings Breakdown -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
          {#if isLoadingOutcomes}
            <div class="h-96 flex flex-col space-y-4">
              <div class="placeholder animate-pulse bg-surface-400/20 h-8 w-3/4 mx-auto rounded"></div>
              <div class="flex-1 space-y-2">
                {#each Array(8) as _, i}
                  <div class="flex items-center space-x-3">
                    <div class="placeholder animate-pulse bg-surface-400/20 h-6 flex-1 rounded"></div>
                    <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-12 rounded"></div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="h-96">
              <canvas id="endingChart"></canvas>
            </div>
          {/if}
          <p class="text-sm text-gray-400 mt-3 text-center">All endings ranked by frequency</p>
        </div>

      </div>
    </div>

    <!-- DISTRIBUTION ANALYSIS -->
    <div class="mb-12">
      <div class="flex items-center mb-6">
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-green-600 to-transparent"></div>
        <h2 class="px-6 text-2xl font-bold text-green-400">Distribution Analysis</h2>
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-green-600 to-transparent"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">

        <!-- Victory Rank Distribution -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
          {#if isLoadingOutcomes}
            <div class="h-64 flex flex-col space-y-3">
              <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-2/3 mx-auto rounded"></div>
              <div class="flex-1 space-y-2">
                <div class="placeholder animate-pulse bg-surface-400/20 h-8 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-6 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-4 rounded"></div>
              </div>
            </div>
          {:else}
            <div class="h-64">
              <canvas id="rankChart"></canvas>
            </div>
          {/if}
          <p class="text-sm text-gray-400 mt-3 text-center">Win quality breakdown</p>
        </div>

        <!-- Loss Types -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
          {#if isLoadingOutcomes}
            <div class="h-64 flex flex-col space-y-3">
              <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-2/3 mx-auto rounded"></div>
              <div class="flex-1 space-y-2">
                {#each Array(5) as _, i}
                  <div class="placeholder animate-pulse bg-surface-400/20 h-4 rounded"></div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="h-64">
              <canvas id="lossTypesChart"></canvas>
            </div>
          {/if}
          <p class="text-sm text-gray-400 mt-3 text-center">Loss type distribution</p>
        </div>

        <!-- Game Length Distribution -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
          {#if isLoadingPathLength}
            <div class="h-64 flex flex-col space-y-3">
              <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-2/3 mx-auto rounded"></div>
              <div class="flex-1 space-y-2">
                {#each Array(6) as _, i}
                  <div class="placeholder animate-pulse bg-surface-400/20 h-5 rounded"></div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="h-64">
              <canvas id="gameLengthChart"></canvas>
            </div>
          {/if}
          <p class="text-sm text-gray-400 mt-3 text-center">Game length distribution</p>
        </div>

      </div>
    </div>





    <!-- CHOICE ANALYSIS BY EVENT -->
    <div class="mb-12">
      <div class="flex items-center mb-6">
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-600 to-transparent"></div>
        <h2 class="px-6 text-2xl font-bold text-emerald-400">Choice Analysis by Event</h2>
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-600 to-transparent"></div>
      </div>
      <p class="text-center text-gray-300 mb-8 max-w-4xl mx-auto">
        Choice popularity analysis organized by game quarters. Shows what percentage of players picked each choice when encountering specific events throughout the game timeline.
      </p>
      
      {#if isLoadingEventAnalysis}
        <!-- Loading skeleton for event analysis -->
        <div class="mb-20">
          <!-- Quarter Header Skeleton -->
          <div class="flex items-center mb-8">
            <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
            <div class="placeholder animate-pulse bg-surface-400/20 h-8 w-32 rounded"></div>
            <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
          </div>
          
          <!-- Events Grid Skeleton -->
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {#each Array(6) as _, i}
              <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
                <div class="h-96 flex flex-col space-y-4">
                  <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-3/4 mx-auto rounded"></div>
                  <div class="flex-1 space-y-3">
                    {#each Array(4) as _, j}
                      <div class="flex items-center space-x-3">
                        <div class="placeholder animate-pulse bg-surface-400/20 h-4 flex-1 rounded"></div>
                        <div class="placeholder animate-pulse bg-surface-400/20 h-4 w-10 rounded"></div>
                      </div>
                    {/each}
                  </div>
                </div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-4 w-2/3 mx-auto mt-3 rounded"></div>
              </div>
            {/each}
          </div>
        </div>
      {:else if eventAnalysis && Object.keys(eventAnalysis).length > 0}
        {#each Object.entries(eventAnalysis) as [quarterKey, quarterEvents]}
          <div class="mb-20">
            <!-- Quarter Header -->
            <div class="flex items-center mb-8">
              <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
              <h3 class="px-6 text-2xl font-bold text-emerald-400">{quarterKey}</h3>
              <div class="flex-grow h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
            </div>
            
            <!-- Events Grid for this Quarter -->
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {#each Object.entries(quarterEvents) as [eventId, eventData]}
                <div class="bg-gray-800 rounded-lg p-6 border border-gray-600">
                  <div class="h-96">
                    <canvas id="event_{eventId.replace(/[^a-zA-Z0-9]/g, '_')}_chart"></canvas>
                  </div>
                  <p class="text-sm text-gray-400 mt-3 text-center font-medium">{eventData.eventHeadline}</p>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {:else}
        <div class="text-center text-gray-400 py-16">
          <p class="text-xl mb-2">No event choice data available</p>
          <p class="text-sm">Play some games to see choice analysis!</p>
        </div>
      {/if}
    </div>

    <!-- LEADERBOARD SECTION -->
    <div class="mb-12">
      <div class="flex items-center mb-6">
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>
        <h2 class="px-6 text-2xl font-bold text-yellow-400">Top 100 Leaderboard</h2>
        <div class="flex-grow h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent"></div>
      </div>
      <p class="text-center text-gray-300 mb-8 max-w-4xl mx-auto">
        The highest scoring players across all games. Rankings are based on the final score achieved in each player's best run.
      </p>
      
      {#if isLoadingLeaderboard}
        <!-- Loading skeleton for leaderboard -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-600 max-w-5xl mx-auto">
          <div class="space-y-3">
            {#each Array(20) as _, i}
              <div class="flex items-center space-x-4 py-2">
                <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-12 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-6 flex-1 rounded"></div>
                <div class="placeholder animate-pulse bg-surface-400/20 h-6 w-20 rounded"></div>
              </div>
            {/each}
          </div>
        </div>
      {:else if leaderboardError}
        <div class="text-center text-gray-400 py-16">
          <p class="text-xl mb-2">Leaderboard unavailable</p>
          <p class="text-sm">{leaderboardError}</p>
        </div>
      {:else if leaderboardData.length === 0}
        <div class="text-center text-gray-400 py-16">
          <p class="text-xl mb-2">No scores available yet</p>
          <p class="text-sm">Be the first to complete a game and set a score!</p>
        </div>
      {:else}
        <div class="bg-gray-800 rounded-lg border border-gray-600 max-w-5xl mx-auto overflow-hidden">
          <!-- Header -->
          <div class="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <div class="grid grid-cols-3 gap-4 font-semibold text-gray-200">
              <div class="text-center">Rank</div>
              <div>Player</div>
              <div class="text-center">Score</div>
            </div>
          </div>
          
          <!-- Leaderboard entries -->
          <div class="max-h-96 overflow-y-auto">
            {#each leaderboardData as entry, index}
              <div class="px-6 py-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition-colors">
                <div class="grid grid-cols-3 gap-4 items-center">
                  <!-- Rank -->
                  <div class="text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                      {entry.rank === 1 ? 'bg-yellow-500 text-black' : 
                       entry.rank === 2 ? 'bg-gray-400 text-black' : 
                       entry.rank === 3 ? 'bg-amber-600 text-white' : 
                       'bg-gray-600 text-gray-200'}">
                      {entry.rank}
                    </span>
                  </div>
                  
                  <!-- Player name -->
                  <div class="font-medium text-gray-100 truncate">
                    {entry.display_name || 'Anonymous'}
                  </div>
                  
                  <!-- Score -->
                  <div class="text-center font-mono text-lg font-bold">
                    <span class="text-green-400">{entry.score.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Footer -->
          <div class="bg-gray-700 px-6 py-3 text-center text-sm text-gray-400">
            Showing top {leaderboardData.length} players
          </div>
        </div>
      {/if}
    </div>



  {/if}

  <!-- Navigation -->
  <div class="fixed bottom-6 right-6">
    <a href="/play" class="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg">
      ← Back to Game
    </a>
  </div>
</div> 