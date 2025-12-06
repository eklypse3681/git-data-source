import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [
    '@octokit/rest',
    '@octokit/types',
    'isomorphic-git',
    'minimatch'
  ],
  outDir: 'dist',
  tsconfig: 'tsconfig.json',
  skipNodeModulesBundle: true,
  target: 'es2022',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
      dts: format === 'cjs' ? '.d.cts' : '.d.ts'
    };
  }
});
