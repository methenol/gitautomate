import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import sanitize from 'sanitize-filename';

export interface MarkdownLintResult {
  isValid: boolean;
  errors: string[];
  fixedContent?: string;
}

export class MarkdownLinter {
  private static readonly TEMP_DIR_PREFIX = 'markdown-lint-';
  private static readonly MAX_CONTENT_SIZE = 1024 * 1024; // 1MB
  private static readonly MAX_FILENAME_LENGTH = 50;
  private static readonly COMMAND_TIMEOUT = 30000; // 30 seconds

  /**
   * Sanitize filename to prevent command injection and path traversal
   */
  private static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'document.md';
    }

    // Remove any path separators and dangerous characters
    let sanitized = sanitize(filename.replace(/[/\\]/g, ''));
    
    // Ensure fallback and enforced .md extension
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'document.md';
    } else if (!sanitized.endsWith('.md')) {
      sanitized += '.md';
    }
    
    // Limit length for security
    if (sanitized.length > MarkdownLinter.MAX_FILENAME_LENGTH) {
      const nameWithoutExt = sanitized.slice(0, MarkdownLinter.MAX_FILENAME_LENGTH - 3);
      sanitized = nameWithoutExt + '.md';
    }
    
    return sanitized;
  }

  /**
   * Create a secure temporary directory
   */
  private static async createSecureTempDir(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), MarkdownLinter.TEMP_DIR_PREFIX));
    return tempDir;
  }

  /**
   * Validate that the file path is secure and within the temporary directory
   */
  private static validateSecurePath(filePath: string, tempDir: string): boolean {
    try {
      const resolvedFile = path.resolve(filePath);
      const resolvedTempDir = path.resolve(tempDir);
      
      // Ensure the file is directly within the temp directory (no subdirectories)
      const parentDir = path.dirname(resolvedFile);
      return parentDir === resolvedTempDir;
    } catch {
      return false;
    }
  }

  /**
   * Safely execute markdownlint command with proper argument handling
   */
  private static async executeMarkdownLint(args: readonly string[], cwd: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      // Validate working directory
      if (!cwd || typeof cwd !== 'string') {
        resolve({ success: false, output: 'Invalid working directory' });
        return;
      }

      // Create a copy of args to ensure immutability
      const safeArgs = ['markdownlint-cli2', ...args];
      
      const child = spawn('npx', safeArgs, {
        cwd,
        stdio: 'pipe',
        shell: false, // Critical: Prevent shell injection
        timeout: MarkdownLinter.COMMAND_TIMEOUT
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
          output: `Command execution error: ${error.message}`
        });
      });

      // Timeout protection
      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: 'Command timed out after 30 seconds'
        });
      }, MarkdownLinter.COMMAND_TIMEOUT);

      child.on('close', () => {
        clearTimeout(timeoutHandle);
      });
    });
  }

  /**
   * Lint markdown content and attempt to fix common issues
   */
  static async lintAndFix(content: string, filename = 'document.md'): Promise<MarkdownLintResult> {
    let tempDir: string | null = null;
    
    try {
      // Input validation
      if (!content || typeof content !== 'string') {
        return {
          isValid: false,
          errors: ['Invalid content provided']
        };
      }

      // Size limit check
      if (content.length > MarkdownLinter.MAX_CONTENT_SIZE) {
        return {
          isValid: false,
          errors: ['Content too large for processing (max 1MB)']
        };
      }

      // Sanitize the filename
      const safeFilename = MarkdownLinter.sanitizeFilename(filename);
      
      // Create secure temporary directory
      tempDir = await MarkdownLinter.createSecureTempDir();
      const tempFile = path.join(tempDir, safeFilename);

      // Additional security validation
      if (!MarkdownLinter.validateSecurePath(tempFile, tempDir)) {
        return {
          isValid: false,
          errors: ['Security validation failed for file path']
        };
      }

      // Write content to temp file with restricted permissions
      await fs.writeFile(tempFile, content, { mode: 0o600 });

      // First, try to fix automatically
      let fixedContent = content;
      try {
        const fixResult = await MarkdownLinter.executeMarkdownLint(['--fix', safeFilename], tempDir);
        if (fixResult.success) {
          fixedContent = await fs.readFile(tempFile, 'utf-8');
        }
      } catch {
        // Auto-fix failed, continue with validation
      }

      // Check if the content is valid
      const lintResult = await MarkdownLinter.executeMarkdownLint([safeFilename], tempDir);
      
      if (lintResult.success) {
        return {
          isValid: true,
          errors: [],
          fixedContent: fixedContent !== content ? fixedContent : undefined
        };
      } else {
        const errors = MarkdownLinter.parseMarkdownLintErrors(lintResult.output);
        
        // Apply manual fixes for common issues
        const manuallyFixed = MarkdownLinter.applyManualFixes(fixedContent);
        
        // If we made manual fixes, test again
        if (manuallyFixed !== fixedContent) {
          await fs.writeFile(tempFile, manuallyFixed, { mode: 0o600 });
          const finalResult = await MarkdownLinter.executeMarkdownLint([safeFilename], tempDir);
          
          if (finalResult.success) {
            return {
              isValid: true,
              errors: [],
              fixedContent: manuallyFixed
            };
          }
        }
        
        return {
          isValid: false,
          errors,
          fixedContent: manuallyFixed !== content ? manuallyFixed : undefined
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        isValid: false,
        errors: [`Linting failed: ${errorMessage}`]
      };
    } finally {
      // Clean up temporary directory and all files within it
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Cleanup failed, but we shouldn't throw
        }
      }
    }
  }

  /**
   * Parse markdownlint error output into readable messages
   */
  private static parseMarkdownLintErrors(errorOutput: string): string[] {
    if (!errorOutput || typeof errorOutput !== 'string') {
      return ['Unknown markdown formatting errors'];
    }

    const errors: string[] = [];
    const lines = errorOutput.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.includes('Command failed') && !trimmedLine.includes('npm WARN')) {
        errors.push(trimmedLine);
      }
    }
    
    return errors.length > 0 ? errors : ['Unknown markdown formatting errors'];
  }

  /**
   * Apply common manual fixes that markdownlint-cli2 might not handle
   */
  private static applyManualFixes(content: string): string {
    if (!content || typeof content !== 'string') {
      return content;
    }

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
    const result = await MarkdownLinter.lintAndFix(content, filename);
    return result.isValid;
  }

  /**
   * Get fixed content or return original if no fixes needed
   */
  static async getFixedContent(content: string, filename = 'document.md'): Promise<string> {
    const result = await MarkdownLinter.lintAndFix(content, filename);
    return result.fixedContent || content;
  }
}