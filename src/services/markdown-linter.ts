import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import sanitize from 'sanitize-filename';

export interface MarkdownLintResult {
  isValid: boolean;
  errors: string[];
  fixedContent?: string;
}

export class MarkdownLinter {
  /**
   * Sanitize filename to prevent command injection and path traversal
   */
  private static sanitizeFilename(filename: string): string {
    let sanitized = '';
    if (typeof filename === 'string') {
      sanitized = sanitize(filename);
    }
    // Ensure fallback and enforced .md extension
    if (!sanitized) {
      sanitized = 'document.md';
    } else if (!sanitized.endsWith('.md')) {
      sanitized += '.md';
    }
    // Limiting length, extra safety
    if (sanitized.length > 50) {
      sanitized = sanitized.slice(0, 50);
    }
    return sanitized;
  }

  /**
   * Validate that the path is within the expected directory and secure
   */
  private static validatePath(filePath: string, expectedDir: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(expectedDir);
      
      // Ensure the path is within the expected directory
      const isWithinDir = resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
      
      // Additional security checks
      const pathComponents = resolvedPath.split(path.sep);
      const hasTraversal = pathComponents.some(component => component === '..' || component === '.');
      
      return isWithinDir && !hasTraversal;
    } catch {
      return false;
    }
  }

  /**
   * Safely execute markdownlint command with proper argument handling
   */
  private static async executeMarkdownLint(args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const child = spawn('npx', ['markdownlint-cli2', ...args], {
        cwd,
        stdio: 'pipe',
        shell: false // Prevent shell injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stderr || stdout
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: error.message
        });
      });

      // Set timeout to prevent hanging
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: 'Command timed out'
        });
      }, 30000); // 30 second timeout
    });
  }
  /**
   * Lint markdown content and attempt to fix common issues
   */
  static async lintAndFix(content: string, filename = 'document.md'): Promise<MarkdownLintResult> {
    try {
      // Input validation
      if (!content || typeof content !== 'string') {
        return {
          isValid: false,
          errors: ['Invalid content provided']
        };
      }

      // Sanitize the filename to prevent security issues
      const safeFilename = this.sanitizeFilename(filename);
      
      // Create a secure temporary directory
      const tempDir = path.resolve('/tmp/markdown-lint');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.resolve(tempDir, safeFilename);

      // Strong containment check: Normalize and resolve path
      let realTempDir: string;
      let realTempFile: string;
      try {
        realTempDir = await fs.realpath(tempDir);
        // Join the sanitized filename with the resolved temp directory
        realTempFile = path.join(realTempDir, safeFilename);
      } catch {
        return {
          isValid: false,
          errors: ['Failed to resolve temporary directory or file path']
        };
      }
      // Ensure realTempFile is inside realTempDir after normalization
      if (!(realTempFile.startsWith(realTempDir + path.sep) || realTempFile === realTempDir)) {
        return {
          isValid: false,
          errors: ['Invalid filename provided - security violation']
        };
      }

      // Write content to temp file with size limit
      if (content.length > 1024 * 1024) { // 1MB limit
        return {
          isValid: false,
          errors: ['Content too large for processing']
        };
      }
      await fs.writeFile(realTempFile, content, { mode: 0o600 }); // Restrict file permissions


      // First, try to fix automatically using secure command execution
      let fixedContent = content;
      try {
        const fixResult = await this.executeMarkdownLint(['--fix', safeFilename], tempDir);
        if (fixResult.success) {
          fixedContent = await fs.readFile(realTempFile, 'utf-8');
        }
      } catch {
        // Auto-fix failed, content may have issues
      }

      // Now check if the fixed content is valid using secure command execution
      try {
        const lintResult = await this.executeMarkdownLint([safeFilename], tempDir);
        
        if (lintResult.success) {
          // Clean up and return success
          await fs.unlink(realTempFile).catch(() => {});
          return {
            isValid: true,
            errors: [],
            fixedContent: fixedContent !== content ? fixedContent : undefined
          };
        } else {
          const errors = this.parseMarkdownLintErrors(lintResult.output);
          
          // Clean up temp file
          await fs.unlink(realTempFile).catch(() => {});
          
          // Apply manual fixes for common issues
          const manuallyFixed = this.applyManualFixes(fixedContent);
          
          // If we made manual fixes, test again
          if (manuallyFixed !== fixedContent) {
            await fs.writeFile(tempFile, manuallyFixed, { mode: 0o600 });
            const finalResult = await this.executeMarkdownLint([safeFilename], tempDir);
            
            if (finalResult.success) {
              // Manual fixes worked
              await fs.unlink(tempFile).catch(() => {});
              return {
                isValid: true,
                errors: [],
                fixedContent: manuallyFixed
              };
            } else {
              // Still has errors
              await fs.unlink(tempFile).catch(() => {});
            }
          }
          
          return {
            isValid: false,
            errors,
            fixedContent: manuallyFixed !== content ? manuallyFixed : undefined
          };
        }
      } catch (error) {
        await fs.unlink(realTempFile).catch(() => {});
        return {
          isValid: false,
          errors: [`Linting failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Linting failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Parse markdownlint error output into readable messages
   */
  private static parseMarkdownLintErrors(errorOutput: string): string[] {
    const errors: string[] = [];
    const lines = errorOutput.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.includes('Command failed')) {
        errors.push(line.trim());
      }
    }
    
    return errors.length > 0 ? errors : ['Unknown markdown formatting errors'];
  }

  /**
   * Apply common manual fixes that markdownlint-cli2 might not handle
   */
  private static applyManualFixes(content: string): string {
    let fixed = content;

    // Fix: Ensure single trailing newline
    fixed = fixed.replace(/\n+$/, '\n');
    
    // Fix: Remove trailing whitespace
    fixed = fixed.replace(/ +$/gm, '');
    
    // Fix: Ensure headers have blank line before them (except first line)
    fixed = fixed.replace(/(?<!^|\n\n)(^#{1,6} .+)/gm, '\n$1');
    
    // Fix: Ensure headers have blank line after them
    fixed = fixed.replace(/(^#{1,6} .+$)(?!\n\n|\n$)/gm, '$1\n');
    
    // Fix: Ensure list items are properly formatted
    fixed = fixed.replace(/^(\s*[-*+])\s+/gm, '$1 ');
    fixed = fixed.replace(/^(\s*\d+\.)\s+/gm, '$1 ');
    
    // Fix: Ensure blank lines around code blocks
    fixed = fixed.replace(/(?<!^|\n\n)(^```)/gm, '\n$1');
    fixed = fixed.replace(/(^```[^\n]*$)(?!\n\n|\n$)/gm, '$1\n');
    
    // Fix: Ensure blank lines around blockquotes
    fixed = fixed.replace(/(?<!^|\n\n)(^>)/gm, '\n$1');
    fixed = fixed.replace(/(^>.*$)(?!\n\n|\n$|\n>)/gm, '$1\n');

    return fixed;
  }

  /**
   * Quick validation without fixing
   */
  static async validate(content: string, filename = 'document.md'): Promise<boolean> {
    const result = await this.lintAndFix(content, filename);
    return result.isValid;
  }

  /**
   * Get fixed content or return original if no fixes needed
   */
  static async getFixedContent(content: string, filename = 'document.md'): Promise<string> {
    const result = await this.lintAndFix(content, filename);
    return result.fixedContent || content;
  }
}