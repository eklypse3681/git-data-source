/**
 * Demo: Error Handling Patterns
 *
 * Shows the fluent error handling options:
 * - Default behavior (throws)
 * - orNull() - returns null on error
 * - orThrow() - custom error
 * - orDefault() - fallback value
 */

import * as path from 'path';
import { GitDataSource } from '../../src';
import { print, printSubHeader } from '../utils';

export async function demoErrorHandling(): Promise<void> {
  const repoPath = path.resolve(__dirname, '../..');
  const repo = GitDataSource.from(repoPath);

  print(`\nDemonstrating error handling patterns`, 'cyan');
  print('Graceful handling of missing files and errors!\n', 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('1. Default Behavior (Throws)');
  // ─────────────────────────────────────────────────────────────

  try {
    print('Attempting to read non-existent file...', 'reset');
    const handle = repo.branch('main').file('this-file-does-not-exist.txt');
    const result = await handle.content();
    // Try to get value - will throw if error
    const content = result.orThrow();
    print(`Content: ${content}`, 'green');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    print(`Caught error: ${message}`, 'yellow');
    print('(Default behavior throws on missing file)', 'dim');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('2. Using orNull()');
  // ─────────────────────────────────────────────────────────────

  const missingHandle = repo.branch('main').file('this-file-does-not-exist.txt');
  const missingResult = await missingHandle.content();
  const contentOrNull = missingResult.orNull();

  if (contentOrNull === null) {
    print('Result: null (file not found)', 'green');
    print('No exception thrown - graceful handling!', 'dim');
  } else {
    print(`Content: ${contentOrNull}`, 'green');
  }

  // Try with existing file
  const pkgHandle = repo.branch('main').file('package.json');
  const pkgResult = await pkgHandle.content();
  const packageJson = pkgResult.orNull();

  if (packageJson !== null) {
    const pkg = JSON.parse(packageJson);
    print(`\nExisting file works too: ${pkg.name} v${pkg.version}`, 'green');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('3. Using orDefault()');
  // ─────────────────────────────────────────────────────────────

  // Get content with fallback
  const configHandle = repo.branch('main').file('config.yaml');
  const configResult = await configHandle.content();
  const configContent = configResult.orDefault('default:\n  key: value');

  print('Requested config.yaml (does not exist)', 'reset');
  print(`Got default value:\n${configContent}`, 'green');

  // Practical example: optional config file
  const envHandle = repo.branch('main').file('.env.local');
  const envResult = await envHandle.content();
  const optionalConfig = envResult.orDefault('# No local config\nNODE_ENV=development');

  print('\nOptional .env.local with fallback:', 'reset');
  print(optionalConfig, 'dim');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('4. Using orThrow() with Custom Error');
  // ─────────────────────────────────────────────────────────────

  class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
    }
  }

  try {
    const criticalHandle = repo.branch('main').file('critical-config.json');
    const criticalResult = await criticalHandle.content();
    criticalResult.orThrow(() => new ConfigurationError(
      'Critical configuration file missing! Please create critical-config.json'
    ));
  } catch (error: unknown) {
    if (error instanceof Error) {
      print(`Caught ${error.name}: ${error.message}`, 'yellow');
    } else {
      print(`Caught error: ${error}`, 'yellow');
    }
    print('(Custom error class for better handling)', 'dim');
  }

  // ─────────────────────────────────────────────────────────────
  printSubHeader('5. Parsing JSON Safely');
  // ─────────────────────────────────────────────────────────────

  // Parse JSON safely using orNull + JSON.parse
  const pkgDataHandle = repo.branch('main').file('package.json');
  const pkgDataResult = await pkgDataHandle.content();
  const pkgContent = pkgDataResult.orNull();

  if (pkgContent) {
    try {
      const packageData = JSON.parse(pkgContent);
      print('Parsed package.json:', 'green');
      print(`  Name: ${packageData.name}`, 'reset');
      print(`  Version: ${packageData.version}`, 'reset');
    } catch {
      print('Failed to parse JSON', 'yellow');
    }
  }

  // Handle non-existent file with default
  const missingJsonHandle = repo.branch('main').file('missing.json');
  const missingJsonResult = await missingJsonHandle.content();
  const missingContent = missingJsonResult.orDefault('{"error": "default value"}');
  const missingData = JSON.parse(missingContent);

  print('\nMissing file with orDefault:', 'green');
  print(`  Result: ${JSON.stringify(missingData)}`, 'reset');

  // ─────────────────────────────────────────────────────────────
  printSubHeader('6. Practical Patterns');
  // ─────────────────────────────────────────────────────────────

  print('Common error handling patterns:', 'green');

  // Pattern 1: Optional file
  print('\n  Pattern 1: Optional file', 'yellow');
  print('  const result = await repo.file("README.md").content();', 'dim');
  print('  const readme = result.orNull();', 'dim');
  print('  if (readme) processReadme(readme);', 'dim');

  // Pattern 2: Required file with custom error
  print('\n  Pattern 2: Required file with custom error', 'yellow');
  print('  const result = await repo.file("config.json").content();', 'dim');
  print('  const config = result.orThrow(() => new Error("Config required!"));', 'dim');

  // Pattern 3: File with default
  print('\n  Pattern 3: File with default value', 'yellow');
  print('  const result = await repo.file(".settings").content();', 'dim');
  print('  const settings = result.orDefault("{}");', 'dim');

  // Pattern 4: Check existence first
  print('\n  Pattern 4: Check existence', 'yellow');
  print('  const exists = await repo.file("important.ts").exists();', 'dim');
  print('  if (exists) { ... }', 'dim');

  print('\n✅ Error handling demo complete!', 'green');
}
