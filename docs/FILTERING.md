# File Filtering Guide

This guide covers the comprehensive filtering capabilities of the git-data-source library.

## Table of Contents

1. [Overview](#overview)
2. [Basic Filtering](#basic-filtering)
3. [Filter Types](#filter-types)
4. [Composable Filters](#composable-filters)
5. [Streaming Filters](#streaming-filters)
6. [Performance Optimization](#performance-optimization)
7. [Common Patterns](#common-patterns)

## Overview

The `FileFilter` class provides a fluent API for filtering files with support for:

- **Glob patterns** - Unix-style path matching (`**/*.ts`)
- **Regex patterns** - Regular expression matching
- **Predicate functions** - Custom sync/async filtering logic
- **Extension filtering** - Filter by file extensions
- **Directory scoping** - Limit to specific directories
- **Size filtering** - Min/max file size constraints
- **Date filtering** - Filter by modification date
- **Exclude patterns** - Inverse matching
- **Composability** - Combine filters with AND/OR/NOT logic

## Basic Filtering

### Creating a Filter

```typescript
import { FileFilter } from '@git-data-source/core';

// Method 1: Builder pattern
const filter = new FileFilter()
  .glob('src/**/*.ts')
  .exclude('**/*.test.ts')
  .size(undefined, 100 * 1024); // Max 100KB

// Method 2: From options object
const filter2 = FileFilter.fromOptions({
  glob: 'src/**/*.ts',
  exclude: '**/*.test.ts',
  maxSize: 100 * 1024
});

// Apply filter
const results = await filter.apply(files);
```

### Utility Functions

```typescript
import { glob, regex, ext, exclude } from '@git-data-source/core/filters';

// Quick filter creation
const tsFilter = glob('**/*.ts');
const noTests = exclude('**/*.test.*');
const smallFiles = new FileFilter().size(undefined, 50 * 1024);
```

## Filter Types

### Glob Patterns

```typescript
const filter = new FileFilter()
  .glob('src/**/*.ts')           // All .ts files in src/
  .glob('**/*.{ts,tsx}')         // TypeScript and TSX files
  .glob('src/**/index.ts');      // All index.ts files in src/
```

**Glob syntax:**
- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/`
- `?` - Matches single character
- `{a,b}` - Matches a or b

### Regex Patterns

```typescript
const filter = new FileFilter()
  .regex(/v\d+\.\d+\.\d+/)       // Files with version numbers
  .regex(/^src\//)               // Files starting with src/
  .regex(/\.(test|spec)\.ts$/);  // Test files
```

### Predicate Functions

```typescript
// Sync predicate
const filter = new FileFilter()
  .predicate(file => file.size > 1024)
  .predicate(file => file.path.includes('important'));

// Async predicate
const filter2 = new FileFilter()
  .predicate(async (file) => {
    // Can perform async operations
    const result = await checkExternalService(file);
    return result.isValid;
  });
```

### Extension Filtering

```typescript
const filter = new FileFilter()
  .ext('.ts', '.tsx')            // TypeScript files
  .ext('js', 'jsx', 'mjs');      // JavaScript files (dot optional)
```

### Directory Scoping

```typescript
const filter = new FileFilter()
  .in('src')                     // Only files in src/
  .in('tests/unit');             // Only files in tests/unit/
```

### Exclude Patterns

```typescript
const filter = new FileFilter()
  .exclude('**/node_modules/**')
  .exclude('**/dist/**')
  .exclude(/\.test\./);          // Supports glob and regex
```

### Size Filtering

```typescript
const filter = new FileFilter()
  .size(1024, 100 * 1024)        // Between 1KB and 100KB
  .size(undefined, 50 * 1024)    // Max 50KB
  .size(10 * 1024, undefined);   // Min 10KB
```

### File Type Filtering

```typescript
const filter = new FileFilter()
  .filesOnly();                  // Exclude directories

const filter2 = new FileFilter()
  .directoriesOnly();            // Only directories
```

### Depth Filtering

```typescript
const filter = new FileFilter()
  .maxDepth(2);                  // Max 2 levels deep
```

### Date Filtering

```typescript
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);

const filter = new FileFilter()
  .modifiedBetween(lastWeek, undefined);  // Last 7 days
```

## Composable Filters

### AND Logic (Chaining)

```typescript
// All conditions must match
const filter = new FileFilter()
  .glob('src/**/*.ts')           // AND
  .exclude('**/*.test.ts')       // AND
  .size(undefined, 100 * 1024);  // AND
```

### AND with `and()` Method

```typescript
const tsFilter = new FileFilter().ext('.ts', '.tsx');
const srcFilter = new FileFilter().in('src');
const combined = tsFilter.and(srcFilter);
```

### OR Logic

```typescript
const tsFilter = new FileFilter().ext('.ts', '.tsx');
const jsFilter = new FileFilter().ext('.js', '.jsx');
const anySource = tsFilter.or(jsFilter);
```

### NOT Logic

```typescript
const testFilter = new FileFilter().glob('**/*.test.*');
const nonTests = testFilter.not();
```

### Complex Combinations

```typescript
// (TypeScript OR JavaScript) AND NOT (tests) AND in src/
const ts = new FileFilter().ext('.ts', '.tsx');
const js = new FileFilter().ext('.js', '.jsx');
const tests = new FileFilter().glob('**/*.{test,spec}.*');
const src = new FileFilter().in('src');

const filter = ts.or(js)
  .and(tests.not())
  .and(src);
```

## Streaming Filters

For large file sets, use streaming to avoid loading everything into memory:

```typescript
const filter = new FileFilter()
  .glob('**/*.ts')
  .size(undefined, 100 * 1024);

// Stream results
for await (const file of filter.applyStream(fileStream)) {
  console.log(file.path);
  // Process one file at a time
}
```

## Performance Optimization

### Early Termination

Filters use early termination for efficiency:

```typescript
const filter = new FileFilter()
  .exclude('**/node_modules/**')  // Checked first
  .glob('**/*.ts')                // Only if not excluded
  .size(undefined, 100 * 1024)    // Only if glob matches
  .predicate(expensiveCheck);     // Only if size matches
```

**Order matters:** Place cheap/exclusive filters first:
1. Exclude patterns (fastest to eliminate files)
2. Extension filters (simple string comparison)
3. Glob patterns (moderate complexity)
4. Size checks (requires metadata)
5. Predicates (potentially expensive)

### Checking Individual Files

```typescript
const filter = new FileFilter().glob('src/**/*.ts');

// Check single file without processing entire list
if (await filter.matches(file)) {
  console.log('File matches!');
}
```

### Filter Count

```typescript
const filter = new FileFilter()
  .glob('**/*.ts')
  .exclude('**/*.test.ts')
  .size(undefined, 100 * 1024);

console.log(`Filter has ${filter.filterCount} conditions`);
```

## Common Patterns

### Filter Builder Helpers

Pre-configured filters for common scenarios:

```typescript
import { FilterBuilder } from '@git-data-source/core/filters';

// TypeScript files
const ts = FilterBuilder.typescript();

// JavaScript files
const js = FilterBuilder.javascript();

// All source code
const code = FilterBuilder.sourceCode();

// Markdown documentation
const docs = FilterBuilder.markdown();

// Config files
const configs = FilterBuilder.config();

// Exclude common directories
const noNodeModules = FilterBuilder.ignoreCommon();

// Small files (under 100KB)
const small = FilterBuilder.small(100);

// Recently modified (last 7 days)
const recent = FilterBuilder.recent(7);
```

### Combining Helpers

```typescript
// TypeScript source code, excluding common dirs
const filter = FilterBuilder.typescript()
  .and(FilterBuilder.ignoreCommon())
  .in('src');

// Recent, small config files
const recentConfigs = FilterBuilder.config()
  .and(FilterBuilder.recent(7))
  .and(FilterBuilder.small(50));
```

### Custom Helpers

Create your own reusable filters:

```typescript
function createProjectFilter() {
  return new FileFilter()
    .glob('src/**/*.{ts,tsx}')
    .exclude('**/*.test.*')
    .exclude('**/*.spec.*')
    .exclude('**/node_modules/**')
    .size(undefined, 200 * 1024)
    .filesOnly();
}

const projectFiles = await createProjectFilter().apply(files);
```

### Integration with File Query

```typescript
import { GitDataSource } from '@git-data-source/core';

const ds = new GitDataSource({
  provider: {
    type: 'github',
    options: { owner: 'user', repo: 'repo', token: 'ghp_xxx' }
  }
});

// Using filter options in query
const files = await ds.query()
  .ref('main')
  .glob('src/**/*.ts')
  .exclude('**/*.test.ts')
  .toArray();

// Or with FileFilter directly
const filter = new FileFilter()
  .glob('src/**/*.ts')
  .exclude('**/*.test.ts');

const allFiles = await ds.query().ref('main').toArray();
const filtered = await filter.apply(allFiles);
```

## Examples

See `/workspace/git-data-source/examples/filter-examples.ts` for comprehensive examples covering all filtering patterns.

## API Reference

### FileFilter

**Methods:**
- `glob(pattern: string): this` - Add glob pattern filter
- `regex(pattern: RegExp): this` - Add regex filter
- `predicate(fn: FilePredicate): this` - Add custom predicate
- `exclude(pattern: string | RegExp): this` - Add exclude pattern
- `ext(...extensions: string[]): this` - Filter by extensions
- `in(directory: string): this` - Scope to directory
- `filesOnly(): this` - Only files
- `directoriesOnly(): this` - Only directories
- `size(min?: number, max?: number): this` - Size constraints
- `maxDepth(depth: number): this` - Max directory depth
- `modifiedBetween(after?: Date, before?: Date): this` - Date range
- `apply(files: FileInfo[]): Promise<FileInfo[]>` - Apply to array
- `applyStream(files: AsyncIterable<FileInfo>): AsyncIterable<FileInfo>` - Apply to stream
- `matches(file: FileInfo): Promise<boolean>` - Check single file
- `and(other: FileFilter): FileFilter` - Combine with AND
- `or(other: FileFilter): FileFilter` - Combine with OR
- `not(): FileFilter` - Negate filter

**Static Methods:**
- `fromOptions(options: FilterOptions): FileFilter` - Create from options

**Properties:**
- `filterCount: number` - Number of registered filters

### FilterBuilder

**Methods:**
- `typescript(): FileFilter` - TypeScript files
- `javascript(): FileFilter` - JavaScript files
- `sourceCode(): FileFilter` - All source code files
- `markdown(): FileFilter` - Markdown files
- `config(): FileFilter` - Config files
- `ignoreCommon(): FileFilter` - Exclude node_modules, dist, etc.
- `small(maxSizeKb: number): FileFilter` - Small files
- `recent(daysAgo: number): FileFilter` - Recently modified

### Types

```typescript
type FilePredicate = (file: FileInfo) => boolean | Promise<boolean>;

interface FilterOptions {
  glob?: string | string[];
  regex?: RegExp | RegExp[];
  predicate?: FilePredicate | FilePredicate[];
  exclude?: string | string[];
  extensions?: string | string[];
  directories?: string | string[];
  filesOnly?: boolean;
  directoriesOnly?: boolean;
  maxDepth?: number;
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}
```
