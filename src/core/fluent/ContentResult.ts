/**
 * ContentResult - Handles file content retrieval with fallback methods
 */

import { FileNotFoundError } from '../types/index.js';

/**
 * Represents the result of a content fetch operation with chainable error handling
 */
export class ContentResult<T = string> {
  private constructor(
    private readonly fetcher: () => Promise<T>,
    private readonly path: string,
    private readonly ref: string
  ) {}

  /**
   * Create a new ContentResult instance
   * @internal
   */
  static create<T>(
    fetcher: () => Promise<T>,
    path: string,
    ref: string
  ): ContentResult<T> {
    return new ContentResult(fetcher, path, ref);
  }

  /**
   * Get content, returning the value directly (throws on error)
   * @returns Content value
   * @throws {FileNotFoundError} If file doesn't exist
   */
  async value(): Promise<T> {
    return this.fetcher();
  }

  /**
   * Get content, returning null if file doesn't exist
   * @returns Content or null
   */
  async orNull(): Promise<T | null> {
    try {
      return await this.fetcher();
    } catch (error) {
      // Check by name in case it's a different instance of FileNotFoundError
      if (error instanceof Error && error.name === 'FileNotFoundError') {
        return null;
      }
      if (error instanceof FileNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get content, throwing custom error if file doesn't exist
   * @param errorFactory - Function to create custom error
   * @returns Content value
   * @throws Custom error from errorFactory
   */
  async orThrow(errorFactory?: (path: string, ref: string) => Error): Promise<T> {
    try {
      return await this.fetcher();
    } catch (error) {
      // Check by name in case it's a different instance of FileNotFoundError
      const isFileNotFound = (error instanceof Error && error.name === 'FileNotFoundError') ||
                             error instanceof FileNotFoundError;

      if (isFileNotFound && errorFactory) {
        throw errorFactory(this.path, this.ref);
      }
      throw error;
    }
  }

  /**
   * Get content with a default value fallback
   * @param defaultValue - Value to return if file doesn't exist
   * @returns Content or default value
   */
  async orDefault(defaultValue: T): Promise<T> {
    try {
      return await this.fetcher();
    } catch (error) {
      // Check by name in case it's a different instance of FileNotFoundError
      if (error instanceof Error && error.name === 'FileNotFoundError') {
        return defaultValue;
      }
      if (error instanceof FileNotFoundError) {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Get content with a lazy default value fallback
   * @param defaultFactory - Function to create default value
   * @returns Content or computed default value
   */
  async orElse(defaultFactory: () => T | Promise<T>): Promise<T> {
    try {
      return await this.fetcher();
    } catch (error) {
      // Check by name in case it's a different instance of FileNotFoundError
      if (error instanceof Error && error.name === 'FileNotFoundError') {
        return await defaultFactory();
      }
      if (error instanceof FileNotFoundError) {
        return await defaultFactory();
      }
      throw error;
    }
  }

  /**
   * Transform content if it exists
   * @param mapper - Transformation function
   * @returns New ContentResult with transformed value
   */
  map<U>(mapper: (value: T) => U | Promise<U>): ContentResult<U> {
    return ContentResult.create(
      async () => {
        const value = await this.fetcher();
        return await mapper(value);
      },
      this.path,
      this.ref
    );
  }

  /**
   * Chain async operations on content
   * @param mapper - Async transformation function
   * @returns New ContentResult with transformed value
   */
  flatMap<U>(
    mapper: (value: T) => Promise<U> | ContentResult<U>
  ): ContentResult<U> {
    return ContentResult.create(
      async () => {
        const value = await this.fetcher();
        const result = await mapper(value);
        if (result instanceof ContentResult) {
          return await result.value();
        }
        return result;
      },
      this.path,
      this.ref
    );
  }

  /**
   * Execute side effect without modifying the content
   * @param effect - Side effect function
   * @returns Same ContentResult for chaining
   */
  tap(effect: (value: T) => void | Promise<void>): ContentResult<T> {
    return ContentResult.create(
      async () => {
        const value = await this.fetcher();
        await effect(value);
        return value;
      },
      this.path,
      this.ref
    );
  }

  /**
   * Make ContentResult awaitable (returns value directly)
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.value().then(onfulfilled, onrejected);
  }
}
