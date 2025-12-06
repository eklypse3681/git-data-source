/**
 * Mock Provider for Testing
 *
 * Provides configurable mock implementation of the Provider interface
 * for testing without real git/GitHub dependencies
 */

import type { FileInfo, GitReference, CommitInfo, CacheOptions } from '../../src/core/types';

export interface MockProviderConfig {
  files?: FileInfo[];
  references?: GitReference[];
  commits?: Map<string, CommitInfo>;
  shouldThrowOnInit?: boolean;
  shouldThrowOnFetch?: boolean;
  errorMessage?: string;
  latency?: number;
}

export class MockProvider {
  private initialized = false;
  private config: MockProviderConfig;
  public callLog: Array<{ method: string; args: any[] }> = [];

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      files: [],
      references: [],
      commits: new Map(),
      shouldThrowOnInit: false,
      shouldThrowOnFetch: false,
      latency: 0,
      ...config
    };
  }

  // Track method calls for verification
  private logCall(method: string, ...args: any[]): void {
    this.callLog.push({ method, args });
  }

  // Simulate async latency
  private async simulateLatency(): Promise<void> {
    if (this.config.latency && this.config.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latency));
    }
  }

  async initialize(): Promise<void> {
    this.logCall('initialize');
    await this.simulateLatency();

    if (this.config.shouldThrowOnInit) {
      throw new Error(this.config.errorMessage || 'Mock initialization error');
    }

    this.initialized = true;
  }

  async listReferences(): Promise<GitReference[]> {
    this.logCall('listReferences');
    await this.simulateLatency();

    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    return [...(this.config.references || [])];
  }

  async getReference(name: string): Promise<GitReference | null> {
    this.logCall('getReference', name);
    await this.simulateLatency();

    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    return this.config.references?.find(ref => ref.name === name) || null;
  }

  async listFiles(ref: string, path = ''): Promise<FileInfo[]> {
    this.logCall('listFiles', ref, path);
    await this.simulateLatency();

    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    if (this.config.shouldThrowOnFetch) {
      throw new Error(this.config.errorMessage || 'Mock fetch error');
    }

    let files = [...(this.config.files || [])];

    // Filter by path if provided
    if (path) {
      const normalizedPath = path.endsWith('/') ? path : `${path}/`;
      files = files.filter(f => f.path.startsWith(normalizedPath));
    }

    return files;
  }

  async getFile(ref: string, path: string): Promise<FileInfo | null> {
    this.logCall('getFile', ref, path);
    await this.simulateLatency();

    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    return this.config.files?.find(f => f.path === path) || null;
  }

  async getFileContent(ref: string, path: string): Promise<string | null> {
    this.logCall('getFileContent', ref, path);
    await this.simulateLatency();

    const file = await this.getFile(ref, path);
    return file?.content || null;
  }

  async exists(ref: string, path: string): Promise<boolean> {
    this.logCall('exists', ref, path);
    await this.simulateLatency();

    return this.config.files?.some(f => f.path === path) || false;
  }

  async getCommit(sha: string): Promise<CommitInfo | null> {
    this.logCall('getCommit', sha);
    await this.simulateLatency();

    return this.config.commits?.get(sha) || null;
  }

  async dispose(): Promise<void> {
    this.logCall('dispose');
    this.initialized = false;
  }

  // Test utilities

  updateConfig(config: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  addFile(file: FileInfo): void {
    if (!this.config.files) {
      this.config.files = [];
    }
    this.config.files.push(file);
  }

  addReference(ref: GitReference): void {
    if (!this.config.references) {
      this.config.references = [];
    }
    this.config.references.push(ref);
  }

  addCommit(sha: string, commit: CommitInfo): void {
    if (!this.config.commits) {
      this.config.commits = new Map();
    }
    this.config.commits.set(sha, commit);
  }

  clearCallLog(): void {
    this.callLog = [];
  }

  getCallCount(method: string): number {
    return this.callLog.filter(call => call.method === method).length;
  }

  wasCalledWith(method: string, ...expectedArgs: any[]): boolean {
    return this.callLog.some(call => {
      if (call.method !== method) return false;
      return expectedArgs.every((arg, i) => {
        const callArg = call.args[i];
        return JSON.stringify(arg) === JSON.stringify(callArg);
      });
    });
  }
}

// Helper to create mock FileInfo objects
export function createMockFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: 'test/file.ts',
    name: 'file.ts',
    type: 'file' as any,
    size: 1024,
    content: 'mock content',
    sha: 'abc123',
    extension: '.ts',
    ...overrides
  };
}

// Helper to create mock GitReference objects
export function createMockReference(overrides: Partial<GitReference> = {}): GitReference {
  return {
    name: 'main',
    type: 'branch',
    sha: 'abc123def456',
    ...overrides
  };
}

// Helper to create mock CommitInfo objects
export function createMockCommit(overrides: Partial<CommitInfo> = {}): CommitInfo {
  return {
    sha: 'abc123def456',
    message: 'Test commit',
    author: {
      name: 'Test Author',
      email: 'test@example.com',
      date: new Date('2025-01-01')
    },
    ...overrides
  };
}
