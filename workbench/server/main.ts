/**
 * `npm run dev` lands here.
 *
 * Starts the workbench host on loopback, prints the URL, and makes sure every
 * child process it owns (dev servers, preview servers) is torn down on exit -
 * a factory that leaks a dev server every time it stops is a factory that
 * eventually cannot start.
 */

import { spawn } from 'node:child_process';
import { startHost } from './host.ts';

const production = process.argv.includes('--production');
const noOpen = process.argv.includes('--no-open');

const host = await startHost({ production });

console.log('');
console.log('  Stinky Weasel Game Factory Workbench');
console.log(`  ${host.url}`);
console.log(`  ${production ? 'production build' : 'dev (hot reload)'} | 127.0.0.1 only | no network, no account, no API key`);
console.log('');

if (!noOpen && process.stdout.isTTY) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(opener, [host.url], { shell: false, detached: true, stdio: 'ignore' }).unref();
}

let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  console.log(`\n  ${signal} - stopping workbench and any preview servers it started.`);
  await host.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
