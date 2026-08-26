import { launchHarness, type Harness } from './harness.ts';
import { serveStatic } from './staticServer.ts';

export interface SmokeOutcome {
  readonly passed: boolean;
  /** Whatever state the spec wants recorded as evidence - shown in the smoke report either way. */
  readonly details: Readonly<Record<string, unknown>>;
  readonly failureReason?: string;
}

export interface SmokeSpec {
  readonly id: string;
  /** Directory containing a production build (must already exist - the runner does not build). */
  readonly buildDir: string;
  readonly entryPath?: string;
  run(harness: Harness): Promise<SmokeOutcome>;
}

export interface SmokeResult extends SmokeOutcome {
  readonly id: string;
  readonly consoleErrors: readonly string[];
  readonly externalRequests: readonly string[];
}

/**
 * The one common runner every committed smoke spec goes through
 * (MASTER_PROJECT.md section 18: "do not create twelve unrelated runners").
 * Serves the build, launches the harness, runs the spec's own scripted
 * interaction, and folds in the two oracle checks every smoke shares
 * (zero console errors, zero external requests) on top of whatever the spec
 * itself asserted.
 */
export async function runSmoke(spec: SmokeSpec): Promise<SmokeResult> {
  const server = await serveStatic(spec.buildDir);
  const harness = await launchHarness();
  try {
    await harness.gotoAndWaitForRuntime(`${server.baseUrl}/${spec.entryPath ?? 'index.html'}`);
    const outcome = await spec.run(harness);
    const consoleErrors = harness.consoleErrors();
    const externalRequests = harness.externalRequests();
    const passed = outcome.passed && consoleErrors.length === 0 && externalRequests.length === 0;
    return { id: spec.id, ...outcome, passed, consoleErrors, externalRequests };
  } finally {
    await harness.close();
    await server.close();
  }
}
