const fs = require('fs');
const file = 'frontend/src/context/AuthContext.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `const { data: initialData, error: initialError } = await supabase`,
  `console.log("SYNC_PROFILE_STEP_1");\nconst { data: initialData, error: initialError } = await supabase`
);

code = code.replace(
  `if (error && error.code !== 'PGRST116') {`,
  `console.log("SYNC_PROFILE_STEP_2", {hasData: !!data, error: error});\nif (error && error.code !== 'PGRST116') {`
);

code = code.replace(
  `setProfileHydrating(true);`,
  `console.log("SYNC_PROFILE_STEP_3");\nsetProfileHydrating(true);`
);

code = code.replace(
  `setProfileHydrating(false);`,
  `console.log("SYNC_PROFILE_STEP_4");\nsetProfileHydrating(false);`
);

code = code.replace(
  `if (!data) {
          const reconciliation = await reconcileInvitationMembership({`,
  `if (!data) {
          console.log("SYNC_PROFILE_STEP_5");
          const reconciliation = await reconcileInvitationMembership({`
);

code = code.replace(
  `if (data && !data.avatar_url && providerAvatar) {`,
  `console.log("SYNC_PROFILE_STEP_6", {hasData: !!data});\nif (data && !data.avatar_url && providerAvatar) {`
);

code = code.replace(
  `// Task 3: Fetch database capabilities`,
  `console.log("SYNC_PROFILE_STEP_7");\n// Task 3: Fetch database capabilities`
);

code = code.replace(
  `const profileWithDesignation = rowToProfile(extendedData as Record<string, unknown>);`,
  `console.log("SYNC_PROFILE_STEP_8");\nconst profileWithDesignation = rowToProfile(extendedData as Record<string, unknown>);`
);

fs.writeFileSync(file, code);
console.log('Patched AuthContext.tsx');
