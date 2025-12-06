/**
 * Filesystem Helper Utilities
 *
 * This module provides utilities for working with the local filesystem,
 * including recursive directory listing, file stats, and path normalization.
 */

import fs from 'fs/promises';
import type { Stats, Dirent } from 'fs';
import path from 'path';
import { FileType } from '../types';

/**
 * File entry information from filesystem
 */
export interface FsFileEntry {
  /** Full absolute path to the file */
  absolutePath: string;

  /** Path relative to the repository root */
  relativePath: string;

  /** File name (last segment of path) */
  name: string;

  /** File type */
  type: FileType;

  /** File size in bytes (null for directories) */
  size: number | null;

  /** File stats */
  stats: Stats;
}

/**
 * Options for listing files
 */
export interface ListFilesOptions {
  /** Follow symbolic links */
  followSymlinks?: boolean;

  /** Maximum file size to process (bytes) */
  maxFileSize?: number;

  /** Patterns to exclude (glob-style) */
  excludePatterns?: string[];
}

/**
 * Recursively list all files in a directory
 *
 * @param dirPath - Absolute path to directory
 * @param options - Listing options
 * @returns Array of file entries
 */
export async function listFilesRecursive(
  dirPath: string,
  options: ListFilesOptions = {}
): Promise<FsFileEntry[]> {
  const {
    followSymlinks = false,
    maxFileSize = Infinity
  } = options;

  const results: FsFileEntry[] = [];

  async function processDirectory(currentPath: string, relativePath = ''): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${currentPath}:`, error);
      return;
    }

    for (const entry of entries) {
      // Skip .git directory
      if (entry.name === '.git') {
        continue;
      }

      const entryAbsolutePath = path.join(currentPath, entry.name);
      const entryRelativePath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      try {
        let stats: Stats;

        // Handle symlinks
        if (entry.isSymbolicLink()) {
          if (!followSymlinks) {
            // Add symlink entry
            stats = await fs.lstat(entryAbsolutePath);
            results.push({
              absolutePath: entryAbsolutePath,
              relativePath: normalizePathSeparators(entryRelativePath),
              name: entry.name,
              type: FileType.Symlink,
              size: stats.size,
              stats
            });
            continue;
          }

          // Follow symlink
          try {
            stats = await fs.stat(entryAbsolutePath);
          } catch {
            // Broken symlink
            stats = await fs.lstat(entryAbsolutePath);
            results.push({
              absolutePath: entryAbsolutePath,
              relativePath: normalizePathSeparators(entryRelativePath),
              name: entry.name,
              type: FileType.Symlink,
              size: stats.size,
              stats
            });
            continue;
          }
        } else {
          stats = await fs.stat(entryAbsolutePath);
        }

        if (stats.isDirectory()) {
          // Add directory entry
          results.push({
            absolutePath: entryAbsolutePath,
            relativePath: normalizePathSeparators(entryRelativePath),
            name: entry.name,
            type: FileType.Directory,
            size: null,
            stats
          });

          // Recurse into directory
          await processDirectory(entryAbsolutePath, entryRelativePath);
        } else if (stats.isFile()) {
          // Check file size limit
          if (stats.size > maxFileSize) {
            console.warn(`Skipping large file ${entryRelativePath}: ${stats.size} bytes`);
            continue;
          }

          // Add file entry
          results.push({
            absolutePath: entryAbsolutePath,
            relativePath: normalizePathSeparators(entryRelativePath),
            name: entry.name,
            type: FileType.File,
            size: stats.size,
            stats
          });
        }
      } catch (error) {
        console.warn(`Error processing ${entryAbsolutePath}:`, error);
        continue;
      }
    }
  }

  await processDirectory(dirPath);
  return results;
}

/**
 * Get file or directory stats
 *
 * @param filePath - Absolute path to file
 * @param followSymlinks - Whether to follow symlinks
 * @returns File stats or null if not found
 */
export async function getFileStats(
  filePath: string,
  followSymlinks = false
): Promise<Stats | null> {
  try {
    return followSymlinks
      ? await fs.stat(filePath)
      : await fs.lstat(filePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Read file content as UTF-8 string
 *
 * @param filePath - Absolute path to file
 * @param encoding - File encoding (default: utf-8)
 * @returns File content or null if not found
 */
export async function readFileContent(
  filePath: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<string | null> {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    // Handle binary files or encoding errors
    if (error.code === 'ERR_INVALID_ARG_VALUE') {
      console.warn(`Cannot read file as text: ${filePath}`);
      return null;
    }
    throw error;
  }
}

/**
 * Check if a path exists
 *
 * @param filePath - Path to check
 * @returns True if path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize path separators to forward slashes
 * Git always uses forward slashes regardless of platform
 *
 * @param pathStr - Path string to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePathSeparators(pathStr: string): string {
  return pathStr.replace(/\\/g, '/');
}

/**
 * Get file extension from path
 *
 * @param filePath - File path
 * @returns File extension (e.g., '.ts') or null
 */
export function getFileExtension(filePath: string): string | null {
  const ext = path.extname(filePath);
  return ext || null;
}

/**
 * Resolve a path relative to repository root
 *
 * @param repoPath - Absolute path to repository root
 * @param relativePath - Relative path within repository
 * @returns Absolute path
 */
export function resolveRepoPath(repoPath: string, relativePath: string): string {
  return path.resolve(repoPath, relativePath);
}

/**
 * Make a path relative to repository root
 *
 * @param repoPath - Absolute path to repository root
 * @param absolutePath - Absolute path to file
 * @returns Relative path with forward slashes
 */
export function makeRelativePath(repoPath: string, absolutePath: string): string {
  const relativePath = path.relative(repoPath, absolutePath);
  return normalizePathSeparators(relativePath);
}

/**
 * Determine file type from stats
 *
 * @param stats - File stats
 * @param followSymlinks - Whether symlinks were followed
 * @returns File type
 */
export function getFileType(stats: Stats, followSymlinks = false): FileType {
  if (stats.isSymbolicLink() && !followSymlinks) {
    return FileType.Symlink;
  }

  if (stats.isDirectory()) {
    return FileType.Directory;
  }

  if (stats.isFile()) {
    return FileType.File;
  }

  // Default to file for unknown types
  return FileType.File;
}

/**
 * List immediate children of a directory (non-recursive)
 *
 * @param dirPath - Absolute path to directory
 * @param options - Listing options
 * @returns Array of file entries
 */
export async function listDirectory(
  dirPath: string,
  options: ListFilesOptions = {}
): Promise<FsFileEntry[]> {
  const {
    followSymlinks = false,
    maxFileSize = Infinity
  } = options;

  const results: FsFileEntry[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip .git directory
      if (entry.name === '.git') {
        continue;
      }

      const entryAbsolutePath = path.join(dirPath, entry.name);

      try {
        let stats: Stats;
        let fileType: FileType;

        // Handle symlinks
        if (entry.isSymbolicLink()) {
          if (!followSymlinks) {
            stats = await fs.lstat(entryAbsolutePath);
            fileType = FileType.Symlink;
          } else {
            try {
              stats = await fs.stat(entryAbsolutePath);
              fileType = getFileType(stats, true);
            } catch {
              // Broken symlink
              stats = await fs.lstat(entryAbsolutePath);
              fileType = FileType.Symlink;
            }
          }
        } else {
          stats = await fs.stat(entryAbsolutePath);
          fileType = getFileType(stats, followSymlinks);
        }

        // Skip large files
        if (fileType === FileType.File && stats.size > maxFileSize) {
          continue;
        }

        results.push({
          absolutePath: entryAbsolutePath,
          relativePath: entry.name,
          name: entry.name,
          type: fileType,
          size: fileType === FileType.File ? stats.size : null,
          stats
        });
      } catch (error) {
        console.warn(`Error processing ${entryAbsolutePath}:`, error);
        continue;
      }
    }
  } catch (error) {
    throw new Error(`Cannot read directory ${dirPath}: ${error}`);
  }

  return results;
}
