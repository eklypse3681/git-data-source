# Test Suite for git-data-source

Comprehensive test suite with high coverage for the git-data-source TypeScript library.

## Structure

```
tests/
├── unit/                      # Unit tests
│   ├── cache.test.ts         # CacheManager tests
│   ├── filters.test.ts       # File filtering tests
│   ├── content-result.test.ts # ContentResult tests
│   └── fluent-api.test.ts    # GitDataSource API tests
└── mocks/
    └── provider.mock.ts      # Mock provider for testing
```

## Test Coverage

### CacheManager Tests (`cache.test.ts`)
- ✅ Basic get/set/delete operations
- ✅ TTL (time-to-live) expiration
- ✅ LRU (least recently used) eviction
- ✅ Statistics tracking (hits, misses, hit rate)
- ✅ Pattern-based deletion (regex, glob)
- ✅ Namespace isolation
- ✅ Automatic cleanup
- ✅ getOrSet pattern
- ✅ Edge cases (large caches, special characters, concurrent ops)

### File Filter Tests (`filters.test.ts`)
- ✅ Glob pattern matching (*, **, ?)
- ✅ Regex pattern matching
- ✅ Extension filtering
- ✅ Directory scoping
- ✅ Exclude patterns
- ✅ File type filtering (files only, directories only)
- ✅ Size filtering (min/max)
- ✅ Depth filtering
- ✅ Predicate filters (sync and async)
- ✅ Filter composition (combining multiple filters)
- ✅ Edge cases (empty lists, no matches, missing properties)

### ContentResult Tests (`content-result.test.ts`)
- ✅ `value()` - direct value retrieval
- ✅ `orNull()` - null fallback on FileNotFoundError
- ✅ `orThrow()` - custom error throwing
- ✅ `orDefault()` - default value fallback
- ✅ `orElse()` - lazy default computation
- ✅ `map()` - value transformation
- ✅ `flatMap()` - async chaining
- ✅ `tap()` - side effects
- ✅ Awaitable (then method)
- ✅ Complex chaining scenarios
- ✅ Type safety through transformations

### Fluent API Tests (`fluent-api.test.ts`)
- ✅ `GitDataSource.from()` - factory method
- ✅ Remote vs local detection
- ✅ `branch()` / `tag()` / `ref()` - reference access
- ✅ `branches()` / `tags()` - listing
- ✅ `invalidate()` - cache clearing
- ✅ `getSource()` - immutable source retrieval
- ✅ Method chaining
- ✅ Caching behavior
- ✅ Error handling
- ✅ Instance independence
- ✅ Edge cases (Unicode, special chars, long names)

### Mock Provider (`provider.mock.ts`)
- Configurable mock implementation
- Call tracking and verification
- Latency simulation
- Error injection
- Helper functions for creating mock data

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Watch mode (re-run on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Coverage Goals

| Metric     | Target | Description                    |
|------------|--------|--------------------------------|
| Statements | >80%   | Individual code statements     |
| Branches   | >75%   | Conditional branches (if/else) |
| Functions  | >80%   | Function/method coverage       |
| Lines      | >80%   | Lines of code executed         |

## Test Patterns

### Arrange-Act-Assert (AAA)
```typescript
it('should cache values', () => {
  // Arrange
  const cache = new CacheManager();

  // Act
  cache.set('key', 'value');
  const result = cache.get('key');

  // Assert
  expect(result).toBe('value');
});
```

### Testing Async Operations
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Cases
```typescript
it('should throw on invalid input', async () => {
  await expect(functionThatThrows()).rejects.toThrow('Expected error');
});
```

### Using Mocks
```typescript
import { MockProvider, createMockFile } from '../mocks/provider.mock';

it('should use mock provider', async () => {
  const mock = new MockProvider({
    files: [createMockFile({ path: 'test.ts' })]
  });

  await mock.initialize();
  const files = await mock.listFiles('main');

  expect(files).toHaveLength(1);
  expect(mock.getCallCount('listFiles')).toBe(1);
});
```

## Writing New Tests

1. **Create test file** in appropriate directory:
   - Unit tests → `tests/unit/`
   - Integration tests → `tests/integration/`

2. **Import dependencies**:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { ClassToTest } from '../../src/path/to/class';
   ```

3. **Structure tests**:
   ```typescript
   describe('ClassToTest', () => {
     describe('methodName', () => {
       it('should do something specific', () => {
         // test implementation
       });
     });
   });
   ```

4. **Use descriptive test names** that explain the expected behavior

5. **Test edge cases**:
   - Empty inputs
   - Null/undefined values
   - Boundary conditions
   - Error scenarios

## Best Practices

- ✅ Each test should be independent and isolated
- ✅ Use `beforeEach` to reset state between tests
- ✅ Test one behavior per test case
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Avoid testing implementation details
- ✅ Test public APIs, not private methods
- ✅ Keep tests simple and readable
- ✅ Use factories/builders for test data
- ✅ Clean up resources in `afterEach`

## Debugging Tests

```bash
# Run specific test file
npx vitest run tests/unit/cache.test.ts

# Run tests matching pattern
npx vitest run -t "CacheManager"

# Debug with Node inspector
node --inspect-brk ./node_modules/.bin/vitest run
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
- name: Run Tests
  run: npm test

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain >80% coverage
4. Update this README if adding new test categories
