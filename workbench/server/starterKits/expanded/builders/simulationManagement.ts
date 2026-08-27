import { defineExpandedKit } from './common.ts';
import { withDefaultThemeRoles } from './themeRoles.ts';

export type SimulationStarterVariant =
  | 'shopkeeper'
  | 'tycoon-lite'
  | 'farming-lite'
  | 'pet-creature'
  | 'colony-lite'
  | 'restaurant'
  | 'aquarium-terrarium';

function shellSource(variant: SimulationStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;

interface Order { id: number; remainingMs: number; ready: boolean; }
interface Plot { state: 'empty' | 'growing' | 'mature'; growthMs: number; }

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-simulation-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const panel = scene.add.image(width * 0.5, 350, context.assets.resolve('ui.panel')).setDisplaySize(860, 130).setAlpha(0.92).setDepth(1);
    const button = scene.add.image(width * 0.5, 505, context.assets.resolve('ui.button')).setDisplaySize(142, 48).setDepth(1);
    const mascot = scene.add.sprite(width * 0.5, 185, context.assets.resolve('player')).setDisplaySize(96, 96);
    const resourceIcon = scene.add.sprite(width * 0.5 - 110, 185, context.assets.resolve('pickup')).setDisplaySize(34, 34);
    const status = scene.add.text(width * 0.5, 290, '', { fontFamily: 'ui-monospace, monospace', fontSize: '18px', color: '#ffffff', align: 'center', wordWrap: { width: 820 } }).setOrigin(0.5, 0).setDepth(50);
    const hint = scene.add.text(width * 0.5, 455, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#9fd7ff', align: 'center', wordWrap: { width: 820 } }).setOrigin(0.5).setDepth(50);

    let elapsedMs = 0;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let lastAction = 'spawn';

    let currency = VARIANT === 'tycoon-lite' ? 22 : 14;
    let stock = 1;
    let sellValue = 6;
    let sales = 0;
    let customerMs = 0;
    let upgradeA = 0;
    let upgradeB = 0;
    let incomeRate = 1;
    let businessValue = 0;

    const plots: Plot[] = [{ state: 'empty', growthMs: 0 }, { state: 'empty', growthMs: 0 }, { state: 'empty', growthMs: 0 }];
    let selectedPlot = 0;
    let harvested = 0;

    let hunger = 72;
    let mood = 72;
    let wellbeingHoldMs = 0;
    let careActions = 0;

    let wood = 0;
    let stone = 0;
    let woodWorkers = 1;
    let stoneWorkers = 1;
    let selectedJob = 0;
    let constructionComplete = false;

    const orders: Order[] = [];
    let nextOrderId = 1;
    let revenue = 0;
    let served = 0;

    let water = 78;
    let food = 78;
    let habitatHealthyMs = 0;

    function clampNeeds(): void { hunger = Phaser.Math.Clamp(hunger, 0, 100); mood = Phaser.Math.Clamp(mood, 0, 100); water = Phaser.Math.Clamp(water, 0, 100); food = Phaser.Math.Clamp(food, 0, 100); }

    function updateShop(deltaMs: number, primary: boolean, secondary: boolean): void {
      customerMs += deltaMs;
      if (customerMs >= 1500) {
        customerMs -= 1500;
        if (stock > 0) { stock -= 1; currency += sellValue; sales += 1; lastAction = 'sale'; }
      }
      if (primary && currency >= 2) { currency -= 2; stock += 1; lastAction = 'restock'; }
      if (secondary && currency >= 16) { currency -= 16; sellValue += 2; upgradeA += 1; lastAction = 'upgrade'; }
      if (sales >= 4 && upgradeA >= 1 && currency >= 18) outcome = 'complete';
    }

    function updateTycoon(deltaMs: number, primary: boolean, secondary: boolean): void {
      currency += incomeRate * deltaMs / 1000;
      businessValue = currency + upgradeA * 18 + upgradeB * 28;
      if (primary) {
        const cost = 10 + upgradeA * 8;
        if (currency >= cost) { currency -= cost; upgradeA += 1; incomeRate += 1.2; lastAction = 'upgrade-a'; }
      }
      if (secondary) {
        const cost = 18 + upgradeB * 12;
        if (currency >= cost) { currency -= cost; upgradeB += 1; incomeRate += 2.8; lastAction = 'upgrade-b'; }
      }
      if (upgradeA >= 1 && upgradeB >= 1 && businessValue >= 70) outcome = 'complete';
    }

    function updateFarming(deltaMs: number, navLeft: boolean, navRight: boolean, confirm: boolean, primary: boolean): void {
      if (navLeft) selectedPlot = Math.max(0, selectedPlot - 1);
      if (navRight) selectedPlot = Math.min(plots.length - 1, selectedPlot + 1);
      if (confirm && plots[selectedPlot]!.state === 'empty') { plots[selectedPlot] = { state: 'growing', growthMs: 0 }; lastAction = 'plant'; }
      for (const plot of plots) if (plot.state === 'growing') { plot.growthMs += deltaMs; if (plot.growthMs >= 2200) plot.state = 'mature'; }
      if (primary && plots[selectedPlot]!.state === 'mature') { plots[selectedPlot] = { state: 'empty', growthMs: 0 }; harvested += 1; currency += 5; lastAction = 'harvest'; }
      if (harvested >= 3) outcome = 'complete';
    }

    function updatePet(deltaMs: number, primary: boolean, secondary: boolean): void {
      hunger -= deltaMs * 0.0028; mood -= deltaMs * 0.0022;
      if (primary) { hunger += 22; careActions += 1; lastAction = 'feed'; }
      if (secondary) { mood += 24; careActions += 1; lastAction = 'play'; }
      clampNeeds();
      if (hunger >= 82 && mood >= 82) wellbeingHoldMs += deltaMs; else wellbeingHoldMs = 0;
      if (wellbeingHoldMs >= 1600 && careActions >= 2) outcome = 'complete';
      if (hunger <= 0 || mood <= 0) outcome = 'failed';
    }

    function updateColony(deltaMs: number, navLeft: boolean, navRight: boolean, confirm: boolean, primary: boolean): void {
      if (navLeft) selectedJob = 0; if (navRight) selectedJob = 1;
      if (confirm) {
        if (selectedJob === 0 && stoneWorkers > 0) { stoneWorkers -= 1; woodWorkers += 1; lastAction = 'assign-wood'; }
        else if (selectedJob === 1 && woodWorkers > 0) { woodWorkers -= 1; stoneWorkers += 1; lastAction = 'assign-stone'; }
      }
      wood += woodWorkers * deltaMs * 0.0008; stone += stoneWorkers * deltaMs * 0.0007;
      if (primary && wood >= 5 && stone >= 5) { wood -= 5; stone -= 5; constructionComplete = true; lastAction = 'build'; outcome = 'complete'; }
    }

    function updateRestaurant(deltaMs: number, primary: boolean, confirm: boolean): void {
      if (primary && orders.length < 3) { orders.push({ id: nextOrderId++, remainingMs: 1800, ready: false }); lastAction = 'queue-order'; }
      for (const order of orders) if (!order.ready) { order.remainingMs -= deltaMs; if (order.remainingMs <= 0) { order.ready = true; order.remainingMs = 0; } }
      if (confirm) {
        const index = orders.findIndex((order) => order.ready);
        if (index >= 0) { orders.splice(index, 1); revenue += 10; served += 1; lastAction = 'serve'; }
      }
      if (revenue >= 30 && served >= 3) outcome = 'complete';
    }

    function updateHabitat(deltaMs: number, primary: boolean, secondary: boolean): void {
      water -= deltaMs * 0.003; food -= deltaMs * 0.0035;
      if (primary) { food += 24; careActions += 1; lastAction = 'feed-habitat'; }
      if (secondary) { water += 24; careActions += 1; lastAction = 'refresh-water'; }
      clampNeeds();
      if (water >= 55 && food >= 55) habitatHealthyMs += deltaMs; else habitatHealthyMs = 0;
      if (habitatHealthyMs >= 7000 && careActions >= 2) outcome = 'complete';
      if (water <= 10 || food <= 10) outcome = 'failed';
    }

    function render(): void {
      if (VARIANT === 'shopkeeper') status.setText('Stock ' + stock + ' · currency ' + Math.floor(currency) + ' · sale value ' + sellValue + ' · sales ' + sales);
      else if (VARIANT === 'tycoon-lite') status.setText('Cash ' + Math.floor(currency) + ' · income ' + incomeRate.toFixed(1) + '/s · A ' + upgradeA + ' · B ' + upgradeB + ' · value ' + Math.floor(businessValue));
      else if (VARIANT === 'farming-lite') status.setText('Plots ' + plots.map((plot, index) => (index === selectedPlot ? '[' + plot.state + ']' : plot.state)).join(' · ') + ' · harvested ' + harvested);
      else if (VARIANT === 'pet-creature') status.setText('Hunger ' + Math.round(hunger) + ' · mood ' + Math.round(mood) + ' · care ' + careActions);
      else if (VARIANT === 'colony-lite') status.setText('Wood ' + wood.toFixed(1) + ' (' + woodWorkers + ' workers) · Stone ' + stone.toFixed(1) + ' (' + stoneWorkers + ' workers)');
      else if (VARIANT === 'restaurant') status.setText('Orders ' + orders.map((order) => order.ready ? 'READY' : Math.ceil(order.remainingMs / 100) / 10 + 's').join(' · ') + ' · revenue ' + revenue);
      else status.setText('Water ' + Math.round(water) + ' · food ' + Math.round(food) + ' · healthy ' + Math.floor(habitatHealthyMs / 1000) + 's');
      hint.setText('PRIMARY action · SECONDARY action · arrows/CONFIRM select' + (outcome !== 'playing' ? ' · ' + outcome.toUpperCase() : ''));
      resourceIcon.setRotation(elapsedMs / 1000 * 0.25);
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT, family: 'simulation-management', playerTextureKey: mascot.texture.key, backgroundTextureKey: background ? background.texture.key : null,
      pickupTextureKey: resourceIcon.texture.key, panelRoleSource: 'ui.panel', panelTextureKey: panel.texture.key,
      buttonRoleSource: 'ui.button', buttonTextureKey: button.texture.key,
      elapsedMs: Math.round(elapsedMs), outcome, lastAction, currency: Math.floor(currency * 100) / 100, stock, sellValue, sales, upgradeA, upgradeB, incomeRate, businessValue,
      plots, selectedPlot, harvested, hunger, mood, wellbeingHoldMs, careActions, wood, stone, woodWorkers, stoneWorkers, selectedJob, constructionComplete,
      orders, revenue, served, water, food, habitatHealthyMs,
    }));

    let disposed = false;
    render();
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return;
        elapsedMs += deltaMs;
        const intent = uiSimulationController.read(context.input);
        const primary = intent.primaryPressed;
        const secondary = context.input.justPressed('SECONDARY_ACTION');
        if (VARIANT === 'shopkeeper') updateShop(deltaMs, primary, secondary);
        else if (VARIANT === 'tycoon-lite') updateTycoon(deltaMs, primary, secondary);
        else if (VARIANT === 'farming-lite') updateFarming(deltaMs, intent.navigateLeftPressed, intent.navigateRightPressed, intent.confirmPressed, primary);
        else if (VARIANT === 'pet-creature') updatePet(deltaMs, primary, secondary);
        else if (VARIANT === 'colony-lite') updateColony(deltaMs, intent.navigateLeftPressed, intent.navigateRightPressed, intent.confirmPressed, primary);
        else if (VARIANT === 'restaurant') updateRestaurant(deltaMs, primary, intent.confirmPressed);
        else updateHabitat(deltaMs, primary, secondary);
        render();
      },
      dispose(): void { if (disposed) return; disposed = true; debugHandle.dispose(); try { background?.destroy(); panel.destroy(); button.destroy(); mascot.destroy(); resourceIcon.destroy(); status.destroy(); hint.destroy(); } catch { /* scene teardown */ } },
    };
  },
};
`;
}

export function simulationStarterKit(variant: SimulationStarterVariant) {
  return withDefaultThemeRoles(defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-simulation-starter',
    shellSource: shellSource(variant),
    level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Display', x: 480, y: 185, width: 0, height: 0, properties: [] }] },
    tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
  }), ['background', 'ui.panel', 'ui.button']);
}
