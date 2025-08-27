

import { Context7MCPServerManager } from '@/lib/mcp-server-manager';

interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown[];
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class Context7MCPClient {
  private serverManager: Context7MCPServerManager;
  private requestCounter = 0;

  constructor(serverManager: Context7MCPServerManager) {
    this.serverManager = serverManager;
  }

  private async sendRequest(method: string, params: unknown[] = []): Promise<unknown> {
    if (!this.serverManager.isRunning()) {
      throw new Error('Context7 MCP server is not running');
    }

    const stdio = this.serverManager.getStdio();
    if (!stdio || !stdio.stdin || !stdio.stdout) {
      throw new Error('MCP server stdio is not available');
    }

    const id = ++this.requestCounter;
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      let responseReceived = false;
      
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('Request timed out'));
        }
      }, 30000);

      const handleMessage = (data: Buffer) => {
        try {
          const responseLines = data.toString().split('\n').filter(line => line.trim());
          
          for (const responseLine of responseLines) {
            const response: JSONRPCResponse = JSON.parse(responseLine);
            
            if (response.id === id) {
              responseReceived = true;
              
              stdio.stdout?.off('data', handleMessage);
              
              if (response.error) {
                reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
              } else {
                resolve(response.result);
              }
              
              clearTimeout(timeoutId);
            }
          }
        } catch (error) {
          console.error('Error parsing MCP response:', error);
        }
      };

      stdio.stdout?.on('data', handleMessage);

      try {
        const messageStr = JSON.stringify(message) + '\n';
        stdio.stdin?.write(messageStr);
      } catch (error) {
        responseReceived = true;
        clearTimeout(timeoutId);
        stdio.stdout?.off('data', handleMessage);
        reject(new Error(`Failed to send request: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  async resolveLibraryToContextId(libraryName: string): Promise<unknown[]> {
    try {
      console.log(`[Context7 MCP] Resolving library: ${libraryName}`);
      
      const response = await this.sendRequest('context7_resolve-library-id', [libraryName]);
      
      console.log(`[Context7 MCP] Resolution response for ${libraryName}:`, JSON.stringify(response, null, 2));
      
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`[Context7 MCP] Failed to resolve library ${libraryName}:`, error);
      
      if (error instanceof Error && 
          (error.message.includes('MCP server is not running') || error.message.includes('timeout'))) {
        throw new Error(`Context7 MCP server unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return [];
    }
  }

  async fetchContextDocumentation(contextId: string): Promise<string | null> {
    try {
      console.log(`[Context7 MCP] Fetching documentation for context ID: ${contextId}`);
      
      const response = await this.sendRequest('context7_get-library-docs', [contextId]);
      
      if (typeof response === 'string' && response.trim()) {
        console.log(`[Context7 MCP] Successfully fetched documentation for ${contextId}, length:`, response.length);
        return response;
      } else {
        console.warn(`[Context7 MCP] Empty or invalid documentation received for ${contextId}`);
        return null;
      }
    } catch (error) {
      console.error(`[Context7 MCP] Failed to fetch documentation for ${contextId}:`, error);
      
      if (error instanceof Error && 
          (error.message.includes('MCP server is not running') || error.message.includes('timeout'))) {
        throw new Error(`Context7 MCP server unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return null;
    }
  }

  async close(): Promise<void> {
    // Clean up any listeners
    if (this.serverManager.isRunning()) {
      const stdio = this.serverManager.getStdio();
      if (stdio) {
        // Remove all listeners to prevent memory leaks
        stdio.stdout?.removeAllListeners();
      }
    }
  }
}


