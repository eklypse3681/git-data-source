/**
 * Core type definitions for Git Data Source library
 *
 * This module defines the fundamental interfaces and types used throughout
 * the library, including provider configurations, file metadata, and API options.
 */

import type { GitHubProviderOptions, LocalProviderOptions } from './providers';

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Discriminated union for provider configuration
 * Enables type-safe provider selection and configuration
 */
export type ProviderConfig =
  | { type: 'github'; options: GitHubProviderOptions }
  | { type: 'local'; options: LocalProviderOptions }
  | { type: 'gitlab'; options: unknown } // Future provider
  | { type: 'bitbucket'; options: unknown }; // Future provider

/**
 * Main configuration options for GitDataSource
 */
export interface GitDataSourceOptions {
  /** Provider configuration (GitHub, Local, etc.) */
  provider: ProviderConfig;

  /** Default reference (branch/tag) to use if not specified in queries */
  defaultRef?: string;

  /** Cache configuration */
  cache?: CacheOptions;

  /** Global timeout for operations (milliseconds) */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// File and Tree Structures
// ============================================================================

/**
 * File type enumeration
 */
export enum FileType {
  File = 'file',
  Directory = 'directory',
  Symlink = 'symlink',
  Submodule = 'submodule'
}

/**
 * File metadata and contents
 * Represents a single file in the repository
 */
export interface FileInfo {
  /** Full path relative to repository root */
  path: string;

  /** File name (last segment of path) */
  name: string;

  /** File type */
  type: FileType;

  /** File size in bytes (null for directories) */
  size: number | null;

  /** File contents as UTF-8 string (null for directories, binary files) */
  content: string | null;

  /** SHA/hash of the file */
  sha: string;

  /** File extension (e.g., '.ts', '.md') */
  extension: string | null;

  /** MIME type if determinable */
  mimeType?: string;

  /** Last commit that modified this file */
  lastCommit?: CommitInfo;

  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Commit information
 */
export interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  committer?: {
    name: string;
    email: string;
    date: Date;
  };
}

/**
 * Tree node for hierarchical file structure
 * Used by .toTree() enumeration method
 */
export interface TreeNode {
  /** File information for this node */
  file: FileInfo;

  /** Child nodes (for directories) */
  children: TreeNode[];

  /** Parent node reference */
  parent: TreeNode | null;

  /** Depth level in tree (0 = root) */
  level: number;
}

// ============================================================================
// Reference Types (Branches, Tags)
// ============================================================================

/**
 * Git reference information
 */
export interface GitReference {
  /** Reference name (e.g., 'main', 'v1.0.0') */
  name: string;

  /** Reference type */
  type: 'branch' | 'tag';

  /** Commit SHA this reference points to */
  sha: string;

  /** Is this the default branch? */
  isDefault?: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Predicate function for custom filtering
 */
export type FilePredicate = (file: FileInfo) => boolean | Promise<boolean>;

/**
 * Filter options for file queries
 * All filters are applied as AND conditions
 */
export interface FilterOptions {
  /** Glob patterns (e.g., `**\/*.ts`, `src/**`) */
  glob?: string | string[];

  /** Regular expression patterns */
  regex?: RegExp | RegExp[];

  /** Custom predicate functions */
  predicate?: FilePredicate | FilePredicate[];

  /** Paths/patterns to exclude */
  exclude?: string | string[];

  /** Filter by file extensions (e.g., '.ts', '.md') */
  extensions?: string | string[];

  /** Filter by directory path */
  directories?: string | string[];

  /** Include only files (exclude directories) */
  filesOnly?: boolean;

  /** Include only directories */
  directoriesOnly?: boolean;

  /** Maximum depth for directory traversal */
  maxDepth?: number;

  /** Minimum file size in bytes */
  minSize?: number;

  /** Maximum file size in bytes */
  maxSize?: number;

  /** Filter by last modified date */
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Cache strategy enumeration
 */
export enum CacheStrategy {
  /** No caching */
  None = 'none',

  /** Cache in memory */
  Memory = 'memory',

  /** Cache to filesystem */
  Filesystem = 'filesystem',

  /** Custom cache implementation */
  Custom = 'custom'
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Cache strategy to use */
  strategy: CacheStrategy;

  /** Time-to-live in milliseconds */
  ttl?: number;

  /** Maximum cache size (number of entries) */
  maxSize?: number;

  /** Cache key prefix */
  keyPrefix?: string;

