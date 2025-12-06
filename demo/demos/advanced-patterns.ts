/**
 * Demo: Advanced Patterns
 *
 * Shows advanced usage scenarios:
 * - Async iteration for large repos
 * - Tree structures
 * - Parallel operations
 * - Real-world use cases
 */

import * as path from 'path';
import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoAdvancedPatterns(): Promise<void> {
  const repoPath = path.resolve(__dirname, '../..');
  const repo = GitDataSource.from(repoPath);

  print(`\nAdvanced patterns and real-world scenarios`, 'cyan');
  print('Power features for complex use cases!\n', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. Async Iteration (Memory Efficient)');
  // ─────────────────────────────────────────────────────────────

  print('Processing files one at a time (memory efficient):\n', 'reset');

  let count = 0;
  let totalSize = 0;

  const fileQuery = repo.branch('main').files().filter('**/*.ts');

  for await (const file of fileQuery) {
    count++;
    totalSize += file.size || 0;

    // Process each file without loading all into memory
    if (count <= 5) {
      print(`  Processing: ${file.path} (${file.size} bytes)`, 'dim');
    }
  }

  print(`\nProcessed ${count} files, total ${(totalSize / 1024).toFixed(1)}KB`, 'green');
  print('(Only one file in memory at a time!)', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. Tree Structure Navigation');
  // ─────────────────────────────────────────────────────────────

  const tree = await repo.branch('main').files()
    .filter('src/**/*.ts')
    .toTree();

  print('File tree structure:', 'green');

  function printTreeNode(node: any, depth: number = 0): void {
    if (depth > 3) return; // Limit depth

    const indent = '  '.repeat(depth);
    const icon = node.children?.length ? '📁' : '📄';
    const name = node.file?.name || 'root';
    const size = node.file?.size ? ` (${node.file.size}b)` : '';

    print(`${indent}${icon} ${name}${size}`, 'reset');

    node.children?.slice(0, 4).forEach((child: any) => {
      printTreeNode(child, depth + 1);
    });

    if (node.children?.length > 4) {
      print(`${indent}  ... and ${node.children.length - 4} more`, 'dim');
    }
  }

  printTreeNode(tree);

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Parallel File Processing');
  // ─────────────────────────────────────────────────────────────

  print('Reading multiple files in parallel:\n', 'reset');

  const filesToRead = [
    'package.json',
    'tsconfig.json',
    'README.md',
  ];

  const startParallel = performance.now();

  const results = await Promise.all(
    filesToRead.map(async (filename) => {
      const result = await repo.branch('main')
        .file(filename)
        .content();
      const content = result.orNull();
      return { filename, found: content !== null, size: content?.length || 0 };
    })
  );

  const parallelTime = performance.now() - startParallel;

  results.forEach(r => {
    const status = r.found ? '✓' : '✗';
    print(`  ${status} ${r.filename}: ${r.size} chars`, r.found ? 'green' : 'yellow');
  });

  print(`\nCompleted in ${parallelTime.toFixed(2)}ms (parallel)`, 'cyan');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Code Analysis Example');
  // ─────────────────────────────────────────────────────────────

  print('Analyzing codebase structure:\n', 'reset');

  const analysis = {
    totalFiles: 0,
    byExtension: {} as Record<string, number>,
    largestFiles: [] as { path: string; size: number }[],
    directories: new Set<string>(),
  };

  for await (const file of repo.branch('main').files()) {
    analysis.totalFiles++;

    // Count by extension
    const ext = file.extension || 'no-ext';
    analysis.byExtension[ext] = (analysis.byExtension[ext] || 0) + 1;

    // Track largest files
    if (file.size && file.size > 1000) {
      analysis.largestFiles.push({ path: file.path, size: file.size });
    }

    // Track directories
    const dir = path.dirname(file.path);
    if (dir !== '.') analysis.directories.add(dir);
  }

  // Sort largest files
  analysis.largestFiles.sort((a, b) => b.size - a.size);

  print(`Total files: ${analysis.totalFiles}`, 'green');
  print(`Directories: ${analysis.directories.size}`, 'green');

  print('\nFiles by extension:', 'yellow');
  Object.entries(analysis.byExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([ext, count]) => {
      print(`  ${ext}: ${count} files`, 'reset');
    });

  print('\nLargest files:', 'yellow');
  analysis.largestFiles.slice(0, 5).forEach(f => {
    print(`  ${f.path}: ${(f.size / 1024).toFixed(1)}KB`, 'reset');
  });

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Finding Specific Patterns');
  // ─────────────────────────────────────────────────────────────

  print('Finding TODO comments in source files:\n', 'reset');

  let todoCount = 0;
  const todos: { file: string; line: string }[] = [];

  for await (const file of repo.branch('main').files().filter('src/**/*.ts')) {
    if (file.content) {
      const lines = file.content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('TODO') || line.includes('FIXME')) {
          todoCount++;
          if (todos.length < 5) {
            todos.push({
              file: `${file.path}:${i + 1}`,
              line: line.trim().slice(0, 60),
            });
          }
        }
      });
    }
  }

  print(`Found ${todoCount} TODO/FIXME comments:`, 'green');
  todos.forEach(t => {
    print(`  ${t.file}`, 'yellow');
    print(`    ${t.line}...`, 'dim');
  });

  // ─────────────────────────────────────────────────────────────
  printSubHeader('6. Export Detection');
  // ─────────────────────────────────────────────────────────────

  print('Finding exported functions and classes:\n', 'reset');

  const exports: { file: string; name: string; type: string }[] = [];

  for await (const file of repo.branch('main').files()
    .filter('src/**/*.ts')
    .exclude('**/*.test.ts')
  ) {
    if (file.content) {
      // Find exports
      const exportMatches = file.content.matchAll(
        /export\s+(class|function|const|interface|type|enum)\s+(\w+)/g
      );

      for (const match of exportMatches) {
        exports.push({
          file: file.path,
          type: match[1],
          name: match[2],
        });
      }
    }
  }

  print(`Found ${exports.length} exports:`, 'green');

  // Group by type
  const byType: Record<string, string[]> = {};
  exports.forEach(e => {
    byType[e.type] = byType[e.type] || [];
    byType[e.type].push(e.name);
  });

  Object.entries(byType).forEach(([type, names]) => {
    print(`\n  ${type}s (${names.length}):`, 'yellow');
    names.slice(0, 5).forEach(n => print(`    • ${n}`, 'reset'));
    if (names.length > 5) print(`    ... and ${names.length - 5} more`, 'dim');
  });

  print('\n✅ Advanced patterns demo complete!', 'green');
}
