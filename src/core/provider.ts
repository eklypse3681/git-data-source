/**
 * Abstract Provider Base Class
 *
 * This module defines the abstract base class that all Git providers must extend.
 * It provides common functionality and enforces the Provider interface contract.
 */

import type {
  Provider,
  FileInfo,
  GitReference,
  CommitInfo,
  CacheProvider,
  CacheOptions
} from '../types';
import { CacheStrategy } from '../types';

/**
 * Abstract base class for all Git providers
 *
 * Provides common functionality like caching, error handling,
 * and enforces implementation of core provider methods.
 */
export abstract class BaseProvider implements Provider {
  protected cache?: CacheProvider;
  protected cacheOptions?: CacheOptions;
  protected initialized = false;

  constructor(
    public readonly type: string,
    cacheOptions?: CacheOptions
  ) {
    this.cacheOptions = cacheOptions;
  }

  /**
   * Initialize the provider
   * Must be called before any operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Setup cache if configured
    if (this.cacheOptions?.strategy !== CacheStrategy.None) {
      this.cache = await this.setupCache();
    }

    // Provider-specific initialization
    await this.onInitialize();

    this.initialized = true;
  }

  /**
   * Provider-specific initialization logic
   * Override in subclasses
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Ensure provider is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider '${this.type}' is not initialized. Call initialize() first.`);
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Setup cache provider based on configuration
   */
  protected async setupCache(): Promise<CacheProvider | undefined> {
    if (!this.cacheOptions) {
      return undefined;
    }

    switch (this.cacheOptions.strategy) {
      case CacheStrategy.Memory:
        return new MemoryCacheProvider(this.cacheOptions);

      case CacheStrategy.Custom:
        return this.cacheOptions.customCache;

      case CacheStrategy.Filesystem:
        // Filesystem cache implementation would go here
        throw new Error('Filesystem cache not yet implemented');

      default:
        return undefined;
    }
  }

  /**
   * Get cached value or compute and cache
   */
  protected async getCached<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.cache) {
      return compute();
    }

    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    await this.cache.set(key, value, ttl ?? this.cacheOptions?.ttl);
    return value;
  }

  /**
   * Invalidate cache entry
   */
  protected async invalidateCache(key: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  protected async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Generate cache key
   */
  protected getCacheKey(...parts: string[]): string {
    const prefix = this.cacheOptions?.keyPrefix ?? 'gds';
    return `${prefix}:${this.type}:${parts.join(':')}`;
  }

  // ============================================================================
  // Abstract Methods (must be implemented by providers)
  // ============================================================================

  abstract listReferences(): Promise<GitReference[]>;
  abstract getReference(name: string): Promise<GitReference | null>;
  abstract listFiles(ref: string, path?: string): Promise<FileInfo[]>;
  abstract getFile(ref: string, path: string): Promise<FileInfo | null>;
  abstract getFileContent(ref: string, path: string): Promise<string | null>;
  abstract exists(ref: string, path: string): Promise<boolean>;
  abstract getCommit(sha: string): Promise<CommitInfo | null>;

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup provider resources
   */
  async dispose(): Promise<void> {
    await this.clearCache();
    await this.onDispose();
    this.initialized = false;
  }

  /**
   * Provider-specific cleanup logic
   * Override in subclasses
   */
  protected async onDispose(): Promise<void> {
    // Default: no-op
  }
}

// ============================================================================
// Memory Cache Implementation
// ============================================================================

/**
 * Simple in-memory cache implementation
 */
class MemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(options: CacheOptions) {
    this.maxSize = options.maxSize ?? 1000;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccess = Date.now();

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = ttl ? Date.now() + ttl : undefined;

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccess: Date.now()
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Evict least recently used entries
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

interface CacheEntry {
  value: unknown;
  expiresAt?: number;
  lastAccess: number;
}
