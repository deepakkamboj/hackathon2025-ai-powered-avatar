import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Singleton database connection
let db: Database | null = null;

export default async function connectDB() {
  // Check if this code is running in edge runtime (Next.js convention)
  const isEdgeRuntime = process.env.NEXT_RUNTIME === 'edge';

  if (isEdgeRuntime) {
    throw new Error(
      'SQLite is not supported in edge runtime. Please use the API routes with serverless runtime instead.',
    );
  }

  // For Node.js environment
  if (!db) {
    db = await open({
      filename: './db/orders.db', // Changed path to be relative to project root
      driver: sqlite3.Database,
    });
  }
  return db;
}
