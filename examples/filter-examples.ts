/**
 * File Filter Examples
 *
 * Demonstrates various filtering patterns and use cases
 */

import { FileFilter, FilterBuilder, glob, regex, ext, exclude } from '../src/filters';
import type { FileInfo } from '../src/types';

// ============================================================================
// Example 1: Basic Glob Filtering
// ============================================================================

async function example1_globFiltering(files: FileInfo[]) {
  console.log('Example 1: Glob Filtering');

  // Find all TypeScript files in src directory
  const filter = new FileFilter()
    .glob('src/**/*.ts');

  const results = await filter.apply(files);
  console.log(`Found ${results.length} TypeScript files in src/`);
}

// ============================================================================
// Example 2: Regex Pattern Matching
// ============================================================================

async function example2_regexFiltering(files: FileInfo[]) {
  console.log('Example 2: Regex Filtering');

  // Find files with version numbers in name (e.g., file-v1.2.3.ts)
  const filter = new FileFilter()
    .regex(/v\d+\.\d+\.\d+/);

  const results = await filter.apply(files);
  console.log(`Found ${results.length} versioned files`);
}

// ============================================================================
// Example 3: Custom Predicate Functions
// ============================================================================

async function example3_predicateFiltering(files: FileInfo[]) {
  console.log('Example 3: Predicate Filtering');

  // Find files with specific content pattern
  const filter = new FileFilter()
    .predicate(file => {
      // Only check text files with content
      if (!file.content) return false;
      return file.content.includes('TODO') || file.content.includes('FIXME');
    });

  const results = await filter.apply(files);
  console.log(`Found ${results.length} files with TODO/FIXME comments`);
}

// ============================================================================
// Example 4: Async Predicate (e.g., checking external API)
// ============================================================================

async function example4_asyncPredicate(files: FileInfo[]) {
  console.log('Example 4: Async Predicate');

  const filter = new FileFilter()
    .predicate(async (file) => {
      // Simulate async operation (e.g., checking file against external service)
      await new Promise(resolve => setTimeout(resolve, 10));
      return file.size !== null && file.size > 1024;
    });

  const results = await filter.apply(files);
  console.log(`Found ${results.length} files larger than 1KB`);
}

// ============================================================================
// Example 5: Extension Filtering
// ============================================================================

async function example5_extensionFiltering(files: FileInfo[]) {
  console.log('Example 5: Extension Filtering');

  // Find all TypeScript and TSX files
  const filter = new FileFilter()
    .ext('.ts', '.tsx'); // Supports with or without leading dot

  const results = await filter.apply(files);
  console.log(`Found ${results.length} TypeScript files`);
}

// ============================================================================
// Example 6: Directory Scoping
// ============================================================================

async function example6_directoryScope(files: FileInfo[]) {
  console.log('Example 6: Directory Scope');

  // Only files in tests directory
  const filter = new FileFilter()
    .in('tests')
    .ext('.test.ts', '.spec.ts');

  const results = await filter.apply(files);
  console.log(`Found ${results.length} test files in tests/`);
}

// ============================================================================
// Example 7: Exclude Patterns
// ============================================================================

async function example7_excludePatterns(files: FileInfo[]) {
  console.log('Example 7: Exclude Patterns');

  // All TypeScript files except tests
  const filter = new FileFilter()
    .ext('.ts', '.tsx')
    .exclude('**/*.test.ts')
    .exclude('**/*.spec.ts')
    .exclude('**/node_modules/**');

  const results = await filter.apply(files);
  console.log(`Found ${results.length} non-test TypeScript files`);
}

// ============================================================================
// Example 8: Size Filtering
// ============================================================================

async function example8_sizeFiltering(files: FileInfo[]) {
  console.log('Example 8: Size Filtering');

  // Files between 10KB and 100KB
  const filter = new FileFilter()
    .size(10 * 1024, 100 * 1024)
    .filesOnly();

  const results = await filter.apply(files);
  console.log(`Found ${results.length} files between 10KB-100KB`);
}

// ============================================================================
// Example 9: Composable Filters (AND Logic)
// ============================================================================

async function example9_composableFilters(files: FileInfo[]) {
  console.log('Example 9: Composable Filters (AND)');

  // TypeScript files in src, excluding tests, max 50KB
  const filter = new FileFilter()
    .glob('src/**/*.ts')
    .exclude('**/*.test.ts')
    .size(undefined, 50 * 1024)
    .filesOnly();

  const results = await filter.apply(files);
  console.log(`Found ${results.length} source TypeScript files under 50KB`);
}

// ============================================================================
// Example 10: Filter Combination (AND/OR/NOT)
// ============================================================================

async function example10_filterCombination(files: FileInfo[]) {
  console.log('Example 10: Filter Combination');

  // (TypeScript OR JavaScript) AND NOT (tests)
  const tsFilter = new FileFilter().ext('.ts', '.tsx');
  const jsFilter = new FileFilter().ext('.js', '.jsx');
  const testFilter = new FileFilter().glob('**/*.{test,spec}.*');

  const filter = tsFilter.or(jsFilter).and(testFilter.not());

  const results = await filter.apply(files);
  console.log(`Found ${results.length} non-test source files`);
}

// ============================================================================
// Example 11: Streaming Filter Application
// ============================================================================

async function example11_streamingFilters(fileStream: AsyncIterable<FileInfo>) {
  console.log('Example 11: Streaming Filters');

  const filter = new FileFilter()
    .glob('**/*.ts')
    .size(undefined, 100 * 1024);

  let count = 0;
  for await (const file of filter.applyStream(fileStream)) {
    console.log(`  - ${file.path} (${file.size} bytes)`);
    count++;
  }

  console.log(`Processed ${count} files via streaming`);
}

