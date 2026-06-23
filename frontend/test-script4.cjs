const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQyMzE3MSwiZXhwIjoyMDkzOTk5MTcxfQ.q_kpv-kvWl2R16oHpwfoc5J7Uo-s_jTiu-_qkRbdt3k';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLeaveBalances() {
  let failures = [];
  
  const { data: userRow } = await supabase.from('users').select('id, workspace_id').limit(1);
  if (!userRow || userRow.length === 0) {
    console.log('FAIL');
    console.log('Blockers: Cannot find a user/workspace to run tests');
    return;
  }
  
  const { id: userId, workspace_id: workspaceId } = userRow[0];
  
  // Cleanup test data first
  await supabase.from('leave_balances').delete().in('leave_type', ['Test Generated', 'Test Constraint']);

  // TEST 1 — Generated Column
  const { data: leaveRow, error: leaveErr } = await supabase.from('leave_balances').insert({
    workspace_id: workspaceId,
    user_id: userId,
    leave_type: 'Test Generated',
    total_allowance: 20,
    used_balance: 5
  }).select('*').single();
  
  if (leaveErr) {
    failures.push(`Test 1 (Generated Column) Insert failed: ${leaveErr.message}`);
  } else {
    if (leaveRow.available_balance !== 15) {
      failures.push(`Test 1 (Generated Column): available_balance is ${leaveRow.available_balance}, expected 15.`);
    }

    // TEST 2 — Mutation Protection
    const { error: mutErr } = await supabase.from('leave_balances').update({ available_balance: 100 }).eq('id', leaveRow.id);
    if (!mutErr) {
      failures.push(`Test 2 (Mutation Protection): Database allowed update of available_balance!`);
    } else if (!mutErr.message.includes('generated column')) {
      // It rejected it but maybe for another reason
       // If it fails with PGRST100 or something, just verifying it fails is enough, but ideally it fails gracefully.
    }
  }

  // TEST 3 — Constraint Protection
  const { error: constErr } = await supabase.from('leave_balances').insert({
    workspace_id: workspaceId,
    user_id: userId,
    leave_type: 'Test Constraint',
    total_allowance: 10,
    used_balance: 20
  });

  if (!constErr) {
    failures.push(`Test 3 (Constraint Protection): Database allowed insert where used > total!`);
    // Cleanup if it succeeded
    await supabase.from('leave_balances').delete().eq('leave_type', 'Test Constraint');
  }

  // TEST 4 — Existing Rows
  const { data: allLeaves, error: allErr } = await supabase.from('leave_balances').select('*');
  if (allErr) {
    failures.push(`Test 4 (Existing Rows): Could not query leave_balances: ${allErr.message}`);
  } else {
    let hasNullTotal = false;
    let hasNullUsed = false;
    let hasBadCalc = false;
    
    allLeaves.forEach(row => {
      if (row.total_allowance === null) hasNullTotal = true;
      if (row.used_balance === null) hasNullUsed = true;
      if (row.available_balance !== (row.total_allowance - row.used_balance)) hasBadCalc = true;
    });

    if (hasNullTotal) failures.push('Test 4 (Existing Rows): Found NULL total_allowance');
    if (hasNullUsed) failures.push('Test 4 (Existing Rows): Found NULL used_balance');
    if (hasBadCalc) failures.push('Test 4 (Existing Rows): Found incorrect available_balance calculation in existing rows');
  }

  if (failures.length > 0) {
    console.log('FAIL');
    console.log('Blockers:');
    failures.forEach(f => console.log(' - ' + f));
  } else {
    console.log('PASS');
  }
}

checkLeaveBalances();
