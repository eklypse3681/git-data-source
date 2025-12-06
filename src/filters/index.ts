/**
 * File filters module
 *
 * Provides filtering utilities for file queries including:
 * - Glob pattern matching
 * - Regex pattern matching
 * - Custom predicate functions
 * - Extension filtering
 * - Directory scoping
 * - Size and date filtering
 * - Composable filter combinations
 *
 * @example
 * ```typescript
 * import { FileFilter, FilterBuilder } from './filters';
 *
 * // Using builder pattern
 * const filter = new FileFilter()
 *   .glob('src/**\/*.ts')
 *   .exclude('**\/*.test.ts')
 *   .size(undefined, 1024 * 100) // Max 100KB
 *   .filesOnly();
 *
 * const filtered = await filter.apply(files);
 *
 * // Using helpers
 * const tsFiles = FilterBuilder.typescript()
 *   .and(FilterBuilder.ignoreCommon());
 *
 * // Streaming
 * for await (const file of filter.applyStream(fileStream)) {
 *   console.log(file.path);
 * }
 * ```
 */

import { FileFilter as FileFilterClass, FilterBuilder as FilterBuilderExport } from './file-filter';
import type { FilterOptions } from '../types';

export { FileFilterClass as FileFilter, FilterBuilderExport as FilterBuilder };
export type { FilterOptions, FilePredicate } from '../types';

/**
 * Utility function to create a filter from options
 * @param options - Filter configuration options
 */
export function createFilter(options: FilterOptions): FileFilterClass {
  return FileFilterClass.fromOptions(options);
}

/**
 * Utility function to create a glob filter
 * @param pattern - Glob pattern
 */
export function glob(pattern: string): FileFilterClass {
  return new FileFilterClass().glob(pattern);
}

/**
 * Utility function to create a regex filter
 * @param pattern - Regular expression
 */
export function regex(pattern: RegExp): FileFilterClass {
  return new FileFilterClass().regex(pattern);
}

/**
 * Utility function to create an extension filter
 * @param extensions - File extensions
 */
export function ext(...extensions: string[]): FileFilterClass {
  return new FileFilterClass().ext(...extensions);
}

/**
 * Utility function to create a directory scope filter
 * @param directory - Directory path
 */
export function inDirectory(directory: string): FileFilterClass {
  return new FileFilterClass().in(directory);
}

/**
 * Utility function to create a files-only filter
 */
export function filesOnly(): FileFilterClass {
  return new FileFilterClass().filesOnly();
}

/**
 * Utility function to create a directories-only filter
 */
export function directoriesOnly(): FileFilterClass {
  return new FileFilterClass().directoriesOnly();
}

/**
 * Utility function to create a size filter
 * @param minSize - Minimum size in bytes
 * @param maxSize - Maximum size in bytes
 */
export function size(minSize?: number, maxSize?: number): FileFilterClass {
  return new FileFilterClass().size(minSize, maxSize);
}

/**
 * Utility function to exclude patterns
 * @param pattern - Pattern to exclude (glob or regex)
 */
export function exclude(pattern: string | RegExp): FileFilterClass {
  return new FileFilterClass().exclude(pattern);
}

/**
 * Combine multiple filters with AND logic
 * @param filters - Filters to combine
 */
export function and(...filters: FileFilterClass[]): FileFilterClass {
  if (filters.length === 0) {
    return new FileFilterClass();
  }
  return filters.reduce((acc, filter) => acc.and(filter));
}

/**
 * Combine multiple filters with OR logic
 * @param filters - Filters to combine
 */
export function or(...filters: FileFilterClass[]): FileFilterClass {
  if (filters.length === 0) {
    return new FileFilterClass();
  }
  return filters.reduce((acc, filter) => acc.or(filter));
}
