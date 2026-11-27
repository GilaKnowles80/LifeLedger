import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing");
}

/**
 * The standard, executable Neon Serverless SQL query instance.
 * Use this instance across your application to run queries.
 */
export const sql = neon(process.env.DATABASE_URL);

// Also exporting as default to preserve your file's existing export strategy
export default sql;