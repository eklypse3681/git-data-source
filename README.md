# git-data-source

A fluent TypeScript library for accessing Git repositories as data sources with seamless GitHub integration.

[![npm version](https://badge.fury.io/js/git-data-source.svg)](https://www.npmjs.com/package/git-data-source)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔄 **Fluent API** - Clean, chainable method syntax for repository operations
- 🐙 **GitHub Integration** - Direct access to GitHub repositories via REST API
- 📁 **Local Repositories** - Work with local Git repositories using isomorphic-git
- 🔍 **Advanced Filtering** - Pattern matching with globs, regex, and custom predicates
- 📊 **Repository Metrics** - Comprehensive statistics and analytics
- 🎯 **Type-Safe** - Full TypeScript support with strict type checking
- 🌐 **Isomorphic** - Works in Node.js and browser environments
- ⚡ **Performance** - Smart caching and efficient file streaming
- 🌲 **Tree Structures** - Convert flat file lists to hierarchical trees
- 🛡️ **Error Handling** - Rich error handling with `.orNull()`, `.orThrow()`, `.orDefault()`

## Installation

```bash
npm install git-data-source
```

### Prerequisites

- Node.js 18.0.0 or higher
- GitHub Personal Access Token (for GitHub API features)

## Quick Start

### GitHub Repository Access

```typescript
import { GitDataSource } from 'git-data-source';

// Initialize with GitHub authentication
const ds = new GitDataSource({
  auth: process.env.GITHUB_TOKEN
});

// Access a repository
const repo = ds.github('owner/repo');

// List TypeScript files
const files = await repo
  .branch('main')
  .files()
  .include('src/**/*.ts')
  .exclude('**/*.test.ts')
  .list();

// Get file content
const content = await repo
  .branch('main')
  .file('README.md')
  .read();

// Repository information
const info = await repo.info();
console.log(info.description, info.stars, info.language);
```

### Local Repository Access

```typescript
import { GitDataSource } from 'git-data-source';

const ds = new GitDataSource();

// Access local repository
const repo = ds.local('/path/to/repo');

// List files
const files = await repo
  .branch('main')
  .files()
  .include('**/*.ts')
  .list();

// Get file content
const content = await repo
  .file('package.json')
  .read();
```

### Fluent API Examples

```typescript
// Branch selection
const main = repo.branch('main');
const develop = repo.tag('v1.0.0');
const commit = repo.ref('abc123');

// File filtering with patterns
const tsFiles = await repo.branch('main')
  .files()
  .filter('**/*.ts')
  .exclude('**/*.test.ts')
  .exclude('node_modules/**')
  .in('src')
  .ext('ts', 'tsx')
  .toArray();

// Tree structure output
const tree = await repo.branch('main')
  .files()
  .filter('src/**/*.ts')
  .toTree();

// Async iteration
for await (const file of repo.branch('main').files()) {
  console.log(file.path, file.size);
}

// File content with error handling
const content = await repo.branch('main')
  .file('config.json')
  .content()
  .orDefault('{}');

// Transform content
const dependencies = await repo.branch('main')
  .file('package.json')
  .content()
  .map(JSON.parse)
  .map(pkg => pkg.dependencies);
```

## Authentication Setup

### GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope (for private repositories) or no scopes (for public repositories)
3. Set the token in your environment:

```bash
export GITHUB_TOKEN='ghp_your_token_here'
```

Or pass it directly:

```typescript
const ds = new GitDataSource({
  auth: 'ghp_your_token_here'
});
```

### Environment Variables

Create a `.env` file:

```env
GITHUB_TOKEN=ghp_your_token_here
```

Load with dotenv:

```typescript
import 'dotenv/config';
import { GitDataSource } from 'git-data-source';

const ds = new GitDataSource({
  auth: process.env.GITHUB_TOKEN
});
```

## Core API

### GitDataSource

Main entry point for the library.

```typescript
const ds = new GitDataSource({
  auth?: string;          // GitHub personal access token
  baseUrl?: string;       // GitHub API base URL (for enterprise)
});

// Access repositories
ds.github('owner/repo');  // GitHub repository
ds.local('/path/to/repo'); // Local repository
```

### Repository Operations

```typescript
const repo = ds.github('owner/repo');

// Reference selection
repo.branch('branch-name');     // Access a branch
repo.tag('v1.0.0');             // Access a tag
repo.ref('abc123');             // Access a commit

// File operations
repo.file('path/to/file').read();
repo.files().include('**/*.ts').list();

// Repository information
await repo.info();              // Basic info (name, description, stars, etc.)
await repo.branches();          // List all branches
await repo.commits(options);    // List commits with filtering
await repo.tags();              // List all tags
await repo.stats();             // Repository statistics
```

### File Filtering

```typescript
const query = repo.branch('main').files();

// Include patterns (glob)
query.include('src/**/*.ts');
query.include('**/*.{ts,tsx}');

// Exclude patterns
query.exclude('**/*.test.ts');
query.exclude('node_modules/**');

// Filter by extension
query.extensions(['.ts', '.tsx', '.js']);

// Custom predicate
query.filter(file => file.size < 10000);

// Combine filters
const files = await repo.branch('main')
  .files()
  .include('src/**/*.ts')
  .exclude('**/*.test.ts')
  .extensions(['.ts'])
  .list();
```

### File Content Access

```typescript
const file = repo.branch('main').file('README.md');

// Read content
const content = await file.read();

// Read with encoding
const utf8 = await file.read('utf8');
const base64 = await file.read('base64');
const buffer = await file.read('buffer');

// Error handling
const contentOrNull = await file.content().orNull();
const contentOrDefault = await file.content().orDefault('default value');
const contentOrThrow = await file.content().orThrow(
  (path, ref) => new Error(`File ${path} not found at ${ref}`)
);

// Transform content
const json = await file.content().map(JSON.parse);
const dependencies = await file.content()
  .map(JSON.parse)
  .map(pkg => pkg.dependencies);

// Check existence
const exists = await file.exists();

// Get metadata
const info = await file.info();
const size = await file.size();
```

### Output Formats

```typescript
const query = repo.branch('main').files().include('src/**/*.ts');

// Array of files
const array = await query.toArray();

// Hierarchical tree structure
const tree = await query.toTree();

// Async iteration
for await (const file of query) {
  console.log(file.path, file.size);
}

// Count files
const count = await query.count();

// First file
const first = await query.first();

// Check if any files match
const hasFiles = await query.any();
```

## Advanced Usage

### Repository Metrics

```typescript
const stats = await repo.stats();

console.log(stats.totalFiles);           // Total number of files
console.log(stats.totalSize);            // Total size in bytes
console.log(stats.filesByExtension);     // Map of extension to count
console.log(stats.largestFiles);         // Top 10 largest files
console.log(stats.directoryStats);       // Stats by directory
```

### Commit History

```typescript
const commits = await repo.commits({
  limit: 50,
  since: '2024-01-01',
  until: '2024-12-31',
  author: 'username',
  path: 'src/index.ts'
});

commits.forEach(commit => {
  console.log(commit.sha);
  console.log(commit.message);
  console.log(commit.author.name);
  console.log(commit.date);
});
```

### Batch File Operations

```typescript
// Read multiple files at once
const contents = await repo.branch('main')
  .files()
  .include('src/**/*.ts')
  .readAll();

contents.forEach(({ path, content, encoding }) => {
  console.log(`File: ${path}`);
  console.log(`Content: ${content.substring(0, 100)}...`);
});
```

### Cache Management

```typescript
// Clear all cached data
repo.invalidate();

// Bypass cache for specific query
const freshFiles = await repo.branch('main')
  .files()
  .fresh()
  .toArray();
```

### Tree Structure Output

```typescript
const tree = await repo.branch('main')
  .files()
  .include('src/**')
  .toTree();

// Tree structure
{
  name: 'src',
  path: 'src',
  type: 'directory',
  children: [
    {
      name: 'index.ts',
      path: 'src/index.ts',
      type: 'file',
      info: { path: 'src/index.ts', size: 1234, ... }
    },
    // ...
  ]
}
```

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

### RepositoryInfo

```typescript
interface RepositoryInfo {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  stars: number;
  forks: number;
  language: string;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### CommitInfo

```typescript
interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  committer: {
    name: string;
    email: string;
    date: Date;
  };
  url: string;
}
```

## Error Handling

```typescript
import { GitDataSource } from 'git-data-source';

try {
  const content = await repo.file('missing.txt').read();
} catch (error) {
  if (error.status === 404) {
    console.error('File not found');
  } else if (error.status === 401) {
    console.error('Authentication failed');
  } else if (error.status === 403) {
    console.error('Rate limit exceeded or insufficient permissions');
  } else {
    console.error('API error:', error.message);
  }
}

// Or use error handling methods
const content = await repo.file('config.json')
  .content()
  .orDefault('{}');  // Returns default if file not found
```

## Examples

See the [examples directory](./docs/examples.md) for more comprehensive examples:

- [Basic repository access](./docs/examples.md#basic-access)
- [File filtering and search](./docs/examples.md#file-filtering)
- [Commit history analysis](./docs/examples.md#commit-analysis)
- [Code metrics and statistics](./docs/examples.md#code-metrics)
- [Multi-repository analysis](./docs/examples.md#multi-repo)

## Documentation

- [Full Documentation](./docs/README.md)
- [API Reference](./docs/api-reference.md)
- [Fluent API Guide](./docs/FLUENT_API.md)
- [Examples](./docs/examples.md)

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting pull requests.

### Development Setup

```bash
# Clone repository
git clone https://github.com/eklypse3681/git-data-source.git
cd git-data-source

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck
```

## License

MIT © git-data-source contributors

See [LICENSE](./LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/eklypse3681/git-data-source/issues)
- [Documentation](./docs/README.md)
- [Discussions](https://github.com/eklypse3681/git-data-source/discussions)

## Related Projects

- [isomorphic-git](https://isomorphic-git.org/) - Git operations in JavaScript
- [octokit.js](https://github.com/octokit/octokit.js) - GitHub REST API client
- [simple-git](https://github.com/steveukx/git-js) - Git command wrapper

