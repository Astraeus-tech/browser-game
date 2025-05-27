import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // No leaderboard fetching on page load
  // Leaderboard will be fetched only after game ends and score is submitted
  return {};
}; 