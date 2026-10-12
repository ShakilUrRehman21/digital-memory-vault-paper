// EVALUATION ONLY: Neon HTTP driver swapped for node-postgres to run against a local PostgreSQL 16 server.
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
