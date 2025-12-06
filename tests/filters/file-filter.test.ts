/**
 * File Filter Tests
 *
 * Comprehensive test suite for file filtering functionality
 */

import { FileFilter, FilterBuilder } from '../../src/filters';
import { FileInfo, FileType } from '../../src/types';

// Mock file data for testing
function createMockFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: 'src/test.ts',
    name: 'test.ts',
    type: FileType.File,
    size: 1024,
    content: 'export const test = true;',
    sha: 'abc123',
    extension: '.ts',
    ...overrides
  };
}

describe('FileFilter', () => {
  describe('glob filtering', () => {
    it('should match glob patterns', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/utils/helper.ts' }),
        createMockFile({ path: 'tests/index.test.ts' }),
        createMockFile({ path: 'README.md', extension: '.md' })
      ];

      const filter = new FileFilter().glob('src/**/*.ts');
      const results = await filter.apply(files);

      expect(results).toHaveLength(2);
      expect(results.map(f => f.path)).toEqual([
        'src/index.ts',
        'src/utils/helper.ts'
      ]);
    });

    it('should support multiple glob patterns', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/App.tsx', extension: '.tsx' }),
        createMockFile({ path: 'tests/index.test.ts' })
      ];

      const filter = new FileFilter()
        .glob('**/*.ts')
        .glob('**/*.tsx');

      const results = await filter.apply(files);
      expect(results).toHaveLength(3);
    });
  });

  describe('regex filtering', () => {
    it('should match regex patterns', async () => {
      const files = [
        createMockFile({ path: 'src/file-v1.0.0.ts' }),
        createMockFile({ path: 'src/file-v2.1.3.ts' }),
        createMockFile({ path: 'src/file.ts' })
      ];

      const filter = new FileFilter().regex(/v\d+\.\d+\.\d+/);
      const results = await filter.apply(files);

      expect(results).toHaveLength(2);
    });
  });

  describe('predicate filtering', () => {
    it('should apply sync predicates', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', size: 500 }),
        createMockFile({ path: 'src/large.ts', size: 2000 }),
        createMockFile({ path: 'src/small.ts', size: 100 })
      ];

      const filter = new FileFilter()
        .predicate(file => file.size !== null && file.size > 1000);

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/large.ts');
    });

    it('should apply async predicates', async () => {
      const files = [
        createMockFile({ path: 'src/with-todo.ts', content: '// TODO: fix this' }),
        createMockFile({ path: 'src/clean.ts', content: 'export const clean = true;' })
      ];

      const filter = new FileFilter()
        .predicate(async (file) => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return file.content?.includes('TODO') ?? false;
        });

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/with-todo.ts');
    });
  });

  describe('extension filtering', () => {
    it('should filter by extension', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', extension: '.ts' }),
        createMockFile({ path: 'src/App.tsx', extension: '.tsx' }),
        createMockFile({ path: 'src/index.js', extension: '.js' })
      ];

      const filter = new FileFilter().ext('.ts', '.tsx');
      const results = await filter.apply(files);

      expect(results).toHaveLength(2);
    });

    it('should handle extensions without dots', async () => {
      const files = [
        createMockFile({ path: 'file.ts', extension: '.ts' }),
        createMockFile({ path: 'file.js', extension: '.js' })
      ];

      const filter = new FileFilter().ext('ts'); // No dot
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].extension).toBe('.ts');
    });
  });

  describe('directory scoping', () => {
    it('should filter by directory', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/utils/helper.ts' }),
        createMockFile({ path: 'tests/index.test.ts' })
      ];

      const filter = new FileFilter().in('src');
      const results = await filter.apply(files);

      expect(results).toHaveLength(2);
    });

    it('should handle directory with trailing slash', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'tests/test.ts' })
      ];

      const filter = new FileFilter().in('src/');
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
    });
  });

  describe('exclude patterns', () => {
    it('should exclude glob patterns', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/index.test.ts' }),
        createMockFile({ path: 'tests/helper.test.ts' })
      ];

      const filter = new FileFilter()
        .glob('**/*.ts')
        .exclude('**/*.test.ts');

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });

    it('should exclude regex patterns', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/index.test.ts' })
      ];

      const filter = new FileFilter()
        .ext('.ts')
        .exclude(/\.test\./);

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
    });
  });

  describe('size filtering', () => {
    it('should filter by minimum size', async () => {
      const files = [
        createMockFile({ path: 'small.ts', size: 500 }),
        createMockFile({ path: 'large.ts', size: 2000 })
      ];

      const filter = new FileFilter().size(1000, undefined);
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('large.ts');
    });

    it('should filter by maximum size', async () => {
      const files = [
        createMockFile({ path: 'small.ts', size: 500 }),
        createMockFile({ path: 'large.ts', size: 2000 })
      ];

      const filter = new FileFilter().size(undefined, 1000);
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('small.ts');
    });

    it('should filter by size range', async () => {
      const files = [
        createMockFile({ path: 'tiny.ts', size: 100 }),
        createMockFile({ path: 'medium.ts', size: 1500 }),
        createMockFile({ path: 'huge.ts', size: 5000 })
      ];

      const filter = new FileFilter().size(1000, 2000);
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('medium.ts');
    });
  });

  describe('file type filtering', () => {
    it('should filter files only', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', type: FileType.File }),
        createMockFile({ path: 'src', type: FileType.Directory, size: null })
      ];

      const filter = new FileFilter().filesOnly();
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(FileType.File);
    });

    it('should filter directories only', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', type: FileType.File }),
        createMockFile({ path: 'src', type: FileType.Directory, size: null })
      ];

      const filter = new FileFilter().directoriesOnly();
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(FileType.Directory);
    });
  });

  describe('depth filtering', () => {
    it('should filter by max depth', async () => {
      const files = [
        createMockFile({ path: 'index.ts' }),           // depth 0
        createMockFile({ path: 'src/index.ts' }),       // depth 1
        createMockFile({ path: 'src/utils/helper.ts' }) // depth 2
      ];

      const filter = new FileFilter().maxDepth(1);
      const results = await filter.apply(files);

      expect(results).toHaveLength(2);
    });
  });

  describe('date filtering', () => {
    it('should filter by modified after', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const lastWeek = new Date(now.getTime() - 7 * 86400000);

      const files = [
        createMockFile({
          path: 'recent.ts',
          lastCommit: {
            sha: 'abc',
            message: 'msg',
            author: { name: 'test', email: 'test@test.com', date: yesterday }
          }
        }),
        createMockFile({
          path: 'old.ts',
          lastCommit: {
            sha: 'def',
            message: 'msg',
            author: { name: 'test', email: 'test@test.com', date: lastWeek }
          }
        })
      ];

      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      const filter = new FileFilter().modifiedBetween(twoDaysAgo, undefined);
      const results = await filter.apply(files);

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('recent.ts');
    });
  });

  describe('composable filters', () => {
    it('should combine filters with AND', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', extension: '.ts' }),
        createMockFile({ path: 'src/App.tsx', extension: '.tsx' }),
        createMockFile({ path: 'tests/index.test.ts', extension: '.ts' })
      ];

      const filter = new FileFilter()
        .ext('.ts')
        .in('src');

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });

    it('should combine filters with and() method', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', extension: '.ts' }),
        createMockFile({ path: 'src/index.js', extension: '.js' }),
        createMockFile({ path: 'tests/index.ts', extension: '.ts' })
      ];

      const tsFilter = new FileFilter().ext('.ts');
      const srcFilter = new FileFilter().in('src');
      const combined = tsFilter.and(srcFilter);

      const results = await combined.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });

    it('should combine filters with OR', async () => {
      const files = [
        createMockFile({ path: 'file.ts', extension: '.ts' }),
        createMockFile({ path: 'file.js', extension: '.js' }),
        createMockFile({ path: 'file.md', extension: '.md' })
      ];

      const tsFilter = new FileFilter().ext('.ts');
      const jsFilter = new FileFilter().ext('.js');
      const combined = tsFilter.or(jsFilter);

      const results = await combined.apply(files);
      expect(results).toHaveLength(2);
    });

    it('should negate filters with NOT', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/index.test.ts' })
      ];

      const testFilter = new FileFilter().glob('**/*.test.ts');
      const notTests = testFilter.not();

      const results = await notTests.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });
  });

  describe('streaming', () => {
    it('should apply filters to stream', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts' }),
        createMockFile({ path: 'src/App.tsx', extension: '.tsx' }),
        createMockFile({ path: 'tests/test.ts' })
      ];

      async function* fileStream() {
        for (const file of files) {
          yield file;
        }
      }

      const filter = new FileFilter().in('src');
      const results: FileInfo[] = [];

      for await (const file of filter.applyStream(fileStream())) {
        results.push(file);
      }

      expect(results).toHaveLength(2);
    });
  });

  describe('matches', () => {
    it('should check individual file', async () => {
      const file = createMockFile({ path: 'src/index.ts', size: 500 });
      const filter = new FileFilter()
        .glob('src/**/*.ts')
        .size(undefined, 1000);

      const matches = await filter.matches(file);
      expect(matches).toBe(true);
    });

    it('should return false for non-matching file', async () => {
      const file = createMockFile({ path: 'tests/index.test.ts' });
      const filter = new FileFilter().in('src');

      const matches = await filter.matches(file);
      expect(matches).toBe(false);
    });
  });

  describe('fromOptions', () => {
    it('should create filter from options object', async () => {
      const files = [
        createMockFile({ path: 'src/index.ts', extension: '.ts', size: 500 }),
        createMockFile({ path: 'src/index.test.ts', extension: '.ts', size: 200 }),
        createMockFile({ path: 'tests/test.ts', extension: '.ts', size: 300 })
      ];

      const filter = FileFilter.fromOptions({
        extensions: '.ts',
        exclude: '**/*.test.ts',
        directories: 'src',
        maxSize: 1000
      });

      const results = await filter.apply(files);
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });
  });
});

