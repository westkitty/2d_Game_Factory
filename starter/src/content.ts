import type { AssetDescriptor, ContentBundle, ContentSource, UiCopy } from '@sw2d/contracts';
import { validateContentBundleData } from '@sw2d/schemas';
import rawContent from '../content/content.json';
import tuningData from '../content/tuning.json';

/**
 * The validated JSON content source.
 *
 * Everything the runtime sees now comes from local content/*.json rather than
 * inline TypeScript literals - the acceptance test for the content boundary
 * @sw2d/contracts describes: the runtime never changes, only what feeds it
 * does.
 *
 * `assets`/`ui` have no JSON Schema yet (that is theme/asset-pipeline work
 * reserved for a later phase); `satisfies` below still gives compile-time
 * shape checking against the same contracts types the runtime consumes.
 * `data` documents (currently just `tuning`) are the part Phase 2 gates
 * through @sw2d/schemas at runtime, via the content-document registry -
 * malformed data fails right here, before a ContentBundle is ever produced.
 */
interface RawGameContent {
  readonly id: string;
  readonly schemaVersion: number;
  readonly assets: readonly AssetDescriptor[];
  readonly ui?: Partial<UiCopy>;
}

// A plain JSON import infers widened primitives (role: string, not AssetRole),
// so `satisfies` cannot narrow it the way a TS literal could. This assertion
// is compile-time trust only, not a runtime check - see the file comment
// above on why assets/ui have no schema yet.
const content = rawContent as RawGameContent;

export const starterContent: ContentSource = {
  id: content.id,
  load: async (): Promise<ContentBundle> => {
    const data = validateContentBundleData({ tuning: tuningData });
    return {
      id: content.id,
      schemaVersion: content.schemaVersion,
      assets: content.assets,
      // exactOptionalPropertyTypes: omit the key entirely rather than set it
      // to undefined when content.json has no `ui` override.
      ...(content.ui !== undefined ? { ui: content.ui } : {}),
      data,
    };
  },
};
