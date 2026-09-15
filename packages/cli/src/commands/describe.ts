import { UnknownPresetError, getPreset } from '@sw2d/presets';

export async function run(args: readonly string[]): Promise<number> {
  const id = args[0];
  if (!id) {
    console.error('Usage: npm run sw2d -- describe <preset-id>');
    console.error('');
    console.error('Show detailed information about a genre preset.');
    console.error('See all presets: npm run sw2d -- list-presets');
    return 1;
  }

  let preset;
  try {
    preset = getPreset(id);
  } catch (error) {
    if (error instanceof UnknownPresetError) {
      console.error(`Unknown preset: "${id}"`);
      console.error('');
      console.error('Run: npm run sw2d -- list-presets');
      return 1;
    }
    throw error;
  }

  console.log(`Preset: ${preset.displayName}`);
  console.log('='.repeat(50));
  console.log('');
  console.log(`  ID:                 ${preset.id}`);
  console.log(`  Family:             ${preset.family}`);
  console.log(`  Maturity:           ${preset.maturity}`);
  console.log(`  Controllers:        ${preset.controllerFamilies.join(', ')}`);
  console.log(`  Input modes:        ${preset.supportedInputModes.join(', ')}`);
  console.log(`  Validation profile:  ${preset.validationProfile}`);
  console.log('');
  console.log('Required packs:');
  if (preset.requiredSystemPacks.length === 0) {
    console.log('  (none)');
  } else {
    for (const pack of preset.requiredSystemPacks) console.log(`  - ${pack.packId}`);
  }
  console.log('');
  console.log('Optional packs:');
  if (preset.optionalSystemPacks.length === 0) {
    console.log('  (none)');
  } else {
    for (const pack of preset.optionalSystemPacks) console.log(`  - ${pack.packId}`);
  }
  console.log('');
  console.log('Required content roles:');
  if (preset.requiredContentRoles.length === 0) {
    console.log('  (none)');
  } else {
    for (const role of preset.requiredContentRoles) console.log(`  - ${role}`);
  }
  console.log('');
  console.log('Known limitations:');
  if (preset.knownLimitations.length === 0) {
    console.log('  (none stated)');
  } else {
    for (const limitation of preset.knownLimitations) console.log(`  - ${limitation}`);
  }
  console.log('');
  console.log('Create a game from this preset:');
  console.log(`  npm run sw2d -- new my-game --preset ${preset.id}`);
  return 0;
}
