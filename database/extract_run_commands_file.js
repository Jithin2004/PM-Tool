import fs from 'fs';
import readline from 'readline';

async function extract() {
  const logFile = 'C:/Users/jithi/.gemini/antigravity-ide/brain/ed076436-8a8f-471b-8f55-5fe38aab7b7f/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Extracting RUN_COMMAND tools...");
  let results = [];
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      // Let's find model steps that made run_command tool calls
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'run_command') {
            results.push(`Cmd: ${tc.args.CommandLine} | Cwd: ${tc.args.Cwd}`);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  fs.writeFileSync('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/run_commands_log.txt', results.join('\n'));
  console.log("Extracted", results.length, "commands.");
}

extract();
