/**
 * Git Data Source Library
 *
 * A fluent TypeScript library for accessing Git repositories as data sources.
 * Supports GitHub, local filesystem, and extensible provider architecture.
 *
 * @example
 * ```typescript
 * const source = new GitDataSource({
 *   provider: {
 *     type: 'github',
 *     options: {
 *       owner: 'myorg',
 *       repo: 'myrepo',
 *       auth: { type: 'token', token: process.env.GITHUB_TOKEN }
 *     }
 *   }
 * });
 *
 * await source.initialize();
 *
 * // Fluent query API
 * const files = await source
 *   .ref('main')
 *   .glob('**\/*.ts')
 *   .exclude('**\/*.test.ts')
 *   .extension('.ts')
 *   .filesOnly()
 *   .toArray();
 * ```
 */

import type {
  GitDataSourceOptions,
  GitDataSourceQuery,
  Provider,
  ProviderConfig
} from './types';
import { QueryBuilder } from './core/query-builder';
import { GitHubProvider } from './providers/github-provider';
import { LocalProvider } from './providers/local-provider';
import { FileFilter } from './filters/file-filter';
import type { FileInfo } from './types';

/**
 * File handle for single file operations
 */
export class FileHandle {
  constructor(
    private source: GitDataSource,
    private ref: string,
    private filePath: string
  ) {}

  async content(): Promise<ContentResult> {
    await (this.source as any).autoInit();
    const provider = this.source.getProvider();
    try {
      const content = await provider.getFileContent(this.ref, this.filePath);
      return new ContentResult(content, null);
    } catch (error) {
      return new ContentResult(null, error as Error);
    }
  }

  async info(): Promise<FileInfo | null> {
    await (this.source as any).autoInit();
    const provider = this.source.getProvider();
    try {
      return await provider.getFile(this.ref, this.filePath);
    } catch {
      return null;
    }
  }

  async exists(): Promise<boolean> {
    await (this.source as any).autoInit();
    const provider = this.source.getProvider();
    return provider.exists(this.ref, this.filePath);
  }
}

/**
 * Content result with error handling
 */
export class ContentResult {
  constructor(
    private value: string | null,
    private error: Error | null
  ) {}

  orNull(): string | null {
    return this.value;
  }

  orThrow(errorFactory?: () => Error): string {
    if (this.error) {
      throw errorFactory ? errorFactory() : this.error;
    }
    return this.value!;
  }

  orDefault(defaultValue: string): string {
    return this.value ?? defaultValue;
  }

  map<T>(fn: (content: string) => T): ContentResult {
    if (this.value !== null) {
      try {
        const mapped = fn(this.value);
        return new ContentResult(mapped as any, null);
      } catch (e) {
        return new ContentResult(null, e as Error);
      }
    }
    return this;
  }
}

/**
 * File query builder for enumeration
 */
class FileQuery implements AsyncIterable<FileInfo> {
  private filters: FileFilter;
  private isFresh = false;

  constructor(
    private source: GitDataSource,
    private ref: string
  ) {
    this.filters = new FileFilter();
  }

  /** Check if fresh mode is enabled */
  get freshMode(): boolean {
    return this.isFresh;
  }

  filter(pattern: string | RegExp | ((file: FileInfo) => boolean | Promise<boolean>)): FileQuery {
    if (typeof pattern === 'string') {
      this.filters.glob(pattern);
    } else if (pattern instanceof RegExp) {
      this.filters.regex(pattern);
    } else {
      this.filters.predicate(pattern);
    }
    return this;
  }

  exclude(pattern: string | RegExp): FileQuery {
    this.filters.exclude(pattern);
    return this;
  }

  in(directory: string): FileQuery {
    this.filters.in(directory);
    return this;
  }

  ext(...extensions: string[]): FileQuery {
    this.filters.ext(...extensions);
    return this;
  }

  fresh(): FileQuery {
    this.isFresh = true;
    return this;
  }

  async toArray(): Promise<FileInfo[]> {
    await (this.source as any).autoInit();
    const provider = this.source.getProvider();
    const files = await provider.listFiles(this.ref);
    return this.filters.apply(files);
  }

  async toTree(): Promise<any> {
    const files = await this.toArray();
    return this.buildTree(files);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<FileInfo> {
    const files = await this.toArray();
    for (const file of files) {
      yield file;
    }
  }

  private buildTree(files: FileInfo[]): any {
    const root = { file: null, children: [] as any[], level: 0 };
    const map = new Map<string, any>();
    map.set('', root);

    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const fullPath = parts.slice(0, i + 1).join('/');

        if (!map.has(fullPath)) {
          const node = {
            file: i === parts.length - 1 ? file : { path: fullPath, name: part, type: 'directory' },
            children: [],
            level: i + 1,
          };
          map.set(fullPath, node);
          current.children.push(node);
        }
        current = map.get(fullPath)!;
      }
    }

