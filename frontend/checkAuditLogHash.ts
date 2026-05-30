import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = "https://ctizplvjglydyrjqaalx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sha256(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex');
}

const deterministicStringify = (obj: any): string => {
  if (obj === null || obj === undefined) return 'null';
  if (Array.isArray(obj)) return '[' + obj.map(deterministicStringify).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + deterministicStringify(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
};

async function checkHashChain() {
  const { data: workspaces } = await supabase.from('workspaces').select('id');
  if (!workspaces) return;

  for (const ws of workspaces) {
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (!logs || logs.length === 0) continue;

    console.log(`Checking workspace: ${ws.id}`);
    let currentPrevHash = 'GENESIS_BLOCK';
    for (let i = 0; i < Math.min(logs.length, 10); i++) {
      const log = logs[i];
      const ts = new Date(log.created_at).toISOString();
      const metadataStr = log.metadata ? deterministicStringify(log.metadata) : 'null';
      const message = `${log.workspace_id}${log.actor_id ?? ''}${log.project_id ?? ''}${log.task_id ?? ''}${log.action}${metadataStr}${log.previous_hash}${ts}`;
      const newHash = sha256(message);

      console.log(`[Index ${i}] ID: ${log.id}`);
      console.log(`  Action: ${log.action}`);
      console.log(`  Prev Hash (in DB): ${log.previous_hash}`);
      console.log(`  Expected Prev Hash: ${currentPrevHash}`);
      console.log(`  Hash (in DB): ${log.hash}`);
      console.log(`  Recomputed Hash: ${newHash}`);

      if (log.previous_hash !== currentPrevHash || log.hash !== newHash) {
        console.log(`  >>> MISMATCH AT INDEX ${i} <<<`);
      }
      currentPrevHash = log.hash;
    }
  }
}

checkHashChain().catch(console.error);
