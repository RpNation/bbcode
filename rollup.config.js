import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';


// rollup.config.js
export default {
	input: 'bbcode-src/index.js',
	output: {
		file: 'assets/javascripts/lib/bbcode-parser.js',
		format: 'es',
		sourcemap: true
	},
	plugins: [terser(), nodeResolve()]
};