import fs from 'fs';
import readline from 'readline';

async function search() {
  const logFile = 'C:/Users/jithi/.gemini/antigravity-ide/brain/ed076436-8a8f-471b-8f55-5fe38aab7b7f/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching history for how SQL was run...");
  let lineNum = 0;
  let matches = [];
  for await (const line of rl) {
    lineNum++;
    // Let's look for run_command or other commands that executed migrations/SQL
    if (line.includes("RUN_COMMAND") && (line.includes(".sql") || line.includes("node ") || line.includes("sql"))) {
      matches.push(`Line ${lineNum}: ${line.substring(0, 300)}...`);
    }
  }
  console.log("Matches:", matches.join("\n"));
}

search();
