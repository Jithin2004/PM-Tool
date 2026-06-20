import { supabase } from '../lib/supabase';
export const uidService = {
  suggestScopeCode(name: string): string {
    if (!name) return 'PRJ';
    // Remove vowels, keep consonants, uppercase, take first 3-4 letters
    const noVowels = name.replace(/[AEIOUaeiou\s]/g, '').toUpperCase();
    if (noVowels.length >= 3) {
      return noVowels.substring(0, 4);
    }
    // Fallback to first letters of words if simple
    const words = name.split(' ').map(w => w[0]?.toUpperCase()).join('');
    if (words.length >= 2) return words.substring(0, 4);
    
    // Just uppercase the whole thing
    return name.substring(0, 4).toUpperCase();
  },

  validateUIDCode(code: string): boolean {
    // Only letters and numbers, max 6 chars, min 2 chars
    const regex = /^[A-Z0-9]{2,6}$/;
    return regex.test(code);
  },

  async generateNextUID(workspaceId: string, scopeType: string, customScopeCode?: string, projectId?: string, scopeId?: string): Promise<string | null> {
    // Call RPC or do a transaction to safely increment
    // Since we don't have a specific RPC defined yet, we do a select and update
    // Note: In production this should be an atomic RPC function on the DB
    
    // Check if sequence exists
    let { data: sequence } = await supabase
      .from('uid_sequences')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('scope_type', scopeType)
      .eq('scope_code', customScopeCode)
      .maybeSingle();

    if (!sequence) {
      if (!customScopeCode) return null;
      // Initialize sequence
      const { data: newSeq, error: insertError } = await supabase
        .from('uid_sequences')
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          scope_type: scopeType,
          scope_id: scopeId,
          scope_code: customScopeCode,
          current_number: 1
        })
        .select()
        .single();
        
      if (insertError || !newSeq) {
        console.error('[uidService.generateNextUID] Insert error:', insertError);
        return null;
      }
      return `${newSeq.scope_code}-${newSeq.current_number}`;
    }

    // Increment existing sequence
    const nextNumber = sequence.current_number + 1;
    const { error: updateError } = await supabase
      .from('uid_sequences')
      .update({ current_number: nextNumber })
      .eq('id', sequence.id);

    if (updateError) {
      console.error('[uidService.generateNextUID] Update error:', updateError);
      return null;
    }

    return `${sequence.scope_code}-${nextNumber}`;
  }
};
