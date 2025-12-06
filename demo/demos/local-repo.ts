/**
 * Demo: Local Filesystem Repository
 *
 * Shows how to:
 * - Connect to a local git repository
 * - Read the working tree (live files on disk)
 * - List branches from .git
 * - Enumerate and read files
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoLocalRepo(): Promise<void> {
  // Use the git-data-source project itself as the demo repo
  const repoPath = path.resolve(__dirname, '../..');

  print(`\nUsing local repository: ${repoPath}`, 'cyan');
  print('(Reading from the working tree - live files on disk)\n', 'dim');

  // Check if it's a git repo
  try {
    await fs.access(path.join(repoPath, '.git'));
  } catch {
    print('Note: This directory is not a git repository.', 'yellow');
    print('Creating a demo with filesystem access only.\n', 'dim');
  }

  // Create the data source for local filesystem
  const repo = GitDataSource.from(repoPath);

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. List All Source Files');
  // ─────────────────────────────────────────────────────────────

  try {
    const allFiles = await repo
      .branch('main') // For local, this reads the working tree
      .files()
      .filter('src/**/*.ts')
      .toArray();

    print(`Found ${allFiles.length} TypeScript files in src/:`, 'green');
    allFiles.slice(0, 10).forEach(f => {
      const size = f.size ? `${(f.size / 1024).toFixed(1)}KB` : '';
      print(`  📄 ${f.path} ${size}`, 'reset');
    });
    if (allFiles.length > 10) {
      print(`  ... and ${allFiles.length - 10} more`, 'dim');
    }
  } catch (error) {
    print(`Could not list files: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. Get File Tree Structure');
  // ─────────────────────────────────────────────────────────────

  try {
    const tree = await repo
      .branch('main')
      .files()
      .filter('src/core/**/*.ts')
      .toTree();

    print('Source tree (src/core/):', 'green');
    printTree(tree, 0, 3); // Print 3 levels deep
  } catch (error) {
    print(`Could not build tree: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Read Configuration Files');
  // ─────────────────────────────────────────────────────────────

  try {
    // Read package.json
    const pkgResult = await repo
      .branch('main')
      .file('package.json')
      .content();
    const pkgContent = pkgResult.orNull();

    if (pkgContent) {
      const pkg = JSON.parse(pkgContent);
      print('package.json:', 'green');
      print(`  Name: ${pkg.name}`, 'reset');
      print(`  Version: ${pkg.version}`, 'reset');
      print(`  Dependencies: ${Object.keys(pkg.dependencies || {}).length}`, 'reset');
      print(`  DevDependencies: ${Object.keys(pkg.devDependencies || {}).length}`, 'reset');
    }

    // Read tsconfig.json
    const tsconfigResult = await repo
      .branch('main')
      .file('tsconfig.json')
      .content();
    const tsconfigContent = tsconfigResult.orNull();

    if (tsconfigContent) {
      const tsconfig = JSON.parse(tsconfigContent);
      print('\ntsconfig.json:', 'green');
      print(`  Target: ${tsconfig.compilerOptions?.target}`, 'reset');
      print(`  Module: ${tsconfig.compilerOptions?.module}`, 'reset');
      print(`  Strict: ${tsconfig.compilerOptions?.strict}`, 'reset');
    }
  } catch (error) {
    print(`Could not read config: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Analyze Test Files');
  // ─────────────────────────────────────────────────────────────

  try {
    const testFiles = await repo
      .branch('main')
      .files()
      .filter('**/*.test.ts')
      .toArray();

    print(`Found ${testFiles.length} test files:`, 'green');

    let totalSize = 0;
    testFiles.forEach(f => {
      totalSize += f.size || 0;
      print(`  🧪 ${f.path}`, 'reset');
    });

    print(`\nTotal test code: ${(totalSize / 1024).toFixed(1)}KB`, 'cyan');
  } catch (error) {
    print(`Could not analyze tests: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Stream Files with Async Iterator');
  // ─────────────────────────────────────────────────────────────

  try {
    print('Streaming markdown files:', 'green');

    let count = 0;
    const files = repo
      .branch('main')
      .files()
      .filter('**/*.md');

    for await (const file of files) {
      count++;
      const preview = file.content?.slice(0, 50).replace(/\n/g, ' ') || '';
      print(`  📝 ${file.path}: "${preview}..."`, 'reset');
      if (count >= 5) {
        print('  ... (stopping early for demo)', 'dim');
        break;
      }
    }
  } catch (error) {
    print(`Could not stream files: ${error}`, 'yellow');
  }

  print('\n✅ Local repository demo complete!', 'green');
}

// Helper to print tree structure
function printTree(node: any, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;

  const indent = '  '.repeat(depth);
  const icon = node.children?.length > 0 ? '📁' : '📄';

  print(`${indent}${icon} ${node.file?.name || 'root'}`, 'reset');

  if (node.children) {
    node.children.slice(0, 5).forEach((child: any) => {
      printTree(child, depth + 1, maxDepth);
    });
    if (node.children.length > 5) {
      print(`${indent}  ... and ${node.children.length - 5} more`, 'dim');
    }
  }
}
