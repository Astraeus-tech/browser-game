// Impact assessment ranges - easy to modify if needed
export const IMPACT_RANGES = {
  NEUTRAL: { min: 0, max: 5 },
  SLIGHT: { min: 5, max: 10 },
  MODERATE: { min: 10, max: 25 },
  STRONG: { min: 25, max: Infinity }
};

// Map of metrics where positive values should be treated as negative impacts
const INVERTED_METRICS: Record<string, boolean> = {
  cyber_bio_risk: false,
  climate_load: false
};

// Calculate impact score based on effects
export function calculateImpactScore(effects: Record<string, string> | undefined): number {
  if (!effects) return 0;
  
  let totalImpact = 0;
  
  // Sum up all numeric effects
  for (const key in effects) {
    if (effects[key]) {
      const effect = effects[key];
      // Extract the min/max values from effects like "10..30"
      const [min, max] = effect.split('..').map(Number);
      
      let value = 0;
      // Average the effect
      if (!isNaN(min) && !isNaN(max)) {
        value = (min + max) / 2;
      } else if (!isNaN(min)) {
        value = min;
      }
      
      // For inverted metrics (like cyber_bio_risk and climate_load), higher values are negative
      if (INVERTED_METRICS[key]) {
        value = -value; // Invert the sign
      }
      
      totalImpact += value;
    }
  }
  
  return totalImpact;
}

// Get impact assessment text
export function getImpactAssessment(score: number): string {
  const absScore = Math.abs(score);
  const direction = score >= 0 ? 'positive' : 'negative';
  
  if (absScore < IMPACT_RANGES.NEUTRAL.max) {
    return 'Neutral';
  } else if (absScore < IMPACT_RANGES.SLIGHT.max) {
    return `Slightly ${direction}`;
  } else if (absScore < IMPACT_RANGES.MODERATE.max) {
    return direction.charAt(0).toUpperCase() + direction.slice(1);
  } else {
    return `Very ${direction}`;
  }
}

// Get color class based on impact assessment
export function getImpactColorClass(score: number): string {
  const absScore = Math.abs(score);
  const isPositive = score >= 0;
  
  if (absScore < IMPACT_RANGES.NEUTRAL.max) {
    return 'text-gray-300';
  } else if (isPositive) {
    return absScore < IMPACT_RANGES.SLIGHT.max 
      ? 'text-green-300' 
      : absScore < IMPACT_RANGES.MODERATE.max
        ? 'text-green-400'
        : 'text-green-500';
  } else {
    return absScore < IMPACT_RANGES.SLIGHT.max 
      ? 'text-red-300' 
      : absScore < IMPACT_RANGES.MODERATE.max
        ? 'text-red-400'
        : 'text-red-500';
  }
} 