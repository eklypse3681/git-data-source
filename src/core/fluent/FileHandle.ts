/**
 * FileHandle - Single file accessor with content and metadata operations
 */

import { ContentResult } from './ContentResult.js';
import { FileInfo, ContentEncoding } from '../types/index.js';

/**
 * Represents a handle to a single file in a git repository
 */
export class FileHandle {
  constructor(
    private readonly path: string,
    private readonly ref: string,
    private readonly repo: FileHandleRepository
  ) {}

  /**
   * Get file content as string (UTF-8)
   * @returns ContentResult for chaining error handling
   */
  content(): ContentResult<string>;
  /**
   * Get file content with specific encoding
   * @param encoding - Content encoding format
   * @returns ContentResult for chaining error handling
   */
  content(encoding: 'utf8'): ContentResult<string>;
  content(encoding: 'base64'): ContentResult<string>;
  content(encoding: 'buffer'): ContentResult<Buffer>;
  content(encoding?: ContentEncoding): ContentResult<string | Buffer> {
    const fetcher = async () => {
      return this.repo.fetchContent(this.path, this.ref, encoding ?? 'utf8');
    };

    return ContentResult.create(fetcher, this.path, this.ref);
  }

  /**
   * Get file metadata information
   * @returns FileInfo object with metadata
   * @throws {FileNotFoundError} If file doesn't exist
   */
  async info(): Promise<FileInfo> {
    return this.repo.fetchInfo(this.path, this.ref);
  }

  /**
   * Check if file exists
   * @returns true if file exists, false otherwise
   */
  async exists(): Promise<boolean> {
    try {
      await this.info();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   * @returns File size
   * @throws {FileNotFoundError} If file doesn't exist
   */
  async size(): Promise<number> {
    const info = await this.info();
    return info.size;
  }

  /**
   * Get file extension (without dot)
   * @returns File extension
   * @throws {FileNotFoundError} If file doesn't exist
   */
  async extension(): Promise<string> {
    const info = await this.info();
    return info.extension;
  }

  /**
   * Get file's git object ID (SHA-1 hash)
   * @returns Git object ID
   * @throws {FileNotFoundError} If file doesn't exist
   */
  async oid(): Promise<string> {
    const info = await this.info();
    return info.oid;
  }

  /**
   * Get the path of this file
   * @returns File path relative to repository root
   */
  getPath(): string {
    return this.path;
  }

  /**
   * Get the reference this file is accessed from
   * @returns Git reference (branch/tag/commit)
   */
  getRef(): string {
    return this.ref;
  }
}

/**
 * Repository interface required by FileHandle
 * @internal
 */
export interface FileHandleRepository {
  fetchContent(
    path: string,
    ref: string,
    encoding: ContentEncoding
  ): Promise<string | Buffer>;
  fetchInfo(path: string, ref: string): Promise<FileInfo>;
}
