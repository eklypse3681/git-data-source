# Git Data Source - Fluent API

A TypeScript library for accessing git repositories as data sources with a fluent, type-safe API.

## Features

- 🔗 **Fluent chaining** - Method chaining with proper TypeScript types
- 📁 **File enumeration** - Filter files with globs, regex, or predicates
- 🌲 **Tree structures** - Convert flat file lists to hierarchical trees
- 🔄 **Async iteration** - Stream files with `for await...of`
- 💾 **Smart caching** - Automatic caching with cache invalidation
- 🎯 **Type-safe** - Full TypeScript support with strict types
- 🛡️ **Error handling** - Rich error handling with `.orNull()`, `.orThrow()`, `.orDefault()`

## Usage Examples

### Create Data Source

```typescript
import { GitDataSource } from './src/core/fluent';

// Remote repository with authentication
const repo = GitDataSource.from('https://github.com/org/repo', {
  token: 'ghp_xxxxxxxxxxxx'
});

// Local repository
const local = GitDataSource.from('/path/to/repo');
```

### Access Branches, Tags, and Commits

```typescript
// Branch
const main = repo.branch('main');

// Tag
const v1 = repo.tag('v1.0.0');

// Commit hash
const commit = repo.ref('abc123def');
```

### File Enumeration with Filtering

```typescript
const files = repo.branch('main').files();

// Glob pattern
await files.filter('**/*.ts').toArray();

// Regex
await files.filter(/\.test\.ts$/).toArray();

// Predicate function
await files.filter(f => f.size < 10000).toArray();

// Exclude patterns
await files
  .exclude('node_modules/**')
  .exclude('*.test.ts')
  .toArray();

// Directory scope
await files.in('src/components').toArray();

// File extensions
await files.ext('ts', 'tsx').toArray();

// Complex chaining
const tsFiles = await repo.branch('main')
  .files()
  .filter('**/*.ts')
  .exclude('**/*.test.ts')
  .exclude('node_modules/**')
  .in('src')
  .ext('ts', 'tsx')
  .toArray();
```

### Output Formats

```typescript
const query = repo.branch('main').files().filter('src/**/*.ts');

// Array
const array = await query.toArray();

// Tree structure
const tree = await query.toTree();

// Async iteration
for await (const file of query) {
  console.log(file.path, file.size);
}

// Count
const count = await query.count();

// First match
const first = await query.first();

// Check existence
const exists = await query.any();
```

### File Content Access

```typescript
// Direct content access (throws on error)
const content = await repo.branch('main')
  .file('src/index.ts')
  .content();

// With null fallback
const maybeContent = await repo.branch('main')
  .file('src/index.ts')
  .content()
  .orNull();

// Custom error
const contentOrError = await repo.branch('main')
  .file('missing.ts')
  .content()
  .orThrow((path, ref) => new Error(`Custom: ${path} not found`));

// Default value
const contentOrDefault = await repo.branch('main')
  .file('config.json')
  .content()
  .orDefault('{}');

// Different encodings
const utf8 = await repo.branch('main').file('README.md').content('utf8');
const base64 = await repo.branch('main').file('image.png').content('base64');
const buffer = await repo.branch('main').file('binary.dat').content('buffer');
```

### Content Transformation

```typescript
// Map transformation
const json = await repo.branch('main')
  .file('package.json')
  .content()
  .map(str => JSON.parse(str));

// FlatMap chaining
const dependencies = await repo.branch('main')
  .file('package.json')
  .content()
  .map(JSON.parse)
  .map(pkg => pkg.dependencies);

// Side effects
await repo.branch('main')
  .file('log.txt')
  .content()
  .tap(content => console.log('File size:', content.length));
```

### File Metadata

```typescript
const file = repo.branch('main').file('src/index.ts');

// Full metadata
const info = await file.info();

// Specific properties
const size = await file.size();
const ext = await file.extension();
const oid = await file.oid();

// Check existence
const exists = await file.exists();
```

### Cache Management

```typescript
// Clear all cache
repo.invalidate();

// Bypass cache for specific query
const freshFiles = await repo.branch('main')
  .files()
  .fresh()
  .toArray();
```

### List Branches and Tags

```typescript
// All branches
const branches = await repo.branches();
// ['main', 'develop', 'feature/new-api']

// All tags
const tags = await repo.tags();
// ['v1.0.0', 'v1.1.0', 'v2.0.0']
```

## API Reference

### GitDataSource

Main entry point for repository access.

- `static from(location: string, options?: RepoOptions): GitDataSource`
- `branch(name: string): RefScope`
- `tag(name: string): RefScope`
- `ref(sha: string): RefScope`
- `branches(): Promise<string[]>`
- `tags(): Promise<string[]>`
- `invalidate(): void`

### RefScope

Represents repository at specific reference.

- `file(path: string): FileHandle`
- `files(): FileQuery`
- `getRef(): string`
- `commit(): Promise<string>`
- `exists(): Promise<boolean>`

### FileQuery

Fluent file enumeration builder.

- `filter(pattern: string | RegExp | FileFilter): FileQuery`
- `exclude(pattern: string | RegExp): FileQuery`
- `in(directory: string): FileQuery`
- `ext(...extensions: string[]): FileQuery`
- `fresh(): FileQuery`
- `toArray(): Promise<FileInfo[]>`
- `toTree(): Promise<TreeNode>`
- `count(): Promise<number>`
- `first(): Promise<FileInfo | undefined>`
- `any(): Promise<boolean>`
- `forEach(callback: (file: FileInfo) => void | Promise<void>): Promise<void>`

### FileHandle

Single file accessor.

- `content(): ContentResult<string>`
- `content(encoding: 'utf8' | 'base64' | 'buffer'): ContentResult<string | Buffer>`
- `info(): Promise<FileInfo>`
- `exists(): Promise<boolean>`
- `size(): Promise<number>`
- `extension(): Promise<string>`
- `oid(): Promise<string>`

### ContentResult

Content with chainable error handling.

- `value(): Promise<T>`
- `orNull(): Promise<T | null>`
- `orThrow(errorFactory?: (path, ref) => Error): Promise<T>`
- `orDefault(defaultValue: T): Promise<T>`
- `orElse(defaultFactory: () => T | Promise<T>): Promise<T>`
- `map<U>(mapper: (value: T) => U | Promise<U>): ContentResult<U>`
- `flatMap<U>(mapper: (value: T) => Promise<U> | ContentResult<U>): ContentResult<U>`
- `tap(effect: (value: T) => void | Promise<void>): ContentResult<T>`

## Type Definitions

### FileInfo

```typescript
interface FileInfo {
  path: string;          // Full path relative to repo root
  size: number;          // File size in bytes
  mode: string;          // File mode (permissions)
  oid: string;           // Git object ID (SHA-1)
  extension: string;     // File extension (without dot)
  directory: string;     // Directory path
  basename: string;      // Base filename
}
```

### TreeNode

```typescript
interface TreeNode {
  name: string;          // Node name
  path: string;          // Full path from repo root
  type: 'file' | 'directory';
  info?: FileInfo;       // Only for file nodes
  children?: TreeNode[]; // Only for directory nodes
}
```

## Architecture

The fluent API is built with strict separation of concerns:

- **GitDataSource** - Entry point and repository-level operations
- **RefScope** - Reference-scoped operations (branch/tag/commit)
- **FileQuery** - File enumeration with filtering
- **FileHandle** - Single file operations
- **ContentResult** - Content retrieval with error handling

All classes use dependency injection through interfaces for testability and extensibility.

## License

MIT
