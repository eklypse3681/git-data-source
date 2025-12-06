/**
 * Core type definitions for git-data-source library
 */

/** File information metadata */
export interface FileInfo {
  /** Full path relative to repository root */
  path: string;
  /** File size in bytes */
  size: number;
  /** File mode (permissions) */
  mode: string;
  /** Git object ID (SHA-1 hash) */
  oid: string;
  /** File extension (without dot) */
  extension: string;
  /** Directory path */
  directory: string;
  /** Base filename */
  basename: string;
}

/** Tree node for hierarchical file structure */
export interface TreeNode {
  /** Node name (file or directory name) */
  name: string;
  /** Full path from repository root */
  path: string;
  /** Node type */
  type: 'file' | 'directory';
  /** File info (only for file nodes) */
  info?: FileInfo;
  /** Child nodes (only for directory nodes) */
  children?: TreeNode[];
}

/** Git reference types */
export type RefType = 'branch' | 'tag' | 'commit';

/** Repository source configuration */
export interface RepoSource {
  /** Repository URL or local path */
  location: string;
  /** Source type */
  type: 'remote' | 'local';
  /** Authentication token (for remote repos) */
  token?: string;
  /** Additional options */
  options?: RepoOptions;
}

/** Repository configuration options */
export interface RepoOptions {
  /** Authentication token for remote repositories */
  token?: string;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable/disable caching */
  cache?: boolean;
  /** Clone depth for shallow clones */
  depth?: number;
}

/** Filter function type for file queries */
export type FileFilter = (file: FileInfo) => boolean;

/** Glob pattern type */
export type GlobPattern = string;

/** Regex pattern type */
export type RegexPattern = RegExp;

/** File content encoding */
export type ContentEncoding = 'utf8' | 'base64' | 'buffer';

/** Error thrown when file is not found */
export class FileNotFoundError extends Error {
  constructor(
    public readonly path: string,
    public readonly ref: string
  ) {
    super(`File not found: ${path} at ref ${ref}`);
    this.name = 'FileNotFoundError';
  }
}

/** Error thrown when reference is not found */
export class RefNotFoundError extends Error {
  constructor(
    public readonly ref: string,
    public readonly type: RefType
  ) {
    super(`${type} not found: ${ref}`);
    this.name = 'RefNotFoundError';
  }
}
