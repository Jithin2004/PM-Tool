const fs = require('fs');
const path = require('path');
const dirs = ['src/components'];
let bgWhiteCount = 0;
let borderCount = 0;
let textBlackCount = 0;
let textGrayCount = 0;
let bgGrayCount = 0;
let fileCount = 0;

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scan(full);
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      const hasBgWhite = content.match(/bg-white([^A-Za-z0-9\-]|$)/g);
      const hasBorder = content.match(/border-gray-[0-9]+/g);
      const hasTextBlack = content.match(/text-black/g);
      const hasTextGray = content.match(/text-gray-[0-9]+/g);
      const hasBgGray = content.match(/bg-slate-[0-9]+|bg-gray-[0-9]+/g);
      
      if (hasBgWhite || hasBorder || hasTextBlack || hasTextGray || hasBgGray) {
        if (hasBgWhite) bgWhiteCount += hasBgWhite.length;
        if (hasBorder) borderCount += hasBorder.length;
        if (hasTextBlack) textBlackCount += hasTextBlack.length;
        if (hasTextGray) textGrayCount += hasTextGray.length;
        if (hasBgGray) bgGrayCount += hasBgGray.length;
        fileCount++;
      }
    }
  }
}
dirs.forEach(scan);
console.log(JSON.stringify({
  fileCount, bgWhiteCount, borderCount, textBlackCount, textGrayCount, bgGrayCount
}));
