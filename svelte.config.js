import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: [vitePreprocess({
		include: ['**/*.svelte', '**/node_modules/@skeletonlabs/**/*.svelte']
	}), mdsvex()],
	kit: { 
		adapter: adapter(),
		moduleExtensions: ['.js', '.ts', '.svelte']
	},
	extensions: ['.svelte', '.svx'],
	compilerOptions: {
		customElement: false
	}
};

export default config;
