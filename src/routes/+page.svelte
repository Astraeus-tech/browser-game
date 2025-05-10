<script>
  import { browser } from '$app/environment';
</script>

{#if browser}
<div class="flex items-center justify-center bg-black min-h-screen font-mono text-green-300">
  <div class="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl bg-gray-900 border-4 border-gray-700 rounded-lg shadow-lg flex flex-col overflow-hidden">
    <header class="flex items-center bg-gray-800 px-4 py-3 border-b border-gray-700">
      <h1 class="text-2xl font-bold">Singularity Run</h1>
      <div class="text-xs ml-auto">The AI Strategy Game</div>
    </header>
    
    <div class="px-6 py-8 bg-green-950 border-b border-gray-700 overflow-y-auto">
      <h2 class="text-xl mb-4 text-yellow-300">Lead Humanity's Future</h2>
      
      <p class="mb-4">The year is 2025. You're the CEO of a promising AI startup on the brink of creating the most powerful artificial intelligence in history.</p>
      
      <p class="mb-4">Every decision you make will impact your company's success, the global environment, and the development of AI capabilities. Will you prioritize profits, pursue responsible innovation, or find a balance between competing interests?</p>
      
      <div class="my-6 px-4 py-4 bg-gray-800 rounded-md border-l-4 border-green-500">
        <h3 class="text-lg mb-2 text-green-400">Your Objective</h3>
        <p>Navigate the complex landscape of AI development while balancing:</p>
        <ul class="list-disc ml-6 mt-2 space-y-1">
          <li>Corporate interests and financial success</li>
          <li>Advancement of AI capabilities</li>
          <li>Impact on social stability and security</li>
        </ul>
      </div>
      
      <p class="italic text-sm text-green-300 mb-6">Can you reach the technological singularity without destroying the world—or your company?</p>
      
      <div class="text-xs text-red-400 mb-2 uppercase">Warning: Choices have consequences. Your decisions will shape the future.</div>
    </div>
    
    <footer class="px-6 py-4 bg-gray-800 border-t border-gray-700">
      <a href="/play" class="block w-full px-4 py-3 bg-green-700 hover:bg-green-600 rounded text-center text-lg font-bold">
        Start Singularity Run
      </a>
      <div class="text-xs text-center mt-3 text-gray-400">
        Strategic decisions await. The future is in your hands.
      </div>
    </footer>
  </div>
</div>
{/if}
