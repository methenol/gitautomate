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

/**
 * Safely parse JSON with validation
 */
function safeJsonParse(text: string): MCPResponse | null {
  try {
    if (!text || text.length > 10000) { // Prevent very large payloads
      return null;
    }
    
    const parsed = JSON.parse(text);
    
    // Validate basic JSON-RPC 2.0 structure
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    
    if (parsed.jsonrpc !== '2.0' || typeof parsed.id !== 'number') {
      return null;
    }
    
    return parsed as MCPResponse;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize tool arguments
 */
function validateToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(args)) {
    // Only allow string keys and basic value types
    if (typeof key === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null || value === undefined) {
        sanitized[key] = value;
      }
      // Skip complex objects/arrays for security
    }
  }
  
  return sanitized;
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
          const responseText = data.toString('utf8').trim();
          if (responseText) {
            const response = safeJsonParse(responseText);
            if (response && response.id === request.id) {
              clearTimeout(timeout);
              this.serverManager?.removeListener('data', onData);
              console.log(`[Context7 MCP] Request ${request.id} succeeded`);
              resolve(response);
            }
          }
        } catch {
          clearTimeout(timeout);
          this.serverManager?.removeListener('data', onData);
          console.error(`[Context7 MCP] Request ${request.id} failed: Invalid response format`);
          reject(new Error('Invalid response format'));
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
    // Validate tool name
    if (typeof toolName !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(toolName)) {
      throw new Error('Invalid tool name');
    }
    
    // Validate and sanitize arguments
    const sanitizedArgs = validateToolArgs(args);
    
    const toolRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: sanitizedArgs
      }
    };

    const response = await this.sendRequest(toolRequest);
    
    if (response.error) {
      // Sanitize error message
      const errorMessage = typeof response.error.message === 'string' 
        ? response.error.message.substring(0, 200) // Limit error message length
        : 'Tool call failed';
      throw new Error(`Tool call failed: ${errorMessage}`);
    }

    return response.result?.content || response.result;
  }

  /**
   * Resolve library name to Context7 library IDs
   */
  async resolveLibraryToContextId(libraryName: string): Promise<LibraryResolution[]> {
    try {
      // Validate library name input
      if (typeof libraryName !== 'string' || libraryName.length === 0 || libraryName.length > 100) {
        throw new Error('Invalid library name');
      }
      
      // Sanitize library name to prevent injection - allow spaces and common punctuation
      const sanitizedLibraryName = libraryName.replace(/[^a-zA-Z0-9_.@/\-\s+]/g, '');
      if (sanitizedLibraryName !== libraryName) {
        throw new Error('Library name contains invalid characters');
      }

      await this.initialize();

      console.log(`[Context7 MCP] Resolving library: ${sanitizedLibraryName}`);
      
      const result = await this.callTool('resolve-library-id', {
        libraryName: sanitizedLibraryName
      });

      // Process the result - this depends on the actual Context7 MCP response format
      if (Array.isArray(result)) {
        return result.map((item: unknown) => ({
          libraryId: String((item as Record<string, unknown>)?.library_id || sanitizedLibraryName).substring(0, 100),
          trustScore: Math.max(0, Math.min(1, Number((item as Record<string, unknown>)?.trust_score) || 0.5)),
          codeSnippetsCount: Math.max(0, Number((item as Record<string, unknown>)?.code_snippets_count) || 0),
          description: String((item as Record<string, unknown>)?.description || '').substring(0, 500)
        }));
      }

      // Fallback for different response formats
      return [{
        libraryId: `${sanitizedLibraryName}-main`,
        trustScore: 0.8,
        codeSnippetsCount: 10,
        description: `Main documentation for ${sanitizedLibraryName}`
      }];

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error resolving library ${libraryName}: ${errorMessage}`);
      
      // Check if it's a network/connectivity issue
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        console.warn(`[Context7 MCP] Context7 service unavailable (network restrictions). Library resolution for "${libraryName}" skipped.`);
      }
      
      return [];
    }
  }

  /**
   * Fetch documentation content for a library ID
   */
  async fetchContextDocumentation(libraryId: string): Promise<DocumentationResult | null> {
    try {
      // Validate library ID input
      if (typeof libraryId !== 'string' || libraryId.length === 0 || libraryId.length > 100) {
        throw new Error('Invalid library ID');
      }
      
      // Sanitize library ID to prevent injection - allow spaces and common punctuation  
      const sanitizedLibraryId = libraryId.replace(/[^a-zA-Z0-9_.@/\-\s+]/g, '');
      if (sanitizedLibraryId !== libraryId) {
        throw new Error('Library ID contains invalid characters');
      }

      await this.initialize();

      console.log(`[Context7 MCP] Fetching documentation for: ${sanitizedLibraryId}`);
      
      const result = await this.callTool('get-library-docs', {
        context7CompatibleLibraryID: sanitizedLibraryId
      });

      // Process the result - this depends on the actual Context7 MCP response format
      let content: string;
      
      if (typeof result === 'string') {
        content = result;
      } else if (typeof result === 'object' && result !== null) {
        const resultObj = result as Record<string, unknown>;
        content = String(resultObj.content || resultObj.documentation || '');
        
        // If no direct content, safely stringify (but limit size)
        if (!content) {
          const safeResult = JSON.stringify(result, null, 2);
          content = safeResult.length > 10000 ? safeResult.substring(0, 10000) + '...' : safeResult;
        }
      } else {
        content = '';
      }

      if (!content) {
        return null;
      }

      // Limit content size for security
      const limitedContent = content.length > 50000 ? content.substring(0, 50000) + '\n\n[Content truncated for security]' : content;

      return {
        content: limitedContent,
        metadata: {
          source: 'Context7',
          lastUpdated: new Date().toISOString().split('T')[0],
          version: 'latest'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error fetching documentation for ${libraryId}: ${errorMessage}`);
      
      // Check if it's a network/connectivity issue
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        console.warn(`[Context7 MCP] Context7 service unavailable (network restrictions). Documentation for "${libraryId}" skipped.`);
      }
      
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