// ============================================================================
// Example 12: Using Filter Builder Helpers
// ============================================================================

async function example12_filterBuilders(files: FileInfo[]) {
  console.log('Example 12: Filter Builder Helpers');

  // TypeScript files excluding common directories
  const filter = FilterBuilder.typescript()
    .and(FilterBuilder.ignoreCommon());

  const results = await filter.apply(files);
  console.log(`Found ${results.length} TypeScript files (excluding node_modules, dist, etc.)`);
}

// ============================================================================
// Example 13: Recently Modified Files
// ============================================================================

async function example13_recentFiles(files: FileInfo[]) {
  console.log('Example 13: Recently Modified Files');

  // Files modified in the last 7 days
  const filter = FilterBuilder.recent(7);

  const results = await filter.apply(files);
  console.log(`Found ${results.length} files modified in the last 7 days`);
}

// ============================================================================
// Example 14: Small Config Files
// ============================================================================

async function example14_smallConfigs(files: FileInfo[]) {
  console.log('Example 14: Small Config Files');

  // Config files under 10KB
  const filter = FilterBuilder.config()
    .and(FilterBuilder.small(10));

  const results = await filter.apply(files);
  console.log(`Found ${results.length} small config files`);
}

// ============================================================================
// Example 15: Advanced Complex Filter
// ============================================================================

async function example15_complexFilter(files: FileInfo[]) {
  console.log('Example 15: Complex Filter');

  // Source code files in src/, excluding tests and large files,
  // that contain specific imports
  const filter = FilterBuilder.sourceCode()
    .in('src')
    .exclude('**/*.test.*')
    .exclude('**/*.spec.*')
    .size(undefined, 200 * 1024)
    .predicate(file => {
      if (!file.content) return false;
      return file.content.includes('import') || file.content.includes('require');
    });

  const results = await filter.apply(files);
  console.log(`Found ${results.length} source files with imports`);
}

// ============================================================================
// Example 16: Creating Filter from Options Object
// ============================================================================

async function example16_filterFromOptions(files: FileInfo[]) {
  console.log('Example 16: Filter from Options');

  const filter = FileFilter.fromOptions({
    glob: ['**/*.ts', '**/*.tsx'],
    exclude: ['**/*.test.*', '**/node_modules/**'],
    filesOnly: true,
    maxSize: 100 * 1024,
    maxDepth: 3
  });

  const results = await filter.apply(files);
  console.log(`Found ${results.length} TypeScript files matching criteria`);
}

// ============================================================================
// Example 17: Utility Functions
// ============================================================================

async function example17_utilityFunctions(files: FileInfo[]) {
  console.log('Example 17: Utility Functions');

  // Using convenience functions
  const filter1 = glob('src/**/*.ts');
  const filter2 = regex(/\.test\./);
  const filter3 = ext('.ts', '.tsx');
  const filter4 = exclude('**/dist/**');

  // Combine them
  const combined = filter1.and(filter2.not()).and(filter4);

  const results = await combined.apply(files);
  console.log(`Found ${results.length} non-test TypeScript files in src/`);
}

// ============================================================================
// Example 18: Early Termination Efficiency
// ============================================================================

async function example18_earlyTermination(files: FileInfo[]) {
  console.log('Example 18: Early Termination');

  // Filters are applied with early termination
  // If exclude matches, no other filters are checked
  const filter = new FileFilter()
    .exclude('**/node_modules/**')  // Checked first
    .glob('**/*.ts')                // Only checked if not excluded
    .size(undefined, 100 * 1024)    // Only checked if glob matches
    .predicate(async (file) => {     // Only checked if size matches
      // Expensive operation only runs on files that passed all previous filters
      await new Promise(resolve => setTimeout(resolve, 10));
      return file.content !== null;
    });

  console.time('filter-with-early-termination');
  const results = await filter.apply(files);
  console.timeEnd('filter-with-early-termination');

  console.log(`Found ${results.length} files efficiently`);
}

// ============================================================================
// Example 19: Date Range Filtering
// ============================================================================

async function example19_dateRangeFilter(files: FileInfo[]) {
  console.log('Example 19: Date Range Filtering');

  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  const filter = new FileFilter()
    .modifiedBetween(startDate, endDate)
    .ext('.ts');

  const results = await filter.apply(files);
  console.log(`Found ${results.length} TypeScript files modified in 2024`);
}

// ============================================================================
// Example 20: Checking Individual File
// ============================================================================

async function example20_individualFileCheck(file: FileInfo) {
  console.log('Example 20: Individual File Check');

  const filter = new FileFilter()
    .glob('src/**/*.ts')
    .size(undefined, 50 * 1024);

  const matches = await filter.matches(file);
  console.log(`File ${file.path} matches: ${matches}`);
}

// ============================================================================
// Run All Examples
// ============================================================================

export async function runAllExamples(files: FileInfo[]) {
  console.log('='.repeat(80));
  console.log('FILE FILTER EXAMPLES');
  console.log('='.repeat(80));

  await example1_globFiltering(files);
  await example2_regexFiltering(files);
  await example3_predicateFiltering(files);
  await example4_asyncPredicate(files);
  await example5_extensionFiltering(files);
  await example6_directoryScope(files);
  await example7_excludePatterns(files);
  await example8_sizeFiltering(files);
  await example9_composableFilters(files);
  await example10_filterCombination(files);
  await example12_filterBuilders(files);
  await example13_recentFiles(files);
  await example14_smallConfigs(files);
  await example15_complexFilter(files);
  await example16_filterFromOptions(files);
  await example17_utilityFunctions(files);
  await example18_earlyTermination(files);
  await example19_dateRangeFilter(files);

  if (files.length > 0) {
    await example20_individualFileCheck(files[0]);
  }

  console.log('='.repeat(80));
}
