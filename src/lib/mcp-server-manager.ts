/**
 * @fileOverview MCP Server Manager - Manages Context7 MCP server lifecycle
 * 
 * This service handles:
 * - Starting and stopping the Context7 MCP server process
 * - Managing stdio communication channels
 * - Process lifecycle management and cleanup
 * - Error handling and recovery
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  command: string;
  args: string[];
  timeout?: number; // Startup timeout in ms (default: 10000)
  maxRestarts?: number; // Max restart attempts (default: 3)
}

// Allowlist of safe commands to prevent command injection
const ALLOWED_COMMANDS = ['npx', 'node'] as const;
const ALLOWED_PACKAGES = ['@upstash/context7-mcp'] as const;

/**
 * Validate command and arguments for security
 */
function validateCommandConfig(config: MCPServerConfig): void {
  // Validate command is in allowlist
  if (!ALLOWED_COMMANDS.includes(config.command as typeof ALLOWED_COMMANDS[number])) {
    throw new Error(`Invalid command: ${config.command}. Only allowed commands: ${ALLOWED_COMMANDS.join(', ')}`);
  }

  // Validate arguments
  if (!Array.isArray(config.args) || config.args.length === 0) {
    throw new Error('Invalid arguments: must be non-empty array');
  }

  // For npx commands, validate the package name
  if (config.command === 'npx') {
    const packageName = config.args[0];
    if (!ALLOWED_PACKAGES.includes(packageName as typeof ALLOWED_PACKAGES[number])) {
      throw new Error(`Invalid package: ${packageName}. Only allowed packages: ${ALLOWED_PACKAGES.join(', ')}`);
    }
  }

  // Validate no shell metacharacters in arguments
  const dangerousChars = /[;&|`$(){}[\]]/;
  for (const arg of config.args) {
    if (typeof arg !== 'string' || dangerousChars.test(arg)) {
      throw new Error(`Invalid argument contains dangerous characters: ${arg}`);
    }
  }
}

export interface MCPServerStatus {
  running: boolean;
  pid?: number;
  startTime?: Date;
  restartCount: number;
  lastError?: string;
}

export class MCPServerManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: MCPServerConfig;
  private status: MCPServerStatus;
  private startupTimeout: NodeJS.Timeout | null = null;
  private shutdownPromise: Promise<void> | null = null;

  constructor(config: MCPServerConfig) {
    super();
    
    // Increase max listeners to handle multiple concurrent requests
    this.setMaxListeners(50);
    
    // Validate configuration for security
    validateCommandConfig(config);
    
    this.config = {
      timeout: 10000,
      maxRestarts: 3,
      ...config
    };
    this.status = {
      running: false,
      restartCount: 0
    };
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    if (this.status.running && this.process) {
      return; // Already running
    }

    if (this.shutdownPromise) {
      await this.shutdownPromise; // Wait for any pending shutdown
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`[MCP Server] Starting Context7 MCP server...`);
        
        // Spawn the Context7 MCP server process
        this.process = spawn(this.config.command, this.config.args, {
          stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
          detached: false
        });

        // Set up startup timeout
        this.startupTimeout = setTimeout(() => {
          const error = new Error(`MCP server startup timeout after ${this.config.timeout}ms`);
          this.handleStartupError(error, reject);
        }, this.config.timeout);

        // Handle process events
        this.process.on('spawn', () => {
          console.log(`[MCP Server] Process started with PID: ${this.process?.pid}`);
          this.status.running = true;
          this.status.pid = this.process?.pid;
          this.status.startTime = new Date();
          
          if (this.startupTimeout) {
            clearTimeout(this.startupTimeout);
            this.startupTimeout = null;
          }
          
          this.emit('started');
          resolve();
        });

        this.process.on('error', (error) => {
          console.error(`[MCP Server] Process error:`, error);
          this.handleStartupError(error, reject);
        });

        this.process.on('exit', (code, signal) => {
          console.log(`[MCP Server] Process exited with code ${code}, signal ${signal}`);
          this.handleProcessExit(code, signal);
        });

        // Handle stderr for debugging
        this.process.stderr?.on('data', (data) => {
          console.error(`[MCP Server] stderr: ${data.toString()}`);
        });

        // Emit stdout data for communication
        this.process.stdout?.on('data', (data) => {
          this.emit('data', data);
        });

      } catch (error) {
        this.handleStartupError(error as Error, reject);
      }
    });
  }

  /**
   * Stop the MCP server process
   */
  async stop(): Promise<void> {
    if (!this.process || !this.status.running) {
      return; // Already stopped
    }

    this.shutdownPromise = new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      console.log(`[MCP Server] Stopping process...`);

      // Set up exit handler
      const onExit = () => {
        this.status.running = false;
        this.status.pid = undefined;
        this.process = null;
        this.emit('stopped');
        resolve();
      };

      this.process.once('exit', onExit);

      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Force kill if not stopped within 5 seconds
      setTimeout(() => {
        if (this.process && this.status.running) {
          console.log(`[MCP Server] Force killing process...`);
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });

    return this.shutdownPromise;
  }

  /**
   * Send data to the MCP server stdin
   */
  send(data: string | Buffer): boolean {
    if (!this.process || !this.status.running) {
      return false;
    }

    try {
      // Validate input data
      let validatedData: string;
      if (Buffer.isBuffer(data)) {
        validatedData = data.toString('utf8');
      } else if (typeof data === 'string') {
        validatedData = data;
      } else {
        console.error('[MCP Server] Invalid data type for send()');
        return false;
      }

      // Basic validation for JSON-RPC format if applicable
      if (validatedData.trim().startsWith('{')) {
        try {
          JSON.parse(validatedData.trim());
        } catch {
          console.error('[MCP Server] Invalid JSON format in send data');
          return false;
        }
      }

      return this.process.stdin?.write(validatedData) ?? false;
    } catch (error) {
      console.error('[MCP Server] Failed to send data:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get current server status
   */
  getStatus(): MCPServerStatus {
    return { ...this.status };
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.status.running && this.process !== null;
  }

  /**
   * Handle startup errors
   */
  private handleStartupError(error: Error, reject: (error: Error) => void): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }

    this.status.running = false;
    // Sanitize error message to prevent information disclosure
    const sanitizedMessage = error.message.replace(/\/[^\s]*node_modules[^\s]*/g, '[PACKAGE_PATH]');
    this.status.lastError = sanitizedMessage;
    this.process = null;
    
    const sanitizedError = new Error(sanitizedMessage);
    this.emit('error', sanitizedError);
    reject(sanitizedError);
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.status.running = false;
    this.status.pid = undefined;

    if (code !== 0 && code !== null) {
      // Unexpected exit, attempt restart if within limits
      if (this.status.restartCount < this.config.maxRestarts!) {
        this.status.restartCount++;
        console.log(`[MCP Server] Attempting restart ${this.status.restartCount}/${this.config.maxRestarts}`);
        
        setTimeout(() => {
          this.start().catch(error => {
            console.error(`[MCP Server] Restart failed:`, error);
            this.emit('error', error);
          });
        }, 1000 * this.status.restartCount); // Exponential backoff
      } else {
        const error = new Error(`MCP server exceeded max restart attempts (${this.config.maxRestarts})`);
        this.status.lastError = error.message;
        this.emit('error', error);
      }
    }

    this.emit('exit', code, signal);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }

    await this.stop();
    this.removeAllListeners();
  }
}

// Global server instance
let mcpServerManager: MCPServerManager | null = null;

/**
 * Get the global MCP server manager instance for Context7
 */
export function getContext7MCPServerManager(): MCPServerManager {
  if (!mcpServerManager) {
    mcpServerManager = new MCPServerManager({
      command: 'npx',
      args: ['@upstash/context7-mcp'],
      timeout: 10000,
      maxRestarts: 3
    });
  }
  return mcpServerManager;
}

/**
 * Clean up the global MCP server manager
 */
export async function cleanupContext7MCPServer(): Promise<void> {
  if (mcpServerManager) {
    await mcpServerManager.cleanup();
    mcpServerManager = null;
  }
}