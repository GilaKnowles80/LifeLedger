import { auth } from "@/auth";
import { sql } from "./admin";

/**
 * Runs a secure database query on Neon after verifying 
 * the caller has an active Auth.js server session.
 * 
 * Works natively on serverless platforms like Vercel.
 */
export async function executeProtectedTransaction<T>(
  callback: (userId: string, database: typeof sql) => Promise<T>
): Promise<T> {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    throw new Error("Unauthorized: Access denied. Active session required.");
  }

  // Execute database transaction securely passing the authenticated user's ID
  return await callback(session.user.id, sql);
}