    return root;
  }
}

/**
 * Reference scope for branch/tag operations
 */
class RefScope {
  public readonly type: 'branch' | 'tag';

  constructor(
    private source: GitDataSource,
    private refName: string,
    refType: 'branch' | 'tag'
  ) {
    this.type = refType;
  }

  file(path: string): FileHandle {
    return new FileHandle(this.source, this.refName, path);
  }

  files(): FileQuery {
    return new FileQuery(this.source, this.refName);
  }
}

/**
 * Repository connection options
 */
export interface RepoOptions {
  /** GitHub personal access token */
  token?: string;
  /** SSH private key path */
  sshKey?: string;
  /** Custom timeout */
  timeout?: number;
}

/**
 * Main GitDataSource class
 * Entry point for the library
 */
export class GitDataSource {
  private provider: Provider;
  private initialized = false;
  private _cache: Map<string, any> = new Map();

  constructor(private readonly options: GitDataSourceOptions) {
    this.provider = this.createProvider(options.provider);
  }

  /**
   * Create GitDataSource from URL or path
   * This is the recommended way to create a data source
   *
   * @example
   * // GitHub repository
   * const repo = GitDataSource.from('https://github.com/owner/repo', { token: 'ghp_...' });
   *
   * // Local repository
   * const local = GitDataSource.from('/path/to/repo');
   */
  static from(location: string, options?: RepoOptions): GitDataSource {
    const isUrl = location.startsWith('http') || location.startsWith('git@');
    const isGitHub = location.includes('github.com');

    if (isUrl && isGitHub) {
      // Parse GitHub URL
      const match = location.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (!match) {
        throw new Error(`Invalid GitHub URL: ${location}`);
      }
      const [, owner, repo] = match;

      return new GitDataSource({
        provider: {
          type: 'github',
          options: {
            owner,
            repo,
            auth: options?.token ? { type: 'token', token: options.token } : { type: 'none' },
            timeout: options?.timeout,
          },
        },
      });
    }

    // Local filesystem
    return new GitDataSource({
      provider: {
        type: 'local',
        options: {
          repoPath: location,
          auth: options?.sshKey ? { type: 'ssh', privateKeyPath: options.sshKey } : { type: 'none' },
        },
      },
    });
  }

  /**
   * Initialize the data source
   * Must be called before any queries
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.provider.initialize();
    this.initialized = true;
  }

  /**
   * Auto-initialize if needed
   */
  private async autoInit(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Start a new query
   */
  query(): GitDataSourceQuery {
    this.ensureInitialized();
    return new QueryBuilder(
      this.provider,
      this.options.defaultRef ?? 'main'
    );
  }

  /**
   * Get a branch scope for fluent API
   */
  branch(name: string): RefScope {
    return new RefScope(this, name, 'branch');
  }

  /**
   * Get a tag scope for fluent API
   */
  tag(name: string): RefScope {
    return new RefScope(this, name, 'tag');
  }

  /**
   * List all branches
   */
  async branches(): Promise<string[]> {
    await this.autoInit();
    const refs = await this.provider.listReferences();
    return refs.filter((r: any) => r.type === 'branch').map((r: any) => r.name);
  }

  /**
   * List all tags
   */
  async tags(): Promise<string[]> {
    await this.autoInit();
    const refs = await this.provider.listReferences();
    return refs.filter((r: any) => r.type === 'tag').map((r: any) => r.name);
  }

  /**
   * Invalidate all caches
   */
  invalidate(): void {
    this._cache.clear();
    if ('clearCache' in this.provider && typeof this.provider.clearCache === 'function') {
      (this.provider as any).clearCache();
    }
  }

  /**
   * Shorthand for query().ref(ref)
   */
  ref(reference: string): GitDataSourceQuery {
    return this.query().ref(reference);
  }

  /**
   * Shorthand for query().path(path)
   */
  path(pathStr: string): GitDataSourceQuery {
    return this.query().path(pathStr);
  }

  /**
   * Get the underlying provider
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Invalidate all caches (legacy)
   */
  async invalidateCache(): Promise<void> {
    this.invalidate();
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.provider.dispose();
    this.initialized = false;
  }

  /**
   * Create provider instance based on configuration
   */
  private createProvider(config: ProviderConfig): Provider {
    switch (config.type) {
      case 'github':
        return new GitHubProvider(config.options, this.options.cache);

      case 'local':
        return new LocalProvider(config.options, this.options.cache);

      case 'gitlab':
      case 'bitbucket':
        throw new Error(`Provider '${config.type}' is not yet implemented`);

      default:
        throw new Error(`Unknown provider type: ${(config as any).type}`);
    }
  }

  /**
   * Ensure data source is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GitDataSource is not initialized. Call initialize() first.');
    }
  }
}

// Re-export types
export * from './types';
export * from './types/providers';
export { BaseProvider } from './core/provider';
export { QueryBuilder } from './core/query-builder';
