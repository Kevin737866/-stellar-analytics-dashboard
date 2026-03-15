import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './connection';

async function runMigrations(): Promise<void> {
  try {
    console.log('Running database migrations...');
    
    // Read and execute schema.sql
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await db.query(schema);
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runMigrations };
