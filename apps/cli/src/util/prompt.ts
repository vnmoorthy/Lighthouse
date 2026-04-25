/**
 * Tiny readline-based prompt helpers.
 *
 * We deliberately avoid `inquirer` / `prompts` to keep the install lean.
 * Passphrase entry hides keystrokes by writing a custom output stream that
 * swallows everything but the newline, so what the user types is never echoed.
 */
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

export async function askLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(prompt, (answer) => resolve(answer));
    });
  } finally {
    rl.close();
  }
}

export async function askPassphrase(prompt: string): Promise<string> {
  // Swallow output so keystrokes don't echo.
  const muted = new Writable({ write(_, __, cb) { cb(); } });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  // Print prompt directly; we control echo.
  process.stdout.write(prompt);
  return await new Promise<string>((resolve) => {
    rl.question('', (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

export async function confirm(prompt: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const ans = (await askLine(`${prompt} ${hint} `)).trim().toLowerCase();
  if (ans === '') return defaultYes;
  return ans === 'y' || ans === 'yes';
}
