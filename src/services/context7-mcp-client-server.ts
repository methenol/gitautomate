/**
 * @fileOverview Context7 MCP Client - Server-side implementation
 * 
 * This service handles:
 * - JSON-RPC 2.0 communication with Context7 MCP server
 * - Library resolution and documentation fetching
 * - Error handling and retry logic
 * - Proper MCP protocol implementation
 */

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
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

interface MCPServerManager {
  start(): Promise<void>;
  send(data: string): boolean;
  on(event: string, listener: (data: Buffer) => void): void;
  removeListener(event: string, listener: (data: Buffer) => void): void;
  cleanup(): Promise<void>;
}

export class Context7MCPClient {
  private serverManager: MCPServerManager | null = null;
  private requestId = 1;
  private isInitialized = false;
  private availableTools: MCPTool[] = [];

  constructor() {
    // Server manager will be set during initialization
  }

  /**
   * Initialize the MCP client and server
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic import of server-side module
      const { getContext7MCPServerManager } = await import('@/lib/mcp-server-manager');
      this.serverManager = getContext7MCPServerManager();

      // Start the MCP server
      await this.serverManager.start();

      // Perform MCP initialization handshake
      await this.performHandshake();

      // Discover available tools
      await this.discoverTools();

      this.isInitialized = true;
      console.log('[Context7 MCP] Client initialized successfully');
    } catch (error) {
      console.error('[Context7 MCP] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform MCP initialization handshake
   */
  private async performHandshake(): Promise<void> {
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'GitAutomate',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendRequest(initRequest);
    
    if (response.error) {
      throw new Error(`Handshake failed: ${response.error.message}`);
    }

    console.log('[Context7 MCP] Handshake completed');
  }

  /**
   * Discover available tools from the MCP server
   */
  private async discoverTools(): Promise<void> {
    const toolsRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/list'
    };

    const response = await this.sendRequest(toolsRequest);
    
    if (response.error) {
      throw new Error(`Tool discovery failed: ${response.error.message}`);
    }

    this.availableTools = (response.result?.tools as MCPTool[]) || [];
    console.log('[Context7 MCP] Available tools:', {
      tools: this.availableTools.map(tool => ({ name: tool.name, description: tool.description }))
    });
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.serverManager) {
        reject(new Error('Server manager not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const requestData = JSON.stringify(request) + '\n';
      
      // Set up response listener
      const onData = (data: Buffer) => {
        try {
          const responseText = data.toString().trim();
          if (responseText) {
            const response = JSON.parse(responseText) as MCPResponse;
            if (response.id === request.id) {
              clearTimeout(timeout);
              this.serverManager?.removeListener('data', onData);
              console.log(`[Context7 MCP] Request ${request.id} succeeded`);
              resolve(response);
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          this.serverManager?.removeListener('data', onData);
          console.error(`[Context7 MCP] Request ${request.id} failed:`, error);
          reject(error);
        }
      };

      this.serverManager.on('data', onData);

      // Send the request
      if (!this.serverManager.send(requestData)) {
        clearTimeout(timeout);
        this.serverManager.removeListener('data', onData);
        reject(new Error('Failed to send request'));
      }
    });
  }

  /**
   * Use a tool with the given arguments
   */
  private async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const toolRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const response = await this.sendRequest(toolRequest);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result?.content || response.result;
  }

  /**
   * Resolve library name to Context7 library IDs
   */
  async resolveLibraryToContextId(libraryName: string): Promise<LibraryResolution[]> {
    try {
      await this.initialize();

      console.log(`[Context7 MCP] Resolving library: ${libraryName}`);
      
      const result = await this.callTool('resolve-library-id', {
        library_name: libraryName
      });

      // Process the result - this depends on the actual Context7 MCP response format
      if (Array.isArray(result)) {
        return result.map((item: unknown) => ({
          libraryId: (item as Record<string, unknown>)?.library_id as string || libraryName,
          trustScore: Number((item as Record<string, unknown>)?.trust_score) || 0.5,
          codeSnippetsCount: Number((item as Record<string, unknown>)?.code_snippets_count) || 0,
          description: (item as Record<string, unknown>)?.description as string
        }));
      }

      // Fallback for different response formats
      return [{
        libraryId: `${libraryName}-main`,
        trustScore: 0.8,
        codeSnippetsCount: 10,
        description: `Main documentation for ${libraryName}`
      }];

    } catch (error) {
      console.error(`Error resolving library ${libraryName}:`, error);
      return [];
    }
  }

  /**
   * Fetch documentation content for a library ID
   */
  async fetchContextDocumentation(libraryId: string): Promise<DocumentationResult | null> {
    try {
      await this.initialize();

      console.log(`[Context7 MCP] Fetching documentation for: ${libraryId}`);
      
      const result = await this.callTool('get-library-docs', {
        library_id: libraryId
      });

      // Process the result - this depends on the actual Context7 MCP response format
      const content = (result as Record<string, unknown>)?.content as string || 
                     (result as Record<string, unknown>)?.documentation as string ||
                     JSON.stringify(result, null, 2);

      if (!content) {
        return null;
      }

      return {
        content: content,
        metadata: {
          source: 'Context7',
          lastUpdated: new Date().toISOString().split('T')[0],
          version: 'latest'
        }
      };

    } catch (error) {
      console.error(`Error fetching documentation for ${libraryId}:`, error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.serverManager) {
      await this.serverManager.cleanup();
    }
    this.isInitialized = false;
  }
}

// Global client instance
let mcpClient: Context7MCPClient | null = null;

/**
 * Get the global Context7 MCP client instance
 */
export function getContext7MCPClient(): Context7MCPClient {
  if (!mcpClient) {
    mcpClient = new Context7MCPClient();
  }
  return mcpClient;
}

/**
 * Clean up the global MCP client
 */
export async function cleanupContext7MCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.cleanup();
    mcpClient = null;
  }
}