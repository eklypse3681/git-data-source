# Git Data Source - System Architecture

## Overview

Git Data Source is a TypeScript library that provides a fluent, type-safe API for accessing Git repositories as data sources. The library supports multiple providers (GitHub, local filesystem) and is designed for extensibility.

## Architecture Decision Records (ADRs)

### ADR-001: Fluent API Pattern

**Status:** Accepted

**Context:**
We need an intuitive, readable API for querying Git repositories that supports complex filtering scenarios.

**Decision:**
Implement a fluent/chainable API pattern using method chaining for query building.

**Rationale:**
- Improved code readability and maintainability
- Natural left-to-right reading flow
- Easy to compose complex queries
- Type-safe method chaining with TypeScript
- Familiar pattern for developers (similar to LINQ, jQuery)

**Example:**
```typescript
const files = await source
  .ref('main')
  .glob('**/*.ts')
  .exclude('**/*.test.ts')
  .filesOnly()
  .toArray();
```

### ADR-002: Provider Pattern

**Status:** Accepted

**Context:**
We need to support multiple Git providers (GitHub, local, GitLab, Bitbucket) with different APIs and authentication mechanisms.

**Decision:**
Implement an abstract Provider base class with a well-defined interface that all providers must implement.

**Rationale:**
- Single Responsibility Principle: Each provider handles only its specific API
- Open/Closed Principle: New providers can be added without modifying existing code
- Dependency Inversion: Core logic depends on abstraction, not concrete implementations
- Testability: Providers can be mocked for testing

**Trade-offs:**
- Initial complexity in setting up abstraction layer
- Potential performance overhead from abstraction
- Benefits outweigh costs for maintainability and extensibility

### ADR-003: TypeScript-First Design

**Status:** Accepted

**Context:**
We need strong type safety and excellent developer experience with autocomplete and type checking.

**Decision:**
Design all APIs with TypeScript as the primary language, using advanced TypeScript features (generics, conditional types, discriminated unions).

**Rationale:**
- Compile-time type checking reduces runtime errors
- Excellent IDE support with autocomplete
- Self-documenting code through types
- Type inference reduces boilerplate

**Key TypeScript Features Used:**
- Discriminated unions for provider configuration
- Generic types for extensible filtering
- Conditional types for type-safe method chaining
- Strict null checking for safer APIs

### ADR-004: Caching Strategy

**Status:** Accepted

**Context:**
Git API calls can be expensive, especially for GitHub with rate limits. We need intelligent caching.

**Decision:**
Implement a pluggable caching system with multiple strategies (memory, filesystem, custom).

**Rationale:**
- Reduces API calls and improves performance
- Respects rate limits
- Configurable per use case
- Easy to invalidate with `.fresh()` and `.invalidate()`

**Cache Key Strategy:**
- Format: `{prefix}:{provider}:{operation}:{params}`
- Example: `gds:github:files:main:src`

### ADR-005: Error Handling Strategy

**Status:** Accepted

**Context:**
Different use cases require different error handling approaches (throw vs. return null vs. custom handler).

**Decision:**
Provide fluent methods for error handling: `.orNull()`, `.orThrow()`, `.onError(handler)`.

**Rationale:**
- Flexibility for different use cases
- Explicit error handling intent
- No hidden error swallowing
- Composable with fluent API

**Example:**
```typescript
// Throw on error (default)
const files = await source.ref('main').toArray();

// Return null on error
const files = await source.ref('main').orNull().toArray();

// Custom error handler
const files = await source.ref('main').onError(handleError).toArray();
```

### ADR-006: Async Iteration Support

**Status:** Accepted

**Context:**
Large repositories may have thousands of files. Loading all into memory is inefficient.

**Decision:**
Implement async iterator support alongside `.toArray()` and `.toTree()` methods.

**Rationale:**
- Memory efficient for large datasets
- Allows streaming processing
- Modern JavaScript/TypeScript pattern
- Composable with async generators

**Example:**
```typescript
for await (const file of source.ref('main').glob('**/*.ts')) {
  console.log(file.path);
}
```

### ADR-007: Filter Composition

**Status:** Accepted

**Context:**
Users need to apply multiple filters (glob, regex, predicates, exclusions) in flexible ways.

**Decision:**
All filters are applied as AND conditions. Multiple calls to the same filter type create OR conditions.

**Rationale:**
- Predictable behavior
- Matches common query patterns
- Easy to reason about
- Performant (short-circuit evaluation)

**Example:**
```typescript
// AND: .ts files that are NOT tests
source.extension('.ts').exclude('**/*.test.ts')

// OR: .ts OR .js files
source.extension('.ts').extension('.js')
```

## Component Diagram (C4 Model - Level 2)

