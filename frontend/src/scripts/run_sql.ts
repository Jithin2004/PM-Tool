// =============================================================================
// RC10 SQL Runner v2 — SAVEPOINT recovery + robust statement splitting
// =============================================================================
import { Client } from 'pg';
import * as fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

/**
 * Split SQL into individual statements, respecting:
 * - $$ dollar-quoted function bodies
 * - Single-line comments (--)
 * - Block comments
 * - String literals
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    // Single-line comment: skip to end of line
    if (sql[i] === '-' && i + 1 < len && sql[i + 1] === '-') {
      while (i < len && sql[i] !== '\n') {
        current += sql[i];
        i++;
      }
      continue;
    }

    // Block comment: /* ... */
    if (sql[i] === '/' && i + 1 < len && sql[i + 1] === '*') {
      current += sql[i]; i++;
      current += sql[i]; i++;
      while (i < len) {
        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          current += sql[i]; i++;
          current += sql[i]; i++;
          break;
        }
        current += sql[i]; i++;
      }
      continue;
    }

    // String literal: '...' (handle escaped quotes '')
    if (sql[i] === "'") {
      current += sql[i]; i++;
      while (i < len) {
        if (sql[i] === "'" && i + 1 < len && sql[i + 1] === "'") {
          current += sql[i]; i++;
          current += sql[i]; i++;
        } else if (sql[i] === "'") {
          current += sql[i]; i++;
          break;
        } else {
          current += sql[i]; i++;
        }
      }
      continue;
    }

    // Dollar-quoting: $tag$ ... $tag$
    if (sql[i] === '$') {
      let tag = '$';
      let j = i + 1;
      while (j < len && (sql[j] === '_' || /[a-zA-Z0-9]/.test(sql[j]))) {
        tag += sql[j]; j++;
      }
      if (j < len && sql[j] === '$') {
        tag += '$';
        // Found opening dollar-quote tag
        current += tag;
        i = j + 1;
        // Now find closing tag
        while (i < len) {
          if (sql[i] === '$') {
            let closeTag = '$';
            let k = i + 1;
            while (k < len && (sql[k] === '_' || /[a-zA-Z0-9]/.test(sql[k]))) {
              closeTag += sql[k]; k++;
            }
            if (k < len && sql[k] === '$') {
              closeTag += '$';
              if (closeTag === tag) {
                current += closeTag;
                i = k + 1;
                break;
              }
            }
          }
          current += sql[i]; i++;
        }
        continue;
      }
    }

    // Statement terminator
    if (sql[i] === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0 && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }

  return statements;
}

async function run() {
  await client.connect();
  console.log('Connected to database.\n');

  // 1. Run Reset Script
  const resetPath = 'C:\\Users\\jithi\\.gemini\\antigravity-ide\\brain\\3625b073-e9c5-4d78-a2fd-ea6423617657\\RC10_RESET_DATABASE.sql';
  if (fs.existsSync(resetPath)) {
    console.log('Running RC10_RESET_DATABASE.sql...');
    const resetSql = fs.readFileSync(resetPath, 'utf8');
    try {
      await client.query(resetSql);
      console.log('✅ Reset completed.\n');
    } catch (err: any) {
      console.error('Reset error:', err.message);
    }
  }

  // 2. Run Install Script — statement by statement with SAVEPOINT recovery
  const installPath = 'C:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
  console.log('Running RESOLVE_PM_V1_3_INSTALL.sql (statement-by-statement with SAVEPOINT)...');
  const installSql = fs.readFileSync(installPath, 'utf8');
  const statements = splitStatements(installSql);
  console.log(`  Total statements: ${statements.length}\n`);

  // Start an explicit transaction so we can use SAVEPOINTs
  await client.query('BEGIN');

  let success = 0, skipped = 0, errors = 0;
  const errorDetails: { index: number; stmt: string; err: string }[] = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    try {
      await client.query('SAVEPOINT sp');
      await client.query(stmt);
      await client.query('RELEASE SAVEPOINT sp');
      success++;
    } catch (err: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      const msg = err.message || '';
      if (
        msg.includes('already exists') ||
        msg.includes('does not exist') ||
        msg.includes('duplicate key') ||
        msg.includes('multiple primary keys') ||
        msg.includes('could not create unique index') ||
        msg.includes('is not a table') ||
        msg.includes('already a member of')
      ) {
        skipped++;
      } else {
        errors++;
        const preview = stmt.substring(0, 150).replace(/\n/g, ' ').replace(/\s+/g, ' ');
        errorDetails.push({ index: i + 1, stmt: preview, err: msg.substring(0, 200) });
        if (errors <= 30) {
          console.error(`  ❌ [${i + 1}/${statements.length}] ${preview.substring(0, 100)}...`);
          console.error(`     → ${msg.substring(0, 150)}\n`);
        }
      }
    }

    // Progress reporting every 200 statements
    if ((i + 1) % 200 === 0) {
      console.log(`  ... processed ${i + 1}/${statements.length} (✅${success} ⏭️${skipped} ❌${errors})`);
    }
  }

  // Commit the transaction
  await client.query('COMMIT');

  console.log('\n═══ Install Summary ═══');
  console.log(`  ✅ Succeeded:  ${success}`);
  console.log(`  ⏭️  Skipped:   ${skipped} (already exists / harmless duplicates)`);
  console.log(`  ❌ Errors:     ${errors}`);
  console.log(`  Total:         ${statements.length}`);

  if (errors > 30) {
    console.log(`\n  (Showing first 30 errors only. ${errors - 30} more omitted.)`);
  }

  // 3. Send schema reload notification
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('\n✅ Schema reload notification sent.');
  } catch {}

  await client.end();
  console.log('Disconnected.\n');

  process.exit(errors > 100 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
