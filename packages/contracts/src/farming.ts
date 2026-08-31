/** Post-ten Phase 23: deterministic plots, crops and simulation calendar. */
export const FARMING_CAPABILITY_ID = 'simulation.farming';
export const FARMING_TIME_UNIT = 'day' as const;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type PlotPhase = 'empty' | 'tilled' | 'planted' | 'growing' | 'harvestable';

export interface CropStage { readonly id: string; readonly durationDays: number; readonly assetRole?: string; }
export interface HarvestOutput { readonly itemId: string; readonly quantity: number; }
export interface CropDefinition { readonly id: string; readonly displayName: string; readonly seedItemId: string; readonly growthStages: readonly CropStage[]; readonly validSeasons: readonly Season[]; readonly requiresWater: boolean; readonly harvestItems: readonly HarvestOutput[]; readonly regrowStage?: number; }
export interface FarmingDocument { readonly schemaVersion: 1; readonly daysPerSeason: number; readonly plots: readonly string[]; readonly crops: readonly CropDefinition[]; }
export interface FarmingCalendar { readonly day: number; readonly season: Season; readonly dayInSeason: number; }
export interface FarmingPlot { readonly id: string; readonly phase: PlotPhase; readonly cropId: string | null; readonly stageIndex: number; readonly progressDays: number; readonly watered: boolean; }
export type FarmingActionResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'unknown-plot' | 'wrong-phase' | 'unknown-crop' | 'invalid-season' | 'missing-seed' | 'not-ready' };

export interface FarmingService { calendar(): FarmingCalendar; plots(): readonly FarmingPlot[]; till(plotId: string): FarmingActionResult; plant(plotId: string, cropId: string): FarmingActionResult; water(plotId: string): FarmingActionResult; harvest(plotId: string): FarmingActionResult; clear(plotId: string): FarmingActionResult; advanceDays(days: number): void; }

export class InvalidFarmingDocumentError extends Error { constructor(message: string) { super(message); this.name = 'InvalidFarmingDocumentError'; } }
export function validateFarmingDocument(document: FarmingDocument): void {
  if (!Number.isInteger(document.daysPerSeason) || document.daysPerSeason <= 0) throw new InvalidFarmingDocumentError('daysPerSeason must be a positive integer.');
  const plots = new Set<string>(); for (const id of document.plots) { if (!id || plots.has(id)) throw new InvalidFarmingDocumentError(`Duplicate or empty plot id "${id}".`); plots.add(id); }
  const crops = new Set<string>(); for (const crop of document.crops) { if (!crop.id || crops.has(crop.id) || !crop.seedItemId || crop.growthStages.length === 0 || crop.harvestItems.length === 0 || crop.validSeasons.length === 0) throw new InvalidFarmingDocumentError(`Crop "${crop.id}" is incomplete or duplicate.`); crops.add(crop.id); for (const stage of crop.growthStages) if (!stage.id || !(stage.durationDays > 0)) throw new InvalidFarmingDocumentError(`Crop "${crop.id}" has an invalid stage.`); if (crop.regrowStage !== undefined && (!Number.isInteger(crop.regrowStage) || crop.regrowStage < 0 || crop.regrowStage >= crop.growthStages.length)) throw new InvalidFarmingDocumentError(`Crop "${crop.id}" has invalid regrowStage.`); }
}
