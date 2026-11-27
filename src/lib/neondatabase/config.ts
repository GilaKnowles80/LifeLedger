/**
 * Retrieves the required project credentials from environment variables.
 * Validates variables locally or on production environments like Vercel.
 */
export function getProjectConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;

  return {
    databaseUrl: databaseUrl || null,
    authSecret: authSecret || null,
  };
}

/**
 * Validates that all production environment variables required 
 * for Auth.js and Neon Database are fully set up.
 */
export function isProjectConfigured(): boolean {
  const { databaseUrl, authSecret } = getProjectConfig();
  
  // Both credentials must exist for the authentication and database layers to operate
  return databaseUrl !== null && authSecret !== null;
}

/**
 * Client-safe check for whether the app is configured.
 * Uses NEXT_PUBLIC_* variables which are available in client components.
 */
export function isAppConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_APP_READY);
}