import type { AssetDescriptor, ContentBundle, ContentSource, UiCopy } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
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
 * `assets`/`ui` now have a JSON Schema (Phase 6 closes the gap left open
 * since Phase 2/5 - see docs/architecture/PHASE5_ARCHITECTURE_GATE_A.md's
 * schema-boundary finding). `data` documents (`tuning`) are validated through
 * the content-document registry, the same mechanism as before.
 */
interface RawGameContent {
  readonly id: string;
  readonly schemaVersion: number;
}

const content = rawContent as RawGameContent;

export const starterContent: ContentSource = {
  id: content.id,
  load: async (): Promise<ContentBundle> => {
    const assets = validateDocumentOrThrow<readonly AssetDescriptor[]>(
      'content-assets',
      'content/content.json#assets',
      rawContent.assets,
    );
    const ui =
      rawContent.ui !== undefined
        ? validateDocumentOrThrow<Partial<UiCopy>>('ui-copy', 'content/content.json#ui', rawContent.ui)
        : undefined;
    const data = validateContentBundleData({ tuning: tuningData });
    return {
      id: content.id,
      schemaVersion: content.schemaVersion,
      assets,
      // exactOptionalPropertyTypes: omit the key entirely rather than set it
      // to undefined when content.json has no `ui` override.
      ...(ui !== undefined ? { ui } : {}),
      data,
    };
  },
};
