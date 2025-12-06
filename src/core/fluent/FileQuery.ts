/**
 * FileQuery - Fluent file enumeration builder with filtering and chaining
 */

import {
  FileInfo,
  TreeNode,
  FileFilter,
  GlobPattern,
  RegexPattern,
} from '../types/index.js';

/**
 * Builder for querying files with chainable filters
 */
export class FileQuery {
  private filters: FileFilter[] = [];
  private excludePatterns: (GlobPattern | RegexPattern)[] = [];
  private directoryScope?: string;
  private extensions?: Set<string>;
  private useCache: boolean = true;

  constructor(
    private readonly ref: string,
    private readonly repo: FileQueryRepository
  ) {}

  /**
   * Add a filter using glob pattern, regex, or predicate function
   * @param pattern - Glob string, regex, or filter function
   * @returns FileQuery for chaining
   */
  filter(pattern: GlobPattern): FileQuery;
  filter(pattern: RegexPattern): FileQuery;
  filter(predicate: FileFilter): FileQuery;
  filter(
    pattern: GlobPattern | RegexPattern | FileFilter
  ): FileQuery {
    if (typeof pattern === 'string') {
      // Glob pattern
      this.filters.push((file) => this.matchGlob(file.path, pattern));
    } else if (pattern instanceof RegExp) {
      // Regex pattern
      this.filters.push((file) => pattern.test(file.path));
    } else {
      // Predicate function
      this.filters.push(pattern);
    }
    return this;
  }

  /**
   * Exclude files matching glob or regex pattern
   * @param pattern - Glob string or regex pattern
   * @returns FileQuery for chaining
   */
  exclude(pattern: GlobPattern | RegexPattern): FileQuery {
    this.excludePatterns.push(pattern);
    return this;
  }

  /**
   * Limit query to specific directory
   * @param directory - Directory path relative to repository root
   * @returns FileQuery for chaining
   */
  in(directory: string): FileQuery {
    this.directoryScope = directory.endsWith('/')
      ? directory
      : directory + '/';
    return this;
  }

  /**
   * Filter by file extensions (without dots)
   * @param extensions - Extension strings (e.g., 'ts', 'tsx', 'js')
   * @returns FileQuery for chaining
   */
  ext(...extensions: string[]): FileQuery {
    if (!this.extensions) {
      this.extensions = new Set();
    }
    extensions.forEach((ext) => this.extensions!.add(ext.replace(/^\./, '')));
    return this;
  }

  /**
   * Bypass cache for this query
   * @returns FileQuery for chaining
   */
  fresh(): FileQuery {
    this.useCache = false;
    return this;
  }

  /**
   * Execute query and return results as array
   * @returns Array of FileInfo objects
   */
  async toArray(): Promise<FileInfo[]> {
    const allFiles = await this.repo.fetchFiles(this.ref, this.useCache);
    return this.applyFilters(allFiles);
  }

  /**
   * Execute query and return results as tree structure
   * @returns Root TreeNode with hierarchical structure
   */
  async toTree(): Promise<TreeNode> {
    const files = await this.toArray();
    return this.buildTree(files);
  }

  /**
   * Get async iterator for streaming results
   * @returns AsyncIterableIterator of FileInfo objects
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<FileInfo> {
    const files = await this.toArray();
    for (const file of files) {
      yield file;
    }
  }

  /**
   * Get the number of files matching the query
   * @returns Count of matching files
   */
  async count(): Promise<number> {
    const files = await this.toArray();
    return files.length;
  }

  /**
   * Get the first file matching the query
   * @returns First FileInfo or undefined if no matches
   */
  async first(): Promise<FileInfo | undefined> {
    const allFiles = await this.repo.fetchFiles(this.ref, this.useCache);
    for (const file of allFiles) {
      if (this.matchesAllFilters(file)) {
        return file;
      }
    }
    return undefined;
  }

  /**
   * Check if any files match the query
   * @returns true if at least one file matches
   */
  async any(): Promise<boolean> {
    return (await this.first()) !== undefined;
  }

  /**
   * Execute a callback for each matching file
   * @param callback - Function to execute for each file
   */
  async forEach(callback: (file: FileInfo) => void | Promise<void>): Promise<void> {
    for await (const file of this) {
      await callback(file);
    }
  }

  /**
   * Apply all filters to file list
   * @private
   */
  private applyFilters(files: FileInfo[]): FileInfo[] {
    return files.filter((file) => this.matchesAllFilters(file));
  }

  /**
   * Check if file matches all filters
   * @private
   */
  private matchesAllFilters(file: FileInfo): boolean {
    // Check directory scope
    if (this.directoryScope && !file.path.startsWith(this.directoryScope)) {
      return false;
    }

    // Check extensions
    if (this.extensions && !this.extensions.has(file.extension)) {
      return false;
    }

    // Check exclude patterns
    for (const pattern of this.excludePatterns) {
      if (typeof pattern === 'string') {
        if (this.matchGlob(file.path, pattern)) {
          return false;
        }
      } else if (pattern.test(file.path)) {
        return false;
      }
    }

    // Check include filters
    if (this.filters.length === 0) {
      return true;
    }

    return this.filters.every((filter) => filter(file));
  }

  /**
   * Simple glob matching implementation
   * @private
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/\?/g, '.') // ? matches single char
      .replace(/\./g, '\\.'); // escape dots

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Build tree structure from flat file list
   * @private
   */
  private buildTree(files: FileInfo[]): TreeNode {
    const root: TreeNode = {
      name: '',
      path: '',
      type: 'directory',
      children: [],
    };

    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set('', root);

    // Sort files by path to ensure parents are created first
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
      const parts = file.path.split('/');
      let currentPath = '';

      // Create directory nodes
      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!nodeMap.has(currentPath)) {
          const dirNode: TreeNode = {
            name: parts[i],
            path: currentPath,
            type: 'directory',
            children: [],
          };

          const parent = nodeMap.get(parentPath)!;
          parent.children!.push(dirNode);
          nodeMap.set(currentPath, dirNode);
        }
      }

      // Create file node
      const fileNode: TreeNode = {
        name: parts[parts.length - 1],
        path: file.path,
        type: 'file',
        info: file,
      };

      const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const parent = nodeMap.get(parentPath)!;
      parent.children!.push(fileNode);
    }

    return root;
  }
}

/**
 * Repository interface required by FileQuery
 * @internal
 */
export interface FileQueryRepository {
  fetchFiles(ref: string, useCache: boolean): Promise<FileInfo[]>;
}
