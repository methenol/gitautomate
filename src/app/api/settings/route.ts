import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Settings schema matching the issue requirements
const SettingsSchema = z.object({
  githubToken: z.string().optional(),
  llmModel: z.string().optional(), // provider/model format
  apiKey: z.string().optional(),
  apiBase: z.string().optional(),
  useTDD: z.boolean().optional(),
});

type Settings = z.infer<typeof SettingsSchema>;

// Simple encryption for API keys (in production, use proper key management)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-not-secure';

function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes256', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encrypted: string): string {
  const decipher = crypto.createDecipher('aes256', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Simple file-based storage (in production, use a proper database)
const SETTINGS_FILE = path.join(process.cwd(), '.settings.json');

async function readSettings(): Promise<Settings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    // Decrypt sensitive fields
    if (settings.apiKey) {
      settings.apiKey = decrypt(settings.apiKey);
    }
    if (settings.githubToken) {
      settings.githubToken = decrypt(settings.githubToken);
    }
    
    return settings;
  } catch (error) {
    // Return empty settings if file doesn't exist
    return {};
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