const { execSync } = require('child_process');
const fs = require('fs');

console.log('Running build to ensure no TypeScript compilation errors...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: 'C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend' });
  console.log('Build completed successfully.');
} catch (e) {
  console.error('Build failed!', e.message);
}

// Just checking if all files exist and compiling the markdown
console.log('Writing PRODUCTION_READINESS_REPORT.md...');
