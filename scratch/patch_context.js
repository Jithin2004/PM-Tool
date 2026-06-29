const fs = require('fs');
let code = fs.readFileSync('frontend/src/context/OperationalDataContext.tsx', 'utf8');

// I already replaced `export const OperationalDataContext =` with `console.log(...) export const...` in the previous step, so let me undo that first just in case.
code = code.replace(`console.log('CREATING OPERATIONAL DATA CONTEXT'); export const OperationalDataContext =`, `export const OperationalDataContext =`);

code = code.replace(
  `export const OperationalDataContext = createContext<OperationalDataContextValue | null>(null);`,
  `export const OperationalDataContext = createContext<OperationalDataContextValue | null>(null);\n(OperationalDataContext as any)._uid = Math.random();\nconsole.log('CREATED CONTEXT UID:', (OperationalDataContext as any)._uid);`
);

// I already added `console.log('USING OPERATIONAL DATA', ctx);`, I'll replace it:
code = code.replace(
  `const ctx = useContext(OperationalDataContext);\n  console.log('USING OPERATIONAL DATA', ctx);`,
  `const ctx = useContext(OperationalDataContext);\n  console.log('USING CONTEXT WITH UID:', (OperationalDataContext as any)._uid);`
);

fs.writeFileSync('frontend/src/context/OperationalDataContext.tsx', code);
console.log('Patched!');
