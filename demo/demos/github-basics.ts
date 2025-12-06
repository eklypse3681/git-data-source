/**
 * Demo: GitHub Remote Repository Basics
 *
 * Shows how to:
 * - Connect to a public GitHub repository
 * - List branches and tags
 * - Enumerate files
 * - Read file contents
 */

import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoGitHubBasics(): Promise<void> {
  // Using a well-known public repository for demo
  const repoUrl = 'https://github.com/sindresorhus/is';

  print(`\nConnecting to: ${repoUrl}`, 'cyan');
  print('(Using public access - no token required)\n', 'dim');

  // Create the data source
  // For public repos, no token is needed
  // For private repos: GitDataSource.from(url, { token: 'ghp_...' })
  const repo = GitDataSource.from(repoUrl);

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. List Branches');
  // ─────────────────────────────────────────────────────────────

  try {
    const branches = await repo.branches();
    print(`Found ${branches.length} branches:`, 'green');
    branches.slice(0, 5).forEach(b => print(`  • ${b}`, 'reset'));
    if (branches.length > 5) {
      print(`  ... and ${branches.length - 5} more`, 'dim');
    }
  } catch (error) {
    print(`Could not list branches: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. List Tags');
  // ─────────────────────────────────────────────────────────────

  try {
    const tags = await repo.tags();
    print(`Found ${tags.length} tags:`, 'green');
    tags.slice(0, 5).forEach(t => print(`  • ${t}`, 'reset'));
    if (tags.length > 5) {
      print(`  ... and ${tags.length - 5} more`, 'dim');
    }
  } catch (error) {
    print(`Could not list tags: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Enumerate Files on Main Branch');
  // ─────────────────────────────────────────────────────────────

  try {
    const files = await repo
      .branch('main')
      .files()
      .toArray();

    print(`Found ${files.length} files:`, 'green');
    files.slice(0, 10).forEach(f => {
      const sizeStr = f.size ? `(${f.size} bytes)` : '(dir)';
      print(`  📄 ${f.path} ${sizeStr}`, 'reset');
    });
    if (files.length > 10) {
      print(`  ... and ${files.length - 10} more files`, 'dim');
    }
  } catch (error) {
    print(`Could not list files: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Read File Content');
  // ─────────────────────────────────────────────────────────────

  try {
    const result = await repo
      .branch('main')
      .file('package.json')
      .content();
    const content = result.orNull();

    if (content) {
      const pkg = JSON.parse(content);
      print('package.json contents:', 'green');
      print(`  Name: ${pkg.name}`, 'reset');
      print(`  Version: ${pkg.version}`, 'reset');
      print(`  Description: ${pkg.description?.slice(0, 50)}...`, 'reset');
    }
  } catch (error) {
    print(`Could not read file: ${error}`, 'yellow');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Filter TypeScript Files');
  // ─────────────────────────────────────────────────────────────

  try {
    const tsFiles = await repo
      .branch('main')
      .files()
      .filter('**/*.ts')
      .exclude('**/*.test.ts')
      .exclude('**/*.d.ts')
      .toArray();

    print(`Found ${tsFiles.length} TypeScript source files:`, 'green');
    tsFiles.slice(0, 8).forEach(f => print(`  📄 ${f.path}`, 'reset'));
    if (tsFiles.length > 8) {
      print(`  ... and ${tsFiles.length - 8} more`, 'dim');
    }
  } catch (error) {
    print(`Could not filter files: ${error}`, 'yellow');
  }

  print('\n✅ GitHub basics demo complete!', 'green');
}
