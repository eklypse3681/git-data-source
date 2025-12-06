/**
 * CacheKeyBuilder - Consistent cache key generation
 *
 * Generates standardized cache keys for different provider operations
 * Format: {provider}:{identifier}:{operation}[:{ref}][:{path}]
 *
 * Examples:
 * - github:owner/repo:branches
 * - github:owner/repo:tags
 * - github:owner/repo:files:main
 * - github:owner/repo:file:main:src/index.ts
 * - local:/path/to/repo:branches
 * - local:/path/to/repo:files:main:src
 */

/**
 * Cache key components
 */
export interface CacheKeyComponents {
  /** Provider type (github, local, gitlab, etc.) */
  provider: string;

  /** Repository identifier (owner/repo for GitHub, path for local) */
  repository: string;

  /** Operation type (branches, tags, files, file, content, etc.) */
  operation: string;

  /** Git reference (branch/tag name) - optional */
  ref?: string;

  /** File/directory path - optional */
  path?: string;

  /** Additional qualifiers - optional */
  qualifiers?: Record<string, string | number | boolean>;
}

/**
 * Cache key builder utility class
 */
export class CacheKeyBuilder {
  /**
   * Build a cache key from components
   */
  static build(components: CacheKeyComponents): string {
    const parts: string[] = [
      components.provider,
      this.sanitizeIdentifier(components.repository),
      components.operation
    ];

    if (components.ref) {
      parts.push(this.sanitizeRef(components.ref));
    }

    if (components.path) {
      parts.push(this.sanitizePath(components.path));
    }

    // Add qualifiers as query-string-like suffix
    if (components.qualifiers && Object.keys(components.qualifiers).length > 0) {
      const qualifierStr = this.serializeQualifiers(components.qualifiers);
      parts.push(qualifierStr);
    }

    return parts.join(':');
  }

  /**
   * Build key for listBranches operation
   */
  static forBranches(provider: string, repository: string): string {
    return this.build({
      provider,
      repository,
      operation: 'branches'
    });
  }

  /**
   * Build key for listTags operation
   */
  static forTags(provider: string, repository: string): string {
    return this.build({
      provider,
      repository,
      operation: 'tags'
    });
  }

  /**
   * Build key for listReferences operation
   */
  static forReferences(provider: string, repository: string): string {
    return this.build({
      provider,
      repository,
      operation: 'references'
    });
  }

  /**
   * Build key for getReference operation
   */
  static forReference(provider: string, repository: string, refName: string): string {
    return this.build({
      provider,
      repository,
      operation: 'reference',
      ref: refName
    });
  }

  /**
   * Build key for listFiles operation
   */
  static forFiles(
    provider: string,
    repository: string,
    ref: string,
    path?: string
  ): string {
    return this.build({
      provider,
      repository,
      operation: 'files',
      ref,
      path: path || ''
    });
  }

  /**
   * Build key for getFile operation
   */
  static forFile(
    provider: string,
    repository: string,
    ref: string,
    path: string
  ): string {
    return this.build({
      provider,
      repository,
      operation: 'file',
      ref,
      path
    });
  }

  /**
   * Build key for getFileContent operation
   */
  static forFileContent(
    provider: string,
    repository: string,
    ref: string,
    path: string
  ): string {
    return this.build({
      provider,
      repository,
      operation: 'content',
      ref,
      path
    });
  }

  /**
   * Build key for exists operation
   */
  static forExists(
    provider: string,
    repository: string,
    ref: string,
    path: string
  ): string {
    return this.build({
      provider,
      repository,
      operation: 'exists',
      ref,
      path
    });
  }

  /**
   * Build key for getCommit operation
   */
  static forCommit(provider: string, repository: string, sha: string): string {
    return this.build({
      provider,
      repository,
      operation: 'commit',
      qualifiers: { sha }
    });
  }

  /**
   * Build key with custom qualifiers
   */
  static forOperation(
    provider: string,
    repository: string,
    operation: string,
    qualifiers?: Record<string, string | number | boolean>
  ): string {
    return this.build({
      provider,
      repository,
      operation,
      qualifiers
    });
  }

  /**
   * Parse a cache key back into components
   */
  static parse(key: string): CacheKeyComponents | null {
    const parts = key.split(':');

    if (parts.length < 3) {
      return null;
    }

    const [provider, repository, operation, ref, path, ...rest] = parts;

    const components: CacheKeyComponents = {
      provider,
      repository,
      operation
    };

    if (ref) {
      components.ref = ref;
    }

    if (path) {
      components.path = path;
    }

    // Parse qualifiers if present
    if (rest.length > 0) {
      const qualifierStr = rest.join(':');
      components.qualifiers = this.parseQualifiers(qualifierStr);
    }

    return components;
  }

  /**
   * Extract provider type from cache key
   */
  static extractProvider(key: string): string | null {
    const parts = key.split(':');
    return parts.length > 0 ? parts[0] : null;
  }

  /**
   * Extract repository identifier from cache key
   */
  static extractRepository(key: string): string | null {
    const parts = key.split(':');
    return parts.length > 1 ? parts[1] : null;
  }

  /**
   * Extract operation from cache key
   */
  static extractOperation(key: string): string | null {
    const parts = key.split(':');
    return parts.length > 2 ? parts[2] : null;
  }

  /**
   * Check if key matches a pattern
   */
  static matches(key: string, pattern: Partial<CacheKeyComponents>): boolean {
    const components = this.parse(key);

    if (!components) {
      return false;
    }

    if (pattern.provider && components.provider !== pattern.provider) {
      return false;
    }

    if (pattern.repository && components.repository !== pattern.repository) {
      return false;
    }

    if (pattern.operation && components.operation !== pattern.operation) {
      return false;
    }

    if (pattern.ref && components.ref !== pattern.ref) {
      return false;
    }

    if (pattern.path && components.path !== pattern.path) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Sanitize repository identifier
   */
  private static sanitizeIdentifier(identifier: string): string {
    // Replace problematic characters with safe alternatives
    return identifier
      .replace(/:/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-\/\.]/g, '');
  }

  /**
   * Sanitize git reference name
   */
  private static sanitizeRef(ref: string): string {
    return ref
      .replace(/:/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-\/\.]/g, '');
  }

  /**
   * Sanitize file path
   */
  private static sanitizePath(path: string): string {
    // Remove leading/trailing slashes and sanitize
    return path
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '/')
      .replace(/:/g, '-')
      .replace(/[^\w\-\/\.]/g, '');
  }

  /**
   * Serialize qualifiers to string
   */
  private static serializeQualifiers(
    qualifiers: Record<string, string | number | boolean>
  ): string {
    return Object.entries(qualifiers)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  /**
   * Parse qualifiers from string
   */
  private static parseQualifiers(
    str: string
  ): Record<string, string | number | boolean> {
    const qualifiers: Record<string, string | number | boolean> = {};

    if (!str) {
      return qualifiers;
    }

    const pairs = str.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');

      if (key && value !== undefined) {
        // Try to parse as number or boolean
        if (value === 'true') {
          qualifiers[key] = true;
        } else if (value === 'false') {
          qualifiers[key] = false;
        } else if (!isNaN(Number(value))) {
          qualifiers[key] = Number(value);
        } else {
          qualifiers[key] = value;
        }
      }
    }

    return qualifiers;
  }
}
