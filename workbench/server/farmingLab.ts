import { existsSync, readFileSync } from 'node:fs';
import type { FarmingDocument } from '@sw2d/contracts';
import { validateFarmingDocument } from '@sw2d/contracts';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import { writeJsonAtomic } from './atomicJson.ts';
import { gameRoot, resolveContained } from './paths.ts';
import { SecurityError } from './security.ts';
function pathFor(gameId: string) { return resolveContained(gameRoot(gameId), 'content', 'farming.json'); }
export function inspectFarming(gameId: string): FarmingDocument { const path = pathFor(gameId); if (!existsSync(path)) throw new SecurityError(404, `No content/farming.json in "${gameId}".`); let raw: unknown; try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new SecurityError(400, 'content/farming.json is not valid JSON.'); } const doc = validateDocumentOrThrow('farming', 'content/farming.json', raw) as FarmingDocument; validateFarmingDocument(doc); return doc; }
export function updateFarming(gameId: string, payload: unknown): { readonly ok: true; readonly document: FarmingDocument } { const doc = validateDocumentOrThrow('farming', 'content/farming.json', payload) as FarmingDocument; try { validateFarmingDocument(doc); } catch (error) { throw new SecurityError(400, error instanceof Error ? error.message : String(error)); } writeJsonAtomic(pathFor(gameId), doc); return { ok: true, document: doc }; }
