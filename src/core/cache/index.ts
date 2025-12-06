/**
 * Cache Module Exports
 *
 * Provides session-based caching with fresh/invalidate capabilities
 * for the git-data-source library.
 */

import { CacheManager as CacheManagerClass, type CacheManagerOptions as CacheManagerOptionsType, type CacheStats as CacheStatsType } from './CacheManager';

export { CacheManagerClass as CacheManager, type CacheManagerOptionsType as CacheManagerOptions, type CacheStatsType as CacheStats };
export { CacheKeyBuilder, type CacheKeyComponents } from './CacheKeyBuilder';
export {
  CachedProvider,
  withCache,
  withSharedCache,
  type CachedOperationOptions
} from './CachedProvider';

// Re-export cache-related types from main types
export type { CacheProvider, CacheOptions, CacheStrategy } from '../../types';
export { CacheError } from '../../types';

/**
 * Default cache instance with standard configuration
 */
export const defaultCache = new CacheManagerClass({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  namespace: 'gds',
  autoCleanup: true,
  cleanupInterval: 60 * 1000 // 1 minute
});

/**
 * Create a cache instance with custom configuration
 */
export function createCache(options?: CacheManagerOptionsType): CacheManagerClass {
  return new CacheManagerClass(options);
}

/**
 * Cache presets for common scenarios
 */
export const CachePresets = {
  /**
   * Short-lived cache for rapidly changing data
   */
  shortLived: {
    ttl: 60 * 1000, // 1 minute
    maxSize: 500,
    autoCleanup: true
  },

  /**
   * Standard cache for typical usage
   */
  standard: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    autoCleanup: true
  },

  /**
   * Long-lived cache for stable data
   */
  longLived: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 2000,
    autoCleanup: true
  },

  /**
   * Large cache for data-intensive operations
   */
  large: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 5000,
    autoCleanup: true,
    cleanupInterval: 2 * 60 * 1000 // 2 minutes
  },

  /**
   * No expiration, size-limited only
   */
  persistent: {
    ttl: 0, // No expiration
    maxSize: 1000,
    autoCleanup: false
  }
} as const;
