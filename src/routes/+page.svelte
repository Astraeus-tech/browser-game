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
      <h2 class="text-xl mb-4 text-yellow-300">Open-source browser game</h2>
      
      <p class="mb-4">Singularity Run is a free, non-commercial, open-source browser game about the future of AI. We created this game as a fun way to explore the future of AI and the challenges we will face, and to raise awareness about the importance of responsible AI development.</p>
      <p class="mb-4">We welcome any feedback, suggestions, or contributions to the game. You can find the code on GitHub, and we're open to pull requests.</p>
      
      <p class="mb-4"><a href="https://github.com/Singularity-Run/browser-game" class="text-blue-400 hover:text-blue-300">You can find the Github repository here: https://github.com/Singularity-Run/browser-game</a>.</p>
      
      <div class="my-6 px-4 py-4 bg-gray-800 rounded-md border-l-4 border-green-500">
        <h3 class="text-lg mb-2 text-green-400">Disclaimer</h3>
        <p>The game is loosely based on the whitepaper AI 2027:<br><a href="https://ai-2027.com/" class="text-blue-400 hover:text-blue-300"> https://ai-2027.com/</a></p> 

        <p>Although we have received permission to use the concepts from the original whitepaper, this project is developed independently and is not endorsed by or affiliated with the original authors.</p>

      </div>
    </div>
    
    <footer class="px-6 py-4 bg-gray-800 border-t border-gray-700">
      <a href="/play" class="block w-full px-4 py-3 bg-green-700 hover:bg-green-600 rounded text-center text-lg font-bold">
       Go to game
      </a>
      <div class="text-xs text-center mt-3 text-gray-400">
        Strategic decisions await. The future is in your hands.
      </div>
    </footer>
  </div>
</div>
{/if}
