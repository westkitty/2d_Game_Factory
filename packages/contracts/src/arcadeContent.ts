export interface MicrogameRoundDef {
  readonly id: string;
  readonly kind: 'react' | 'mash' | 'hold' | 'alternate';
  readonly countdownMs: number;
  readonly durationMs: number;
  readonly target: number;
  readonly score: number;
}
export interface MicrogameCatalog {
  readonly schemaVersion: number;
  readonly order: 'fixed' | 'rotate';
  readonly rounds: readonly MicrogameRoundDef[];
}

export interface FishingCatalog {
  readonly schemaVersion: number;
  readonly castMs: number;
  readonly biteMs: number;
  readonly hookMs: number;
  readonly tensionMin: number;
  readonly tensionMax: number;
  readonly reelTarget: number;
  readonly catchTarget: number;
  readonly fish: readonly { readonly id: string; readonly name: string; readonly score: number; readonly pull: number }[];
}

export interface CookingCatalog {
  readonly schemaVersion: number;
  readonly ingredients: readonly { readonly id: string; readonly label: string }[];
  readonly recipes: readonly {
    readonly id: string;
    readonly dish: string;
    readonly score: number;
    readonly actions: readonly { readonly ingredientId: string; readonly action: string; readonly maxDelayMs: number }[];
  }[];
}
