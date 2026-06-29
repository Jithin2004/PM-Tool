const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/error/AppErrorBoundary.tsx', 'utf8');
code = code.replace(
  `The application encountered a critical error. Our systems have prevented further action to protect your data.`,
  `The application encountered a critical error. {this.state.error?.message} : {this.state.error?.stack}`
);
fs.writeFileSync('frontend/src/components/error/AppErrorBoundary.tsx', code);
