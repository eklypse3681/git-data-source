/**
 * File Filter Implementation
 *
 * This module implements the filtering logic for file queries.
 * Handles glob patterns, regex, predicates, and various file attribute filters.
 */

import { minimatch } from 'minimatch';
import type { FileInfo, FilterOptions, FilePredicate } from '../types';
import { FileType } from '../types';

/**
 * Internal filter function type
 */
type FilterFn = (file: FileInfo) => boolean | Promise<boolean>;

/**
 * File filter class with fluent builder pattern
 * Supports glob, regex, predicates, size, extension, and directory filtering
 * Enables composable filters with efficient early termination
 */
export class FileFilter {
  private filters: FilterFn[] = [];
  private excludeFilters: FilterFn[] = [];
  private globPatterns: string[] = [];
  private regexPatterns: RegExp[] = [];

  /**
   * Constructor - optionally accepts filter options
   */
  constructor(options?: FilterOptions) {
    if (options) {
      // Apply options directly without creating new instance
      this.applyOptions(options);
    }
  }

  /**
   * Apply filter options to this instance
   */
  private applyOptions(options: FilterOptions): void {
    // Add glob filters (OR logic for multiple patterns)
    if (options.glob) {
      const patterns = Array.isArray(options.glob) ? options.glob : [options.glob];
      this.globPatterns.push(...patterns);
    }

    // Add regex filters (OR logic for multiple patterns)
    if (options.regex) {
      const regexes = Array.isArray(options.regex) ? options.regex : [options.regex];
      this.regexPatterns.push(...regexes);
    }

    // Add predicate filters (AND logic)
    if (options.predicate) {
      const predicates = Array.isArray(options.predicate) ? options.predicate : [options.predicate];
      predicates.forEach(pred => this.predicate(pred));
    }

    // Add exclude patterns
    if (options.exclude) {
      const patterns = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
      patterns.forEach(pattern => this.exclude(pattern));
    }

    // Add extension filter
    if (options.extensions) {
      const exts = Array.isArray(options.extensions) ? options.extensions : [options.extensions];
      this.ext(...exts);
    }

    // Add directory filter (OR logic for multiple directories)
    if (options.directories) {
      const dirs = Array.isArray(options.directories) ? options.directories : [options.directories];
      if (dirs.length > 0) {
        this.filters.push(file => {
          return dirs.some(directory => {
            const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;
            return file.path.startsWith(normalizedDir) || file.path === directory;
          });
        });
      }
    }

    // Add file/directory type filters
    if (options.filesOnly) {
      this.filesOnly();
    }
    if (options.directoriesOnly) {
      this.directoriesOnly();
    }

    // Add size filters
    if (options.minSize !== undefined || options.maxSize !== undefined) {
      this.size(options.minSize, options.maxSize);
    }

    // Add depth filter
    if (options.maxDepth !== undefined) {
      this.maxDepth(options.maxDepth);
    }

    // Add date filters
    if (options.modifiedAfter || options.modifiedBefore) {
      this.modifiedBetween(options.modifiedAfter, options.modifiedBefore);
    }
  }

  /**
   * Create a filter from options object
   */
  static fromOptions(options: FilterOptions): FileFilter {
    return new FileFilter(options);
  }

  /**
   * Add glob pattern filter
   * Multiple glob patterns are combined with OR logic
   * @param pattern - Glob pattern (e.g., '**\/*.ts', 'src/**')
   */
  glob(pattern: string): this {
    this.globPatterns.push(pattern);
    return this;
  }

  /**
   * Add regex pattern filter
   * Multiple regex patterns are combined with OR logic
   * @param pattern - Regular expression
   */
  regex(pattern: RegExp): this {
    this.regexPatterns.push(pattern);
    return this;
  }

  /**
   * Add custom predicate filter
   * @param fn - Predicate function (sync or async)
   */
  predicate(fn: FilePredicate): this {
    this.filters.push(fn);
    return this;
  }

  /**
   * Add exclude pattern (inverse matching)
   * Supports both glob patterns and regex
   * @param pattern - Glob pattern or regex to exclude
   */
  exclude(pattern: string | RegExp): this {
    if (typeof pattern === 'string') {
      this.excludeFilters.push(file => minimatch(file.path, pattern, { dot: true }));
    } else {
      this.excludeFilters.push(file => pattern.test(file.path));
    }
    return this;
  }

  /**
   * Filter by file extensions
   * @param extensions - Extensions with or without leading dot (e.g., '.ts', 'tsx')
   */
  ext(...extensions: string[]): this {
    const normalized = extensions.map(ext => ext.startsWith('.') ? ext : `.${ext}`);
    this.filters.push(file => {
      if (!file.extension) return false;
      return normalized.includes(file.extension);
    });
    return this;
  }

  /**
   * Scope to specific directory
   * Only files within this path will match
   * @param directory - Directory path
   */
  in(directory: string): this {
    const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;
    this.filters.push(file =>
      file.path.startsWith(normalizedDir) || file.path === directory
    );
    return this;
  }

  /**
   * Filter to only files (exclude directories)
   */
  filesOnly(): this {
    this.filters.push(file => file.type === FileType.File);
    return this;
  }

  /**
   * Filter to only directories (exclude files)
   */
  directoriesOnly(): this {
    this.filters.push(file => file.type === FileType.Directory);
    return this;
  }

  /**
   * Filter by file size
   * @param minSize - Minimum size in bytes (inclusive)
   * @param maxSize - Maximum size in bytes (inclusive)
   */
  size(minSize?: number, maxSize?: number): this {
    this.filters.push(file => {
      if (file.size === null) return true; // Don't filter directories
      if (minSize !== undefined && file.size < minSize) return false;
      if (maxSize !== undefined && file.size > maxSize) return false;
      return true;
    });
    return this;
  }

