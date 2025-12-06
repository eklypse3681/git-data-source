/**
 * Provider-specific type definitions
 *
 * This module contains configuration types for each supported Git provider.
 * Each provider has its own authentication and configuration requirements.
 */

// ============================================================================
// GitHub Provider
// ============================================================================

/**
 * Authentication methods for GitHub
 */
export type GitHubAuth =
  | { type: 'token'; token: string }
  | { type: 'app'; appId: string; privateKey: string; installationId: string }
  | { type: 'none' };

/**
 * GitHub API configuration options
 */
export interface GitHubProviderOptions {
  /** Repository owner (username or organization) */
  owner: string;

  /** Repository name */
  repo: string;

  /** Authentication configuration */
  auth: GitHubAuth;

  /** GitHub API base URL (for GitHub Enterprise) */
  baseUrl?: string;

  /** Custom Octokit options */
  octokitOptions?: {
    userAgent?: string;
    previews?: string[];
    throttle?: {
      onRateLimit?: (retryAfter: number, options: unknown) => boolean;
      onAbuseLimit?: (retryAfter: number, options: unknown) => boolean;
    };
  };

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Number of retries for failed requests */
  retries?: number;

  /** Enable GraphQL API for better performance (when available) */
  useGraphQL?: boolean;
}

// ============================================================================
// Local Filesystem Provider
// ============================================================================

/**
 * Authentication methods for local Git repositories
 */
export type LocalAuth =
  | { type: 'ssh'; privateKeyPath: string; passphrase?: string }
  | { type: 'https'; username: string; password: string }
  | { type: 'none' };

/**
 * Local filesystem Git configuration options
 */
export interface LocalProviderOptions {
  /** Absolute path to the Git repository */
  repoPath: string;

  /** Authentication for remote operations */
  auth?: LocalAuth;

  /** Automatically fetch from remote before queries */
  autoFetch?: boolean;

  /** Remote name to fetch from */
  remoteName?: string;

  /** Filesystem options */
  fs?: {
    /** File encoding for text files */
    encoding?: BufferEncoding;

    /** Follow symlinks */
    followSymlinks?: boolean;

    /** Maximum file size to read (bytes) */
    maxFileSize?: number;
  };

  /** Git configuration overrides */
  gitConfig?: Record<string, string>;

  /** Working directory for file operations */
  workingDir?: string;
}

// ============================================================================
// Future Provider Placeholders
// ============================================================================

/**
 * GitLab provider options (future implementation)
 */
export interface GitLabProviderOptions {
  /** GitLab project ID or path */
  project: string;

  /** Authentication token */
  token?: string;

  /** GitLab instance URL (for self-hosted) */
  baseUrl?: string;

  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Bitbucket provider options (future implementation)
 */
export interface BitbucketProviderOptions {
  /** Workspace name */
  workspace: string;

  /** Repository slug */
  repo: string;

  /** Authentication credentials */
  auth?: {
    username: string;
    appPassword: string;
  };

  /** Bitbucket API URL (for Bitbucket Server) */
  baseUrl?: string;

  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Azure DevOps provider options (future implementation)
 */
export interface AzureDevOpsProviderOptions {
  /** Organization name */
  organization: string;

  /** Project name */
  project: string;

  /** Repository name */
  repo: string;

  /** Personal access token */
  token?: string;

  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Generic Git provider options
 * For custom or unsupported providers
 */
export interface GenericProviderOptions {
  /** Provider identifier */
  providerId: string;

  /** Git remote URL */
  remoteUrl: string;

  /** Authentication */
  auth?: LocalAuth;

  /** Custom provider-specific configuration */
  config?: Record<string, unknown>;
}