```
┌─────────────────────────────────────────────────────────────┐
│                      GitDataSource                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Query Builder (Fluent API)               │  │
│  │  .ref() .path() .glob() .filter() .toArray()         │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Provider Interface                   │  │
│  │  listFiles() getFile() listReferences() getCommit()  │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐         │
│  │  GitHub    │   │   Local    │   │   Future   │         │
│  │  Provider  │   │  Provider  │   │  Providers │         │
│  └────────────┘   └────────────┘   └────────────┘         │
│         │                 │                                │
│         ▼                 ▼                                │
│  ┌────────────┐   ┌────────────┐                          │
│  │  Octokit   │   │ Isomorphic │                          │
│  │    API     │   │    Git     │                          │
│  └────────────┘   └────────────┘                          │
└─────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────┐
       │      Supporting Components         │
       ├────────────────────────────────────┤
       │  - FileFilter (glob, regex, etc.)  │
       │  - CacheProvider (memory, fs)      │
       │  - TreeBuilder (hierarchy builder) │
       │  - Error Handlers                  │
       └────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Create GitDataSource
     ▼
┌─────────────────┐
│  GitDataSource  │
└────┬────────────┘
     │
     │ 2. initialize()
     ▼
┌─────────────────┐
│    Provider     │ ◄──── Cache Check
└────┬────────────┘
     │
     │ 3. Build Query
     ▼
┌─────────────────┐
│  Query Builder  │
└────┬────────────┘
     │
     │ 4. Apply Filters
     ▼
┌─────────────────┐
│   FileFilter    │
└────┬────────────┘
     │
     │ 5. Execute
     ▼
┌─────────────────┐
│  Provider API   │ ──► GitHub API / Local Git
└────┬────────────┘
     │
     │ 6. Map to FileInfo
     ▼
┌─────────────────┐
│  Results        │ ──► Cache Store
│  (Array/Tree)   │
└─────────────────┘
```

## Directory Structure

```
/workspace/git-data-source/
├── src/
│   ├── types/                  # TypeScript type definitions
│   │   ├── index.ts           # Core types and interfaces
│   │   └── providers.ts       # Provider-specific types
│   ├── core/                   # Core abstractions
│   │   ├── provider.ts        # Abstract Provider base class
│   │   └── query-builder.ts   # Fluent API implementation
│   ├── providers/              # Provider implementations
│   │   ├── github-provider.ts
│   │   └── local-provider.ts
│   ├── filters/                # Filtering logic
│   │   └── file-filter.ts
│   ├── cache/                  # Cache implementations
│   │   └── (future)
│   ├── utils/                  # Utility functions
│   │   └── tree-builder.ts
│   └── index.ts               # Main entry point
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   └── ARCHITECTURE.md        # This file
├── package.json
└── tsconfig.json
```

## Technology Stack

### Core Dependencies
- **TypeScript 5.3+**: Primary language
- **@octokit/rest**: GitHub API client
- **isomorphic-git**: Local Git operations
- **minimatch**: Glob pattern matching

### Development Dependencies
- **Jest**: Testing framework
- **ESLint**: Code linting
- **TypeScript**: Type checking

## Design Patterns

### 1. Builder Pattern (Fluent API)
The QueryBuilder class implements the builder pattern for constructing complex queries.

### 2. Strategy Pattern (Providers)
Different providers implement the same interface with different strategies for data access.

### 3. Template Method Pattern (BaseProvider)
BaseProvider defines the skeleton of provider operations, with subclasses implementing specific steps.

### 4. Proxy Pattern (Caching)
Cache layer acts as a proxy between the query builder and provider.

### 5. Iterator Pattern
Async iterator support for streaming large result sets.

## Performance Considerations

### 1. Caching
- Memory cache for frequently accessed data
- TTL-based expiration
- LRU eviction for size limits

### 2. Lazy Evaluation
- Filters applied only when results are materialized
- Async iterators for streaming

### 3. Batch Operations
- Provider-level batching where supported
- Single API calls for directory listings

### 4. Type Safety
- Zero runtime overhead for TypeScript types
- Compile-time optimization

## Security Considerations

### 1. Authentication
- Token-based auth for GitHub
- SSH/HTTPS auth for local repositories
- No auth stored in code

### 2. Input Validation
- Path traversal prevention
- Pattern validation for glob/regex
- Size limits for file operations

### 3. Rate Limiting
- Respect provider rate limits
- Automatic retry with backoff
- Cache to reduce API calls

## Future Enhancements

### 1. Additional Providers
- GitLab
- Bitbucket
- Azure DevOps

### 2. Advanced Features
- Incremental updates (watch mode)
- Diff operations
- Commit history analysis

### 3. Performance
- GraphQL API for GitHub (when available)
- Filesystem cache strategy
- Parallel file fetching

### 4. Developer Experience
- CLI tool for testing queries
- VSCode extension
- Interactive documentation

## Testing Strategy

### Unit Tests
- Provider implementations
- Filter logic
- Cache behavior
- Query builder

### Integration Tests
- GitHub API integration
- Local repository operations
- End-to-end workflows

### Performance Tests
- Large repository handling
- Cache effectiveness
- Memory usage

## Deployment

### NPM Package
- Scoped package: `@git-data-source/core`
- Semantic versioning
- Comprehensive documentation
- TypeScript declarations included

### Peer Dependencies
- Octokit and isomorphic-git as peer dependencies
- Allows users to control versions
