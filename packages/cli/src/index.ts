/**
 * @sw2d/cli - the sw2d factory CLI: doctor, list-presets, describe, new,
 * add-level, add-theme, validate, build, pack.
 *
 * Each command lives in its own module under `commands/`, loaded via a
 * dynamic `import()` keyed by the requested command name - not a static
 * import list. That is what keeps `list-presets`/`describe`/`doctor` from
 * ever loading Ajv or Phaser: only the command actually invoked is
 * evaluated (ADR-0015's boundary discipline, applied to the CLI itself).
 */

const COMMANDS = [
  'doctor',
  'list-presets',
  'describe',
  'new',
  'add-level',
  'add-theme',
  'validate',
  'build',
  'pack',
] as const;

type CommandName = (typeof COMMANDS)[number];

function isCommandName(value: string): value is CommandName {
  return (COMMANDS as readonly string[]).includes(value);
}

async function loadCommand(name: CommandName): Promise<{ run(args: readonly string[]): Promise<number> }> {
  switch (name) {
    case 'doctor':
      return import('./commands/doctor.ts');
    case 'list-presets':
      return import('./commands/listPresets.ts');
    case 'describe':
      return import('./commands/describe.ts');
    case 'new':
      return import('./commands/new.ts');
    case 'add-level':
      return import('./commands/addLevel.ts');
    case 'add-theme':
      return import('./commands/addTheme.ts');
    case 'validate':
      return import('./commands/validate.ts');
    case 'build':
      return import('./commands/build.ts');
    case 'pack':
      return import('./commands/pack.ts');
  }
}

function printUsage(): void {
  console.error('Usage: npm run sw2d -- <command> [args]');
  console.error('');
  console.error('Commands:');
  for (const name of COMMANDS) console.error(`  ${name}`);
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const [commandName, ...rest] = argv;
  if (!commandName || !isCommandName(commandName)) {
    console.error(`Unknown command "${commandName ?? ''}". Run: npm run sw2d -- <command>`);
    printUsage();
    return 1;
  }
  const command = await loadCommand(commandName);
  return command.run(rest);
}
