/**
 * Local Filesystem Provider Implementation
 *
 * This module implements the Provider interface for local Git repositories.
 * It uses isomorphic-git for Git operations (branches, tags, refs) and
 * Node.js fs/promises for reading files from the working tree.
 */

import git from 'isomorphic-git';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type {
  GitReference,
  FileInfo,
  CommitInfo,
  CacheOptions
} from '../types';
import { FileType } from '../types';
import type { LocalProviderOptions } from '../types/providers';
import { BaseProvider } from '../core/provider';
import { NotFoundError, ProviderError } from '../types';
import {
  listFilesRecursive,
  getFileStats,
  readFileContent,
  pathExists,
  normalizePathSeparators,
  getFileExtension,
  resolveRepoPath,
  getFileType,
  type FsFileEntry
} from '../utils/fs-helpers';

/**
 * Local filesystem provider implementation
 *
 * Reads from the working tree (live filesystem) for file operations,
 * uses isomorphic-git for Git metadata (branches, tags, refs).
 */
export class LocalProvider extends BaseProvider {
  private readonly options: LocalProviderOptions;
  private readonly repoPath: string;
  private readonly encoding: BufferEncoding;
  private readonly followSymlinks: boolean;
  private readonly maxFileSize: number;

  constructor(options: LocalProviderOptions, cacheOptions?: CacheOptions) {
    super('local', cacheOptions);
    this.options = options;
    this.repoPath = path.resolve(options.repoPath);
    this.encoding = options.fs?.encoding ?? 'utf-8';
    this.followSymlinks = options.fs?.followSymlinks ?? false;
    this.maxFileSize = options.fs?.maxFileSize ?? 100 * 1024 * 1024; // 100MB default
  }

  /**
   * Initialize local repository
   */
  protected async onInitialize(): Promise<void> {
    // Verify repository exists and is valid
    await this.verifyRepository();

    // Auto-fetch if configured
    if (this.options.autoFetch && this.options.remoteName) {
      await this.fetchFromRemote();
    }
  }

  /**
   * Verify repository exists and is a valid Git repository
   */
  private async verifyRepository(): Promise<void> {
    try {
      const gitDir = path.join(this.repoPath, '.git');
      const exists = await pathExists(gitDir);

      if (!exists) {
        throw new ProviderError(
          `Not a valid Git repository: ${this.repoPath} (missing .git directory)`
        );
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(
        `Failed to verify Git repository at ${this.repoPath}`,
        error as Error
      );
    }
  }

  /**
   * Fetch from remote repository
   */
  private async fetchFromRemote(): Promise<void> {
    try {
      const http = await import('isomorphic-git/http/node');
      await git.fetch({
        fs,
        http: http.default,
        dir: this.repoPath,
        remote: this.options.remoteName ?? 'origin',
        ...this.getAuthConfig()
      });
    } catch (error) {
      // Fetching is optional, just log warning
      console.warn(`Failed to fetch from remote: ${error}`);
    }
  }

  /**
   * Get authentication configuration for isomorphic-git
   */
  private getAuthConfig(): Record<string, unknown> {
    if (!this.options.auth || this.options.auth.type === 'none') {
      return {};
    }

    if (this.options.auth.type === 'https') {
      const httpsAuth = this.options.auth;
      return {
        onAuth: () => ({
          username: httpsAuth.username,
          password: httpsAuth.password
        })
      };
    }

    if (this.options.auth.type === 'ssh') {
      // SSH authentication would require additional isomorphic-git setup
      // For now, rely on system SSH configuration
      console.warn('SSH authentication not fully implemented, using system SSH config');
      return {};
    }

    return {};
  }

  // ============================================================================
  // Git Reference Operations (using isomorphic-git)
  // ============================================================================

  /**
   * List all references (branches and tags)
   */
  async listReferences(): Promise<GitReference[]> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('refs');

    return this.getCached(cacheKey, async () => {
      const [branches, tags] = await Promise.all([
        this.listBranches(),
        this.listTags()
      ]);

      return [...branches, ...tags];
    });
  }

  /**
   * List all branches using isomorphic-git
   */
  private async listBranches(): Promise<GitReference[]> {
    try {
      const branches = await git.listBranches({
        fs,
        dir: this.repoPath
      });

      const currentBranch = await git.currentBranch({
        fs,
        dir: this.repoPath,
        fullname: false
      });

      return await Promise.all(
        branches.map(async (name) => {
          const sha = await this.resolveRef(name);

          return {
            name,
            type: 'branch' as const,
            sha,
            isDefault: name === currentBranch
          };
        })
      );
    } catch (error) {
      throw new ProviderError('Failed to list branches', error as Error);
    }
  }

