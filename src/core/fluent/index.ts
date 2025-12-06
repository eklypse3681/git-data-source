/**
 * Fluent API exports for git-data-source
 */

export { GitDataSource } from './GitDataSource.js';
export { RefScope } from './RefScope.js';
export { FileQuery } from './FileQuery.js';
export { FileHandle } from './FileHandle.js';
export { ContentResult } from './ContentResult.js';

// Re-export types for convenience
export type {
  FileInfo,
  TreeNode,
  RepoSource,
  RepoOptions,
  FileFilter,
  GlobPattern,
  RegexPattern,
  ContentEncoding,
} from '../types/index.js';

export {
  FileNotFoundError,
  RefNotFoundError,
} from '../types/index.js';
