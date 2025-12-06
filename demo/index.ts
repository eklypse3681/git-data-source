#!/usr/bin/env npx ts-node
/**
 * Git Data Source - Interactive Demo Application
 *
 * This demo showcases the full capabilities of the git-data-source library:
 * - Remote GitHub repository access
 * - Local filesystem repository access
 * - Fluent API with method chaining
 * - Powerful filtering (glob, regex, predicates)
 * - Caching with fresh/invalidate controls
 * - Error handling patterns
 * - Multiple output formats (array, tree, iterator)
 */

import * as readline from 'readline';

// Demo modules
import { demoGitHubBasics } from './demos/github-basics';
import { demoLocalRepo } from './demos/local-repo';
import { demoFiltering } from './demos/filtering';
import { demoCaching } from './demos/caching';
import { demoErrorHandling } from './demos/error-handling';
import { demoAdvancedPatterns } from './demos/advanced-patterns';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function print(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title: string): void {
  const line = '═'.repeat(60);
  console.log();
  print(line, 'cyan');
  print(`  ${title}`, 'bright');
  print(line, 'cyan');
  console.log();
}

function printSubHeader(title: string): void {
  print(`\n▶ ${title}`, 'yellow');
  print('─'.repeat(40), 'dim');
}

async function showMenu(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printHeader('🚀 Git Data Source - Interactive Demo');

  print('Choose a demo to run:\n', 'bright');
  print('  1. GitHub Remote Repository Basics', 'green');
  print('  2. Local Filesystem Repository', 'green');
  print('  3. Filtering Capabilities', 'green');
  print('  4. Caching Features', 'green');
  print('  5. Error Handling Patterns', 'green');
  print('  6. Advanced Patterns', 'green');
  print('  7. Run All Demos', 'magenta');
  print('  q. Quit\n', 'red');

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}Select option (1-7, q): ${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function runDemo(choice: string): Promise<void> {
  try {
    switch (choice) {
      case '1':
        printHeader('Demo 1: GitHub Remote Repository');
        await demoGitHubBasics();
        break;
      case '2':
        printHeader('Demo 2: Local Filesystem Repository');
        await demoLocalRepo();
        break;
      case '3':
        printHeader('Demo 3: Filtering Capabilities');
        await demoFiltering();
        break;
      case '4':
        printHeader('Demo 4: Caching Features');
        await demoCaching();
        break;
      case '5':
        printHeader('Demo 5: Error Handling Patterns');
        await demoErrorHandling();
        break;
      case '6':
        printHeader('Demo 6: Advanced Patterns');
        await demoAdvancedPatterns();
        break;
      case '7':
        printHeader('Running All Demos');
        print('Demo 1: GitHub Remote Repository', 'yellow');
        await demoGitHubBasics();
        print('\nDemo 2: Local Filesystem Repository', 'yellow');
        await demoLocalRepo();
        print('\nDemo 3: Filtering Capabilities', 'yellow');
        await demoFiltering();
        print('\nDemo 4: Caching Features', 'yellow');
        await demoCaching();
        print('\nDemo 5: Error Handling Patterns', 'yellow');
        await demoErrorHandling();
        print('\nDemo 6: Advanced Patterns', 'yellow');
        await demoAdvancedPatterns();
        break;
      case 'q':
        print('\nGoodbye! 👋', 'cyan');
        process.exit(0);
      default:
        print('Invalid option. Please choose 1-7 or q.', 'red');
    }
  } catch (error) {
    print(`\nError running demo: ${error}`, 'red');
  }
}

async function main(): Promise<void> {
  // Check for command line arguments
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Run specific demo from command line
    const demoNumber = args[0];
    await runDemo(demoNumber);
  } else {
    // Interactive mode
    while (true) {
      const choice = await showMenu();
      await runDemo(choice);

      if (choice !== 'q') {
        console.log('\n' + '─'.repeat(60));
        print('Press Enter to continue...', 'dim');
        await new Promise<void>((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          rl.question('', () => {
            rl.close();
            resolve();
          });
        });
      }
    }
  }
}

// Export for testing
export { printHeader, printSubHeader, print, colors };

// Run if called directly
main().catch(console.error);
