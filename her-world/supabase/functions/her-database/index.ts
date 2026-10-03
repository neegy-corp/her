import postgres from 'npm:postgres@3.4.8';
import queries from './queries.json' with { type: 'json' };
import ca from '../../../db/supabase-ca.ts';

const allowed = new Set(queries);
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
  // Custom server authentication: PostgreSQL verifies a dedicated 256-bit credential.
  // The browser never receives it. The login has rights only in her_private.
  const password = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!/^[a-f0-9]{64}$/.test(password)) return response({ error: 'Unauthorized.' }, 401);
  let statements: { query: string; values: (string | number | boolean | null)[] }[];
  try {
    const raw = await request.text();
    if (raw.length > 128000) return response({ error: 'Request too large.' }, 413);
    statements = JSON.parse(raw).statements;
    if (!Array.isArray(statements) || !statements.length || statements.length > 12 ||
      statements.some(s => !allowed.has(s.query) || !Array.isArray(s.values) ||
        s.values.length !== (s.query.match(/\?/g)?.length ?? 0) ||
        s.values.some(v => v !== null && !['string','number','boolean'].includes(typeof v)))) {
      return response({ error: 'Unsupported operation.' }, 400);
    }
  } catch { return response({ error: 'Invalid request.' }, 400); }
  const sql = postgres({
    host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, database: 'postgres',
    username: 'her_web.mkewxmunkqsyziatkqfz', password,
    ssl: { rejectUnauthorized: true, ca }, max: 1, prepare: false, connect_timeout: 8,
    connection: { statement_timeout: 10000 },
    types: { milliseconds: { to: 20, from: [20], serialize: String, parse: Number } },
  });
  try {
    const results = await sql.begin(async transaction => {
      const results = [];
      for (const statement of statements) {
        let index = 0;
        const query = statement.query.replace(/\?/g, () => `$${++index}`);
        const rows = await transaction.unsafe(query, statement.values);
        results.push({ results: [...rows], meta: { changes: rows.count } });
      }
      return results;
    });
    return response({ results });
  } catch (error) {
    const code = error instanceof postgres.PostgresError ? error.code : '';
    if (code === '28P01') return response({ error: 'Unauthorized.' }, 401);
    if (code === '23505') return response({ error: 'This record already exists or the stage is occupied.' }, 409);
    console.error('HER database operation failed', code || 'connection_error');
    return response({ error: 'Database operation unavailable. Please try again.' }, 503);
  } finally { await sql.end({ timeout: 2 }); }
});
