import { describe, expect, it } from 'vitest';
import { SchemaValidationError, packConfigValidator, registerSchema } from '@sw2d/schemas';
import gameData from '../content/game.json';
import placeholderMoverConfigSchema from '../schemas/placeholder-mover-config.schema.json';

/**
 * Regression coverage for pack config enforcement in the real game.
 *
 * `main.ts` now passes `packConfigValidator` to `createGame`, so every pack
 * this game selects has its declared `configSchemaId` checked before install
 * (ADR-0013). Before that, `starter.placeholder-mover` declared a
 * `configSchemaId` naming a schema that did not exist anywhere - a
 * declaration that would have thrown the moment anyone turned enforcement on.
 *
 * Deliberately does not import `placeholderMoverPack.ts`: it imports Phaser,
 * and this suite runs in plain Node (see vitest.config.ts). The schema
 * document and the validator are the parts under test; `main.ts` supplying
 * the validator is covered by the browser regression.
 */

const PACK_ID = 'starter.placeholder-mover';

// The pack module registers this at import time; do the same here so the test
// does not depend on a Phaser-importing module having been loaded first.
registerSchema(placeholderMoverConfigSchema);

function validate(config: unknown): unknown {
  return packConfigValidator.validate(placeholderMoverConfigSchema.$id, PACK_ID, config);
}

describe('starter.placeholder-mover config schema', () => {
  it('the id the pack declares resolves to a registered schema', () => {
    expect(placeholderMoverConfigSchema.$id).toBe('urn:sw2d:schema:starter-placeholder-mover-config:v1');
    expect(() => validate({})).not.toThrow();
  });

  it('accepts the config the shipped game.json actually selects', () => {
    const selection = gameData.systemPacks.find((entry) => entry.packId === PACK_ID);
    expect(selection).toBeDefined();
    expect(() => validate(selection?.config)).not.toThrow();
  });

  it('accepts a full, plausible tuning override', () => {
    expect(() =>
      validate({ moveSpeed: 260, dashMultiplier: 2, jumpVelocity: -500, gravity: 1200 }),
    ).not.toThrow();
  });

  it('rejects a positive jumpVelocity, with a located error', () => {
    // Phaser's y axis grows downward, so a positive jump velocity would drive
    // the actor into the floor - a typo a schema can and should catch.
    expect(() => validate({ jumpVelocity: 430 })).toThrow(SchemaValidationError);
    expect(() => validate({ jumpVelocity: 430 })).toThrow(/jumpVelocity/);
  });

  it('rejects a zero moveSpeed and an unknown field', () => {
    expect(() => validate({ moveSpeed: 0 })).toThrow(/moveSpeed/);
    expect(() => validate({ movespeed: 220 })).toThrow(SchemaValidationError);
  });
});
