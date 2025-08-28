/**
 * @fileOverview Context7 MCP Client - Real MCP integration with JSON-RPC 2.0 protocol
 * 
 * This service handles:
 * - JSON-RPC 2.0 communication with Context7 MCP server
 * - Library resolution and documentation fetching
 * - Error handling and retry logic
 * - Proper MCP protocol implementation
 */

import { getContext7MCPServerManager } from '@/lib/mcp-server-manager';

export interface LibraryResolution {
  libraryId: string;
  trustScore: number;
  codeSnippetsCount: number;
  description?: string;
}

export interface DocumentationResult {
  content: string;
  metadata?: {
    source?: string;
    lastUpdated?: string;
    version?: string;
  };
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class Context7MCPClient {
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private responseBuffer = '';
  private isInitialized = false;

  constructor() {
    this.setupResponseHandler();
  }

  /**
   * Ensure MCP server is initialized with proper handshake
   */
  private async ensureMCPInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[Context7 MCP] Initializing MCP connection...');
      
      // Send initialize request first
      await this.sendMCPRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'gitautomate-context7-client',
          version: '1.0.0'
        }
      });

      // List available tools to understand what's available
      const toolsResult = await this.sendMCPRequest('tools/list', {});
      console.log('[Context7 MCP] Available tools:', toolsResult);

      this.isInitialized = true;
      console.log('[Context7 MCP] Initialization complete');
      
    } catch (error) {
      console.error('[Context7 MCP] Initialization failed:', error);
      throw new Error('Failed to initialize MCP connection');
    }
  }

  /**
   * Resolve library name to Context7 library ID
   */
  async resolveLibraryToContextId(libraryName: string): Promise<LibraryResolution[]> {
    console.log(`[Context7 MCP] Resolving library: ${libraryName}`);
    
    try {
      // First ensure MCP is initialized
      await this.ensureMCPInitialized();
      
      const result = await this.sendMCPRequest('tools/call', {
        name: 'resolve-library-id',
        arguments: {
          libraryName: libraryName
        }
      });

      // Transform result to our interface
      if (result.content && Array.isArray(result.content)) {
        return result.content.map((lib: any) => ({
          libraryId: lib.library_id || lib.id,
          trustScore: lib.trust_score || lib.trustScore || 0,
          codeSnippetsCount: lib.code_snippets_count || lib.codeSnippetsCount || 0,
          description: lib.description
        }));
      }

      return [];
    } catch (error) {
      console.error(`[Context7 MCP] Failed to resolve library ${libraryName}:`, error);
      return [];
    }
  }

  /**
   * Fetch comprehensive documentation for a library
   */
  async fetchContextDocumentation(contextId: string): Promise<DocumentationResult | null> {
    console.log(`[Context7 MCP] Fetching documentation for: ${contextId}`);
    
    try {
      // Ensure MCP is initialized
      await this.ensureMCPInitialized();
      
      const result = await this.sendMCPRequest('tools/call', {
        name: 'get-library-docs',
        arguments: {
          libraryId: contextId
        }
      });

      if (result.content && typeof result.content === 'string') {
        return {
          content: result.content,
          metadata: {
            source: result.metadata?.source || 'Context7',
            lastUpdated: result.metadata?.last_updated || result.metadata?.lastUpdated,
            version: result.metadata?.version
          }
        };
      }

      return null;
    } catch (error) {
      console.error(`[Context7 MCP] Failed to fetch documentation for ${contextId}:`, error);
      return null;
    }
  }

  /**
   * Send JSON-RPC 2.0 request to MCP server
   */
  private async sendMCPRequest(method: string, params?: any): Promise<any> {
    const serverManager = getContext7MCPServerManager();
    
    // Ensure server is running
    if (!serverManager.isRunning()) {
      console.log('[Context7 MCP] Starting MCP server...');
      await serverManager.start();
    }

    const requestId = this.generateRequestId();
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set up timeout (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`MCP request timeout for method: ${method}`));
      }, 30000);

      // Store the pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });

      // Send the request
      const requestData = JSON.stringify(request) + '\n';
      const sent = serverManager.send(requestData);
      
      if (!sent) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Failed to send MCP request - server not available'));
      }

      console.log(`[Context7 MCP] Sent request: ${method} (ID: ${requestId})`);
    });
  }

  /**
   * Setup response handler for MCP server data
   */
  private setupResponseHandler(): void {
    const serverManager = getContext7MCPServerManager();
    
    serverManager.on('data', (data: Buffer) => {
      this.handleResponseData(data.toString());
    });

    serverManager.on('error', (error: Error) => {
      console.error('[Context7 MCP] Server error:', error);
      this.rejectAllPendingRequests(error);
    });

    serverManager.on('exit', () => {
      console.log('[Context7 MCP] Server exited');
      this.rejectAllPendingRequests(new Error('MCP server exited unexpectedly'));
    });
  }

  /**
   * Handle incoming response data from MCP server
   */
  private handleResponseData(data: string): void {
    this.responseBuffer += data;
    
    // Process complete JSON lines
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: MCPResponse = JSON.parse(line);
          this.handleMCPResponse(response);
        } catch (error) {
          console.error('[Context7 MCP] Failed to parse response:', error, 'Line:', line);
        }
      }
    }
  }

  /**
   * Handle a parsed MCP response
   */
  private handleMCPResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    
    if (!pending) {
      console.warn(`[Context7 MCP] Received response for unknown request ID: ${response.id}`);
      return;
    }

    // Clean up
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    // Handle response
    if (response.error) {
      console.error(`[Context7 MCP] Request ${response.id} failed:`, response.error);
      pending.reject(new Error(`MCP Error: ${response.error.message} (Code: ${response.error.code})`));
    } else {
      console.log(`[Context7 MCP] Request ${response.id} succeeded`);
      pending.resolve(response.result);
    }
  }

  /**
   * Reject all pending requests (on server error/exit)
   */
  private rejectAllPendingRequests(error: Error): void {
    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('[Context7 MCP] Cleaning up client...');
    
    // Reset initialization state
    this.isInitialized = false;
    
    // Reject all pending requests
    this.rejectAllPendingRequests(new Error('Client shutting down'));
    
    // Stop the MCP server
    const serverManager = getContext7MCPServerManager();
    await serverManager.cleanup();
  }

  /**
   * Check if MCP server is available
   */
  isServerAvailable(): boolean {
    const serverManager = getContext7MCPServerManager();
    return serverManager.isRunning();
  }

  /**
   * Get server status
   */
  getServerStatus() {
    const serverManager = getContext7MCPServerManager();
    return serverManager.getStatus();
  }
}

// Singleton instance
let context7Client: Context7MCPClient | null = null;

/**
 * Get the global Context7 MCP client instance
 */
export function getContext7MCPClient(): Context7MCPClient {
  if (!context7Client) {
    context7Client = new Context7MCPClient();
  }
  return context7Client;
}

/**
 * Clean up the global Context7 MCP client
 */
export async function cleanupContext7MCPClient(): Promise<void> {
  if (context7Client) {
    await context7Client.cleanup();
    context7Client = null;
  }
}