/** Runtime configuration, read once from the environment (see .env.example and docs/DEPLOY.md). */
export type Config = { databaseUrl: string; jwtSecret: string; port: number; host: string; env: string; corsOrigins: string[] };
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const jwtSecret = env.JWT_SECRET ?? '';
  const nodeEnv = env.NEXUS_ENV || env.NODE_ENV || 'development';
  if (jwtSecret.length < 32) {
    if (nodeEnv === 'production') throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return {
    databaseUrl,
    jwtSecret: jwtSecret || 'local-development-secret-change-me-0123456789',
    port: Number(env.PORT || 3001),
    host: env.HOST || '127.0.0.1',
    env: nodeEnv,
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  };
}
