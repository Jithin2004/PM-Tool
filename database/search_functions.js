import fs from 'fs';

const content = fs.readFileSync('FINAL_PRODUCTION_SCHEMA.sql', 'utf8');
const regex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.\"]+)/gi;
let match;
while ((match = regex.exec(content)) !== null) {
  const funcName = match[1];
  if (funcName.toLowerCase().includes('sql') || funcName.toLowerCase().includes('exec') || funcName.toLowerCase().includes('query')) {
    console.log("Found function:", funcName);
  }
}
