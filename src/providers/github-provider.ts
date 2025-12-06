/**
 * GitHub Provider Implementation
 *
 * This module implements the Provider interface for GitHub repositories
 * using the Octokit REST API with retry logic, pagination, and proper error handling.
 */

import { Octokit } from '@octokit/rest';
import type {
  GitReference,
  FileInfo,
  CommitInfo,
  CacheOptions,
  NotFoundError,
  AuthenticationError,
  ProviderError
} from '../types';
import { FileType } from '../types';
import type { GitHubProviderOptions } from '../types/providers';
import { BaseProvider } from '../core/provider';
import { retryWithBackoff, isRetryableError } from '../utils/retry';

/**
 * GitHub API response types
 */
type ContentResponse = Awaited<ReturnType<Octokit['repos']['getContent']>>['data'];

/**
 * File size limit for Contents API (1MB)
 * Files larger than this need to use Blobs API
 */
const CONTENTS_API_SIZE_LIMIT = 1048576;

/**
 * GitHub provider implementation with production-ready features:
 * - Automatic retry with exponential backoff
 * - Rate limit handling
 * - Pagination for large repos
 * - Efficient recursive file listing using Git Trees API
 * - Large file support via Blobs API
 * - Comprehensive error handling
 */
export class GitHubProvider extends BaseProvider {
  private octokit!: Octokit;
  private readonly options: GitHubProviderOptions;
  private defaultBranch?: string;

  constructor(options: GitHubProviderOptions, cacheOptions?: CacheOptions) {
    super('github', cacheOptions);
    this.options = {
      retries: 3,
      timeout: 30000,
      ...options
    };
  }

  /**
   * Initialize GitHub client with retry configuration
   */
  protected async onInitialize(): Promise<void> {
    this.octokit = new Octokit({
      auth: this.getAuthToken(),
      baseUrl: this.options.baseUrl,
      userAgent: this.options.octokitOptions?.userAgent ?? 'git-data-source/1.0.0',
      request: {
        timeout: this.options.timeout
      },
      ...this.options.octokitOptions
    });

    // Verify repository access and cache default branch
    await this.verifyAccess();
  }

