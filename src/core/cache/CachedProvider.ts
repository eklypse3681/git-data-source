/**
 * CachedProvider - Decorator/wrapper that adds caching to any Provider
 *
 * Implements the Provider interface and delegates to an underlying provider,
 * caching results to improve performance for repeated operations.
 *
 * Features:
 * - Transparent caching for all provider operations
 * - Fresh option to bypass cache
 * - Automatic cache invalidation support
 * - Respects provider-specific identifiers
 */

import type {
  Provider,
  FileInfo,
  GitReference,
  CommitInfo
} from '../../types';
import { CacheManager, type CacheManagerOptions } from './CacheManager';
import { CacheKeyBuilder } from './CacheKeyBuilder';

/**
 * Options for cached provider operations
 */
export interface CachedOperationOptions {
  /** Bypass cache and fetch fresh data */
  fresh?: boolean;

  /** Custom TTL for this operation (overrides default) */
  ttl?: number;
}

/**
 * Provider wrapper that adds caching capabilities
 */
export class CachedProvider implements Provider {
  private cache: CacheManager;
  private providerIdentifier: string;

  constructor(
    private readonly provider: Provider,
    cache?: CacheManager,
    cacheOptions?: CacheManagerOptions
  ) {
    this.cache = cache ?? new CacheManager(cacheOptions);
    this.providerIdentifier = this.getProviderIdentifier();
  }

  get type(): string {
    return this.provider.type;
  }

  /**
   * Initialize the underlying provider
   */
  async initialize(): Promise<void> {
    await this.provider.initialize();
  }

  /**
   * List all references with caching
   */
  async listReferences(options?: CachedOperationOptions): Promise<GitReference[]> {
    const cacheKey = CacheKeyBuilder.forReferences(
      this.provider.type,
      this.providerIdentifier
    );

    if (options?.fresh) {
      const result = await this.provider.listReferences();
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.listReferences(),
      options?.ttl
    );
  }

  /**
   * Get a specific reference with caching
   */
  async getReference(
    name: string,
    options?: CachedOperationOptions
  ): Promise<GitReference | null> {
    const cacheKey = CacheKeyBuilder.forReference(
      this.provider.type,
      this.providerIdentifier,
      name
    );

    if (options?.fresh) {
      const result = await this.provider.getReference(name);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.getReference(name),
      options?.ttl
    );
  }

  /**
   * List files with caching
   */
  async listFiles(
    ref: string,
    path?: string,
    options?: CachedOperationOptions
  ): Promise<FileInfo[]> {
    const cacheKey = CacheKeyBuilder.forFiles(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );

    if (options?.fresh) {
      const result = await this.provider.listFiles(ref, path);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.listFiles(ref, path),
      options?.ttl
    );
  }

  /**
   * Get a single file with caching
   */
  async getFile(
    ref: string,
    path: string,
    options?: CachedOperationOptions
  ): Promise<FileInfo | null> {
    const cacheKey = CacheKeyBuilder.forFile(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );

    if (options?.fresh) {
      const result = await this.provider.getFile(ref, path);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.getFile(ref, path),
      options?.ttl
    );
  }

  /**
   * Get file content with caching
   */
  async getFileContent(
    ref: string,
    path: string,
    options?: CachedOperationOptions
  ): Promise<string | null> {
    const cacheKey = CacheKeyBuilder.forFileContent(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );

    if (options?.fresh) {
      const result = await this.provider.getFileContent(ref, path);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.getFileContent(ref, path),
      options?.ttl
    );
  }

  /**
   * Check if path exists with caching
   */
  async exists(
    ref: string,
    path: string,
    options?: CachedOperationOptions
  ): Promise<boolean> {
    const cacheKey = CacheKeyBuilder.forExists(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );

    if (options?.fresh) {
      const result = await this.provider.exists(ref, path);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.exists(ref, path),
      options?.ttl
    );
  }

  /**
   * Get commit information with caching
   */
  async getCommit(
    sha: string,
    options?: CachedOperationOptions
  ): Promise<CommitInfo | null> {
    const cacheKey = CacheKeyBuilder.forCommit(
      this.provider.type,
      this.providerIdentifier,
      sha
    );

    if (options?.fresh) {
      const result = await this.provider.getCommit(sha);
      this.cache.set(cacheKey, result, options.ttl);
      return result;
    }

    return this.cache.getOrSet(
      cacheKey,
      () => this.provider.getCommit(sha),
      options?.ttl
    );
  }

  /**
   * Dispose of provider and clear cache
   */
  async dispose(): Promise<void> {
    this.cache.clear();
    this.cache.dispose();
    await this.provider.dispose();
  }

  // ============================================================================
  // Cache Management Methods
  // ============================================================================

  /**
   * Get the underlying cache manager
   */
  getCacheManager(): CacheManager {
    return this.cache;
  }

  /**
   * Invalidate cache for a specific reference
   */
  invalidateReference(ref: string): void {
    const pattern = new RegExp(
      `^${this.provider.type}:${this.escapeRegex(this.providerIdentifier)}:.*:${this.escapeRegex(ref)}`
    );
    this.cache.deletePattern(pattern);
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(ref: string, path: string): void {
    const fileKey = CacheKeyBuilder.forFile(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );
    const contentKey = CacheKeyBuilder.forFileContent(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );
    const existsKey = CacheKeyBuilder.forExists(
      this.provider.type,
      this.providerIdentifier,
      ref,
      path
    );

    this.cache.delete(fileKey);
    this.cache.delete(contentKey);
    this.cache.delete(existsKey);
  }

  /**
   * Invalidate all caches for this provider
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    return this.cache.deletePattern(pattern);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Warm up cache by pre-fetching common operations
   */
  async warmup(refs?: string[]): Promise<void> {
    // Pre-fetch references
    await this.listReferences();

    // Pre-fetch file lists for specified refs
    if (refs && refs.length > 0) {
      await Promise.all(
        refs.map(ref => this.listFiles(ref).catch(() => {
          // Ignore errors during warmup
        }))
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get provider identifier for cache keys
   * This should uniquely identify the repository/source
   */
  private getProviderIdentifier(): string {
    // For GitHub providers, this would be owner/repo
    // For local providers, this would be the absolute path
    // The actual implementation depends on how providers expose this info

    // For now, use type as fallback
    // Subclasses or provider wrappers should override this
    return this.provider.type;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Set provider identifier (for advanced usage)
   */
  setProviderIdentifier(identifier: string): void {
    this.providerIdentifier = identifier;
  }
}

/**
 * Factory function to create a cached provider
 */
export function withCache(
  provider: Provider,
  options?: CacheManagerOptions
): CachedProvider {
  return new CachedProvider(provider, undefined, options);
}

/**
 * Factory function to create a cached provider with shared cache
 */
export function withSharedCache(
  provider: Provider,
  cache: CacheManager
): CachedProvider {
  return new CachedProvider(provider, cache);
}
