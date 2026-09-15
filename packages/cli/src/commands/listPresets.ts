import { listPresets } from '@sw2d/presets';

/** No Ajv, no Phaser: @sw2d/presets' own production dependency shape (ADR-0015) is what keeps this cheap. */
export async function run(): Promise<number> {
  const presets = listPresets();
  console.log('SW2D Preset Catalog');
  console.log('===================');
  console.log('');
  console.log('ID                                    Family    Maturity           Display Name');
  console.log('------------------------------------  --------  -----------------  --------------------------------');
  for (const preset of presets) {
    const id = preset.id.padEnd(36);
    const family = preset.family.padEnd(10);
    const maturity = preset.maturity.padEnd(19);
    console.log(`${id}${family}${maturity}${preset.displayName}`);
  }
  console.log('');
  const maturityCounts = presets.reduce<Record<string, number>>((acc, p) => {
    acc[p.maturity] = (acc[p.maturity] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Total: ${presets.length} presets`);
  for (const [maturity, count] of Object.entries(maturityCounts).sort()) {
    console.log(`  ${maturity}: ${count}`);
  }
  console.log('');
  console.log('Use: npm run sw2d -- describe <preset-id>');
  return 0;
}
