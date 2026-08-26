import { spawn } from 'node:child_process';

export interface ExecResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run a subprocess to completion, capturing both streams. Never throws on a
 * nonzero exit - the caller decides what a failing exit code means
 * (MASTER_PROJECT.md section 24: "do not swallow subprocess errors" means
 * surface stdout/stderr on failure, not that a nonzero exit must throw).
 */
export function run(command: string, args: readonly string[], options: { cwd: string }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
