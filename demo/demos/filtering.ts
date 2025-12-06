/**
 * Demo: Filtering Capabilities
 *
 * Shows the full power of the filtering system:
 * - Glob patterns
 * - Regular expressions
 * - Custom predicates (sync and async)
 * - Extension filtering
 * - Directory scoping
 * - Exclude patterns
 * - Combining filters
 */

import * as path from 'path';
import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoFiltering(): Promise<void> {
  const repoPath = path.resolve(__dirname, '../..');
  const repo = GitDataSource.from(repoPath);

  print(`\nDemonstrating filtering on: ${repoPath}`, 'cyan');
  print('All filters are chainable and composable!\n', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. Glob Pattern Matching');
  // ─────────────────────────────────────────────────────────────

  try {
    // Single glob
    const tsFiles = await repo.branch('main').files()
      .filter('**/*.ts')
      .toArray();
    print(`'**/*.ts' → ${tsFiles.length} files`, 'green');

    // Nested glob
    const coreFiles = await repo.branch('main').files()
      .filter('src/core/**/*.ts')
      .toArray();
    print(`'src/core/**/*.ts' → ${coreFiles.length} files`, 'green');

    // Multiple globs (OR logic)
    const configFiles = await repo.branch('main').files()
      .filter('*.json')
      .filter('*.config.*')
      .toArray();
    print(`'*.json' OR '*.config.*' → ${configFiles.length} files`, 'green');
  } catch (error) {
    print(`Glob demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. Regular Expression Matching');
  // ─────────────────────────────────────────────────────────────

  try {
    // Match test files
    const testFiles = await repo.branch('main').files()
      .filter(/\.test\.ts$/)
      .toArray();
    print(`/\\.test\\.ts$/ → ${testFiles.length} test files`, 'green');

    // Match files with numbers in name
    const numberedFiles = await repo.branch('main').files()
      .filter(/\d+/)
      .toArray();
    print(`/\\d+/ → ${numberedFiles.length} files with numbers`, 'green');

    // Case-insensitive match
    const readmeFiles = await repo.branch('main').files()
      .filter(/readme/i)
      .toArray();
    print(`/readme/i → ${readmeFiles.length} readme files`, 'green');
  } catch (error) {
    print(`Regex demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Custom Predicate Functions');
  // ─────────────────────────────────────────────────────────────

  try {
    // Filter by file size
    const smallFiles = await repo.branch('main').files()
      .filter('**/*.ts')
      .filter(file => (file.size || 0) < 1000)
      .toArray();
    print(`TypeScript files < 1KB → ${smallFiles.length} files`, 'green');

    // Filter by file size (large files)
    const largeFiles = await repo.branch('main').files()
      .filter('**/*.ts')
      .filter(file => (file.size || 0) > 5000)
      .toArray();
    print(`TypeScript files > 5KB → ${largeFiles.length} files`, 'green');

    // Filter by path depth
    const shallowFiles = await repo.branch('main').files()
      .filter(file => file.path.split('/').length <= 2)
      .toArray();
    print(`Files at depth ≤ 2 → ${shallowFiles.length} files`, 'green');

    // Async predicate (simulating async check)
    const asyncFiltered = await repo.branch('main').files()
      .filter('**/*.ts')
      .filter(async (file) => {
        // Simulate async operation (e.g., external API check)
        await new Promise(r => setTimeout(r, 1));
        return file.path.includes('index');
      })
      .toArray();
    print(`Async filter (index files) → ${asyncFiltered.length} files`, 'green');
  } catch (error) {
    print(`Predicate demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Extension Filtering');
  // ─────────────────────────────────────────────────────────────

  try {
    // Single extension
    const jsonFiles = await repo.branch('main').files()
      .ext('json')
      .toArray();
    print(`.json files → ${jsonFiles.length} files`, 'green');

    // Multiple extensions
    const codeFiles = await repo.branch('main').files()
      .ext('ts', 'js', 'tsx', 'jsx')
      .toArray();
    print(`.ts/.js/.tsx/.jsx files → ${codeFiles.length} files`, 'green');

    // Config files
    const configExts = await repo.branch('main').files()
      .ext('json', 'yaml', 'yml', 'toml')
      .toArray();
    print(`Config files → ${configExts.length} files`, 'green');
  } catch (error) {
    print(`Extension demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Directory Scoping');
  // ─────────────────────────────────────────────────────────────

  try {
    // Scope to specific directory
    const srcFiles = await repo.branch('main').files()
      .in('src')
      .toArray();
    print(`in('src') → ${srcFiles.length} files`, 'green');

    // Nested directory
    const coreFiles = await repo.branch('main').files()
      .in('src/core')
      .toArray();
    print(`in('src/core') → ${coreFiles.length} files`, 'green');

    // Combine with filter
    const coreTsFiles = await repo.branch('main').files()
      .in('src/core')
      .filter('**/*.ts')
      .toArray();
    print(`in('src/core') + '**/*.ts' → ${coreTsFiles.length} files`, 'green');
  } catch (error) {
    print(`Directory demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('6. Exclude Patterns');
  // ─────────────────────────────────────────────────────────────

  try {
    // Exclude tests
    const srcNoTests = await repo.branch('main').files()
      .filter('src/**/*.ts')
      .exclude('**/*.test.ts')
      .toArray();
    print(`src/**/*.ts excluding tests → ${srcNoTests.length} files`, 'green');

    // Exclude multiple patterns
    const cleanSrc = await repo.branch('main').files()
      .filter('**/*.ts')
      .exclude('**/*.test.ts')
      .exclude('**/*.spec.ts')
      .exclude('**/*.d.ts')
      .toArray();
    print(`TS excluding test/spec/d.ts → ${cleanSrc.length} files`, 'green');

    // Exclude directories
    const noNodeModules = await repo.branch('main').files()
      .filter('**/*.json')
      .exclude('**/node_modules/**')
      .toArray();
    print(`JSON excluding node_modules → ${noNodeModules.length} files`, 'green');
  } catch (error) {
    print(`Exclude demo error: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('7. Combining All Filters');
  // ─────────────────────────────────────────────────────────────

  try {
    // Complex filter chain
    const complexQuery = await repo.branch('main').files()
      .in('src')                          // Start in src/
      .filter('**/*.ts')                  // TypeScript files
      .exclude('**/*.test.ts')            // No tests
      .exclude('**/*.d.ts')               // No declarations
      .filter(f => (f.size || 0) > 500)   // Larger than 500 bytes
      .filter(f => (f.size || 0) < 10000) // Smaller than 10KB
      .toArray();

    print('Complex query result:', 'green');
    print(`  • in('src')`, 'dim');
    print(`  • filter('**/*.ts')`, 'dim');
    print(`  • exclude('**/*.test.ts')`, 'dim');
    print(`  • exclude('**/*.d.ts')`, 'dim');
    print(`  • size between 500B and 10KB`, 'dim');
    print(`  → ${complexQuery.length} matching files`, 'cyan');

    complexQuery.slice(0, 5).forEach(f => {
      print(`    📄 ${f.path} (${f.size} bytes)`, 'reset');
    });
  } catch (error) {
    print(`Complex filter error: ${error}`, 'yellow');
  }

  print('\n✅ Filtering demo complete!', 'green');
}
