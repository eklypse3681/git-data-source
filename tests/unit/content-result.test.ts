/**
 * ContentResult Unit Tests
 *
 * Tests for orNull(), orThrow(), orDefault(), map(), and error handling
 */

import { describe, it, expect, vi } from 'vitest';
import { ContentResult } from '../../src/core/fluent/ContentResult';

// Mock FileNotFoundError
class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

describe('ContentResult', () => {
  describe('value()', () => {
    it('should return value from successful fetcher', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.value();

      expect(value).toBe('content');
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('should propagate errors from fetcher', async () => {
      const error = new Error('Fetch failed');
      const fetcher = vi.fn(async () => {
        throw error;
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      await expect(result.value()).rejects.toThrow('Fetch failed');
    });

    it('should support awaiting ContentResult directly', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      // ContentResult is thenable
      const value = await result;

      expect(value).toBe('content');
    });
  });

  describe('orNull()', () => {
    it('should return value when file exists', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.orNull();

      expect(value).toBe('content');
    });

    it('should return null on FileNotFoundError', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('File not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.orNull();

      expect(value).toBeNull();
    });

    it('should propagate non-FileNotFoundError errors', async () => {
      const error = new Error('Network error');
      const fetcher = vi.fn(async () => {
        throw error;
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      await expect(result.orNull()).rejects.toThrow('Network error');
    });
  });

  describe('orThrow()', () => {
    it('should return value when file exists', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.orThrow();

      expect(value).toBe('content');
    });

    it('should throw original error when no errorFactory provided', async () => {
      const originalError = new FileNotFoundError('Original error');
      const fetcher = vi.fn(async () => {
        throw originalError;
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      await expect(result.orThrow()).rejects.toThrow('Original error');
    });

    it('should throw custom error from errorFactory', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Original');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const errorFactory = (path: string, ref: string) => {
        return new Error(`Custom: ${path} not found in ${ref}`);
      };

      await expect(result.orThrow(errorFactory))
        .rejects.toThrow('Custom: test.ts not found in main');
    });

    it('should call errorFactory with correct arguments', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'src/index.ts', 'feature-branch');

      const errorFactory = vi.fn((path: string, ref: string) => {
        return new Error(`${path} @ ${ref}`);
      });

      await expect(result.orThrow(errorFactory)).rejects.toThrow();

      expect(errorFactory).toHaveBeenCalledWith('src/index.ts', 'feature-branch');
    });

    it('should propagate non-FileNotFoundError without calling errorFactory', async () => {
      const networkError = new Error('Network error');
      const fetcher = vi.fn(async () => {
        throw networkError;
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const errorFactory = vi.fn(() => new Error('Custom'));

      await expect(result.orThrow(errorFactory)).rejects.toThrow('Network error');
      expect(errorFactory).not.toHaveBeenCalled();
    });
  });

  describe('orDefault()', () => {
    it('should return value when file exists', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.orDefault('default');

      expect(value).toBe('content');
    });

    it('should return default value on FileNotFoundError', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result.orDefault('default content');

      expect(value).toBe('default content');
    });

    it('should support different default value types', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });

      const stringResult = ContentResult.create(fetcher, 'test.ts', 'main');
      expect(await stringResult.orDefault('')).toBe('');

      const objectResult = ContentResult.create<any>(fetcher, 'test.ts', 'main');
      expect(await objectResult.orDefault({ default: true })).toEqual({ default: true });

      const arrayResult = ContentResult.create<any>(fetcher, 'test.ts', 'main');
      expect(await arrayResult.orDefault([])).toEqual([]);
    });

    it('should propagate non-FileNotFoundError', async () => {
      const fetcher = vi.fn(async () => {
        throw new Error('Network error');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      await expect(result.orDefault('default')).rejects.toThrow('Network error');
    });
  });

  describe('orElse()', () => {
    it('should return value when file exists', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const defaultFactory = vi.fn(() => 'default');
      const value = await result.orElse(defaultFactory);

      expect(value).toBe('content');
      expect(defaultFactory).not.toHaveBeenCalled();
    });

    it('should call defaultFactory on FileNotFoundError', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const defaultFactory = vi.fn(() => 'computed default');
      const value = await result.orElse(defaultFactory);

      expect(value).toBe('computed default');
      expect(defaultFactory).toHaveBeenCalledOnce();
    });

    it('should support async defaultFactory', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const asyncFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async default';
      };

      const value = await result.orElse(asyncFactory);

      expect(value).toBe('async default');
    });

    it('should propagate non-FileNotFoundError', async () => {
      const fetcher = vi.fn(async () => {
        throw new Error('Network error');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const defaultFactory = vi.fn(() => 'default');

      await expect(result.orElse(defaultFactory)).rejects.toThrow('Network error');
      expect(defaultFactory).not.toHaveBeenCalled();
    });
  });

  describe('map()', () => {
    it('should transform value with mapper function', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const mapped = result.map(content => content.toUpperCase());
      const value = await mapped.value();

      expect(value).toBe('CONTENT');
    });

    it('should chain multiple map operations', async () => {
      const fetcher = vi.fn(async () => '10');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const mapped = result
        .map(str => parseInt(str, 10))
        .map(num => num * 2)
        .map(num => `Result: ${num}`);

      const value = await mapped.value();

      expect(value).toBe('Result: 20');
    });

    it('should support async mapper functions', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const mapped = result.map(async (content) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return content.toUpperCase();
      });

      const value = await mapped.value();

      expect(value).toBe('CONTENT');
    });

    it('should propagate errors from original fetcher', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const mapped = result.map(content => content.toUpperCase());

      await expect(mapped.value()).rejects.toThrow('Not found');
    });

    it('should work with orNull() after map()', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const mapped = result.map(content => content.toUpperCase());
      const value = await mapped.orNull();

      expect(value).toBeNull();
    });

    it('should preserve path and ref information', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'src/index.ts', 'feature');

      const mapped = result.map(content => content);
      const errorFactory = vi.fn((path, ref) => new Error(`${path}@${ref}`));

      await expect(mapped.orThrow(errorFactory)).rejects.toThrow();
      expect(errorFactory).toHaveBeenCalledWith('src/index.ts', 'feature');
    });
  });

  describe('flatMap()', () => {
    it('should chain async operations', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const flatMapped = result.flatMap(async (content) => {
        return content.toUpperCase();
      });

      const value = await flatMapped.value();

      expect(value).toBe('CONTENT');
    });

    it('should unwrap nested ContentResult', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const flatMapped = result.flatMap((content) => {
        return ContentResult.create(
          async () => content.toUpperCase(),
          'test.ts',
          'main'
        );
      });

      const value = await flatMapped.value();

      expect(value).toBe('CONTENT');
    });

    it('should propagate errors', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const flatMapped = result.flatMap(async (content) => content);

      await expect(flatMapped.value()).rejects.toThrow('Not found');
    });
  });

  describe('tap()', () => {
    it('should execute side effect without modifying value', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const sideEffect = vi.fn();
      const tapped = result.tap(sideEffect);
      const value = await tapped.value();

      expect(value).toBe('content');
      expect(sideEffect).toHaveBeenCalledWith('content');
    });

    it('should support async side effects', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const asyncEffect = vi.fn(async (content) => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const tapped = result.tap(asyncEffect);
      await tapped.value();

      expect(asyncEffect).toHaveBeenCalled();
    });

    it('should chain multiple tap operations', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const effect1 = vi.fn();
      const effect2 = vi.fn();

      const tapped = result.tap(effect1).tap(effect2);
      const value = await tapped.value();

      expect(value).toBe('content');
      expect(effect1).toHaveBeenCalledWith('content');
      expect(effect2).toHaveBeenCalledWith('content');
    });

    it('should propagate errors from fetcher', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const sideEffect = vi.fn();
      const tapped = result.tap(sideEffect);

      await expect(tapped.value()).rejects.toThrow('Not found');
      expect(sideEffect).not.toHaveBeenCalled();
    });
  });

  describe('Chaining Operations', () => {
    it('should support complex chaining', async () => {
      const fetcher = vi.fn(async () => '{"count": 5}');
      const result = ContentResult.create(fetcher, 'data.json', 'main');

      const log: string[] = [];

      const value = await result
        .tap(content => log.push(`Raw: ${content}`))
        .map(content => JSON.parse(content))
        .tap(obj => log.push(`Parsed: ${JSON.stringify(obj)}`))
        .map(obj => obj.count * 2)
        .tap(num => log.push(`Computed: ${num}`))
        .orDefault(0);

      expect(value).toBe(10);
      expect(log).toEqual([
        'Raw: {"count": 5}',
        'Parsed: {"count":5}',
        'Computed: 10'
      ]);
    });

    it('should handle errors at any point in chain', async () => {
      const fetcher = vi.fn(async () => {
        throw new FileNotFoundError('Not found');
      });
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      const value = await result
        .map(content => content.toUpperCase())
        .map(content => content.length)
        .orDefault(0);

      expect(value).toBe(0);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type through transformations', async () => {
      const fetcher = vi.fn(async () => 'content');
      const result = ContentResult.create(fetcher, 'test.ts', 'main');

      // String -> String
      const stringResult = result.map(s => s.toUpperCase());
      const str: string = await stringResult.value();

      // String -> Number
      const numberResult = result.map(s => s.length);
      const num: number = await numberResult.value();

      // String -> Object
      const objectResult = result.map(s => ({ length: s.length }));
      const obj: { length: number } = await objectResult.value();

      expect(typeof str).toBe('string');
      expect(typeof num).toBe('number');
      expect(typeof obj).toBe('object');
    });
  });
});
