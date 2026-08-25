import type { PackConfigValidator } from '@sw2d/contracts';
import { validateBySchemaIdOrThrow } from './validator.ts';

/**
 * The concrete `PackConfigValidator` backing `@sw2d/runtime`'s
 * dependency-inverted validator interface (`SystemHostImpl`'s optional third
 * constructor argument).
 *
 * A composition root - a game, or a pack's own test suite - passes this in
 * to enforce `configSchemaId`. Omitting it leaves `configSchemaId` declared
 * but unenforced, exactly as before this existed. The schema itself must
 * already be registered (see `registerSchema` in `./validator.ts`) by
 * whichever package owns it - this validator does not know about any
 * specific pack's schema, only how to check one by id.
 */
export const packConfigValidator: PackConfigValidator = {
  validate(configSchemaId, packId, config) {
    return validateBySchemaIdOrThrow(configSchemaId, `${packId}.config`, config);
  },
};
