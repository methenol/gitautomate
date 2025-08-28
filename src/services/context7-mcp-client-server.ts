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
    libraryId?: string;
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
  public availableTools: MCPTool[] = [];

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
   * Call a tool with rate limiting and exponential backoff
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // Validate tool name
    if (typeof toolName !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(toolName)) {
      throw new Error('Invalid tool name');
    }
    
    // Validate and sanitize arguments
    const sanitizedArgs = validateToolArgs(args);
    
    let lastError: Error | null = null;
    let rateLimitAttempts = 0;
    const maxRateLimitAttempts = 20;
    let delay = 1000; // Start with 1 second delay
    
    while (rateLimitAttempts < maxRateLimitAttempts) {
      try {
        // Add delay between requests for rate limiting
        if (rateLimitAttempts > 0) {
          console.log(`[Context7 MCP] Rate limit retry ${rateLimitAttempts}/${maxRateLimitAttempts}, waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
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
          
          // Check for rate limiting errors
          if (response.error.code === 429 || 
              errorMessage.toLowerCase().includes('rate limit') ||
              errorMessage.toLowerCase().includes('too many requests') ||
              errorMessage.toLowerCase().includes('quota exceeded') ||
              errorMessage.toLowerCase().includes('throttled')) {
            
            rateLimitAttempts++;
            lastError = new Error(`Rate limit: ${errorMessage}`);
            
            // Exponential backoff: 1s → 2s → 4s → 8s → 10s (capped)
            delay = Math.min(delay * 2, 10000);
            continue; // Retry
          }
          
          throw new Error(`Tool call failed: ${errorMessage}`);
        }

        // Success - return result
        return response.result?.content || response.result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if it's a rate limiting error
        if (errorMessage.includes('rate limit') || 
            errorMessage.includes('Rate limit') ||
            errorMessage.includes('429') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('quota exceeded') ||
            errorMessage.includes('throttled')) {
          
          rateLimitAttempts++;
          lastError = error instanceof Error ? error : new Error(errorMessage);
          
          // Exponential backoff: 1s → 2s → 4s → 8s → 10s (capped)
          delay = Math.min(delay * 2, 10000);
          continue; // Retry
        }
        
        // Non-rate-limit error - throw immediately
        throw error;
      }
    }
    
    // Exhausted all rate limit retries
    throw lastError || new Error(`Rate limit exceeded after ${maxRateLimitAttempts} attempts`);
  }

  /**
   * Parse Context7 resolve-library-id response to extract library information
   */
  private parseResolveLibraryResponse(responseText: string, originalLibraryName: string): LibraryResolution[] {
    const libraries: LibraryResolution[] = [];
    
    try {
      console.log(`[Context7 MCP] Parsing resolve response for ${originalLibraryName}`);
      
      // Split response into individual library entries
      const entries = responseText.split('----------').filter(entry => entry.trim());
      
      for (const entry of entries) {
        const lines = entry.split('\n').map(line => line.trim()).filter(line => line);
        
        let libraryId = '';
        let description = '';
        let codeSnippetsCount = 0;
        let trustScore = 0;
        
        for (const line of lines) {
          // Extract Context7-compatible library ID
          const idMatch = line.match(/^-?\s*Context7-compatible library ID:\s*(\/[\w\-_/]+)/);
          if (idMatch) {
            libraryId = idMatch[1];
            continue;
          }
          
          // Extract description
          const descMatch = line.match(/^-?\s*Description:\s*(.+)/);
          if (descMatch) {
            description = descMatch[1];
            continue;
          }
          
          // Extract code snippets count
          const snippetsMatch = line.match(/^-?\s*Code Snippets:\s*(\d+)/);
          if (snippetsMatch) {
            codeSnippetsCount = parseInt(snippetsMatch[1], 10) || 0;
            continue;
          }
          
          // Extract trust score
          const trustMatch = line.match(/^-?\s*Trust Score:\s*(\d+(?:\.\d+)?)/);
          if (trustMatch) {
            trustScore = parseFloat(trustMatch[1]) / 10; // Normalize to 0-1 range
            continue;
          }
        }
        
        // Add library if we found a valid ID
        if (libraryId) {
          libraries.push({
            libraryId,
            trustScore: Math.max(0, Math.min(1, trustScore)),
            codeSnippetsCount,
            description: description || `Documentation for ${originalLibraryName}`
          });
        }
      }
      
      // Sort by trust score and code snippets count (prefer higher scores and more snippets)
      libraries.sort((a, b) => {
        if (a.trustScore !== b.trustScore) {
          return b.trustScore - a.trustScore; // Higher trust score first
        }
        return b.codeSnippetsCount - a.codeSnippetsCount; // More snippets first
      });
      
      console.log(`[Context7 MCP] Parsed ${libraries.length} libraries for ${originalLibraryName}`);
      
    } catch (error) {
      console.error(`[Context7 MCP] Error parsing resolve response:`, error);
    }
    
    return libraries;
  }

  /**
   * Resolve library name to Context7 library IDs using resolve-library-id tool
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
      
      // Use resolve-library-id tool as the PRIMARY method
      console.log(`[Context7 MCP] Using resolve-library-id tool for: ${sanitizedLibraryName}`);
      
      try {
        const result = await this.callTool('resolve-library-id', { 
          libraryName: sanitizedLibraryName 
        });

        // Extract response text from MCP response format
        const responseText = this.extractContentFromMCPResponse(result);

        if (responseText && !this.isErrorResponse(responseText)) {
          console.log(`[Context7 MCP] resolve-library-id returned ${responseText.length} characters`);
          const libraries = this.parseResolveLibraryResponse(responseText, sanitizedLibraryName);
          
          if (libraries.length > 0) {
            console.log(`[Context7 MCP] Successfully resolved ${libraries.length} libraries for ${sanitizedLibraryName}`);
            return libraries;
          }
        } else {
          console.warn(`[Context7 MCP] resolve-library-id returned error or empty response: ${responseText}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Context7 MCP] resolve-library-id tool failed: ${errorMessage}`);
        
        // Check if it's a rate limiting error
        if (errorMessage.includes('rate limit') || 
            errorMessage.includes('Rate limit') ||
            errorMessage.includes('429') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('quota exceeded') ||
            errorMessage.includes('throttled')) {
          throw new Error(`Rate limit: ${errorMessage}`);
        }
        
        // For non-rate-limit errors, continue to fallback
      }

      // Fallback: return a generic result if resolve-library-id fails
      console.log(`[Context7 MCP] No resolution found, returning fallback for: ${sanitizedLibraryName}`);
      return [{
        libraryId: sanitizedLibraryName.toLowerCase(),
        trustScore: 0.2, // Low trust for fallback
        codeSnippetsCount: 1,
        description: `Documentation search for ${sanitizedLibraryName} (no specific library found)`
      }];

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error resolving library ${libraryName}: ${errorMessage}`);
      
      // Check if it's a rate limiting error and re-throw with proper classification
      if (errorMessage.includes('rate limit') || 
          errorMessage.includes('Rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('too many requests') ||
          errorMessage.includes('quota exceeded') ||
          errorMessage.includes('throttled')) {
        throw new Error(`Rate limit: ${errorMessage}`);
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
      
      // Validate library ID format - Context7 expects /org/project format
      if (!sanitizedLibraryId.startsWith('/') && !sanitizedLibraryId.includes('/')) {
        // Try to construct a valid format
        const possibleFormats = [
          `/${sanitizedLibraryId}/${sanitizedLibraryId}`,
          `/${sanitizedLibraryId}/core`,
          `/${sanitizedLibraryId}js/${sanitizedLibraryId}`,
        ];
        
        for (const format of possibleFormats) {
          try {
            const result = await this.callTool('get-library-docs', {
              context7CompatibleLibraryID: format
            });
            
            const content = this.extractContentFromMCPResponse(result);
            if (content && !this.isErrorResponse(content)) {
              return this.createDocumentationResult(content, format);
            }
          } catch (error) {
            // Continue to next format
            console.warn(`[Context7 MCP] Format ${format} failed:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
        
        // If no format worked, return null
        console.warn(`[Context7 MCP] No valid format found for library ID: ${sanitizedLibraryId}`);
        return null;
      }
      
      const result = await this.callTool('get-library-docs', {
        context7CompatibleLibraryID: sanitizedLibraryId
      });

      const content = this.extractContentFromMCPResponse(result);
      
      if (!content || this.isErrorResponse(content)) {
        console.warn(`[Context7 MCP] Documentation fetch error: ${content}`);
        return null;
      }

      return this.createDocumentationResult(content, sanitizedLibraryId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error fetching documentation for ${libraryId}: ${errorMessage}`);
      
      // Check if it's a rate limiting error and re-throw with proper classification
      if (errorMessage.includes('rate limit') || 
          errorMessage.includes('Rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('too many requests') ||
          errorMessage.includes('quota exceeded') ||
          errorMessage.includes('throttled')) {
        throw new Error(`Rate limit: ${errorMessage}`);
      }
      
      return null;
    }
  }

  /**
   * Extract text content from MCP response format
   */
  private extractContentFromMCPResponse(result: unknown): string {
    let content = '';
    
    if (Array.isArray(result)) {
      // Handle content array format
      for (const item of result) {
        if (typeof item === 'object' && item !== null && 'type' in item && 'text' in item) {
          content += (item as { type: string; text: string }).text + '\n';
        }
      }
    } else if (typeof result === 'object' && result !== null && 'content' in result) {
      // Handle full MCP response format
      const contentArray = (result as { content: unknown }).content;
      if (Array.isArray(contentArray)) {
        for (const item of contentArray) {
          if (typeof item === 'object' && item !== null && 'type' in item && 'text' in item) {
            content += (item as { type: string; text: string }).text + '\n';
          }
        }
      }
    } else if (typeof result === 'string') {
      content = result;
    }

    return content.trim();
  }

  /**
   * Check if response indicates an error
   */
  private isErrorResponse(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return lowerContent.includes('error') || 
           lowerContent.includes('failed') ||
           lowerContent.includes('not found') ||
           lowerContent.includes('documentation not found') ||
           lowerContent.includes('error code:');
  }

  /**
   * Create a documentation result object
   */
  private createDocumentationResult(content: string, libraryId: string): DocumentationResult {
    // Limit content size for security
    const limitedContent = content.length > 50000 ? content.substring(0, 50000) + '\n\n[Content truncated for security]' : content;

    return {
      content: limitedContent,
      metadata: {
        source: 'Context7',
        lastUpdated: new Date().toISOString().split('T')[0],
        version: 'latest',
        libraryId: libraryId
      }
    };
  }

  /**
   * Finalize a library resolution object
   */
  private finalizeLibraryResolution(partial: Partial<LibraryResolution>, fallbackName: string): LibraryResolution {
    return {
      libraryId: partial.libraryId || fallbackName.toLowerCase(),
      trustScore: Math.max(0, Math.min(1, partial.trustScore || 0.5)),
      codeSnippetsCount: Math.max(0, partial.codeSnippetsCount || 0),
      description: (partial.description || `Documentation for ${fallbackName}`).substring(0, 500)
    };
  }
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