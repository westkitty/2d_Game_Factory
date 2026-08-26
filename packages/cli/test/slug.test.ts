import { describe, expect, it } from 'vitest';
import { InvalidSlugError, assertValidSlug } from '../src/slug.ts';

describe('assertValidSlug', () => {
  it('accepts a lowercase-hyphen id', () => {
    expect(assertValidSlug('game id', 'my-game-42')).toBe('my-game-42');
  });

  it('accepts a single-letter id', () => {
    expect(assertValidSlug('game id', 'a')).toBe('a');
  });

  it('rejects an empty id', () => {
    expect(() => assertValidSlug('game id', '')).toThrow(InvalidSlugError);
  });

  it('rejects a traversal attempt', () => {
    expect(() => assertValidSlug('game id', '../evil')).toThrow(InvalidSlugError);
    expect(() => assertValidSlug('game id', '..')).toThrow(InvalidSlugError);
  });

  it('rejects a path separator', () => {
    expect(() => assertValidSlug('game id', 'foo/bar')).toThrow(InvalidSlugError);
    expect(() => assertValidSlug('game id', 'foo\\bar')).toThrow(InvalidSlugError);
  });

  it('rejects an absolute path', () => {
    expect(() => assertValidSlug('game id', '/etc/passwd')).toThrow(InvalidSlugError);
  });

  it('rejects uppercase letters', () => {
    expect(() => assertValidSlug('game id', 'MyGame')).toThrow(InvalidSlugError);
  });

  it('rejects an id starting with a digit or hyphen', () => {
    expect(() => assertValidSlug('game id', '1game')).toThrow(InvalidSlugError);
    expect(() => assertValidSlug('game id', '-game')).toThrow(InvalidSlugError);
  });

  it('rejects an id with a dot', () => {
    expect(() => assertValidSlug('game id', 'game.json')).toThrow(InvalidSlugError);
  });

  it('the error message names the offending id', () => {
    expect(() => assertValidSlug('level id', 'Bad Id')).toThrow(/"Bad Id"/);
  });
});
