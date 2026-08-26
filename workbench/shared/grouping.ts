/**
 * Naming-tolerant frame grouping (principle P07).
 *
 * GDevelop's own bulk-import work had to cope with the fact that artists and
 * exporters do not agree on a convention - some start at 0, some at 1, some
 * pad, some use hyphens, some underscores (see
 * docs/research/WORKBENCH_COMPETITIVE_RESEARCH.md). So this recognises the
 * common shapes and *suggests*; it never requires one, and a file it cannot
 * read is imported ungrouped rather than rejected.
 */

export interface NameParts {
  /** The name with its trailing frame number and extension removed. Empty when the whole name was a number. */
  readonly stem: string;
  /** The trailing frame number, when the name ended in one. */
  readonly frameIndex?: number;
}

const TRAILING_NUMBER = /^(.*?)[ _\-.]?(\d{1,5})$/;

/** Strips a directory prefix and a file extension. Never throws - a name with no dot is its own base. */
export function baseName(relativePath: string): string {
  const lastSlash = Math.max(relativePath.lastIndexOf('/'), relativePath.lastIndexOf('\\'));
  const fileName = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath;
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

/** The directory portion of an imported relative path, used only as a library folder label. */
export function folderOf(relativePath: string): string | undefined {
  const normalized = relativePath.replaceAll('\\', '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return undefined;
  const folder = normalized.slice(0, lastSlash).replace(/^\.\//, '');
  return folder.length > 0 ? folder : undefined;
}

/**
 * Splits `walk_01` / `walk-2` / `walk0003` / `player_idle_0` / `run-left-01`
 * into a stem and a frame index. `hero` (no trailing digits) yields the whole
 * name and no index, which is correct: a single image is a group of one.
 */
export function parseName(relativePath: string): NameParts {
  const base = baseName(relativePath);
  const match = TRAILING_NUMBER.exec(base);
  if (!match) return { stem: base };
  const stem = match[1] ?? '';
  const digits = match[2]!;
  // A name that is *only* digits ("01.png") has no stem to group on; treat the
  // whole thing as the stem so it does not silently merge with every other
  // numerically-named file from an unrelated folder.
  if (stem.length === 0) return { stem: base };
  return { stem, frameIndex: Number.parseInt(digits, 10) };
}

/** Lowercased, punctuation-flattened stem - the actual grouping key. `Walk_01` and `walk-1` land together. */
export function groupKey(relativePath: string): string {
  const { stem } = parseName(relativePath);
  const folder = folderOf(relativePath) ?? '';
  const flattened = stem
    .toLowerCase()
    .replace(/[ _\-.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return folder.length > 0 ? `${folder.toLowerCase()}/${flattened}` : flattened;
}

export interface NameGroup {
  readonly name: string;
  readonly members: readonly { readonly ref: string; readonly frameIndex?: number }[];
}

/**
 * Groups by tolerant key, then keeps only groups with more than one member -
 * a "group" of one is just a file, and showing it as an animation candidate
 * would be a false claim about what was detected.
 */
export function groupByName(entries: readonly { readonly ref: string; readonly relativePath: string }[]): readonly NameGroup[] {
  const byKey = new Map<string, { ref: string; frameIndex?: number }[]>();
  for (const entry of entries) {
    const key = groupKey(entry.relativePath);
    if (key.length === 0) continue;
    const parsed = parseName(entry.relativePath);
    const member = parsed.frameIndex === undefined ? { ref: entry.ref } : { ref: entry.ref, frameIndex: parsed.frameIndex };
    const existing = byKey.get(key);
    if (existing) existing.push(member);
    else byKey.set(key, [member]);
  }

  return [...byKey.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([name, members]) => ({
      name,
      members: [...members].sort((a, b) => (a.frameIndex ?? 0) - (b.frameIndex ?? 0) || a.ref.localeCompare(b.ref)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Role hints read from a filename. Purely advisory - the Role Mapper always
 * shows the suggestion as a suggestion, and the user's choice always wins.
 */
const ROLE_HINTS: readonly { readonly pattern: RegExp; readonly role: string }[] = [
  { pattern: /\b(player|hero|character|protagonist|avatar|guy|girl|cat|dog)\b/, role: 'player' },
  { pattern: /\b(enemy|monster|foe|villain|boss|mob|creep)\b/, role: 'enemy' },
  { pattern: /\b(pickup|coin|gem|collectible|item|loot|star|fruit)\b/, role: 'pickup' },
  { pattern: /\b(platform|ground|floor|brick|block)\b/, role: 'platform' },
  { pattern: /\b(tile|tileset|tiles)\b/, role: 'tile' },
  { pattern: /\b(background|bg|backdrop|sky|scene|level|world|landscape)\b/, role: 'background' },
  { pattern: /\b(hazard|spike|trap|lava|saw|danger)\b/, role: 'hazard' },
  { pattern: /\b(checkpoint|flag|save|banner)\b/, role: 'checkpoint' },
  { pattern: /\b(exit|door|goal|portal|gate|finish)\b/, role: 'exit' },
  { pattern: /\b(particle|spark|dust|smoke|puff)\b/, role: 'particle' },
  { pattern: /\b(panel|window|frame|dialog|hud)\b/, role: 'ui.panel' },
  { pattern: /\b(button|btn)\b/, role: 'ui.button' },
  { pattern: /\b(cursor|pointer|crosshair|reticle)\b/, role: 'ui.cursor' },
];

export function roleHintsFromName(relativePath: string): readonly string[] {
  const haystack = relativePath.toLowerCase().replace(/[_\-./\\]+/g, ' ');
  const hits: string[] = [];
  for (const hint of ROLE_HINTS) {
    if (hint.pattern.test(haystack) && !hits.includes(hint.role)) hits.push(hint.role);
  }
  return hits;
}
