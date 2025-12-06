# API Documentation

## Installation

```bash
npm install @git-data-source/core @octokit/rest isomorphic-git
```

## Quick Start

### GitHub Provider

```typescript
import { GitDataSource } from '@git-data-source/core';

const source = new GitDataSource({
  provider: {
    type: 'github',
    options: {
      owner: 'myorg',
      repo: 'myrepo',
      auth: {
        type: 'token',
        token: process.env.GITHUB_TOKEN
      }
    }
  },
  defaultRef: 'main'
});

await source.initialize();

// Query files
const tsFiles = await source
  .glob('**/*.ts')
  .exclude('**/*.test.ts')
  .filesOnly()
  .toArray();
```

### Local Provider

```typescript
const source = new GitDataSource({
  provider: {
    type: 'local',
    options: {
      repoPath: '/path/to/repo',
      auth: { type: 'none' }
    }
  }
});

await source.initialize();

const files = await source.ref('main').toArray();
```

## API Reference

### GitDataSource

#### Constructor

```typescript
new GitDataSource(options: GitDataSourceOptions)
```

#### Methods

**initialize(): Promise<void>**
Initialize the data source. Must be called before any queries.

**query(): GitDataSourceQuery**
Start a new query.

**ref(reference: string): GitDataSourceQuery**
Shorthand for `query().ref(reference)`.

**path(path: string): GitDataSourceQuery**
Shorthand for `query().path(path)`.

**invalidateCache(): Promise<void>**
Clear all cached data.

**dispose(): Promise<void>**
Cleanup resources.

### GitDataSourceQuery (Fluent API)

#### Reference Selection

**ref(reference: string): this**
Specify branch or tag to query.

**path(path: string): this**
Specify starting path (directory).

#### Filtering

**glob(pattern: string | string[]): this**
Filter by glob pattern(s).

```typescript
source.glob('**/*.ts')
source.glob(['**/*.ts', '**/*.js'])
```

**regex(pattern: RegExp | RegExp[]): this**
Filter by regular expression(s).

```typescript
source.regex(/\.tsx?$/)
```

**filter(predicate: FilePredicate): this**
Apply custom filter function.

```typescript
source.filter(file => file.size! > 1000)
source.filter(async file => {
  return file.content?.includes('TODO') ?? false;
})
```

**exclude(pattern: string | string[]): this**
Exclude files matching pattern(s).

```typescript
source.exclude('**/*.test.ts')
source.exclude(['**/node_modules/**', '**/.git/**'])
```

**extension(ext: string | string[]): this**
Filter by file extension.

```typescript
source.extension('.ts')
source.extension(['.ts', '.tsx'])
```

**directory(dir: string | string[]): this**
Filter by directory path.

```typescript
source.directory('src')
source.directory(['src', 'lib'])
```

**filesOnly(): this**
Include only files (exclude directories).

**directoriesOnly(): this**
Include only directories.

**maxDepth(depth: number): this**
Limit directory traversal depth.

```typescript
source.maxDepth(2) // Max 2 levels deep
```

#### Cache Control

**fresh(): this**
Bypass cache and fetch fresh data.

**cached(): this**
Use cached data (default).

#### Error Handling

**orNull(): this**
Return null/empty on errors instead of throwing.

**orThrow(): this**
Throw errors (default behavior).

**onError(handler: ErrorHandler): this**
Use custom error handler.

```typescript
source.onError(error => {
  console.error('Query failed:', error);
})
```

#### Execution

**toArray(): Promise<FileInfo[]>**
Execute query and return all results as array.

**toTree(): Promise<TreeNode[]>**
Execute query and return hierarchical tree structure.

**count(): Promise<number>**
Get count of matching files.

**any(): Promise<boolean>**
Check if any files match.

**first(): Promise<FileInfo | null>**
Get first matching file.

**[Symbol.asyncIterator](): AsyncIterator<FileInfo>**
Iterate results asynchronously.

```typescript
for await (const file of source.glob('**/*.ts')) {
  console.log(file.path);
}
```

## Type Definitions

### FileInfo

```typescript
interface FileInfo {
  path: string;              // Full path
  name: string;              // File name
  type: FileType;            // 'file' | 'directory' | 'symlink' | 'submodule'
  size: number | null;       // Bytes (null for directories)
  content: string | null;    // UTF-8 content
  sha: string;               // Git hash
  extension: string | null;  // e.g., '.ts'
  mimeType?: string;
  lastCommit?: CommitInfo;
  metadata?: Record<string, unknown>;
}
```

### TreeNode

```typescript
interface TreeNode {
  file: FileInfo;
  children: TreeNode[];
  parent: TreeNode | null;
  level: number;
}
```

### GitReference

```typescript
interface GitReference {
  name: string;         // 'main', 'v1.0.0'
  type: 'branch' | 'tag';
  sha: string;
  isDefault?: boolean;
}
```

## Examples

### Find All TypeScript Files

```typescript
const tsFiles = await source
  .glob('**/*.ts')
  .filesOnly()
  .toArray();
```

### Find Large Files

```typescript
const largeFiles = await source
  .filter(file => (file.size ?? 0) > 100_000)
  .toArray();
```

### Get Project Structure

```typescript
const tree = await source
  .path('src')
  .maxDepth(3)
  .toTree();
```

### Find TODO Comments

```typescript
const todosFiles = await source
  .glob('**/*.ts')
  .filter(async file => {
    return file.content?.includes('TODO') ?? false;
  })
  .toArray();
```

### Count Test Files

```typescript
const testCount = await source
  .glob('**/*.test.ts')
  .count();
```

### Stream Processing

```typescript
for await (const file of source.glob('**/*.md')) {
  console.log(`Processing: ${file.path}`);
  // Process file...
}
```

## Error Handling

### Default (Throw)

```typescript
try {
  const files = await source.ref('invalid-branch').toArray();
} catch (error) {
  console.error('Query failed:', error);
}
```

### Return Null

```typescript
const files = await source
  .ref('invalid-branch')
  .orNull()
  .toArray();

if (files === null) {
  console.log('Query failed');
}
```

### Custom Handler

```typescript
const files = await source
  .ref('invalid-branch')
  .onError(error => {
    logger.error('Query failed', { error });
  })
  .toArray();
```

## Advanced Usage

### Multiple Filters (AND)

```typescript
const files = await source
  .glob('**/*.ts')          // TypeScript files
  .exclude('**/*.test.ts')  // AND not tests
  .directory('src')         // AND in src directory
  .toArray();
```

### Multiple Filters (OR)

```typescript
const files = await source
  .extension('.ts')    // .ts files
  .extension('.tsx')   // OR .tsx files
  .toArray();
```

### Complex Predicate

```typescript
const files = await source
  .filter(async file => {
    if (!file.content) return false;

    // Find files with specific imports
    return file.content.includes("import { React }");
  })
  .toArray();
```
