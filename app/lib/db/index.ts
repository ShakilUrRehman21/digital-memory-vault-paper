import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Two drivers behind one interface: Neon's serverless HTTP driver for the hosted deployment, and node-postgres
// for any other PostgreSQL server (local development, the evaluation kit, self-hosting).
// DB_DRIVER=neon|pg overrides the choice, which otherwise follows the host name in DATABASE_URL.
const url = process.env.DATABASE_URL!;
const driver = process.env.DB_DRIVER ?? (/\.neon\.tech/.test(url ?? '') ? 'neon' : 'pg');

export const db: NodePgDatabase<typeof schema> =
    driver === 'neon'
        ? (drizzleNeon(neon(url), { schema }) as unknown as NodePgDatabase<typeof schema>)
        : drizzlePg(new Pool({ connectionString: url, max: Number(process.env.DB_POOL_SIZE ?? 10) }), { schema });