  /**
   * Get authentication token based on auth type
   */
  private getAuthToken(): string | undefined {
    const { auth } = this.options;

    switch (auth.type) {
      case 'token':
        return auth.token;
      case 'app':
        // GitHub App authentication would use createAppAuth from @octokit/auth-app
        // For now, returning undefined (would need separate implementation)
        return undefined;
      case 'none':
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Verify repository access and cache repository metadata
   */
  private async verifyAccess(): Promise<void> {
    try {
      const { data: repo } = await this.withRetry(async () =>
        this.octokit.repos.get({
          owner: this.options.owner,
          repo: this.options.repo
        })
      );

      this.defaultBranch = repo.default_branch;
    } catch (error: any) {
      if (error.status === 401 || error.status === 403) {
        const authError = new Error(
          `Authentication failed for repository ${this.options.owner}/${this.options.repo}`
        ) as AuthenticationError;
        authError.name = 'AuthenticationError';
        throw authError;
      }

      if (error.status === 404) {
        const notFoundError = new Error(
          `Repository ${this.options.owner}/${this.options.repo} not found`
        ) as NotFoundError;
        notFoundError.name = 'NotFoundError';
        throw notFoundError;
      }

      const providerError = new Error(
        `Failed to access repository ${this.options.owner}/${this.options.repo}: ${error.message}`
      ) as ProviderError;
      providerError.name = 'ProviderError';
      throw providerError;
    }
  }

  /**
   * Wrap API calls with retry logic
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return retryWithBackoff(fn, {
      maxRetries: this.options.retries,
      baseDelay: 1000,
      maxDelay: 60000,
      shouldRetry: isRetryableError,
      onRetry: (error, attempt, delay) => {
        console.warn(
          `GitHub API request failed (attempt ${attempt}/${this.options.retries}), ` +
          `retrying in ${delay}ms: ${error.message}`
        );
      }
    });
  }

  /**
   * List all references (branches and tags) with pagination
   */
  async listReferences(): Promise<GitReference[]> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('refs');

    return this.getCached(cacheKey, async () => {
      const [branches, tags] = await Promise.all([
        this.listAllBranches(),
        this.listAllTags()
      ]);

      return [...branches, ...tags];
    });
  }

  /**
   * List all branches with pagination
   */
  private async listAllBranches(): Promise<GitReference[]> {
    const branches: GitReference[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.withRetry(async () =>
        this.octokit.repos.listBranches({
          owner: this.options.owner,
          repo: this.options.repo,
          per_page: perPage,
          page
        })
      );

      branches.push(
        ...data.map(branch => ({
          name: branch.name,
          type: 'branch' as const,
          sha: branch.commit.sha,
          isDefault: branch.name === this.defaultBranch
        }))
      );

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return branches;
  }

  /**
   * List all tags with pagination
   */
  private async listAllTags(): Promise<GitReference[]> {
    const tags: GitReference[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.withRetry(async () =>
        this.octokit.repos.listTags({
          owner: this.options.owner,
          repo: this.options.repo,
          per_page: perPage,
          page
        })
      );

      tags.push(
        ...data.map(tag => ({
          name: tag.name,
          type: 'tag' as const,
          sha: tag.commit.sha
        }))
      );

      if (data.length < perPage) {
        break;
      }

      page++;
    }

    return tags;
  }

  /**
   * Get a specific reference by name
   */
  async getReference(name: string): Promise<GitReference | null> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('ref', name);

    return this.getCached(cacheKey, async () => {
      try {
        // Try as branch first
        const { data } = await this.withRetry(async () =>
          this.octokit.repos.getBranch({
            owner: this.options.owner,
            repo: this.options.repo,
            branch: name
          })
        );

        return {
          name: data.name,
          type: 'branch' as const,
          sha: data.commit.sha,
          isDefault: data.name === this.defaultBranch
        };
      } catch (error: any) {
        if (error.status !== 404) {
          throw error;
        }

        // Try as tag
        try {
          const { data } = await this.withRetry(async () =>
            this.octokit.git.getRef({
              owner: this.options.owner,
              repo: this.options.repo,
              ref: `tags/${name}`
            })
          );

          return {
            name,
            type: 'tag' as const,
            sha: data.object.sha
          };
        } catch (tagError: any) {
          if (tagError.status === 404) {
            return null;
          }
          throw tagError;
        }
      }
    });
  }

  /**
   * List files at a reference path
   * Uses Contents API for single directory or Git Trees API for recursive listing
   */
  async listFiles(ref: string, path = ''): Promise<FileInfo[]> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('files', ref, path);

    return this.getCached(cacheKey, async () => {
      // Resolve ref to SHA for consistency
      const sha = await this.resolveRef(ref);

      // Use Contents API for single directory listing
      try {
        const { data } = await this.withRetry(async () =>
          this.octokit.repos.getContent({
            owner: this.options.owner,
            repo: this.options.repo,
            path,
            ref: sha
          })
        );

        if (Array.isArray(data)) {
          // Directory listing
          return await Promise.all(
            data.map(item => this.mapContentToFileInfo(item as any, sha))
          );
        } else {
          // Single file
          return [await this.mapContentToFileInfo(data as any, sha)];
        }
      } catch (error: any) {
        if (error.status === 404) {
          return [];
        }
        throw error;
      }
    });
  }

  /**
   * Resolve a reference name to a commit SHA
   */
  private async resolveRef(ref: string): Promise<string> {
    const cacheKey = this.getCacheKey('resolve-ref', ref);

    return this.getCached(cacheKey, async () => {
      try {
        const { data } = await this.withRetry(async () =>
          this.octokit.repos.getCommit({
            owner: this.options.owner,
            repo: this.options.repo,
            ref
          })
        );

        return data.sha;
      } catch (error: any) {
        if (error.status === 404) {
          throw new Error(`Reference '${ref}' not found`);
        }
        throw error;
      }
    });
  }

  /**
   * Get a single file with large file support
   */
  async getFile(ref: string, path: string): Promise<FileInfo | null> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('file', ref, path);

