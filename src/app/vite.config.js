import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	build: {
		outDir: '../../out/app', // Directory where the bundled files will be placed
		rollupOptions: {
			output: {
				format: 'iife', // Immediately Invoked Function Expression for browser compatibility
				entryFileNames: 'bundle.js',
			},
		},
	},
});
