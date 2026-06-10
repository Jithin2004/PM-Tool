import fs from 'fs';
import readline from 'readline';

async function extract() {
  const logFile = 'C:/Users/jithi/.gemini/antigravity-ide/brain/ed076436-8a8f-471b-8f55-5fe38aab7b7f/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Extracting RUN_COMMAND details...");
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'RUN_COMMAND' || (parsed.tool_calls && parsed.tool_calls.some(t => t.name === 'run_command'))) {
        console.log(`Line ${lineNum}:`, parsed.content || JSON.stringify(parsed.tool_calls));
      }
    } catch (e) {
      // ignore
    }
  }
}

extract();
