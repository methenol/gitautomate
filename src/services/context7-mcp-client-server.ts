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
    if (!text || text.length > 100000) { // Allow much larger payloads - Context7 docs can be large
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
  private static lastRequestTime: number = 0;
  private static readonly MIN_REQUEST_INTERVAL = 20000; // 20 seconds minimum between requests

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
   * Ensure minimum 20-second delay between Context7 requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - Context7MCPClient.lastRequestTime;
    
    if (timeSinceLastRequest < Context7MCPClient.MIN_REQUEST_INTERVAL) {
      const waitTime = Context7MCPClient.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[Context7 MCP] Rate limiting: waiting ${waitTime}ms since last request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    Context7MCPClient.lastRequestTime = Date.now();
  }

  /**
   * Send a JSON-RPC request to the MCP server with timeout retry logic
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    let timeoutAttempts = 0;
    const maxTimeoutAttempts = 20;
    let delay = 20000; // Start with 20 seconds delay for rate limiting
    let lastError: Error | null = null;

    while (timeoutAttempts < maxTimeoutAttempts) {
      try {
        // Add delay between timeout retries
        if (timeoutAttempts > 0) {
          console.log(`[Context7 MCP] Timeout retry ${timeoutAttempts}/${maxTimeoutAttempts}, waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const response = await new Promise<MCPResponse>((resolve, reject) => {
          if (!this.serverManager) {
            reject(new Error('Server manager not initialized'));
            return;
          }

          const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
          }, 8000); // Reduced timeout from 10s to 8s for faster retries

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

        // Success - return the response
        return response;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if it's a timeout error
        if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
          timeoutAttempts++;
          lastError = error instanceof Error ? error : new Error(errorMessage);
          
          // Exponential backoff: 20s → 40s → 60s (capped at 60s)
          delay = Math.min(delay * 2, 60000);
          continue; // Retry
        }
        
        // Non-timeout error - throw immediately
        throw error;
      }
    }
    
    // Exhausted all timeout retries
    throw lastError || new Error(`Request timeout exceeded after ${maxTimeoutAttempts} attempts`);
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
    
    // Enforce minimum 20-second delay between all Context7 requests
    await this.enforceRateLimit();
    
    let lastError: Error | null = null;
    let rateLimitAttempts = 0;
    const maxRateLimitAttempts = 20;
    let delay = 20000; // Start with 20 seconds delay for rate limiting
    
    while (rateLimitAttempts < maxRateLimitAttempts) {
      try {
        // Add delay between requests for rate limiting (only for retries)
        if (rateLimitAttempts > 0) {
          console.log(`[Context7 MCP] Rate limit retry ${rateLimitAttempts}/${maxRateLimitAttempts}, waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Update last request time after retry delay
          Context7MCPClient.lastRequestTime = Date.now();
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
            
            // Exponential backoff: 20s → 40s → 60s (capped at 60s)
            delay = Math.min(delay * 2, 60000);
            continue; // Retry
          }
          
          throw new Error(`Tool call failed: ${errorMessage}`);
        }

        // Success - check response content for rate limiting
        const result = response.result?.content || response.result;
        const resultContent = this.extractContentFromMCPResponse(result);
        
        // Check if successful response contains rate limit message
        if (resultContent && (
            resultContent.toLowerCase().includes('rate limited') ||
            resultContent.toLowerCase().includes('too many requests') ||
            resultContent.toLowerCase().includes('rate limit'))) {
          
          rateLimitAttempts++;
          lastError = new Error(`Rate limit in response: ${resultContent.substring(0, 100)}`);
          
          // Exponential backoff: 20s → 40s → 60s (capped at 60s)
          delay = Math.min(delay * 2, 60000);
          continue; // Retry
        }
        
        // Success - return result
        return result;
        
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
          
          // Exponential backoff: 20s → 40s → 60s (capped at 60s)
          delay = Math.min(delay * 2, 60000);
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
          // Extract Context7-compatible library ID - allow more characters including dots
          const idMatch = line.match(/^-?\s*Context7-compatible library ID:\s*(\/[\w\-_./]+)/);
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
          
          // Extract trust score (normalize from 0-10 scale to 0-1 scale)
          const trustMatch = line.match(/^-?\s*Trust Score:\s*(\d+(?:\.\d+)?)/);
          if (trustMatch) {
            trustScore = parseFloat(trustMatch[1]) / 10; // Normalize 0-10 to 0-1
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
      
      // Sort by name similarity, trust score and code snippets count
      libraries.sort((a, b) => {
        // Calculate name similarity (simple contains check and length similarity)
        const aNameMatch = a.libraryId.toLowerCase().includes(originalLibraryName.toLowerCase()) ? 1 : 0;
        const bNameMatch = b.libraryId.toLowerCase().includes(originalLibraryName.toLowerCase()) ? 1 : 0;
        
        if (aNameMatch !== bNameMatch) {
          return bNameMatch - aNameMatch; // Prefer name matches
        }
        
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
      
      // Use resolve-library-id tool as the PRIMARY and ONLY method - no fallbacks
      console.log(`[Context7 MCP] Using resolve-library-id tool for: ${sanitizedLibraryName}`);
      
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

      // No fallbacks - if resolve-library-id fails, return empty array
      return [];

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error resolving library ${libraryName}: ${errorMessage}`);
      
      // Re-throw all errors - no fallbacks
      throw error;
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

      const content = this.extractContentFromMCPResponse(result);
      
      if (!content || this.isErrorResponse(content)) {
        console.warn(`[Context7 MCP] Documentation fetch error: ${content}`);
        return null;
      }

      return this.createDocumentationResult(content, sanitizedLibraryId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      console.error(`Error fetching documentation for ${libraryId}: ${errorMessage}`);
      
      // Re-throw all errors - no fallbacks
      throw error;
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
   * Check if response indicates an error (not including rate limits)
   */
  private isErrorResponse(content: string): boolean {
    // Only flag actual error messages, not documentation content or rate limits
    const trimmedContent = content.trim();
    
    // Rate limiting should be handled by retry logic, not treated as permanent error
    if (trimmedContent.includes('Rate limited') || 
        trimmedContent.includes('too many requests') ||
        trimmedContent.includes('rate limit')) {
      return false; // Let retry logic handle this
    }
    
    // Check for specific Context7 error messages
    if (trimmedContent.includes('The library you are trying to access does not exist')) {
      return true;
    }
    
    if (trimmedContent.includes('Please try with a different library ID')) {
      return true;
    }
    
    // Check if content starts with error indicators
    const errorStarters = [
      /^error:/i,
      /^failed:/i,
      /^no documentation available/i,
      /^invalid library/i,
      /^library not found/i
    ];
    
    if (errorStarters.some(pattern => pattern.test(trimmedContent))) {
      return true;
    }
    
    // If content contains CODE SNIPPETS or other documentation indicators, it's valid
    if (trimmedContent.includes('CODE SNIPPETS') || 
        trimmedContent.includes('TITLE:') ||
        trimmedContent.includes('DESCRIPTION:') ||
        trimmedContent.includes('SOURCE:') ||
        trimmedContent.length > 500) {
      return false;
    }
    
    return false;
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