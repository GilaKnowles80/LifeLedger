import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

const sql = neon(process.env.DATABASE_URL);

/**
 * Splits a SQL script into individual statements, respecting $$ dollar-quoted blocks.
 */
function splitSqlStatements(script) {
  const statements = [];
  let current = "";
  let inDollarBlock = false;
  let dollarTag = "";
  let i = 0;

  while (i < script.length) {
    const ch = script[i];

    if (inDollarBlock) {
      current += ch;
      // Check for end of dollar block: tag$$
      if (ch === "$") {
        const possibleTag = script.slice(i + 1);
        if (possibleTag.startsWith(dollarTag + "$$")) {
          current += dollarTag + "$$";
          i += dollarTag.length + 2;
          inDollarBlock = false;
          dollarTag = "";
          continue;
        }
      }
      i++;
      continue;
    }

    // Check for start of dollar block: $tag$
    if (ch === "$") {
      const rest = script.slice(i + 1);
      const tagMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\$/);
      if (tagMatch) {
        current += ch;
        dollarTag = tagMatch[1];
        inDollarBlock = true;
        i += 1 + dollarTag.length + 1; // skip $tag$
        continue;
      }
    }

    if (ch === ";" && !inDollarBlock) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const last = current.trim();
  if (last.length > 0) statements.push(last);

  return statements;
}

async function main() {
  const migration = await readFile("./database.sql", "utf8");
  const statements = splitSqlStatements(migration);

  console.log(`Found ${statements.length} SQL statement(s) to execute.\n`);

  for (const stmt of statements) {
    try {
      // Use sql.unsafe for raw SQL execution
      await sql.unsafe(stmt);
      console.log(`✓ ${stmt.substring(0, 80)}${stmt.length > 80 ? "..." : ""}`);
    } catch (err) {
      console.error(`✗ ${stmt.substring(0, 80)}${stmt.length > 80 ? "..." : ""}`);
      console.error(`  ${err && err.message ? err.message : err}`);
    }
  }

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});