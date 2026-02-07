import { cpSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const src = join(process.cwd(), 'src', 'public');
const dest = join(process.cwd(), 'dist', 'public');

// Ensure destination directory exists
mkdirSync(dest, { recursive: true });

// Copy all files from src to dest
cpSync(src, dest, { recursive: true });

console.log('Static assets copied to dist/public');
