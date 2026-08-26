import { existsSync } from 'node:fs';
import { findSystemChrome } from '@sw2d/qa';
import { REPO_ROOT } from '../paths.ts';

interface Check {
  readonly name: string;
  readonly status: 'ok' | 'warn' | 'fail';
  readonly detail: string;
}

function check(name: string, status: Check['status'], detail: string): Check {
  return { name, status, detail };
}

/**
 * Environment diagnostics only - never mutates the project (MASTER_PROJECT.md
 * section 9's "doctor must not mutate the project"). Tiled and browser QA are
 * reported as optional/best-effort, per the same section.
 */
export async function run(): Promise<number> {
  const checks: Check[] = [];

  const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
  const nodeOk = major > 22 || (major === 22 && minor >= 12);
  checks.push(check('Node.js', nodeOk ? 'ok' : 'fail', `${process.version} (need >=22.12.0)`));

  checks.push(check('npm', existsSync(`${REPO_ROOT}/package-lock.json`) ? 'ok' : 'warn', 'package-lock.json present'));

  const installed = existsSync(`${REPO_ROOT}/node_modules`);
  checks.push(check('Dependency install', installed ? 'ok' : 'fail', installed ? 'node_modules present' : 'run `npm install`'));

  try {
    await import('typescript');
    checks.push(check('TypeScript', 'ok', 'resolvable'));
  } catch {
    checks.push(check('TypeScript', 'fail', 'not resolvable - run `npm install`'));
  }

  try {
    const schemas = await import('@sw2d/schemas');
    schemas.validateDocument('game-definition', 'doctor-probe', {});
    checks.push(check('Schemas (@sw2d/schemas)', 'ok', 'Ajv validator loads'));
  } catch (error) {
    checks.push(check('Schemas (@sw2d/schemas)', 'fail', String(error)));
  }

  for (const dir of ['packages/contracts', 'packages/runtime', 'packages/presets', 'packages/cli']) {
    checks.push(check(`Directory ${dir}`, existsSync(`${REPO_ROOT}/${dir}`) ? 'ok' : 'fail', 'required'));
  }
  checks.push(
    check('Directory games/ (generated games)', existsSync(`${REPO_ROOT}/games`) ? 'ok' : 'warn', "created on first `sw2d new` - absent is normal before that"),
  );

  const tiledPath = process.env.TILED_PATH;
  checks.push(
    check(
      'Tiled (optional)',
      tiledPath && existsSync(tiledPath) ? 'ok' : 'warn',
      tiledPath ? `TILED_PATH=${tiledPath}` : 'not configured - TILED_PATH env var; not required to run generated games',
    ),
  );

  const chrome = findSystemChrome();
  checks.push(
    check(
      'Real-browser QA capability',
      chrome ? 'ok' : 'warn',
      chrome ? `system Chrome found at ${chrome}` : 'no system Chrome found - browser smoke will be skipped, and validate will report incomplete',
    ),
  );

  let failed = false;
  for (const c of checks) {
    const marker = c.status === 'ok' ? 'OK  ' : c.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`[${marker}] ${c.name}: ${c.detail}`);
    if (c.status === 'fail') failed = true;
  }

  return failed ? 1 : 0;
}
