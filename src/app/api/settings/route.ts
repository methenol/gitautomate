import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DocumentationSettingsSchema } from '@/types/documentation';

// Settings schema matching the issue requirements
const SettingsSchema = z.object({
  githubToken: z.string().optional(),
  llmModel: z.string().optional(), // provider/model format
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  useTDD: z.boolean().optional(),
  temperature: z.number().min(0).max(2),
  documentation: DocumentationSettingsSchema.optional(),
});

type Settings = z.infer<typeof SettingsSchema>;

// Simple encryption for API keys (in production, use proper key management)
const DEFAULT_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'; // 64 hex chars = 32 bytes
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_KEY;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string {
  try {
    // Try new format first (iv:authTag:data)
    if (encrypted.includes(':')) {
      const parts = encrypted.split(':');
      if (parts.length === 3) {
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedData = parts[2];
        const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    }
    
    // If old format, return empty string to force re-entry
    console.log('Old format detected, clearing corrupted settings');
    return '';
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    // Return empty string to allow user to re-enter settings
    return '';
  }
}

// Simple file-based storage (in production, use a proper database)
const SETTINGS_FILE = path.join(process.cwd(), '.settings.json');

async function readSettings(): Promise<Settings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    // Decrypt sensitive fields
    if (settings.apiKey) {
      const decrypted = decrypt(settings.apiKey);
      settings.apiKey = decrypted || undefined; // Clear if decryption failed
    }
    if (settings.githubToken) {
      const decrypted = decrypt(settings.githubToken);
      settings.githubToken = decrypted || undefined; // Clear if decryption failed
    }
    
    return settings;
  } catch {
    // Return default settings if file doesn't exist or is corrupted
    console.log('Settings file not found or corrupted, returning default settings');
    return { temperature: 0.7 };
  }
}

async function writeSettings(settings: Settings): Promise<void> {
  const settingsToSave = { ...settings };
  
  // Encrypt sensitive fields
  if (settingsToSave.apiKey) {
    settingsToSave.apiKey = encrypt(settingsToSave.apiKey);
  }
  if (settingsToSave.githubToken) {
    settingsToSave.githubToken = encrypt(settingsToSave.githubToken);
  }
  
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2));
}

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = SettingsSchema.parse(body);
    
    await writeSettings(settings);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid settings format', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}