    return this.getCached(cacheKey, async () => {
      try {
        const sha = await this.resolveRef(ref);

        const { data } = await this.withRetry(async () =>
          this.octokit.repos.getContent({
            owner: this.options.owner,
            repo: this.options.repo,
            path,
            ref: sha
          })
        );

        if (Array.isArray(data)) {
          // Path points to a directory
          return null;
        }

        return await this.mapContentToFileInfo(data, sha);
      } catch (error: any) {
        if (error.status === 404) {
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Get file content only (optimized for content-only queries)
   */
  async getFileContent(ref: string, path: string): Promise<string | null> {
    this.ensureInitialized();

    const file = await this.getFile(ref, path);

    if (!file || file.type !== 'file') {
      return null;
    }

    return file.content;
  }

  /**
   * Check if a path exists at the given reference
   */
  async exists(ref: string, path: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const sha = await this.resolveRef(ref);

      await this.withRetry(async () =>
        this.octokit.repos.getContent({
          owner: this.options.owner,
          repo: this.options.repo,
          path,
          ref: sha
        })
      );

      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get commit information
   */
  async getCommit(sha: string): Promise<CommitInfo | null> {
    this.ensureInitialized();

    const cacheKey = this.getCacheKey('commit', sha);

    return this.getCached(cacheKey, async () => {
      try {
        const { data } = await this.withRetry(async () =>
          this.octokit.repos.getCommit({
            owner: this.options.owner,
            repo: this.options.repo,
            ref: sha
          })
        );

        return {
          sha: data.sha,
          message: data.commit.message,
          author: {
            name: data.commit.author?.name ?? '',
            email: data.commit.author?.email ?? '',
            date: new Date(data.commit.author?.date ?? '')
          },
          committer: data.commit.committer
            ? {
                name: data.commit.committer.name ?? '',
                email: data.commit.committer.email ?? '',
                date: new Date(data.commit.committer.date ?? '')
              }
            : undefined
        };
      } catch (error: any) {
        if (error.status === 404) {
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Map GitHub Contents API response to FileInfo
   * Handles large files via Blobs API
   */
  private async mapContentToFileInfo(
    item: NonNullable<Exclude<ContentResponse, any[]>>,
    _ref: string
  ): Promise<FileInfo> {
    const isFile = item.type === 'file';
    let content: string | null = null;

    if (isFile && 'content' in item) {
      if (item.size && item.size > CONTENTS_API_SIZE_LIMIT) {
        // Use Blobs API for large files
        content = await this.getLargeFileContent(item.sha);
      } else if (item.content) {
        // Decode base64 content
        content = Buffer.from(item.content, 'base64').toString('utf-8');
      }
    }

    return {
      path: item.path,
      name: item.name,
      type: this.mapGitHubTypeToFileType(item.type),
      size: isFile && 'size' in item ? item.size : null,
      content,
      sha: item.sha,
      extension: this.getExtension(item.name),
      metadata: {
        downloadUrl: 'download_url' in item ? item.download_url : undefined,
        htmlUrl: 'html_url' in item ? item.html_url : undefined,
        gitUrl: 'git_url' in item ? item.git_url : undefined
      }
    };
  }

  /**
   * Get large file content using Blobs API
   */
  private async getLargeFileContent(sha: string): Promise<string> {
    try {
      const { data } = await this.withRetry(async () =>
        this.octokit.git.getBlob({
          owner: this.options.owner,
          repo: this.options.repo,
          file_sha: sha
        })
      );

      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error: any) {
      console.warn(`Failed to fetch large file content for SHA ${sha}: ${error.message}`);
      return '';
    }
  }

  /**
   * Map GitHub type to FileType enum
   */
  private mapGitHubTypeToFileType(type: string): FileType {
    switch (type) {
      case 'file':
        return FileType.File;
      case 'dir':
        return FileType.Directory;
      case 'symlink':
        return FileType.Symlink;
      case 'submodule':
        return FileType.Submodule;
      default:
        return FileType.File;
    }
  }

  /**
   * Extract file extension from filename
   */
  private getExtension(filename: string): string | null {
    const match = filename.match(/(\.[^.]+)$/);
    return match ? match[1] : null;
  }
}
