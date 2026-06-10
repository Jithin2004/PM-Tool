import fs from 'fs';
import readline from 'readline';

async function getLines() {
  const logFile = 'C:/Users/jithi/.gemini/antigravity-ide/brain/ed076436-8a8f-471b-8f55-5fe38aab7b7f/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Printing log lines around line 5080...");
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum >= 5075 && lineNum <= 5090) {
      console.log(`Line ${lineNum}:`, line);
    }
  }
}

getLines();
