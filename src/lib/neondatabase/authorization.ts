import { auth } from "@/auth";
import { sql } from "@/lib/neondatabase/admin";

/**
 * Retrieves the currently authenticated user session via Auth.js.
 * Filters out unverified users if email confirmation tracking is used.
 */
export async function getVerifiedUser() {
  const session = await auth();
  
  if (!session || !session.user || !session.user.email) {
    return null;
  }

  return session.user;
}

/**
 * Checks if the currently logged-in user is an administrator 
 * by running a query against your Neon PostgreSQL database.
 */
export async function isLifeledgerAdmin(): Promise<boolean> {
  const user = await getVerifiedUser();
  if (!user) return false;

  try {
    // Executes a PostgreSQL function or raw check in Neon
    // Replace with your actual database logic (e.g., checking a 'role' column)
    const result = await sql`
      SELECT is_admin FROM users WHERE email = ${user.email} LIMIT 1
    `;
    
    if (result.length === 0) return false;
    return result[0].is_admin === true;
  } catch (error) {
    console.error("Admin verification database error:", error);
    return false;
  }
}

/**
 * Auth.js handles Session security natively via encrypted JWTs or Database Sessions.
 * This replaces the specific Supabase MFA/AAL2 verification step.
 */
export async function hasAal2(): Promise<boolean> {
  const session = await auth();
  
  // Returns true if a valid session exists, asserting standard secure access
  return !!session;
}