/**
 * Tree Builder Utility
 *
 * This module builds hierarchical tree structures from flat file lists.
 * Used by the .toTree() enumeration method.
 */

import type { FileInfo, TreeNode } from '../types';

/**
 * Tree builder utility class
 */
export class TreeBuilder {
  /**
   * Build a tree structure from a flat list of files
   */
  static build(files: FileInfo[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Sort files by path depth to ensure parents are created first
    const sortedFiles = [...files].sort((a, b) => {
      const depthA = a.path.split('/').length;
      const depthB = b.path.split('/').length;
      return depthA - depthB;
    });

    // Create nodes
    for (const file of sortedFiles) {
      const node: TreeNode = {
        file,
        children: [],
        parent: null,
        level: this.getDepth(file.path)
      };

      nodeMap.set(file.path, node);

      // Find parent
      const parentPath = this.getParentPath(file.path);

      if (parentPath) {
        const parent = nodeMap.get(parentPath);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        } else {
          // Parent not in list, add to roots
          roots.push(node);
        }
      } else {
        // Top-level file
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Get parent path from a file path
   */
  private static getParentPath(path: string): string | null {
    const parts = path.split('/');
    if (parts.length <= 1) {
      return null;
    }
    return parts.slice(0, -1).join('/');
  }

  /**
   * Get depth of a path
   */
  private static getDepth(path: string): number {
    if (!path) return 0;
    return path.split('/').length - 1;
  }

  /**
   * Flatten a tree back to a list
   */
  static flatten(nodes: TreeNode[]): FileInfo[] {
    const files: FileInfo[] = [];

    const traverse = (node: TreeNode) => {
      files.push(node.file);
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const node of nodes) {
      traverse(node);
    }

    return files;
  }

  /**
   * Print tree structure (for debugging)
   */
  static print(nodes: TreeNode[], indent = ''): string {
    let output = '';

    for (const node of nodes) {
      output += `${indent}${node.file.name}\n`;
      if (node.children.length > 0) {
        output += this.print(node.children, indent + '  ');
      }
    }

    return output;
  }
}
