/**
 * RefScope - Branch/tag/ref scope for accessing repository at specific reference
 */

import { FileHandle, FileHandleRepository } from './FileHandle.js';
import { FileQuery, FileQueryRepository } from './FileQuery.js';
import { FileInfo, ContentEncoding } from '../types/index.js';

/**
 * Represents a scope at a specific git reference (branch/tag/commit)
 */
export class RefScope implements FileHandleRepository, FileQueryRepository {
  constructor(
    private readonly refName: string,
    private readonly repo: RefScopeRepository
  ) {}

  /**
   * Get a handle to a single file at this reference
   * @param path - File path relative to repository root
   * @returns FileHandle for accessing file content and metadata
   */
  file(path: string): FileHandle {
    return new FileHandle(path, this.refName, this);
  }

  /**
   * Create a query for enumerating files at this reference
   * @returns FileQuery builder for filtering files
   */
  files(): FileQuery {
    return new FileQuery(this.refName, this);
  }

  /**
   * Get the reference name (branch/tag/commit) for this scope
   * @returns Reference name
   */
  getRef(): string {
    return this.refName;
  }

  /**
   * List all files at this reference (no filtering)
   * @returns Array of FileInfo objects
   */
  async listAll(): Promise<FileInfo[]> {
    return this.repo.fetchFiles(this.refName, true);
  }

  /**
   * Get the commit SHA for this reference
   * @returns Commit SHA-1 hash
   */
  async commit(): Promise<string> {
    return this.repo.resolveRef(this.refName);
  }

  /**
   * Check if this reference exists
   * @returns true if reference exists
   */
  async exists(): Promise<boolean> {
    try {
      await this.commit();
      return true;
    } catch {
      return false;
    }
  }

  // FileHandleRepository implementation
  async fetchContent(
    path: string,
    ref: string,
    encoding: ContentEncoding
  ): Promise<string | Buffer> {
    return this.repo.fetchContent(path, ref, encoding);
  }

  async fetchInfo(path: string, ref: string): Promise<FileInfo> {
    return this.repo.fetchInfo(path, ref);
  }

  // FileQueryRepository implementation
  async fetchFiles(ref: string, useCache: boolean): Promise<FileInfo[]> {
    return this.repo.fetchFiles(ref, useCache);
  }
}

/**
 * Repository interface required by RefScope
 * @internal
 */
export interface RefScopeRepository {
  fetchContent(
    path: string,
    ref: string,
    encoding: ContentEncoding
  ): Promise<string | Buffer>;
  fetchInfo(path: string, ref: string): Promise<FileInfo>;
  fetchFiles(ref: string, useCache: boolean): Promise<FileInfo[]>;
  resolveRef(ref: string): Promise<string>;
}
