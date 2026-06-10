import fs from 'fs';
import readline from 'readline';

async function check() {
  const logFile = 'C:/Users/jithi/.gemini/antigravity-ide/brain/ed076436-8a8f-471b-8f55-5fe38aab7b7f/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Checking psql runs...");
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.includes("psql -U postgres")) {
      console.log(`Line ${lineNum}: ${line.substring(0, 500)}`);
      // Find the next RUN_COMMAND line to print output
    }
  }
}

check();
