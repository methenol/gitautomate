import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MarkdownLintResult {
  isValid: boolean;
  errors: string[];
  fixedContent?: string;
}

export class MarkdownLinter {
  /**
   * Lint markdown content and attempt to fix common issues
   */
  static async lintAndFix(content: string, filename = 'document.md'): Promise<MarkdownLintResult> {
    try {
      // Create a temporary file for linting
      const tempDir = '/tmp/markdown-lint';
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, filename);
      
      await fs.writeFile(tempFile, content);

      // First, try to fix automatically
      let fixedContent = content;
      try {
        execSync(`npx markdownlint-cli2 --fix "${tempFile}"`, { 
          cwd: process.cwd(),
          stdio: 'pipe' 
        });
        fixedContent = await fs.readFile(tempFile, 'utf-8');
      } catch (fixError) {
        // Auto-fix failed, content may have issues
      }

      // Now check if the fixed content is valid
      try {
        execSync(`npx markdownlint-cli2 "${tempFile}"`, { 
          cwd: process.cwd(),
          stdio: 'pipe' 
        });
        
        // Clean up and return success
        await fs.unlink(tempFile).catch(() => {});
        return {
          isValid: true,
          errors: [],
          fixedContent: fixedContent !== content ? fixedContent : undefined
        };
      } catch (lintError) {
        const errorOutput = lintError.toString();
        const errors = this.parseMarkdownLintErrors(errorOutput);
        
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});
        
        // Apply manual fixes for common issues
        const manuallyFixed = this.applyManualFixes(fixedContent);
        
        // If we made manual fixes, test again
        if (manuallyFixed !== fixedContent) {
          await fs.writeFile(tempFile, manuallyFixed);
          try {
            execSync(`npx markdownlint-cli2 "${tempFile}"`, { 
              cwd: process.cwd(),
              stdio: 'pipe' 
            });
            // Manual fixes worked
            await fs.unlink(tempFile).catch(() => {});
            return {
              isValid: true,
              errors: [],
              fixedContent: manuallyFixed
            };
          } catch {
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
      return {
        isValid: false,
        errors: [`Linting failed: ${error.message}`]
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