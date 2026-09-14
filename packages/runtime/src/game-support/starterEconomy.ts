import { ECONOMY_CAPABILITY_ID, type EconomyService } from '@sw2d/contracts';
import type { SimulationService } from '@sw2d/packs';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.economy` (Category-C Wave 1).
 *
 * Inert unless the game installed the pack. The shell calls this once; all
 * customer / stock / production behaviour lives in the reusable service.
 * Presentation is a high-contrast HUD so a shop/restaurant/tycoon is
 * readable in the first short play session.
 */

export interface StarterEconomySnapshot {
  readonly active: boolean;
  readonly mode: string | null;
  readonly cash: number;
  readonly stock: Readonly<Record<string, number>>;
  readonly queue: readonly { id: string; name: string; goodId: string; remainingMs: number }[];
  readonly served: number;
  readonly lost: number;
  readonly produced: number;
  readonly selectedIndex: number;
  readonly selectedId: string | null;
  readonly producing: { recipeId: string; remainingMs: number } | null;
  readonly lastResult: string | null;
  readonly frontWant: string | null;
  readonly walkers: readonly { id: string; x: number; y: number; phase: string }[];
  readonly payMultiplier: number;
  readonly prestigeLevel: number;
  readonly gold: number;
}

export interface StarterEconomyBinding {
  readonly active: boolean;
  select(delta: number): void;
  serve(): void;
  secondary(): void;
  prestige(): void;
  snapshot(): StarterEconomySnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterEconomyBinding = {
  active: false,
  select: () => undefined,
  serve: () => undefined,
  secondary: () => undefined,
  prestige: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    cash: 0,
    stock: {},
    queue: [],
    served: 0,
    lost: 0,
    produced: 0,
    selectedIndex: 0,
    selectedId: null,
    producing: null,
    lastResult: null,
    frontWant: null,
    walkers: [],
    payMultiplier: 1,
    prestigeLevel: 0,
    gold: 0,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

export function bindStarterEconomy(context: SceneContext, options?: { readonly hud?: boolean }): StarterEconomyBinding {
  if (!context.capabilities.has(ECONOMY_CAPABILITY_ID)) return INERT;
  const economy = context.capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
  const simulation = context.capabilities.has('simulation.resources')
    ? context.capabilities.require<SimulationService>('simulation.resources')
    : null;
  if (simulation) economy.setPayMultiplier(simulation.prestigeMultiplier());
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const layout = economy.layout();
  const fixtures: { destroy(): void }[] = [];
  if (hud && layout) {
    fixtures.push(scene.add.rectangle(layout.counter.x, layout.counter.y, 72, 36, 0x8a93a6, 0.95).setScrollFactor(0).setDepth(18));
    for (const slot of layout.queueSlots) {
      fixtures.push(scene.add.rectangle(slot.x, slot.y, 28, 28, 0x39415a, 0.9).setStrokeStyle(1, 0x8a93a6, 0.8).setScrollFactor(0).setDepth(18));
    }
    for (const seat of layout.seats ?? []) {
      fixtures.push(scene.add.circle(seat.x, seat.y, 14, 0x4f9ee0, 0.85).setScrollFactor(0).setDepth(18));
    }
  }
  const walkerDots: { setPosition(x: number, y: number): unknown; destroy(): void }[] = [];

  const title = hud ? scene.add.text(width * 0.5, 36, '', headingStyle(22)).setOrigin(0.5).setScrollFactor(0) : null;
  const body = hud
    ? scene.add
        .text(width * 0.5, height * 0.42, '', headingStyle(18))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setWordWrapWidth(width - 80)
    : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 36, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0) : null;
  const status = hud ? scene.add.text(width * 0.5, height - 64, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0) : null;

  function selectedId(): string | null {
    if (economy.mode() === 'shop') return economy.goods()[economy.selectedIndex()]?.id ?? null;
    return economy.recipes()[economy.selectedIndex()]?.id ?? null;
  }

  function snapshot(): StarterEconomySnapshot {
    const stock: Record<string, number> = {};
    for (const good of economy.goods()) stock[good.id] = good.stock;
    const producing = economy.producing();
    const front = economy.queue()[0];
    return {
      active: true,
      mode: economy.mode(),
      cash: economy.cash(),
      stock,
      queue: economy.queue().map((c) => ({
        id: c.instanceId,
        name: c.displayName,
        goodId: c.goodId,
        remainingMs: Math.round(c.remainingMs),
      })),
      served: economy.served(),
      lost: economy.lost(),
      produced: economy.produced(),
      selectedIndex: economy.selectedIndex(),
      selectedId: selectedId(),
      producing: producing ? { recipeId: producing.recipeId, remainingMs: Math.round(producing.remainingMs) } : null,
      lastResult: economy.lastResult(),
      frontWant: front?.goodId ?? null,
      walkers: economy.walkers().map((w) => ({ id: w.instanceId, x: w.x, y: w.y, phase: w.phase })),
      payMultiplier: economy.payMultiplier(),
      prestigeLevel: simulation?.prestigeLevel() ?? 0,
      gold: simulation?.resource('gold') ?? 0,
    };
  }

  function render(): void {
    if (!title || !body || !hint || !status) return;
    const modeLabel = economy.mode() === 'shop' ? 'SHOP' : economy.mode() === 'kitchen' ? 'KITCHEN' : 'FACTORY';
    title.setText(modeLabel);

    const stockLine = economy.goods().map((g) => `${g.displayName} x${g.stock}`).join('   ') || 'no goods';
    const front = economy.queue()[0];
    const waiting = front
      ? `${front.displayName} wants ${front.goodId}  (${Math.ceil(front.remainingMs / 1000)}s)`
      : 'no customer yet';
    const queueN = economy.queue().length;

    let selectionLine = '';
    if (economy.mode() === 'shop') {
      const good = economy.goods()[economy.selectedIndex()];
      selectionLine = good ? `> ${good.displayName}  $${good.price}  restock $${good.restockCost ?? 0}` : '> (empty shelf)';
    } else {
      const recipe = economy.recipes()[economy.selectedIndex()];
      const prod = economy.producing();
      const cook = prod ? `cooking ${prod.recipeId} (${Math.ceil(prod.remainingMs / 1000)}s)` : 'idle';
      selectionLine = recipe ? `> ${recipe.displayName}  [${cook}]` : `> (no recipes)  [${cook}]`;
    }

    const walkers = economy.walkers();
    while (walkerDots.length < walkers.length) {
      walkerDots.push(scene.add.circle(0, 0, 10, 0xf0c274, 1).setScrollFactor(0).setDepth(22));
    }
    while (walkerDots.length > walkers.length) walkerDots.pop()?.destroy();
    walkers.forEach((walker, index) => walkerDots[index]?.setPosition(walker.x, walker.y));

    body.setText(
      [
        `cash $${economy.cash()}   served ${economy.served()}   lost ${economy.lost()}   x${economy.payMultiplier()}`,
        stockLine,
        `${waiting}${queueN > 1 ? `  +${queueN - 1} waiting` : ''}`,
        selectionLine,
      ].join('\n\n'),
    );

    const last = economy.lastResult();
    status.setText(last ? `last: ${last}` : '');
    hint.setText(
      economy.mode() === 'shop'
        ? 'ARROWS pick a good   ENTER serves   K restocks   BACKSPACE prestige'
        : economy.mode() === 'kitchen'
          ? 'ARROWS pick a recipe   K cooks   ENTER serves   BACKSPACE prestige'
          : 'ARROWS pick a recipe   K produces   BACKSPACE prestige',
    );
  }

  render();

  let disposed = false;
  return {
    active: true,
    select(delta: number): void {
      economy.selectByDelta(delta);
      render();
    },
    serve(): void {
      economy.serve();
      context.audio.playCue('ui.confirm');
      render();
    },
    secondary(): void {
      economy.secondary();
      context.audio.playCue('ui.confirm');
      render();
    },
    prestige(): void {
      if (!simulation) return;
      const result = simulation.prestige();
      if (result.ok) economy.setPayMultiplier(result.multiplier);
      context.audio.playCue('ui.confirm');
      render();
    },
    snapshot,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        body?.destroy();
        hint?.destroy();
        status?.destroy();
        for (const fixture of fixtures) fixture.destroy();
        for (const dot of walkerDots) dot.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
