import { DatabaseService } from './core/database';
import fs from 'node:fs';
import path from 'node:path';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbService = DatabaseService.getWriteInstance();

// Read and execute schema
const schemaPath = path.join(process.cwd(), 'apps/server/src/db/schema/tables/setup.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

console.log('Creating database schema...');
dbService.db.exec(schema);

// Run seed script
console.log('Seeding database...');
import('./seed'); 