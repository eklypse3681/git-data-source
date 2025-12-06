# File Filter Quick Reference

## Import

```typescript
import { FileFilter, FilterBuilder } from '@git-data-source/core/filters';
```

## Basic Patterns

### Glob Patterns

```typescript
.glob('src/**/*.ts')           // All .ts files in src/
.glob('**/*.{ts,tsx}')         // All TypeScript files
.glob('**/index.ts')           // All index.ts files
```

### Regex Patterns

```typescript
.regex(/\.test\.ts$/)          // Test files
.regex(/^src\//)               // Files starting with src/
.regex(/v\d+\.\d+\.\d+/)       // Files with versions
```

### Extensions

```typescript
.ext('.ts', '.tsx')            // TypeScript files
.ext('js', 'jsx')              // JavaScript (dot optional)
```

### Directory Scope

```typescript
.in('src')                     // Only files in src/
.in('tests/unit')              // Only files in tests/unit/
```

### Exclude

```typescript
.exclude('**/node_modules/**') // Exclude node_modules
.exclude(/\.test\./)           // Exclude tests (regex)
```

### Size

```typescript
.size(1024, 100 * 1024)        // 1KB - 100KB
.size(undefined, 50 * 1024)    // Max 50KB
.size(10 * 1024, undefined)    // Min 10KB
```

### File Types

```typescript
.filesOnly()                   // Exclude directories
.directoriesOnly()             // Only directories
```

### Depth

```typescript
.maxDepth(2)                   // Max 2 levels deep
```

### Date Range

```typescript
.modifiedBetween(startDate, endDate)
```

### Predicates

```typescript
.predicate(file => file.size > 1024)
.predicate(async file => await check(file))
```

## Composition

### AND (Chaining)

```typescript
const filter = new FileFilter()
  .glob('src/**/*.ts')
  .exclude('**/*.test.ts')
  .size(undefined, 100 * 1024);
```

### AND (Method)

```typescript
const combined = filter1.and(filter2);
```

### OR

```typescript
const either = tsFilter.or(jsFilter);
```

### NOT

```typescript
const nonTests = testFilter.not();
```

## FilterBuilder Helpers

```typescript
FilterBuilder.typescript()      // .ts, .tsx files
FilterBuilder.javascript()      // .js, .jsx files
FilterBuilder.sourceCode()      // All code files
FilterBuilder.markdown()        // .md, .mdx files
FilterBuilder.config()          // Config files
FilterBuilder.ignoreCommon()    // Exclude node_modules, dist, etc.
FilterBuilder.small(100)        // Max 100KB
FilterBuilder.recent(7)         // Last 7 days
```

## Execution

### Apply to Array

```typescript
const results = await filter.apply(files);
```

### Streaming

```typescript
for await (const file of filter.applyStream(fileStream)) {
  console.log(file.path);
}
```

### Single File Check

```typescript
const matches = await filter.matches(file);
```

### From Options

```typescript
const filter = FileFilter.fromOptions({
  glob: '**/*.ts',
  exclude: '**/*.test.ts',
  maxSize: 100 * 1024
});
```

## Common Use Cases

### TypeScript Source Files

```typescript
const filter = FilterBuilder.typescript()
  .and(FilterBuilder.ignoreCommon())
  .in('src')
  .exclude('**/*.test.ts');
```

### Small Config Files

```typescript
const filter = FilterBuilder.config()
  .and(FilterBuilder.small(10));
```

### Recent Modifications

```typescript
const filter = FilterBuilder.recent(7)
  .ext('.ts', '.tsx')
  .in('src');
```

### Complex Filter

```typescript
const ts = new FileFilter().ext('.ts', '.tsx');
const js = new FileFilter().ext('.js', '.jsx');
const tests = new FileFilter().glob('**/*.{test,spec}.*');

const filter = ts.or(js)
  .and(tests.not())
  .in('src')
  .size(undefined, 200 * 1024);
```

## Performance Tips

1. **Order matters** - Place fast filters first:
   ```typescript
   .exclude('**/node_modules/**')  // Fast
   .ext('.ts')                     // Fast
   .glob('**/*.ts')                // Medium
   .size(undefined, 100 * 1024)    // Medium
   .predicate(expensiveCheck)      // Slow
   ```

2. **Use streaming** for large file sets:
   ```typescript
   for await (const file of filter.applyStream(stream)) {
     // Process incrementally
   }
   ```

3. **Check individual files** when possible:
   ```typescript
   if (await filter.matches(file)) {
     // Process
   }
   ```

## Utility Functions

```typescript
import { glob, regex, ext, exclude, and, or } from '@git-data-source/core/filters';

const filter = and(
  glob('src/**/*.ts'),
  exclude('**/*.test.ts')
);
```
