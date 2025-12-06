/**
 * CacheManager - In-memory caching with TTL and LRU eviction
 *
 * Features:
 * - O(1) get/set/delete operations using Map
 * - TTL (time-to-live) support per entry
 * - LRU (least recently used) eviction when max size is reached
 * - Namespace support for organizing cache keys
 * - Automatic expiration cleanup
 */

import { CacheError } from '../../types';

/**
 * Configuration options for CacheManager
 */
export interface CacheManagerOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** Maximum number of cache entries (default: 1000) */
  maxSize?: number;

  /** Key prefix/namespace for this cache instance */
  namespace?: string;

  /** Enable automatic cleanup of expired entries (default: true) */
  autoCleanup?: boolean;

  /** Cleanup interval in milliseconds (default: 60 seconds) */
  cleanupInterval?: number;
}

/**
 * Internal cache entry structure
 */
interface CacheEntry<T> {
  /** The cached value */
  value: T;

  /** Timestamp when this entry was created */
  createdAt: number;

  /** Timestamp when this entry expires (optional) */
  expiresAt?: number;

  /** Timestamp when this entry was last accessed (for LRU) */
  lastAccessedAt: number;

  /** Size estimate for this entry (used for memory tracking) */
  size?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total number of cache entries */
  size: number;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate percentage */
  hitRate: number;

  /** Number of evictions due to size limit */
  evictions: number;

  /** Number of expirations due to TTL */
  expirations: number;

  /** Oldest entry age in milliseconds */
  oldestEntryAge?: number;
}

/**
 * In-memory cache manager with TTL and LRU eviction
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<unknown>>;
  private readonly options: Required<CacheManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  // Statistics tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0
  };

  constructor(options: CacheManagerOptions = {}) {
    this.cache = new Map();
    this.options = {
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize ?? 1000,
      namespace: options.namespace ?? '',
      autoCleanup: options.autoCleanup ?? true,
      cleanupInterval: options.cleanupInterval ?? 60 * 1000 // 1 minute default
    };

    if (this.options.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }

    // Update access time for LRU (entry is a reference, so this mutates the cached object)
    // Ensure the timestamp is always increasing for proper LRU ordering
    const now = Date.now();
    entry.lastAccessedAt = now > entry.lastAccessedAt ? now : entry.lastAccessedAt + 1;
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set a value in cache with optional TTL override
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const fullKey = this.getFullKey(key);

    // Evict if cache is at max size and this is a new key
    if (this.cache.size >= this.options.maxSize && !this.cache.has(fullKey)) {
      this.evictLRU();
    }

    const now = Date.now();
    const effectiveTtl = ttl ?? this.options.ttl;

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: effectiveTtl > 0 ? now + effectiveTtl : undefined
    };

    this.cache.set(fullKey, entry);
  }

  /**
   * Check if a key exists in cache (and is not expired)
   */
  has(key: string): boolean {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete a specific cache entry
   * Returns true if the entry existed and was deleted
   */
  delete(key: string): boolean {
    const fullKey = this.getFullKey(key);
    return this.cache.delete(fullKey);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get current cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    // Find oldest entry
    let oldestAge: number | undefined;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      const age = now - entry.createdAt;
      if (oldestAge === undefined || age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      oldestEntryAge: oldestAge
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Get all keys in cache (optionally filtered by pattern)
   */
  keys(pattern?: string | RegExp): string[] {
    const allKeys = Array.from(this.cache.keys());
    const namespace = this.options.namespace;

    // Remove namespace prefix
    let keys = allKeys.map(k =>
      namespace && k.startsWith(namespace + ':')
        ? k.substring(namespace.length + 1)
        : k
    );

    // Apply pattern filter if provided
    if (pattern) {
      const regex = typeof pattern === 'string'
        ? new RegExp(pattern)
        : pattern;
      keys = keys.filter(k => regex.test(k));
    }

    return keys;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
    const keysToDelete = this.keys(pattern);
    let deleteCount = 0;

    for (const key of keysToDelete) {
      if (this.delete(key)) {
        deleteCount++;
      }
    }

    return deleteCount;
  }

  /**
   * Clean up expired entries
   * Returns number of entries removed
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.cache.delete(key);
        removed++;
        this.stats.expirations++;
      }
    }

    return removed;
  }

  /**
   * Get or set a value (atomic operation)
   * If key exists and is valid, returns cached value
   * Otherwise, calls factory function, caches result, and returns it
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await factory();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      throw new CacheError(
        `Failed to compute value for cache key '${key}'`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update TTL for an existing entry
   */
  touch(key: string, ttl?: number): boolean {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry || this.isExpired(entry)) {
      return false;
    }

    const effectiveTtl = ttl ?? this.options.ttl;
    entry.expiresAt = effectiveTtl > 0 ? Date.now() + effectiveTtl : undefined;
    entry.lastAccessedAt = Date.now();

    return true;
  }

  /**
   * Dispose of the cache manager and cleanup resources
   */
  dispose(): void {
    this.stopAutoCleanup();
    this.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get full cache key with namespace
   */
  private getFullKey(key: string): string {
    return this.options.namespace
      ? `${this.options.namespace}:${key}`
      : key;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return entry.expiresAt <= Date.now();
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);

    // Don't keep the process alive for cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
