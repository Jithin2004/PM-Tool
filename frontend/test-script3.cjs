const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQyMzE3MSwiZXhwIjoyMDkzOTk5MTcxfQ.q_kpv-kvWl2R16oHpwfoc5J7Uo-s_jTiu-_qkRbdt3k';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  let failures = [];
  
  // Test invoice_line_items tax_percentage
  const { data: invLine, error: invErr } = await supabase
    .from('invoice_line_items')
    .select('tax_percentage')
    .limit(1);
    
  if (invErr && invErr.code === '42703') {
     failures.push('invoice_line_items missing tax_percentage');
  }

  // Test leave_balances generated column
  // Try inserting a unique leave
  const { data: userRow } = await supabase.from('users').select('id, workspace_id').limit(1);
  if (userRow && userRow.length > 0) {
    const { id: userId, workspace_id: workspaceId } = userRow[0];
    
    // cleanup previous test
    await supabase.from('leave_balances').delete().eq('leave_type', 'Test Leave 2');
    
    const { data: leaveRow, error: leaveErr } = await supabase.from('leave_balances').insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type: 'Test Leave 2',
      total_allowance: 20,
      used_balance: 5
    }).select('*').single();
    
    if (leaveErr) {
       failures.push(`Leave balances insert failed: ${leaveErr.message}`);
    } else {
       if (leaveRow.available_balance !== 15) {
         failures.push(`Leave available_balance calculation failed. Expected 15, got ${leaveRow.available_balance}`);
       }

       // Attempt manual update
       const { error: mutErr } = await supabase.from('leave_balances').update({ available_balance: 100 }).eq('id', leaveRow.id);
       if (!mutErr) {
         failures.push(`Leave balances mutable generated column (Update succeeded)`);
       }
    }
  }

  if (failures.length > 0) {
    console.log('FAIL');
    console.log('Blockers:');
    failures.forEach(f => console.log(' - ' + f));
  } else {
    console.log('PASS');
  }
}

checkColumns();
