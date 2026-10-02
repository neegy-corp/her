import { AsyncLocalStorage } from 'node:async_hooks';

type Value = string | number | boolean | null;
type QueryResult = { results: Record<string, unknown>[]; meta: { changes: number } };
const scopes = new AsyncLocalStorage<{ database?: Database; url: string }>();

export class Statement {
  constructor(readonly database: Database, readonly query: string, readonly values: Value[] = []) {}
  bind(...values: Value[]) { return new Statement(this.database, this.query, values); }
  async all<T = Record<string, unknown>>() { const result = await this.database.execute(this); return { ...result, results: result.results as T[] }; }
  async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  run() { return this.database.execute(this); }
}

export class Database {
  readonly credential: string;
  readonly endpoint: string;
  constructor(url: string) {
    if (!url) throw new Error('Database connection is unavailable.');
    const connection = new URL(url);
    this.credential = decodeURIComponent(connection.password);
    this.endpoint = 'https://mkewxmunkqsyziatkqfz.supabase.co/functions/v1/her-database';
  }
  prepare(query: string) { return new Statement(this, query); }
  async execute(statement: Statement): Promise<QueryResult> {
    return (await this.batch([statement]))[0];
  }
  async batch(statements: Statement[]): Promise<QueryResult[]> {
    const result = await fetch(this.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.credential}` },
      body: JSON.stringify({ statements: statements.map(({ query, values }) => ({ query, values })) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await result.json() as { results: QueryResult[]; error?: string };
    if (!result.ok) throw new Error(data.error || 'Storage is temporarily unavailable.');
    return data.results;
  }
}

export function db() {
  const scope = scopes.getStore();
  if (!scope) throw new Error('Database request scope is unavailable.');
  return scope.database ??= new Database(scope.url);
}

export async function withDatabase<T>(url: string, work: () => Promise<T>) {
  const scope: { database?: Database; url: string } = { url };
  return scopes.run(scope, async () => {
    return work();
  });
}
