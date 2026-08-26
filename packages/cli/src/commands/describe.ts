import { UnknownPresetError, getPreset } from '@sw2d/presets';

export async function run(args: readonly string[]): Promise<number> {
  const id = args[0];
  if (!id) {
    console.error('Usage: npm run sw2d -- describe <preset-id>');
    return 1;
  }

  let preset;
  try {
    preset = getPreset(id);
  } catch (error) {
    if (error instanceof UnknownPresetError) {
      console.error(error.message);
      console.error('Run: npm run sw2d -- list-presets');
      return 1;
    }
    throw error;
  }

  console.log(`id:               ${preset.id}`);
  console.log(`displayName:      ${preset.displayName}`);
  console.log(`family:           ${preset.family}`);
  console.log(`maturity:         ${preset.maturity}`);
  console.log(`controllers:      ${preset.controllerFamilies.join(', ')}`);
  console.log(`required packs:   ${preset.requiredSystemPacks.map((s) => s.packId).join(', ') || '(none)'}`);
  console.log(`optional packs:   ${preset.optionalSystemPacks.map((s) => s.packId).join(', ') || '(none)'}`);
  console.log(`content roles:    ${preset.requiredContentRoles.join(', ')}`);
  console.log(`input modes:      ${preset.supportedInputModes.join(', ')}`);
  console.log(`validationProfile: ${preset.validationProfile}`);
  console.log('knownLimitations:');
  if (preset.knownLimitations.length === 0) {
    console.log('  (none stated)');
  } else {
    for (const limitation of preset.knownLimitations) console.log(`  - ${limitation}`);
  }
  return 0;
}
