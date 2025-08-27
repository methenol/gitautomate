import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface MCPServerManager {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
}

export class Context7MCPServerManager implements MCPServerManager {
  private process: ChildProcess | null = null;
  private isServerRunningInternal = false;

  async start(): Promise<void> {
    if (this.isRunning()) return;
    
    try {
      // Check if @upstash/context7-mcp is installed
      const packagePath = path.resolve(process.cwd(), 'node_modules', '@upstash', 'context7-mcp');
      
      this.process = spawn('npx', ['@upstash/context7-mcp'], {
        stdio: 'pipe',
        env: { ...process.env }
      });

      this.process.stdout?.on('data', (data) => {
        console.log('[Context7 MCP Server]', data.toString().trim());
      });

      this.process.stderr?.on('data', (data) => {
        console.error('[Context7 MCP Server Error]', data.toString().trim());
      });

      this.process.on('exit', (code, signal) => {
        console.log(`Context7 MCP server exited with code ${code}, signal ${signal}`);
        this.isServerRunningInternal = false;
      });

      // Wait a bit for the server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.isServerRunningInternal = true;
    } catch (error) {
      console.error('Failed to start Context7 MCP server:', error);
      throw new Error(`Context7 MCP server startup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  stop(): void {
    if (this.process) {
      this.killProcessTree(this.process.pid);
      this.process = null;
    }
    this.isServerRunningInternal = false;
  }

  isRunning(): boolean {
    return this.isServerRunningInternal && (this.process !== null);
  }

  private killProcessTree(pid?: number | undefined): void {
    if (!pid) return;
    
    try {
      // Try to terminate the process gracefully
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/f']);
      } else {
        // On Unix-like systems, send SIGTERM
        process.kill(pid, 'SIGTERM');
        
        // Force kill after a timeout if it doesn't exit
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            // Process already terminated
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Error killing process:', error);
    }
  }

  getStdio() {
    return this.process ? { 
      stdin: this.process.stdin, 
      stdout: this.process.stdout, 
      stderr: this.process.stderr 
    } : null;
  }
}
