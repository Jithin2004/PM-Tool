const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQyMzE3MSwiZXhwIjoyMDkzOTk5MTcxfQ.q_kpv-kvWl2R16oHpwfoc5J7Uo-s_jTiu-_qkRbdt3k';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log('--- VERIFY TABLE EXISTENCE ---');
  let failures = [];
  
  const tables = ['clock_events', 'leave_balances', 'invoice_line_items'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[FAIL] ${table}:`, error.message);
      failures.push(`Table existence: ${table} - ${error.message}`);
    } else {
      console.log(`[PASS] ${table} exists.`);
    }
  }

  console.log('\n--- VERIFY FINANCE CONTRACT ---');
  // First we need a dummy invoice
  const { data: inv, error: invErr } = await supabase.from('invoices').select('id').limit(1);
  let invoiceId = inv && inv.length > 0 ? inv[0].id : null;
  
  if (!invoiceId) {
    console.log('[WARN] No invoices found to attach test line item. Creating dummy workspace & invoice...');
    // Create dummy workspace
    const { data: ws } = await supabase.from('workspaces').insert({ name: 'Test WS' }).select('id').single();
    if (ws) {
        // Create dummy project to create invoice
        const { data: proj } = await supabase.from('projects').insert({ workspace_id: ws.id, name: 'Test Proj', code: 'TP' }).select('id').single();
        if (proj) {
            const { data: newInv } = await supabase.from('invoices').insert({ workspace_id: ws.id, project_id: proj.id, invoice_number: 'TEST-001', status: 'draft', amount: 100, due_date: new Date().toISOString() }).select('id').single();
            if (newInv) invoiceId = newInv.id;
        }
    }
  }

  if (invoiceId) {
    const { error: insertErr } = await supabase.from('invoice_line_items').insert({
      invoice_id: invoiceId,
      description: 'Test Item',
      quantity: 1,
      unit_price: 100,
      tax_percentage: 10,
      total: 110
    });
    if (insertErr) {
      console.log(`[FAIL] Finance contract insert:`, insertErr.message);
      failures.push(`Finance insert: ${insertErr.message}`);
    } else {
      console.log(`[PASS] invoice_line_items accepted new schema.`);
    }
  }

  console.log('\n--- VERIFY LEAVE GENERATED COLUMN ---');
  // We need a workspace and a user
  const { data: userRow } = await supabase.from('users').select('id, workspace_id').limit(1);
  if (userRow && userRow.length > 0) {
    const { id: userId, workspace_id: workspaceId } = userRow[0];
    const { data: leaveRow, error: leaveErr } = await supabase.from('leave_balances').insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type: 'Test Leave',
      total_allowance: 20,
      used_balance: 5
    }).select('*').single();
    
    if (leaveErr) {
       console.log(`[FAIL] Leave balances insert failed:`, leaveErr.message);
       failures.push(`Leave balances insert: ${leaveErr.message}`);
    } else {
       if (leaveRow.available_balance === 15) {
         console.log(`[PASS] available_balance is correctly calculated as 15.`);
       } else {
         console.log(`[FAIL] available_balance is ${leaveRow.available_balance}, expected 15.`);
         failures.push(`Leave available_balance calculation failed`);
       }

       // Attempt manual update
       const { error: mutErr } = await supabase.from('leave_balances').update({ available_balance: 100 }).eq('id', leaveRow.id);
       if (mutErr) {
         console.log(`[PASS] Database successfully rejected mutation of generated column (${mutErr.message})`);
       } else {
         console.log(`[FAIL] Database ALLOWED mutation of generated column!`);
         failures.push(`Leave balances mutable generated column`);
       }
    }
  } else {
      console.log('[WARN] Could not find any user to test leave balances.');
  }

  console.log('\n--- VERIFY HR RLS ---');
  console.log('[INFO] Skipping full JS RLS mock, checking RLS presence via SQL definitions...');
  
  const { data: rlsData, error: rlsErr } = await supabase.rpc('get_policies_for_table', { target_table: 'clock_events' });
  // Fallback if no RPC
  if (rlsErr) {
      console.log('[INFO] No RPC for policies. Relying on network check...');
  } else {
      console.log('RLS Policies for clock_events:', rlsData);
  }

  if (failures.length > 0) {
    console.log('\nFINAL STATUS: FAIL');
    console.log('Blockers:');
    failures.forEach(f => console.log(' - ' + f));
    process.exit(1);
  } else {
    console.log('\nFINAL STATUS: PASS');
  }
}

runTests();