  /**
   * Filter by maximum directory depth
   * @param depth - Maximum depth (0 = root level only)
   */
  maxDepth(depth: number): this {
    this.filters.push(file => {
      const fileDepth = file.path.split('/').length - 1;
      return fileDepth <= depth;
    });
    return this;
  }

  /**
   * Filter by modification date range
   * @param after - Modified after this date (inclusive)
   * @param before - Modified before this date (inclusive)
   */
  modifiedBetween(after?: Date, before?: Date): this {
    this.filters.push(file => {
      if (!file.lastCommit) return true; // Don't filter files without commit info
      const modifiedDate = file.lastCommit.author.date;
      if (after && modifiedDate < after) return false;
      if (before && modifiedDate > before) return false;
      return true;
    });
    return this;
  }

  /**
   * Apply all filters to file array
   * Filters are applied with AND logic (all must pass)
   * Uses early termination for efficiency
   * @param files - Array of files to filter
   */
  async apply(files: FileInfo[]): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (const file of files) {
      if (await this.matches(file)) {
        results.push(file);
      }
    }

    return results;
  }

  /**
   * Apply filters to async iterable stream
   * Efficient streaming with early termination
   * @param files - Async iterable of files
   */
  async *applyStream(files: AsyncIterable<FileInfo>): AsyncIterable<FileInfo> {
    for await (const file of files) {
      if (await this.matches(file)) {
        yield file;
      }
    }
  }

  /**
   * Check if a single file matches all filters
   * @param file - File to check
   */
  async matches(file: FileInfo): Promise<boolean> {
    // Early termination: check exclude filters first
    for (const excludeFilter of this.excludeFilters) {
      const result = await excludeFilter(file);
      if (result) return false; // Excluded
    }

    // Check glob patterns (OR logic - match ANY pattern)
    if (this.globPatterns.length > 0) {
      const matchesGlob = this.globPatterns.some(pattern =>
        minimatch(file.path, pattern, { dot: true })
      );
      if (!matchesGlob) return false;
    }

    // Check regex patterns (OR logic - match ANY pattern)
    if (this.regexPatterns.length > 0) {
      const matchesRegex = this.regexPatterns.some(pattern =>
        pattern.test(file.path)
      );
      if (!matchesRegex) return false;
    }

    // Check all include filters (AND logic)
    for (const filter of this.filters) {
      const result = await filter(file);
      if (!result) return false; // Failed a filter
    }

    return true; // Passed all filters
  }

  /**
   * Combine this filter with another using AND logic
   * @param other - Another filter to combine
   */
  and(other: FileFilter): FileFilter {
    const combined = new FileFilter();
    combined.filters = [...this.filters, ...other.filters];
    combined.excludeFilters = [...this.excludeFilters, ...other.excludeFilters];
    combined.globPatterns = [...this.globPatterns, ...other.globPatterns];
    combined.regexPatterns = [...this.regexPatterns, ...other.regexPatterns];
    return combined;
  }

  /**
   * Combine this filter with another using OR logic
   * @param other - Another filter to combine
   */
  or(other: FileFilter): FileFilter {
    const combined = new FileFilter();
    combined.filters = [
      async (file: FileInfo) => {
        const thisMatches = await this.matches(file);
        if (thisMatches) return true;
        return await other.matches(file);
      }
    ];
    return combined;
  }

  /**
   * Negate this filter
   * Returns files that DON'T match the current filters
   */
  not(): FileFilter {
    const negated = new FileFilter();
    negated.filters = [
      async (file: FileInfo) => {
        return !(await this.matches(file));
      }
    ];
    return negated;
  }

  /**
   * Get the number of filters registered
   */
  get filterCount(): number {
    return this.filters.length + this.excludeFilters.length;
  }
}

/**
 * Builder helper functions for common filter patterns
 */
export const FilterBuilder = {
  /**
   * Create filter for TypeScript files
   */
  typescript(): FileFilter {
    return new FileFilter().ext('.ts', '.tsx');
  },

  /**
   * Create filter for JavaScript files
   */
  javascript(): FileFilter {
    return new FileFilter().ext('.js', '.jsx', '.mjs', '.cjs');
  },

  /**
   * Create filter for source code files
   */
  sourceCode(): FileFilter {
    return new FileFilter().ext('.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp');
  },

  /**
   * Create filter for markdown documentation
   */
  markdown(): FileFilter {
    return new FileFilter().ext('.md', '.mdx');
  },

  /**
   * Create filter for config files
   */
  config(): FileFilter {
    return new FileFilter().glob('**/*.{json,yaml,yml,toml,ini,conf,config}');
  },

  /**
   * Create filter excluding common ignore patterns
   */
  ignoreCommon(): FileFilter {
    return new FileFilter()
      .exclude('**/node_modules/**')
      .exclude('**/dist/**')
      .exclude('**/build/**')
      .exclude('**/.git/**')
      .exclude('**/.next/**')
      .exclude('**/coverage/**');
  },

  /**
   * Create filter for small files only
   * @param maxSizeKb - Maximum size in kilobytes
   */
  small(maxSizeKb: number = 100): FileFilter {
    return new FileFilter().size(undefined, maxSizeKb * 1024);
  },

  /**
   * Create filter for recently modified files
   * @param daysAgo - Number of days to look back
   */
  recent(daysAgo: number = 7): FileFilter {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return new FileFilter().modifiedBetween(date, undefined);
  }
};
