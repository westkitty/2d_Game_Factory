import { describe, expect, it } from 'vitest';
import { baseName, folderOf, groupByName, groupKey, parseName, roleHintsFromName } from '../shared/grouping.ts';

describe('tolerant name parsing (P07)', () => {
  it('reads a trailing frame number in every common convention', () => {
    expect(parseName('walk_01.png')).toEqual({ stem: 'walk', frameIndex: 1 });
    expect(parseName('walk-2.png')).toEqual({ stem: 'walk', frameIndex: 2 });
    expect(parseName('walk0003.png')).toEqual({ stem: 'walk', frameIndex: 3 });
    expect(parseName('player_idle_0.png')).toEqual({ stem: 'player_idle', frameIndex: 0 });
    expect(parseName('run-left-01.png')).toEqual({ stem: 'run-left', frameIndex: 1 });
    expect(parseName('frame.12.png')).toEqual({ stem: 'frame', frameIndex: 12 });
  });

  it('treats a name with no trailing number as its own stem, not an error', () => {
    expect(parseName('hero.png')).toEqual({ stem: 'hero' });
    expect(parseName('background.jpg')).toEqual({ stem: 'background' });
  });

  it('does not merge purely numeric filenames from unrelated sources', () => {
    // "01.png" has no stem. Grouping it on the empty string would silently
    // pull every numerically-named file from every folder into one animation.
    expect(parseName('01.png')).toEqual({ stem: '01' });
    expect(parseName('sprites/01.png').stem).toBe('01');
  });

  it('extracts base names and folders from nested relative paths', () => {
    expect(baseName('art/hero/walk_01.png')).toBe('walk_01');
    expect(baseName('noextension')).toBe('noextension');
    expect(folderOf('art/hero/walk_01.png')).toBe('art/hero');
    expect(folderOf('walk_01.png')).toBeUndefined();
  });

  it('normalises case and separators into one grouping key', () => {
    expect(groupKey('Walk_01.png')).toBe(groupKey('walk-1.png'));
    expect(groupKey('hero/Run Left-02.png')).toBe('hero/run-left');
  });

  it('keeps identically-named files in different folders apart', () => {
    expect(groupKey('hero/walk_01.png')).not.toBe(groupKey('enemy/walk_01.png'));
  });
});

describe('group detection', () => {
  it('groups frames written in mixed conventions and orders them by frame index', () => {
    const groups = groupByName([
      { ref: 'a', relativePath: 'walk_01.png' },
      { ref: 'b', relativePath: 'walk-3.png' },
      { ref: 'c', relativePath: 'Walk0002.png' },
      { ref: 'd', relativePath: 'hero.png' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('walk');
    expect(groups[0]!.members.map((m) => m.ref)).toEqual(['a', 'c', 'b']);
  });

  it('does not report a group of one - that would be a false claim about what was detected', () => {
    expect(groupByName([{ ref: 'a', relativePath: 'hero.png' }])).toHaveLength(0);
  });

  it('returns groups in a stable order regardless of input order', () => {
    const entries = [
      { ref: 'z1', relativePath: 'zeta_01.png' },
      { ref: 'a1', relativePath: 'alpha_01.png' },
      { ref: 'z2', relativePath: 'zeta_02.png' },
      { ref: 'a2', relativePath: 'alpha_02.png' },
    ];
    const forward = groupByName(entries).map((g) => g.name);
    const reversed = groupByName([...entries].reverse()).map((g) => g.name);
    expect(forward).toEqual(['alpha', 'zeta']);
    expect(reversed).toEqual(forward);
  });
});

describe('role hints', () => {
  it('reads obvious role words out of a filename', () => {
    expect(roleHintsFromName('player_idle_01.png')).toContain('player');
    expect(roleHintsFromName('art/backgrounds/sky.png')).toContain('background');
    expect(roleHintsFromName('spikes-hazard.png')).toContain('hazard');
    expect(roleHintsFromName('ui/button-green.png')).toContain('ui.button');
  });

  it('returns nothing for a name that says nothing, rather than guessing', () => {
    expect(roleHintsFromName('img_20240101_0001.png')).toEqual([]);
    expect(roleHintsFromName('untitled.png')).toEqual([]);
  });

  it('is a hint only: several matches are all reported, none is chosen', () => {
    const hints = roleHintsFromName('player-vs-enemy.png');
    expect(hints).toContain('player');
    expect(hints).toContain('enemy');
  });
});
