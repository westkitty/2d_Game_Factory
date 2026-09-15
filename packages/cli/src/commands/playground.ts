import { UnknownPresetError } from '@sw2d/presets';
import { createGame } from '../factory.ts';
import { InvalidSlugError } from '../slug.ts';
import { TargetExistsError } from '../paths.ts';
import { parseArgs } from '../args.ts';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths.ts';
import { execSync } from 'node:child_process';

/**
 * `sw2d playground <preset-id>` - Instant game preview from a preset.
 *
 * The WOW-ME feature: one command generates a game, installs dependencies,
 * builds it, and tells you how to play it. The fastest path from "I want to
 * try this preset" to "I'm playing it."
 *
 * Cleans up after itself when done (or on Ctrl+C).
 */
export async function run(args: readonly string[]): Promise<number> {
  const { positional, flags } = parseArgs(args);
  const presetId = positional[0];
  const keep = flags.keep === 'true' || flags.keep === '1';

  if (!presetId) {
    console.error('Usage: npm run sw2d -- playground <preset-id> [--keep=true]');
    console.error('');
    console.error('Instantly generate, build, and serve a game from any preset.');
    console.error('The game directory is cleaned up automatically unless --keep=true.');
    console.error('');
    console.error('Examples:');
    console.error('  npm run sw2d -- playground traditional-platformer');
    console.error('  npm run sw2d -- playground twin-stick-shooter --keep=true');
    return 1;
  }

  const gameId = `playground-${presetId}-${Date.now().toString(36)}`;
  const gameDir = join(REPO_ROOT, 'games', gameId);

  const cleanup = (): void => {
    if (!keep && existsSync(gameDir)) {
      console.log(`\nCleaning up ${gameId}...`);
      try {
        rmSync(gameDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  };

  // Register cleanup on exit
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  try {
    // Step 1: Generate
    console.log('');
    console.log('🎮 SW2D Playground');
    console.log('==================');
    console.log('');
    console.log(`Preset: ${presetId}`);
    console.log('');

    process.stdout.write('⏳ Generating game... ');
    let result;
    try {
      result = createGame({ gameId, presetId });
      console.log('✓');
    } catch (error) {
      console.log('✗');
      if (error instanceof UnknownPresetError) {
        console.error(`Unknown preset: "${presetId}"`);
        console.error('Run: npm run sw2d -- list-presets');
        return 1;
      }
      if (error instanceof InvalidSlugError || error instanceof TargetExistsError) {
        console.error(error.message);
        return 1;
      }
      throw error;
    }

    // Step 2: Install
    process.stdout.write('⏳ Installing dependencies... ');
    try {
      execSync('npm install', { cwd: REPO_ROOT, stdio: 'pipe' });
      console.log('✓');
    } catch {
      console.log('⚠ (dependencies may already be installed)');
    }

    // Step 3: Build
    process.stdout.write('⏳ Building game... ');
    try {
      execSync('npm run build', { cwd: gameDir, stdio: 'pipe' });
      console.log('✓');
    } catch (error) {
      console.log('✗');
      console.error('Build failed. Try: npm run sw2d -- build ' + gameId);
      cleanup();
      return 1;
    }

    // Step 4: Report
    console.log('');
    console.log('✅ Game ready!');
    console.log('');
    console.log(`  Game ID:   ${result.gameId}`);
    console.log(`  Directory: games/${result.gameId}/`);
    console.log(`  Preset:    ${result.presetId}`);
    console.log('');
    console.log('To play:');
    console.log(`  cd games/${result.gameId} && npx serve dist`);
    console.log('');
    console.log('Or validate:');
    console.log(`  npm run sw2d -- validate ${result.gameId}`);
    console.log('');
    if (keep) {
      console.log('Game directory kept (--keep=true). Remove manually when done.');
    } else {
      console.log('Game directory will be cleaned up on exit. Use --keep=true to keep it.');
    }

    cleanup();
    return 0;
  } catch (error) {
    console.error('Unexpected error:', error);
    cleanup();
    return 1;
  }
}
