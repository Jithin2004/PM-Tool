import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.');
files.forEach(file => {
  if (file.endsWith('.sql')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('exec_sql')) {
      console.log(`Found exec_sql in file: ${file}`);
    }
  }
});
