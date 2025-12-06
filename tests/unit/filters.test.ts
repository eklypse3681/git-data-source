/**
 * File Filter Unit Tests
 *
 * Tests for glob patterns, regex, predicates, extensions, directories, and filter composition
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileFilter } from '../../src/filters/file-filter';
import type { FileInfo, FilterOptions } from '../../src/types';

// Helper to create mock FileInfo
function createFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: 'src/index.ts',
    name: 'index.ts',
    type: 'file' as any,
    size: 1024,
    content: 'content',
    sha: 'abc123',
    extension: '.ts',
    ...overrides
  };
}

describe('FileFilter', () => {
  describe('Glob Pattern Matching', () => {
    it('should match files with * wildcard', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/util.ts' }),
        createFile({ path: 'tests/index.test.ts' })
      ];

      const filter = new FileFilter({ glob: 'src/*.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('src/index.ts');
      expect(result[1].path).toBe('src/util.ts');
    });

    it('should match files with ** recursive wildcard', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/utils/helper.ts' }),
        createFile({ path: 'src/utils/deep/nested.ts' }),
        createFile({ path: 'tests/index.test.ts' })
      ];

      const filter = new FileFilter({ glob: 'src/**/*.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(3);
      expect(result.some(f => f.path === 'src/index.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/utils/helper.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/utils/deep/nested.ts')).toBe(true);
    });

    it('should match files with ? single character wildcard', async () => {
      const files = [
        createFile({ path: 'file1.ts' }),
        createFile({ path: 'file2.ts' }),
        createFile({ path: 'file10.ts' })
      ];

      const filter = new FileFilter({ glob: 'file?.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'file1.ts')).toBe(true);
      expect(result.some(f => f.path === 'file2.ts')).toBe(true);
    });

    it('should support multiple glob patterns', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'tests/index.test.ts' }),
        createFile({ path: 'docs/README.md' })
      ];

      const filter = new FileFilter({ glob: ['src/**/*.ts', '**/*.md'] });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/index.ts')).toBe(true);
      expect(result.some(f => f.path === 'docs/README.md')).toBe(true);
    });

    it('should match exact paths', async () => {
      const files = [
        createFile({ path: 'package.json' }),
        createFile({ path: 'src/package.json' })
      ];

      const filter = new FileFilter({ glob: 'package.json' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('package.json');
    });
  });

  describe('Regex Pattern Matching', () => {
    it('should match files with regex', async () => {
      const files = [
        createFile({ path: 'src/UserService.ts' }),
        createFile({ path: 'src/PostService.ts' }),
        createFile({ path: 'src/utils.ts' })
      ];

      const filter = new FileFilter({ regex: /Service\.ts$/ });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/UserService.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/PostService.ts')).toBe(true);
    });

    it('should support multiple regex patterns', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/index.test.ts' }),
        createFile({ path: 'src/index.spec.ts' }),
        createFile({ path: 'src/utils.ts' })
      ];

      const filter = new FileFilter({ regex: [/\.test\.ts$/, /\.spec\.ts$/] });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/index.test.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/index.spec.ts')).toBe(true);
    });

    it('should match case-insensitive patterns', async () => {
      const files = [
        createFile({ path: 'README.md' }),
        createFile({ path: 'readme.MD' }),
        createFile({ path: 'index.ts' })
      ];

      const filter = new FileFilter({ regex: /readme\.md$/i });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
    });
  });

  describe('Extension Filtering', () => {
    it('should filter by single extension', async () => {
      const files = [
        createFile({ path: 'index.ts', extension: '.ts' }),
        createFile({ path: 'index.js', extension: '.js' }),
        createFile({ path: 'README.md', extension: '.md' })
      ];

      const filter = new FileFilter({ extensions: '.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('index.ts');
    });

    it('should filter by multiple extensions', async () => {
      const files = [
        createFile({ path: 'index.ts', extension: '.ts' }),
        createFile({ path: 'index.tsx', extension: '.tsx' }),
        createFile({ path: 'index.js', extension: '.js' }),
        createFile({ path: 'README.md', extension: '.md' })
      ];

      const filter = new FileFilter({ extensions: ['.ts', '.tsx'] });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'index.ts')).toBe(true);
      expect(result.some(f => f.path === 'index.tsx')).toBe(true);
    });

    it('should exclude files without extensions', async () => {
      const files = [
        createFile({ path: 'index.ts', extension: '.ts' }),
        createFile({ path: 'Makefile', extension: null })
      ];

      const filter = new FileFilter({ extensions: '.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('index.ts');
    });
  });

  describe('Directory Scoping', () => {
    it('should filter by single directory', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/utils.ts' }),
        createFile({ path: 'tests/index.test.ts' }),
        createFile({ path: 'docs/README.md' })
      ];

      const filter = new FileFilter({ directories: 'src' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.path.startsWith('src/'))).toBe(true);
    });

    it('should filter by multiple directories', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'tests/index.test.ts' }),
        createFile({ path: 'docs/README.md' })
      ];

      const filter = new FileFilter({ directories: ['src', 'tests'] });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/index.ts')).toBe(true);
      expect(result.some(f => f.path === 'tests/index.test.ts')).toBe(true);
    });

    it('should handle nested directories', async () => {
      const files = [
        createFile({ path: 'src/utils/helper.ts' }),
        createFile({ path: 'src/utils/deep/nested.ts' }),
        createFile({ path: 'src/index.ts' })
      ];

      const filter = new FileFilter({ directories: 'src/utils' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.path.startsWith('src/utils/'))).toBe(true);
    });

    it('should match exact directory path', async () => {
      const files = [
        createFile({ path: 'src' }),
        createFile({ path: 'src/index.ts' })
      ];

      const filter = new FileFilter({ directories: 'src' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
    });
  });

  describe('Exclude Patterns', () => {
    it('should exclude files matching glob pattern', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/index.test.ts' }),
        createFile({ path: 'src/utils.ts' })
      ];

      const filter = new FileFilter({ exclude: '**/*.test.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => !f.path.includes('.test.ts'))).toBe(true);
    });

    it('should exclude multiple patterns', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/index.test.ts' }),
        createFile({ path: 'src/index.spec.ts' }),
        createFile({ path: 'build/output.js' })
      ];

      const filter = new FileFilter({ exclude: ['**/*.test.ts', '**/*.spec.ts', 'build/**'] });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/index.ts');
    });

    it('should exclude node_modules', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'node_modules/package/index.js' }),
        createFile({ path: 'node_modules/package/deep/file.js' })
      ];

      const filter = new FileFilter({ exclude: 'node_modules/**' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/index.ts');
    });
  });

  describe('File Type Filtering', () => {
    it('should filter files only', async () => {
      const files = [
        createFile({ path: 'src/index.ts', type: 'file' as any }),
        createFile({ path: 'src', type: 'directory' as any }),
        createFile({ path: 'link', type: 'symlink' as any })
      ];

      const filter = new FileFilter({ filesOnly: true });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('file');
    });

    it('should filter directories only', async () => {
      const files = [
        createFile({ path: 'src/index.ts', type: 'file' as any }),
        createFile({ path: 'src', type: 'directory' as any }),
        createFile({ path: 'tests', type: 'directory' as any })
      ];

      const filter = new FileFilter({ directoriesOnly: true });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.type === 'directory')).toBe(true);
    });
  });

  describe('Size Filtering', () => {
    it('should filter by minimum size', async () => {
      const files = [
        createFile({ path: 'small.ts', size: 100 }),
        createFile({ path: 'medium.ts', size: 1000 }),
        createFile({ path: 'large.ts', size: 10000 })
      ];

      const filter = new FileFilter({ minSize: 500 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.size && f.size >= 500)).toBe(true);
    });

    it('should filter by maximum size', async () => {
      const files = [
        createFile({ path: 'small.ts', size: 100 }),
        createFile({ path: 'medium.ts', size: 1000 }),
        createFile({ path: 'large.ts', size: 10000 })
      ];

      const filter = new FileFilter({ maxSize: 5000 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.size && f.size <= 5000)).toBe(true);
    });

    it('should filter by size range', async () => {
      const files = [
        createFile({ path: 'small.ts', size: 100 }),
        createFile({ path: 'medium.ts', size: 1000 }),
        createFile({ path: 'large.ts', size: 10000 })
      ];

      const filter = new FileFilter({ minSize: 500, maxSize: 5000 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('medium.ts');
    });

    it('should not filter directories by size', async () => {
      const files = [
        createFile({ path: 'dir', type: 'directory' as any, size: null }),
        createFile({ path: 'file.ts', type: 'file' as any, size: 100 })
      ];

      const filter = new FileFilter({ minSize: 500 });
      const result = await filter.apply(files);

      expect(result.some(f => f.path === 'dir')).toBe(true);
    });
  });

  describe('Depth Filtering', () => {
    it('should filter by maximum depth', async () => {
      const files = [
        createFile({ path: 'file.ts' }),                    // depth 0
        createFile({ path: 'src/index.ts' }),              // depth 1
        createFile({ path: 'src/utils/helper.ts' }),       // depth 2
        createFile({ path: 'src/utils/deep/nested.ts' })   // depth 3
      ];

      const filter = new FileFilter({ maxDepth: 1 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'file.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/index.ts')).toBe(true);
    });

    it('should include root level files with maxDepth 0', async () => {
      const files = [
        createFile({ path: 'README.md' }),
        createFile({ path: 'src/index.ts' })
      ];

      const filter = new FileFilter({ maxDepth: 0 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('README.md');
    });
  });

  describe('Predicate Filters', () => {
    it('should filter with custom predicate', async () => {
      const files = [
        createFile({ path: 'UserService.ts' }),
        createFile({ path: 'PostService.ts' }),
        createFile({ path: 'utils.ts' })
      ];

      const filter = new FileFilter({
        predicate: (file: FileInfo) => file.path.includes('Service')
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.path.includes('Service'))).toBe(true);
    });

    it('should support async predicates', async () => {
      const files = [
        createFile({ path: 'file1.ts', size: 100 }),
        createFile({ path: 'file2.ts', size: 200 })
      ];

      const filter = new FileFilter({
        predicate: async (file: FileInfo) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return (file.size ?? 0) > 150;
        }
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('file2.ts');
    });

    it('should support multiple predicates', async () => {
      const files = [
        createFile({ path: 'UserService.ts', size: 100 }),
        createFile({ path: 'PostService.ts', size: 200 }),
        createFile({ path: 'utils.ts', size: 300 })
      ];

      const filter = new FileFilter({
        predicate: [
          (file: FileInfo) => file.path.includes('Service'),
          (file: FileInfo) => (file.size ?? 0) > 150
        ]
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('PostService.ts');
    });
  });

  describe('Filter Composition', () => {
    it('should combine glob and extension filters', async () => {
      const files = [
        createFile({ path: 'src/index.ts', extension: '.ts' }),
        createFile({ path: 'src/index.js', extension: '.js' }),
        createFile({ path: 'tests/index.ts', extension: '.ts' })
      ];

      const filter = new FileFilter({
        glob: 'src/**',
        extensions: '.ts'
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('src/index.ts');
    });

    it('should combine directory and exclude filters', async () => {
      const files = [
        createFile({ path: 'src/index.ts' }),
        createFile({ path: 'src/index.test.ts' }),
        createFile({ path: 'src/utils.ts' }),
        createFile({ path: 'tests/index.ts' })
      ];

      const filter = new FileFilter({
        directories: 'src',
        exclude: '**/*.test.ts'
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/index.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/utils.ts')).toBe(true);
    });

    it('should apply all filters in correct order', async () => {
      const files = [
        createFile({ path: 'src/UserService.ts', extension: '.ts', size: 1000, type: 'file' as any }),
        createFile({ path: 'src/UserService.test.ts', extension: '.ts', size: 500, type: 'file' as any }),
        createFile({ path: 'src/PostService.ts', extension: '.ts', size: 2000, type: 'file' as any }),
        createFile({ path: 'src/utils.ts', extension: '.ts', size: 500, type: 'file' as any }),
        createFile({ path: 'tests/index.ts', extension: '.ts', size: 1000, type: 'file' as any })
      ];

      const filter = new FileFilter({
        directories: 'src',
        extensions: '.ts',
        exclude: '**/*.test.ts',
        minSize: 800,
        predicate: (file: FileInfo) => file.path.includes('Service')
      });
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
      expect(result.some(f => f.path === 'src/UserService.ts')).toBe(true);
      expect(result.some(f => f.path === 'src/PostService.ts')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file list', async () => {
      const filter = new FileFilter({ glob: '**/*.ts' });
      const result = await filter.apply([]);

      expect(result).toHaveLength(0);
    });

    it('should handle filters with no matches', async () => {
      const files = [
        createFile({ path: 'index.js', extension: '.js' })
      ];

      const filter = new FileFilter({ extensions: '.ts' });
      const result = await filter.apply(files);

      expect(result).toHaveLength(0);
    });

    it('should handle files with missing properties', async () => {
      const files = [
        createFile({ extension: null, size: null })
      ];

      const filter = new FileFilter({ extensions: '.ts', minSize: 100 });
      const result = await filter.apply(files);

      expect(result).toHaveLength(0);
    });

    it('should handle no filters (pass-through)', async () => {
      const files = [
        createFile({ path: 'file1.ts' }),
        createFile({ path: 'file2.js' })
      ];

      const filter = new FileFilter({});
      const result = await filter.apply(files);

      expect(result).toHaveLength(2);
    });
  });
});
