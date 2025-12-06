/**
 * CacheManager Unit Tests
 *
 * Tests for in-memory caching with TTL, LRU eviction, statistics, and namespacing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from '../../src/core/cache/CacheManager';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ autoCleanup: false }); // Disable auto-cleanup for deterministic tests
  });

  afterEach(() => {
    cache.dispose();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should delete specific entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const deleted = cache.delete('key1');

      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
    });

    it('should report correct size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });

    it('should handle different value types', () => {
      cache.set('string', 'text');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);
      cache.set('null', null);

      expect(cache.get('string')).toBe('text');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('null')).toBe(null);
    });
  });

  describe('TTL (Time-to-Live)', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = new CacheManager({ ttl: 100, autoCleanup: false });

      shortTtlCache.set('key1', 'value1');
      expect(shortTtlCache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortTtlCache.get('key1')).toBeUndefined();
      expect(shortTtlCache.has('key1')).toBe(false);

      shortTtlCache.dispose();
    });

    it('should support custom TTL per entry', async () => {
      cache.set('short', 'value1', 50);
      cache.set('long', 'value2', 200);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('long')).toBe('value2');
    });

    it('should not expire entries with TTL = 0', async () => {
      const noTtlCache = new CacheManager({ ttl: 0, autoCleanup: false });

      noTtlCache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(noTtlCache.get('key1')).toBe('value1');

      noTtlCache.dispose();
    });

    it('should update TTL with touch()', async () => {
      const shortTtlCache = new CacheManager({ ttl: 100, autoCleanup: false });

      shortTtlCache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 60));

      // Touch to extend TTL
      const touched = shortTtlCache.touch('key1', 100);
      expect(touched).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 60));

      // Should still exist after original TTL
      expect(shortTtlCache.get('key1')).toBe('value1');

      shortTtlCache.dispose();
    });

    it('should return false when touching non-existent key', () => {
      const touched = cache.touch('non-existent');
      expect(touched).toBe(false);
    });

    it('should track expirations in statistics', async () => {
      const shortTtlCache = new CacheManager({ ttl: 50, autoCleanup: false });

      shortTtlCache.set('key1', 'value1');
      shortTtlCache.set('key2', 'value2');

      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger expiration checks
      shortTtlCache.get('key1');
      shortTtlCache.get('key2');

      const stats = shortTtlCache.getStats();
      expect(stats.expirations).toBe(2);

      shortTtlCache.dispose();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when max size reached', () => {
      const lruCache = new CacheManager({ maxSize: 3, autoCleanup: false });

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');

      // This should trigger eviction of key1
      lruCache.set('key4', 'value4');

      expect(lruCache.has('key1')).toBe(false);
      expect(lruCache.has('key2')).toBe(true);
      expect(lruCache.has('key3')).toBe(true);
      expect(lruCache.has('key4')).toBe(true);
      expect(lruCache.size()).toBe(3);

      lruCache.dispose();
    });

    it('should update access time on get()', () => {
      const lruCache = new CacheManager({ maxSize: 3, autoCleanup: false });

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');

      // Access key1 to make it most recent
      lruCache.get('key1');

      // This should evict key2 (least recently used)
      lruCache.set('key4', 'value4');

      expect(lruCache.has('key1')).toBe(true);
      expect(lruCache.has('key2')).toBe(false);
      expect(lruCache.has('key3')).toBe(true);
      expect(lruCache.has('key4')).toBe(true);

      lruCache.dispose();
    });

    it('should not evict when updating existing key', () => {
      const lruCache = new CacheManager({ maxSize: 3, autoCleanup: false });

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');

      // Update existing key
      lruCache.set('key2', 'updated');

      expect(lruCache.size()).toBe(3);
      expect(lruCache.get('key2')).toBe('updated');

      lruCache.dispose();
    });

    it('should track evictions in statistics', () => {
      const lruCache = new CacheManager({ maxSize: 2, autoCleanup: false });

      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.set('key3', 'value3');
      lruCache.set('key4', 'value4');

      const stats = lruCache.getStats();
      expect(stats.evictions).toBe(2);

      lruCache.dispose();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should track cache misses', () => {
      cache.get('non-existent1');
      cache.get('non-existent2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key3'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(50); // 2 hits out of 4 requests = 50%
    });

    it('should track oldest entry age', async () => {
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.oldestEntryAge).toBeGreaterThanOrEqual(100);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('non-existent');

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should include size in statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('Namespace Isolation', () => {
    it('should isolate entries by namespace', () => {
      const cache1 = new CacheManager({ namespace: 'ns1', autoCleanup: false });
      const cache2 = new CacheManager({ namespace: 'ns2', autoCleanup: false });

      cache1.set('key1', 'value-ns1');
      cache2.set('key1', 'value-ns2');

      expect(cache1.get('key1')).toBe('value-ns1');
      expect(cache2.get('key1')).toBe('value-ns2');

      cache1.dispose();
      cache2.dispose();
    });

    it('should include namespace in keys()', () => {
      const nsCache = new CacheManager({ namespace: 'test', autoCleanup: false });

      nsCache.set('key1', 'value1');
      nsCache.set('key2', 'value2');

      const keys = nsCache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).not.toContain('test:key1'); // Should strip namespace

      nsCache.dispose();
    });
  });

  describe('Pattern-based Operations', () => {
    beforeEach(() => {
      cache.set('user:1', 'Alice');
      cache.set('user:2', 'Bob');
      cache.set('post:1', 'Post 1');
      cache.set('post:2', 'Post 2');
      cache.set('comment:1', 'Comment 1');
    });

    it('should get keys matching string pattern', () => {
      const keys = cache.keys('user:.*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('post:1');
    });

    it('should get keys matching regex pattern', () => {
      const keys = cache.keys(/^post:/);
      expect(keys).toContain('post:1');
      expect(keys).toContain('post:2');
      expect(keys).not.toContain('user:1');
    });

    it('should delete keys matching pattern', () => {
      const deleted = cache.deletePattern('user:.*');

      expect(deleted).toBe(2);
      expect(cache.has('user:1')).toBe(false);
      expect(cache.has('user:2')).toBe(false);
      expect(cache.has('post:1')).toBe(true);
    });

    it('should delete keys matching regex', () => {
      const deleted = cache.deletePattern(/^(user|post):/);

      expect(deleted).toBe(4);
      expect(cache.has('comment:1')).toBe(true);
    });
  });

  describe('Automatic Cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      const autoCache = new CacheManager({
        ttl: 50,
        autoCleanup: true,
        cleanupInterval: 100
      });

      autoCache.set('key1', 'value1');
      autoCache.set('key2', 'value2');

      await new Promise(resolve => setTimeout(resolve, 80));

      // Entries should be expired
      expect(autoCache.size()).toBe(2); // Not cleaned yet

      await new Promise(resolve => setTimeout(resolve, 50));

      // Cleanup should have run
      expect(autoCache.size()).toBe(0);

      autoCache.dispose();
    });

    it('should return count of cleaned entries', async () => {
      const shortTtlCache = new CacheManager({ ttl: 50, autoCleanup: false });

      shortTtlCache.set('key1', 'value1');
      shortTtlCache.set('key2', 'value2');
      shortTtlCache.set('key3', 'value3');

      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = shortTtlCache.cleanup();
      expect(removed).toBe(3);

      shortTtlCache.dispose();
    });
  });

  describe('getOrSet Pattern', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value');

      const factoryMock = vi.fn(() => 'new-value');

      const result = await cache.getOrSet('key1', factoryMock);

      expect(result).toBe('cached-value');
      expect(factoryMock).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factoryMock = vi.fn(() => 'computed-value');

      const result = await cache.getOrSet('key1', factoryMock);

      expect(result).toBe('computed-value');
      expect(factoryMock).toHaveBeenCalledOnce();
      expect(cache.get('key1')).toBe('computed-value');
    });

    it('should support async factories', async () => {
      const asyncFactory = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-value';
      });

      const result = await cache.getOrSet('key1', asyncFactory);

      expect(result).toBe('async-value');
      expect(cache.get('key1')).toBe('async-value');
    });

    it('should respect custom TTL', async () => {
      const factory = () => 'value';

      await cache.getOrSet('key1', factory, 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should throw CacheError on factory failure', async () => {
      const failingFactory = () => {
        throw new Error('Factory failed');
      };

      await expect(cache.getOrSet('key1', failingFactory))
        .rejects
        .toThrow(/Failed to compute value for cache key/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large cache sizes', () => {
      const largeCache = new CacheManager({ maxSize: 10000, autoCleanup: false });

      for (let i = 0; i < 10000; i++) {
        largeCache.set(`key${i}`, `value${i}`);
      }

      expect(largeCache.size()).toBe(10000);

      largeCache.dispose();
    });

    it('should handle empty string as key', () => {
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle special characters in keys', () => {
      cache.set('key:with:colons', 'value1');
      cache.set('key/with/slashes', 'value2');
      cache.set('key.with.dots', 'value3');

      expect(cache.get('key:with:colons')).toBe('value1');
      expect(cache.get('key/with/slashes')).toBe('value2');
      expect(cache.get('key.with.dots')).toBe('value3');
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cache.getOrSet(`key${i}`, async () => `value${i}`));
      }

      await Promise.all(promises);

      expect(cache.size()).toBe(100);
    });
  });
});
