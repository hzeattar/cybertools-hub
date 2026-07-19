export type QueryResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rows: T[];
};

export type Queryable = {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
};

let poolPromise: Promise<Queryable | null> | null = null;

function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL) && (process.env.NODE_ENV === "production" || process.env.STORAGE_DRIVER === "postgres");
}

async function getPool() {
  if (!shouldUsePostgres()) return null;
  if (poolPromise) return poolPromise;

  poolPromise = (async () => {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
      Pool: new (config: { connectionString: string }) => Queryable;
    }>;

    try {
      const { Pool } = await dynamicImport("pg");
      return new Pool({ connectionString: process.env.DATABASE_URL as string });
    } catch (error) {
      poolPromise = null;
      if (process.env.NODE_ENV === "production") throw error;
      return null;
    }
  })();

  return poolPromise;
}

export async function withPg<T>(operation: (pool: Queryable) => Promise<T>) {
  const pool = await getPool();
  if (!pool) return null;
  return operation(pool);
}
