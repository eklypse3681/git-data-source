/**
 * Demo: Caching Features
 *
 * Shows the caching system:
 * - Session-based caching
 * - fresh() to bypass cache
 * - invalidate() to clear cache
 * - Cache performance benefits
 */

import * as path from 'path';
import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoCaching(): Promise<void> {
  const repoPath = path.resolve(__dirname, '../..');
  const repo = GitDataSource.from(repoPath);

  print(`\nDemonstrating caching on: ${repoPath}`, 'cyan');
  print('Caching reduces repeated I/O operations!\n', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. First Call (Cache Miss)');
  // ─────────────────────────────────────────────────────────────

  const start1 = performance.now();
  const files1 = await repo.branch('main').files().filter('**/*.ts').toArray();
  const time1 = performance.now() - start1;

  print(`First call: ${files1.length} files in ${time1.toFixed(2)}ms`, 'green');
  print('(Cache was empty - had to read from filesystem)', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. Second Call (Cache Hit)');
  // ─────────────────────────────────────────────────────────────

  const start2 = performance.now();
  const files2 = await repo.branch('main').files().filter('**/*.ts').toArray();
  const time2 = performance.now() - start2;

  print(`Second call: ${files2.length} files in ${time2.toFixed(2)}ms`, 'green');
  print(`Speed improvement: ${(time1 / time2).toFixed(1)}x faster`, 'cyan');
  print('(Results served from cache)', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Using fresh() to Bypass Cache');
  // ─────────────────────────────────────────────────────────────

  const start3 = performance.now();
  const files3 = await repo.branch('main').files().filter('**/*.ts').fresh().toArray();
  const time3 = performance.now() - start3;

  print(`Fresh call: ${files3.length} files in ${time3.toFixed(2)}ms`, 'green');
  print('(Cache bypassed - read from filesystem again)', 'dim');
  print('Use fresh() when you know files have changed!', 'yellow');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Cache Invalidation');
  // ─────────────────────────────────────────────────────────────

  print('Before invalidate(): Cache is populated', 'reset');

  // Invalidate all cache
  repo.invalidate();
  print('Called repo.invalidate() - cache cleared', 'cyan');

  const start4 = performance.now();
  const files4 = await repo.branch('main').files().filter('**/*.ts').toArray();
  const time4 = performance.now() - start4;

  print(`After invalidate: ${files4.length} files in ${time4.toFixed(2)}ms`, 'green');
  print('(Cache was cleared - had to read from filesystem)', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Cache Across Different Queries');
  // ─────────────────────────────────────────────────────────────

  print('Each unique query has its own cache entry:\n', 'reset');

  // Different queries
  const queries = [
    { name: 'All TS files', filter: '**/*.ts' },
    { name: 'Test files', filter: '**/*.test.ts' },
    { name: 'JSON files', filter: '**/*.json' },
    { name: 'Core files', filter: 'src/core/**/*.ts' },
  ];

  // First pass - cache miss
  print('First pass (cache miss):', 'yellow');
  for (const q of queries) {
    const start = performance.now();
    const files = await repo.branch('main').files().filter(q.filter).toArray();
    const time = performance.now() - start;
    print(`  ${q.name}: ${files.length} files in ${time.toFixed(2)}ms`, 'reset');
  }

  // Second pass - cache hit
  print('\nSecond pass (cache hit):', 'yellow');
  for (const q of queries) {
    const start = performance.now();
    const files = await repo.branch('main').files().filter(q.filter).toArray();
    const time = performance.now() - start;
    print(`  ${q.name}: ${files.length} files in ${time.toFixed(2)}ms`, 'reset');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('6. Performance Summary');
  // ─────────────────────────────────────────────────────────────

  print('Cache benefits:', 'green');
  print('  ✓ Reduces filesystem I/O', 'reset');
  print('  ✓ Faster repeated queries', 'reset');
  print('  ✓ Session-scoped (cleared on restart)', 'reset');
  print('  ✓ Use fresh() when data may have changed', 'reset');
  print('  ✓ Use invalidate() to force refresh all', 'reset');

  print('\n✅ Caching demo complete!', 'green');
}
