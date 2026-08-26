import { listPresets } from '@sw2d/presets';

/** No Ajv, no Phaser: @sw2d/presets' own production dependency shape (ADR-0015) is what keeps this cheap. */
export async function run(): Promise<number> {
  for (const preset of listPresets()) {
    console.log(`${preset.id}\t${preset.family}\t${preset.maturity}\t${preset.displayName}`);
  }
  return 0;
}