  /** Custom cache implementation */
  customCache?: CacheProvider;
}

/**
 * Cache provider interface for custom implementations
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error handling strategy
 */
export enum ErrorHandlingStrategy {
  /** Throw errors (default) */
  Throw = 'throw',

  /** Return null on errors */
  ReturnNull = 'null',

  /** Return empty array/iterator on errors */
  ReturnEmpty = 'empty',

  /** Use custom error handler */
  Custom = 'custom'
}

/**
 * Custom error handler function
 */
export type ErrorHandler = (error: Error) => void | Promise<void>;

/**
 * Git Data Source specific errors
 */
export class GitDataSourceError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GitDataSourceError';
  }
}

export class ProviderError extends GitDataSourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'PROVIDER_ERROR', cause);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends GitDataSourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_ERROR', cause);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends GitDataSourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'NOT_FOUND', cause);
    this.name = 'NotFoundError';
  }
}

export class CacheError extends GitDataSourceError {
  constructor(message: string, cause?: Error) {
    super(message, 'CACHE_ERROR', cause);
    this.name = 'CacheError';
  }
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Result wrapper for error handling strategies
 */
export type QueryResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Async iterable result for streaming file access
 */
export interface AsyncIterableResult<T> extends AsyncIterable<T> {
  /** Convert to array (materializes all results) */
  toArray(): Promise<T[]>;

  /** Convert to tree structure */
  toTree(): Promise<TreeNode[]>;

  /** Get count without materializing */
  count(): Promise<number>;

  /** Check if any results exist */
  any(): Promise<boolean>;

  /** Get first result or null */
  first(): Promise<T | null>;

  /** Apply additional filtering */
  filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterableResult<T>;

  /** Transform results */
  map<U>(transform: (item: T) => U | Promise<U>): AsyncIterableResult<U>;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Abstract provider interface
 * All provider implementations must conform to this interface
 */
export interface Provider {
  /** Provider type identifier */
  readonly type: string;

  /** Initialize the provider */
  initialize(): Promise<void>;

  /** List all references (branches/tags) */
  listReferences(): Promise<GitReference[]>;

  /** Get a specific reference */
  getReference(name: string): Promise<GitReference | null>;

  /** List files at a specific reference */
  listFiles(ref: string, path?: string): Promise<FileInfo[]>;

  /** Get a single file */
  getFile(ref: string, path: string): Promise<FileInfo | null>;

  /** Get file content only (optimized) */
  getFileContent(ref: string, path: string): Promise<string | null>;

  /** Check if path exists */
  exists(ref: string, path: string): Promise<boolean>;

  /** Get commit information */
  getCommit(sha: string): Promise<CommitInfo | null>;

  /** Cleanup resources */
  dispose(): Promise<void>;
}

// ============================================================================
// Fluent API Builder Interface
// ============================================================================

/**
 * Main fluent query builder interface
 * Enables method chaining for elegant API usage
 */
export interface GitDataSourceQuery {
  /** Specify the reference (branch/tag) to query */
  ref(reference: string): this;

  /** Specify the path to start from */
  path(path: string): this;

  /** Apply glob pattern filter */
  glob(pattern: string | string[]): this;

  /** Apply regex filter */
  regex(pattern: RegExp | RegExp[]): this;

  /** Apply custom predicate filter */
  filter(predicate: FilePredicate): this;

  /** Exclude paths/patterns */
  exclude(pattern: string | string[]): this;

  /** Filter by file extension */
  extension(ext: string | string[]): this;

  /** Filter by directory */
  directory(dir: string | string[]): this;

  /** Include only files */
  filesOnly(): this;

  /** Include only directories */
  directoriesOnly(): this;

  /** Set maximum depth */
  maxDepth(depth: number): this;

  /** Invalidate cache for this query */
  fresh(): this;

  /** Explicitly use cache */
  cached(): this;

  /** Set error handling to return null on errors */
  orNull(): this;

  /** Set error handling to throw errors (default) */
  orThrow(): this;

  /** Set custom error handler */
  onError(handler: ErrorHandler): this;

  /** Execute query and return array */
  toArray(): Promise<FileInfo[]>;

  /** Execute query and return tree structure */
  toTree(): Promise<TreeNode[]>;

  /** Execute query and return async iterator */
  [Symbol.asyncIterator](): AsyncIterator<FileInfo>;

  /** Get count of matching files */
  count(): Promise<number>;

  /** Check if any files match */
  any(): Promise<boolean>;

  /** Get first matching file */
  first(): Promise<FileInfo | null>;
}
