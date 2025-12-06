/**
 * Fluent Query Builder Implementation
 *
 * This module implements the fluent/chainable API for querying Git data sources.
 * It handles filter composition, caching, error handling, and result enumeration.
 */

import type {
  GitDataSourceQuery,
  FileInfo,
  TreeNode,
  FilterOptions,
  FilePredicate,
  ErrorHandler,
  Provider
} from '../types';
import { ErrorHandlingStrategy } from '../types';
import { FileFilter } from '../filters/file-filter';
import { TreeBuilder } from '../utils/tree-builder';

/**
 * Query builder implementation
 * Provides fluent API for building and executing file queries
 */
export class QueryBuilder implements GitDataSourceQuery {
  private filterOptions: FilterOptions = {};
  private currentRef: string;
  private currentPath = '';
  private errorStrategy: ErrorHandlingStrategy = ErrorHandlingStrategy.Throw;
  private customErrorHandler?: ErrorHandler;

  constructor(
    private readonly provider: Provider,
    defaultRef: string
  ) {
    this.currentRef = defaultRef;
  }

  // ============================================================================
  // Reference and Path Selection
  // ============================================================================

  ref(reference: string): this {
    this.currentRef = reference;
    return this;
  }

  path(path: string): this {
    this.currentPath = path;
    return this;
  }

  // ============================================================================
  // Filter Methods
  // ============================================================================

  glob(pattern: string | string[]): this {
    this.filterOptions.glob = Array.isArray(pattern)
      ? [...(this.filterOptions.glob ? [this.filterOptions.glob].flat() : []), ...pattern]
      : [...(this.filterOptions.glob ? [this.filterOptions.glob].flat() : []), pattern];
    return this;
  }

  regex(pattern: RegExp | RegExp[]): this {
    this.filterOptions.regex = Array.isArray(pattern)
      ? [...(this.filterOptions.regex ? [this.filterOptions.regex].flat() : []), ...pattern]
      : [...(this.filterOptions.regex ? [this.filterOptions.regex].flat() : []), pattern];
    return this;
  }

  filter(predicate: FilePredicate): this {
    const existing = this.filterOptions.predicate;
    this.filterOptions.predicate = existing
      ? Array.isArray(existing) ? [...existing, predicate] : [existing, predicate]
      : predicate;
    return this;
  }

  exclude(pattern: string | string[]): this {
    this.filterOptions.exclude = Array.isArray(pattern)
      ? [...(this.filterOptions.exclude ? [this.filterOptions.exclude].flat() : []), ...pattern]
      : [...(this.filterOptions.exclude ? [this.filterOptions.exclude].flat() : []), pattern];
    return this;
  }

  extension(ext: string | string[]): this {
    const extensions = Array.isArray(ext) ? ext : [ext];
    // Normalize extensions to start with '.'
    const normalized = extensions.map(e => e.startsWith('.') ? e : `.${e}`);

    this.filterOptions.extensions = [
      ...(this.filterOptions.extensions ? [this.filterOptions.extensions].flat() : []),
      ...normalized
    ];
    return this;
  }

  directory(dir: string | string[]): this {
    this.filterOptions.directories = Array.isArray(dir)
      ? [...(this.filterOptions.directories ? [this.filterOptions.directories].flat() : []), ...dir]
      : [...(this.filterOptions.directories ? [this.filterOptions.directories].flat() : []), dir];
    return this;
  }

  filesOnly(): this {
    this.filterOptions.filesOnly = true;
    this.filterOptions.directoriesOnly = false;
    return this;
  }

  directoriesOnly(): this {
    this.filterOptions.directoriesOnly = true;
    this.filterOptions.filesOnly = false;
    return this;
  }

  maxDepth(depth: number): this {
    this.filterOptions.maxDepth = depth;
    return this;
  }

  // ============================================================================
  // Cache Control
  // ============================================================================

  fresh(): this {
    // Fresh data - not currently implemented, placeholder for future
    return this;
  }

  cached(): this {
    // Cached data - default behavior, placeholder for future
    return this;
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  orNull(): this {
    this.errorStrategy = ErrorHandlingStrategy.ReturnNull;
    return this;
  }

  orThrow(): this {
    this.errorStrategy = ErrorHandlingStrategy.Throw;
    return this;
  }

  onError(handler: ErrorHandler): this {
    this.errorStrategy = ErrorHandlingStrategy.Custom;
    this.customErrorHandler = handler;
    return this;
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  async toArray(): Promise<FileInfo[]> {
    try {
      const files = await this.executeQuery();
      return files;
    } catch (error) {
      return this.handleError(error as Error, []) as Promise<FileInfo[]>;
    }
  }

  async toTree(): Promise<TreeNode[]> {
    try {
      const files = await this.executeQuery();
      return TreeBuilder.build(files);
    } catch (error) {
      return this.handleError(error as Error, []) as Promise<TreeNode[]>;
    }
  }

  async count(): Promise<number> {
    try {
      const files = await this.executeQuery();
      return files.length;
    } catch (error) {
      return this.handleError(error as Error, 0) as Promise<number>;
    }
  }

  async any(): Promise<boolean> {
    try {
      const files = await this.executeQuery();
      return files.length > 0;
    } catch (error) {
      return this.handleError(error as Error, false) as Promise<boolean>;
    }
  }

  async first(): Promise<FileInfo | null> {
    try {
      const files = await this.executeQuery();
      return files[0] ?? null;
    } catch (error) {
      return this.handleError(error as Error, null) as Promise<FileInfo | null>;
    }
  }

  // ============================================================================
  // Async Iterator
  // ============================================================================

  async *[Symbol.asyncIterator](): AsyncIterator<FileInfo> {
    try {
      const files = await this.executeQuery();
      for (const file of files) {
        yield file;
      }
    } catch (error) {
      await this.handleError(error as Error, null);
    }
  }

  // ============================================================================
  // Internal Query Execution
  // ============================================================================

  /**
   * Execute the query and return filtered results
   */
  private async executeQuery(): Promise<FileInfo[]> {
    // Get all files from provider
    const allFiles = await this.provider.listFiles(this.currentRef, this.currentPath);

    // Apply filters
    const filter = FileFilter.fromOptions(this.filterOptions);
    const filteredFiles = await filter.apply(allFiles);

    return filteredFiles;
  }

  /**
   * Handle errors based on strategy
   */
  private async handleError<T>(error: Error, defaultValue: T): Promise<T> {
    switch (this.errorStrategy) {
      case ErrorHandlingStrategy.ReturnNull:
        return defaultValue;

      case ErrorHandlingStrategy.Custom:
        if (this.customErrorHandler) {
          await this.customErrorHandler(error);
          return defaultValue;
        }
        throw error;

      case ErrorHandlingStrategy.Throw:
      default:
        throw error;
    }
  }
}