  /**
   * List all tags using isomorphic-git
   */
  private async listTags(): Promise<GitReference[]> {
    try {
      const tags = await git.listTags({
        fs,
        dir: this.repoPath
      });

      return await Promise.all(
        tags.map(async (name) => {
          const sha = await this.resolveRef(name);

          return {
            name,
            type: 'tag' as const,
            sha
          };
        })
      );
    } catch (error) {
      throw new ProviderError('Failed to list tags', error as Error);
    }
  }

  /**
   * Get a specific reference by name
   */
  async getReference(name: string): Promise<GitReference | null> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('ref', name);

    return this.getCached(cacheKey, async () => {
      try {
        const sha = await this.resolveRef(name);

        // Determine if branch or tag
        const branches = await git.listBranches({
          fs,
          dir: this.repoPath
        });

        const type = branches.includes(name) ? 'branch' : 'tag';
        const isDefault = type === 'branch' ? await this.isDefaultBranch(name) : false;

        return {
          name,
          type,
          sha,
          ...(isDefault && { isDefault })
        };
      } catch (error) {
        return null;
      }
    });
  }

  /**
   * Resolve a Git reference to commit SHA
   */
  private async resolveRef(ref: string): Promise<string> {
    try {
      return await git.resolveRef({
        fs,
        dir: this.repoPath,
        ref
      });
    } catch (error) {
      throw new NotFoundError(`Reference not found: ${ref}`, error as Error);
    }
  }

  /**
   * Check if a branch is the default branch
   */
  private async isDefaultBranch(branchName: string): Promise<boolean> {
    try {
      const currentBranch = await git.currentBranch({
        fs,
        dir: this.repoPath,
        fullname: false
      });
      return currentBranch === branchName;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // File Operations (reading from working tree)
  // ============================================================================

  /**
   * List files from the working tree
   *
   * Note: The ref parameter is accepted for interface compliance but currently
   * always reads from the working tree. Future versions may support reading
   * from specific commits.
   *
   * @param _ref - Git reference (currently unused, reads from working tree)
   * @param dirPath - Optional subdirectory path
   */
  async listFiles(_ref: string, dirPath = ''): Promise<FileInfo[]> {
    this.ensureInitialized();

    // Validate ref exists (even though we read from working tree)
    await this.resolveRef(_ref);

    const cacheKey = this.getCacheKey('files', _ref, dirPath);

    return this.getCached(cacheKey, async () => {
      const fullPath = dirPath
        ? resolveRepoPath(this.repoPath, dirPath)
        : this.repoPath;

      // Check if path exists
      const stats = await getFileStats(fullPath, this.followSymlinks);
      if (!stats) {
        throw new NotFoundError(`Path not found: ${dirPath}`);
      }

      // If path is a file, return single file info
      if (stats.isFile()) {
        const fileInfo = await this.getFileInfo(_ref, dirPath);
        return fileInfo ? [fileInfo] : [];
      }

      // List directory recursively
      const fsEntries = await listFilesRecursive(fullPath, {
        followSymlinks: this.followSymlinks,
        maxFileSize: this.maxFileSize
      });

      // Convert filesystem entries to FileInfo
      const fileInfos = await Promise.all(
        fsEntries.map(entry => this.fsEntryToFileInfo(entry, dirPath))
      );

      return fileInfos.filter((info): info is FileInfo => info !== null);
    });
  }

  /**
   * Get information about a single file
   *
   * @param ref - Git reference (currently unused, reads from working tree)
   * @param filePath - Path to file relative to repository root
   */
  async getFile(ref: string, filePath: string): Promise<FileInfo | null> {
    this.ensureInitialized();

    // Validate ref exists
    await this.resolveRef(ref);

    const cacheKey = this.getCacheKey('file', ref, filePath);

    return this.getCached(cacheKey, async () => {
      return this.getFileInfo(ref, filePath);
    });
  }

  /**
   * Get file information from working tree
   */
  private async getFileInfo(_ref: string, filePath: string): Promise<FileInfo | null> {
    const absolutePath = resolveRepoPath(this.repoPath, filePath);
    const stats = await getFileStats(absolutePath, this.followSymlinks);

    if (!stats) {
      return null;
    }

    const fileType = getFileType(stats, this.followSymlinks);
    const normalizedPath = normalizePathSeparators(filePath);
    const fileName = path.basename(filePath);

    // Read content for files
    let content: string | null = null;
    if (fileType === FileType.File) {
      content = await readFileContent(absolutePath, this.encoding);

      // If content is null (binary file), we still return the file info
      // but with null content
    }

    // Compute SHA for the file (Git uses SHA-1)
    const sha = await this.computeFileSha(absolutePath, fileType);

    return {
      path: normalizedPath,
      name: fileName,
      type: fileType,
      size: fileType === FileType.File ? stats.size : null,
      content,
      sha,
      extension: getFileExtension(fileName),
      metadata: {
        mtime: stats.mtime,
        ctime: stats.ctime,
        mode: stats.mode
      }
    };
  }

  /**
   * Convert filesystem entry to FileInfo
   */
  private async fsEntryToFileInfo(
    entry: FsFileEntry,
    basePath: string
  ): Promise<FileInfo | null> {
    try {
      // Make path relative to base path if provided
      let relativePath = entry.relativePath;
      if (basePath) {
        relativePath = normalizePathSeparators(
          path.join(basePath, entry.relativePath)
        );
      }

      // Read content for files
      let content: string | null = null;
      if (entry.type === FileType.File) {
        content = await readFileContent(entry.absolutePath, this.encoding);
      }

      // Compute SHA
      const sha = await this.computeFileSha(entry.absolutePath, entry.type);

      return {
        path: relativePath,
        name: entry.name,
        type: entry.type,
        size: entry.size,
        content,
        sha,
        extension: getFileExtension(entry.name),
        metadata: {
          mtime: entry.stats.mtime,
          ctime: entry.stats.ctime,
          mode: entry.stats.mode
        }
      };
    } catch (error) {
      console.warn(`Error converting filesystem entry ${entry.absolutePath}:`, error);
      return null;
    }
  }

  /**
   * Compute SHA-1 hash for a file (matching Git's hash)
   */
  private async computeFileSha(
    absolutePath: string,
    fileType: FileType
  ): Promise<string> {
    if (fileType === FileType.Directory) {
      // Directories get a deterministic placeholder SHA
      return crypto
        .createHash('sha1')
        .update(`tree:${absolutePath}`)
        .digest('hex');
    }

    try {
      const content = await fs.readFile(absolutePath);

      // Git SHA-1: sha1("blob " + filesize + "\0" + content)
      const header = Buffer.from(`blob ${content.length}\0`);
      const fullContent = Buffer.concat([header, content]);

      return crypto
        .createHash('sha1')
        .update(fullContent)
        .digest('hex');
    } catch (error) {
      // Fallback for inaccessible files
      return crypto
        .createHash('sha1')
        .update(`error:${absolutePath}`)
        .digest('hex');
    }
  }

  /**
   * Get file content only (optimized)
   *
   * @param ref - Git reference (currently unused, reads from working tree)
   * @param filePath - Path to file relative to repository root
   */
  async getFileContent(ref: string, filePath: string): Promise<string | null> {
    this.ensureInitialized();

    // Validate ref exists
    await this.resolveRef(ref);

    const cacheKey = this.getCacheKey('content', ref, filePath);

    return this.getCached(cacheKey, async () => {
      const absolutePath = resolveRepoPath(this.repoPath, filePath);
      return readFileContent(absolutePath, this.encoding);
    });
  }

  /**
   * Check if a path exists in the working tree
   *
   * @param ref - Git reference (currently unused, reads from working tree)
   * @param filePath - Path to check
   */
  async exists(ref: string, filePath: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Validate ref exists
      await this.resolveRef(ref);

      const absolutePath = resolveRepoPath(this.repoPath, filePath);
      return await pathExists(absolutePath);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Commit Operations (using isomorphic-git)
  // ============================================================================

  /**
   * Get commit information
   */
  async getCommit(sha: string): Promise<CommitInfo | null> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('commit', sha);

    return this.getCached(cacheKey, async () => {
      try {
        const commit = await git.readCommit({
          fs,
          dir: this.repoPath,
          oid: sha
        });

        return {
          sha: commit.oid,
          message: commit.commit.message,
          author: {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            date: new Date(commit.commit.author.timestamp * 1000)
          },
          committer: {
            name: commit.commit.committer.name,
            email: commit.commit.committer.email,
            date: new Date(commit.commit.committer.timestamp * 1000)
          }
        };
      } catch (error: any) {
        if (error.code === 'NotFoundError') {
          return null;
        }
        throw new ProviderError(`Failed to read commit ${sha}`, error);
      }
    });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Provider-specific cleanup
   */
  protected async onDispose(): Promise<void> {
    // No special cleanup needed for local provider
  }
}
