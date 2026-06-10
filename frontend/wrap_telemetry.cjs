const ts = require('typescript');
const fs = require('fs');

function wrapSupabaseCalls(sourceFile, sourceCode) {
    let replacements = [];

    function visit(node) {
        if (ts.isAwaitExpression(node)) {
            const exp = node.expression;
            let isSupabase = false;
            let opName = 'supabase_operation';

            let current = exp;
            while(current) {
                if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
                    if (ts.isPropertyAccessExpression(current)) {
                        if (ts.isIdentifier(current.expression) && current.expression.text === 'supabase') {
                            isSupabase = true;
                            opName = 'supabase_' + current.name.text;
                            
                            // Extract table or rpc name
                            if ((current.name.text === 'from' || current.name.text === 'rpc') && ts.isCallExpression(current.parent) && current.parent.arguments.length > 0) {
                                const arg = current.parent.arguments[0];
                                if (ts.isStringLiteral(arg)) {
                                    opName = 'supabase_' + current.name.text + '_' + arg.text;
                                }
                            }
                            break;
                        }
                        current = current.expression;
                    } else if (ts.isCallExpression(current)) {
                        current = current.expression;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            if (isSupabase) {
                if (ts.isCallExpression(exp) && ts.isIdentifier(exp.expression) && exp.expression.text === 'trackSupabaseOperation') {
                    // Already wrapped
                } else {
                    replacements.push({
                        start: exp.getStart(sourceFile),
                        end: exp.getEnd(),
                        opName: opName
                    });
                }
            }
        }
        
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Apply replacements from back to front
    replacements.sort((a, b) => b.start - a.start);
    
    let result = sourceCode;
    for (const r of replacements) {
        const originalText = result.substring(r.start, r.end);
        const replacementText = `trackSupabaseOperation('${r.opName}', () => ${originalText})`;
        result = result.substring(0, r.start) + replacementText + result.substring(r.end);
    }
    
    return { result, count: replacements.length };
}

const filesToWrap = [
    'src/services/financeService.ts',
    'src/services/projectService.ts',
    'src/services/approvalService.ts',
    'src/services/teamService.ts',
    'src/pages/onboarding/WorkspaceSetupWizard.tsx'
];

let totalWrapped = 0;

for (const file of filesToWrap) {
    if (!fs.existsSync(file)) {
        console.log("File not found:", file);
        continue;
    }
    const sourceCode = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    
    const { result, count } = wrapSupabaseCalls(sourceFile, sourceCode);
    
    if (count > 0) {
        let finalResult = result;
        if (!finalResult.includes('trackSupabaseOperation')) {
            let importPath = '../core/observability/telemetry';
            if (file.includes('components')) {
                importPath = '../../core/observability/telemetry';
            }
            finalResult = `import { trackSupabaseOperation } from '${importPath}';\n` + finalResult;
        }
        
        fs.writeFileSync(file, finalResult, 'utf8');
        console.log(`Wrapped ${count} operations in ${file}`);
        totalWrapped += count;
    } else {
        console.log(`No unwrapped operations found in ${file}`);
    }
}

console.log("Total operations wrapped:", totalWrapped);


