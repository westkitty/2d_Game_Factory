import { UnknownPresetError } from '@sw2d/presets';
import { OverlayContainmentError, createGame } from '../factory.ts';
import { TargetExistsError } from '../paths.ts';
import { InvalidSlugError } from '../slug.ts';
import { parseArgs } from '../args.ts';

/**
 * `sw2d new <game-id> --preset <preset-id>`.
 *
 * A thin argv wrapper over `createGame` in `../factory.ts` - the one canonical
 * generation path, shared with the workbench host so the two can never drift
 * into different factories. Everything this file adds is argv parsing and
 * turning a thrown error into an exit code plus a message a person can act on.
 */
export async function run(args: readonly string[]): Promise<number> {
  const { positional, flags } = parseArgs(args);
  const gameId = positional[0];
  const presetId = flags.preset;

  if (!gameId || !presetId) {
    console.error('Usage: npm run sw2d -- new <game-id> --preset <preset-id>');
    return 1;
  }

  try {
    const result = createGame({ gameId, presetId });
    console.log(`Generated "${result.gameId}" from preset "${result.presetId}" at games/${result.gameId}/.`);
    console.log(`Next: npm install && npm run sw2d -- validate ${result.gameId}`);
    return 0;
  } catch (error) {
    if (error instanceof UnknownPresetError) {
      console.error(error.message);
      console.error('Run: npm run sw2d -- list-presets');
      return 1;
    }
    if (error instanceof InvalidSlugError || error instanceof TargetExistsError || error instanceof OverlayContainmentError) {
      console.error(error.message);
      return 1;
    }
    if (error instanceof Error && error.message.startsWith('Generator error:')) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}