describe('FilterBuilder', () => {
  it('should create TypeScript filter', async () => {
    const files = [
      createMockFile({ path: 'file.ts', extension: '.ts' }),
      createMockFile({ path: 'file.tsx', extension: '.tsx' }),
      createMockFile({ path: 'file.js', extension: '.js' })
    ];

    const filter = FilterBuilder.typescript();
    const results = await filter.apply(files);

    expect(results).toHaveLength(2);
  });

  it('should create JavaScript filter', async () => {
    const files = [
      createMockFile({ path: 'file.js', extension: '.js' }),
      createMockFile({ path: 'file.jsx', extension: '.jsx' }),
      createMockFile({ path: 'file.ts', extension: '.ts' })
    ];

    const filter = FilterBuilder.javascript();
    const results = await filter.apply(files);

    expect(results).toHaveLength(2);
  });

  it('should create small files filter', async () => {
    const files = [
      createMockFile({ path: 'small.ts', size: 50 * 1024 }),
      createMockFile({ path: 'large.ts', size: 200 * 1024 })
    ];

    const filter = FilterBuilder.small(100); // 100KB
    const results = await filter.apply(files);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('small.ts');
  });

  it('should create ignore common filter', async () => {
    const files = [
      createMockFile({ path: 'src/index.ts' }),
      createMockFile({ path: 'node_modules/package/index.js' }),
      createMockFile({ path: 'dist/bundle.js' })
    ];

    const filter = FilterBuilder.ignoreCommon();
    const results = await filter.apply(files);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('src/index.ts');
  });
});
