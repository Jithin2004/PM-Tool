import fs from 'fs';
import readline from 'readline';

async function parseLog() {
  const fileStream = fs.createReadStream('C:/Users/jithi/.gemini/antigravity-ide/brain/bf8de1a0-b33f-422c-bedf-5e6d6b54fed3/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching logs...");
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.toLowerCase().includes("exec_sql") || line.toLowerCase().includes("migration") || line.toLowerCase().includes("apply_sprint")) {
      // Print first 200 chars to avoid overwhelming console
      console.log(`Line ${lineNum}: ${line.substring(0, 300)}...`);
    }
  }
}

parseLog();
