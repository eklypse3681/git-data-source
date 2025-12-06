#!/usr/bin/env npx ts-node
/**
 * Simple Demo Runner
 *
 * Run all demos in sequence without interactive menu
 * Usage: npx ts-node demo/run-demo.ts
 */

import { print, printHeader, colors } from './utils';

// Import demos
import { demoGitHubBasics } from './demos/github-basics';
import { demoLocalRepo } from './demos/local-repo';
import { demoFiltering } from './demos/filtering';
import { demoCaching } from './demos/caching';
import { demoErrorHandling } from './demos/error-handling';
import { demoAdvancedPatterns } from './demos/advanced-patterns';

async function runAllDemos(): Promise<void> {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ${colors.bright}🚀 Git Data Source - Complete Demo Suite${colors.cyan}                ║
║                                                            ║
║   Demonstrating all library capabilities:                  ║
║   • GitHub remote repository access                        ║
║   • Local filesystem repository access                     ║
║   • Fluent API with method chaining                        ║
║   • Powerful filtering (glob, regex, predicates)           ║
║   • Session caching with fresh/invalidate                  ║
║   • Error handling patterns                                ║
║   • Advanced patterns (streaming, analysis)                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`);

  const demos = [
    { name: 'GitHub Remote Repository', fn: demoGitHubBasics },
    { name: 'Local Filesystem Repository', fn: demoLocalRepo },
    { name: 'Filtering Capabilities', fn: demoFiltering },
    { name: 'Caching Features', fn: demoCaching },
    { name: 'Error Handling Patterns', fn: demoErrorHandling },
    { name: 'Advanced Patterns', fn: demoAdvancedPatterns },
  ];

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    printHeader(`Demo ${i + 1}/${demos.length}: ${demo.name}`);

    try {
      await demo.fn();
      passed++;
    } catch (error) {
      failed++;
      print(`\n❌ Demo failed: ${error}`, 'red');
    }

    // Small pause between demos
    await new Promise(r => setTimeout(r, 500));
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ${colors.bright}📊 Demo Suite Complete!${colors.cyan}                                  ║
║                                                            ║
║   Results:                                                 ║
║   ${colors.green}✓ Passed: ${passed}${colors.cyan}                                              ║
║   ${failed > 0 ? colors.red : colors.dim}✗ Failed: ${failed}${colors.cyan}                                              ║
║   ⏱ Time: ${totalTime}s                                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run demos
runAllDemos().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
